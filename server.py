"""
HealthGuard AI - Flask Backend Server
Provides REST API endpoints for medical scan analysis.
"""

import os
import uuid
import json
import shutil
import zipfile
import tarfile
import tempfile
import threading
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from PIL import Image
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge

from backend.scan_classifier import classify_scan_type
from backend.analyzer import MedicalImageAnalyzer, MEDICAL_FINDINGS
from backend.report_generator import generate_report

# ---------- Configuration ----------
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
RESULTS_FOLDER = os.path.join(os.path.dirname(__file__), "results")
REPORTS_FOLDER = os.path.join(os.path.dirname(__file__), "reports")
FEEDBACK_FOLDER = os.path.join(os.path.dirname(__file__), "feedback")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff", "tif", "dcm", "webp"}
DATASET_EXTENSIONS = {"zip", "tar", "gz", "tgz", "tar.gz", "7z", "rar"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)
os.makedirs(REPORTS_FOLDER, exist_ok=True)
os.makedirs(FEEDBACK_FOLDER, exist_ok=True)

# ---------- Flask App ----------
app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024  # 16 GB max upload size
app.config['MAX_FORM_PARTS'] = 50000  # Allow up to 50,000 files in a single folder upload (default is 1000!)
app.config['MAX_FORM_MEMORY_SIZE'] = 500 * 1024 * 1024  # 500 MB for in-memory form data


# ---------- JSON Error Handlers ----------
# Ensures Flask ALWAYS returns JSON, never HTML error pages
@app.errorhandler(413)
@app.errorhandler(RequestEntityTooLarge)
def handle_request_too_large(e):
    return jsonify({"error": f"Upload rejected: {str(e)}. Try a smaller dataset or use a ZIP archive instead."}), 413


@app.errorhandler(404)
def handle_not_found(e):
    # Only return JSON for API routes; let static files fall through
    if request.path.startswith('/api/'):
        return jsonify({"error": f"Endpoint not found: {request.path}"}), 404
    return send_from_directory("frontend", "index.html")


@app.errorhandler(500)
def handle_server_error(e):
    return jsonify({"error": f"Internal server error: {str(e)}"}), 500

# ---------- Load ML Model ----------
print("[HealthGuard AI] Loading ML models...")
analyzer = MedicalImageAnalyzer()
print("[HealthGuard AI] Models loaded and ready!")

# ---------- Session storage for re-analysis ----------
session_store = {}

# ---------- Training state management ----------
training_state = {
    "is_training": False,
    "progress": 0,
    "message": "",
    "result": None,
    "cancel": False,  # Flag to cancel an in-progress training
}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/")
def serve_frontend():
    return send_from_directory("frontend", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("frontend", path)


@app.route("/api/health", methods=["GET"])
def health_check():
    stats = analyzer.get_feedback_stats()
    return jsonify({
        "status": "healthy",
        "model": "HealthGuard DenseNet-121",
        "version": "1.0.0",
        "device": str(analyzer.device),
        "feedback_stats": stats,
    })


@app.route("/api/findings", methods=["GET"])
def get_findings():
    """Return the list of known medical findings for feedback dropdown."""
    return jsonify({
        "findings": analyzer.findings_list,
        "custom_findings": analyzer.custom_findings,
    })


@app.route("/api/analyze", methods=["POST"])
def analyze_scan():
    """
    Analyze an uploaded medical scan image.
    Expects multipart form data with an 'image' file.
    Returns JSON with scan type classification, findings, and image paths.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({
            "error": "Invalid file. Supported formats: " + ", ".join(ALLOWED_EXTENSIONS)
        }), 400

    try:
        # Generate unique session ID
        session_id = str(uuid.uuid4())[:12]
        original_filename = secure_filename(file.filename)

        # Save uploaded file
        upload_path = os.path.join(UPLOAD_FOLDER, f"{session_id}_{original_filename}")
        file.save(upload_path)

        # Open image
        image = Image.open(upload_path)

        # Step 1: Classify scan type
        scan_type_result = classify_scan_type(image)

        # Step 2: Analyze with ML model + generate heatmap
        results_dir = os.path.join(RESULTS_FOLDER, session_id)
        os.makedirs(results_dir, exist_ok=True)

        analysis_result = analyzer.analyze(image, results_dir)

        # Step 3: Generate PDF report
        report_filename = generate_report(
            scan_type_result=scan_type_result,
            analysis_result=analysis_result,
            original_filename=original_filename,
            output_dir=REPORTS_FOLDER,
            images_dir=results_dir,
        )

        # Store session for re-analysis
        session_store[session_id] = {
            "upload_path": upload_path,
            "original_filename": original_filename,
            "scan_type_result": scan_type_result,
        }

        # Build response
        response = {
            "session_id": session_id,
            "scan_type": scan_type_result,
            "analysis": {
                "findings": analysis_result["findings"],
                "overall_severity": analysis_result["overall_severity"],
                "primary_finding": analysis_result["primary_finding"],
                "description": analysis_result["findings"][0].get("description", ""),
                "model_info": analysis_result["model_info"],
            },
            "images": {
                "heatmap": f"/api/results/{session_id}/{analysis_result['heatmap_path']}",
                "annotated": f"/api/results/{session_id}/{analysis_result['annotated_path']}",
            },
            "report": {
                "filename": report_filename,
                "download_url": f"/api/report/{report_filename}",
            },
        }

        return jsonify(response), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    """
    Submit feedback to fine-tune the model via reinforcement learning.
    Expects JSON body with:
      - session_id: str
      - correct_finding: str (from known findings or '__other__')
      - custom_finding: str (text if correct_finding is '__other__')
      - severity_correction: str (low/medium/high)
      - notes: str
      - description: str
      - rating: int (1-5)
      - scan_type: str
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        session_id = data.get("session_id", "")
        if session_id not in session_store:
            return jsonify({"error": "Session not found. Please re-upload the scan."}), 404

        # Load the original image
        session_data = session_store[session_id]
        image = Image.open(session_data["upload_path"])

        # Apply feedback to the model (reinforcement learning)
        feedback = {
            "correct_finding": data.get("correct_finding", ""),
            "custom_finding": data.get("custom_finding", ""),
            "severity_correction": data.get("severity_correction", ""),
            "notes": data.get("notes", ""),
            "description": data.get("description", ""),
            "rating": data.get("rating", 3),
            "scan_type": data.get("scan_type", session_data.get("scan_type_result", {}).get("scan_type", "Unknown")),
        }

        result = analyzer.apply_feedback(image, feedback)

        # Save feedback to file for persistence
        feedback_file = os.path.join(
            FEEDBACK_FOLDER,
            f"feedback_{session_id}_{result['feedback_id']}.json"
        )
        with open(feedback_file, "w") as f:
            json.dump({
                "session_id": session_id,
                "feedback": feedback,
                "result": result,
                "original_filename": session_data["original_filename"],
            }, f, indent=2)

        return jsonify(result), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Feedback processing failed: {str(e)}"}), 500


@app.route("/api/reanalyze", methods=["POST"])
def reanalyze_scan():
    """
    Re-analyze a previously uploaded scan with the updated model.
    Expects JSON body with:
      - session_id: str
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        session_id = data.get("session_id", "")
        if session_id not in session_store:
            return jsonify({"error": "Session not found. Please re-upload the scan."}), 404

        session_data = session_store[session_id]
        image = Image.open(session_data["upload_path"])
        original_filename = session_data["original_filename"]
        scan_type_result = session_data["scan_type_result"]

        # Create new results directory for re-analysis
        new_session_id = f"{session_id}_r{uuid.uuid4().hex[:4]}"
        results_dir = os.path.join(RESULTS_FOLDER, new_session_id)
        os.makedirs(results_dir, exist_ok=True)

        # Re-analyze with updated model
        analysis_result = analyzer.analyze(image, results_dir)

        # Generate new PDF report
        report_filename = generate_report(
            scan_type_result=scan_type_result,
            analysis_result=analysis_result,
            original_filename=original_filename,
            output_dir=REPORTS_FOLDER,
            images_dir=results_dir,
        )

        # Update session store
        session_store[new_session_id] = session_store[session_id].copy()

        # Build response
        response = {
            "session_id": new_session_id,
            "scan_type": scan_type_result,
            "analysis": {
                "findings": analysis_result["findings"],
                "overall_severity": analysis_result["overall_severity"],
                "primary_finding": analysis_result["primary_finding"],
                "description": analysis_result["findings"][0].get("description", ""),
                "model_info": analysis_result["model_info"],
            },
            "images": {
                "heatmap": f"/api/results/{new_session_id}/{analysis_result['heatmap_path']}",
                "annotated": f"/api/results/{new_session_id}/{analysis_result['annotated_path']}",
            },
            "report": {
                "filename": report_filename,
                "download_url": f"/api/report/{report_filename}",
            },
            "is_reanalysis": True,
            "feedback_stats": analyzer.get_feedback_stats(),
        }

        return jsonify(response), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Re-analysis failed: {str(e)}"}), 500


@app.route("/api/feedback/stats", methods=["GET"])
def feedback_stats():
    """Get feedback and training statistics."""
    stats = analyzer.get_feedback_stats()
    stats["is_training"] = training_state["is_training"]
    stats["training_progress"] = training_state["progress"]
    stats["training_message"] = training_state["message"]
    return jsonify(stats)


@app.route("/api/train", methods=["POST"])
def train_on_dataset():
    """
    Upload a dataset (folder, zip, tar.gz, or images) and train the AI model.
    Supports two upload modes:
      - Folder upload: 'dataset_files' (multiple files with relative paths)
      - Archive/file upload: 'dataset' (single zip/tar/image)
    Also expects form data:
      - description: str
      - finding_label: str (optional - label to assign)
      - epochs: int (default 3)
      - is_folder: "true" or "false"
    """
    # If a training session is already running, cancel it and wait for it to stop
    if training_state["is_training"]:
        print("[HealthGuard AI] Cancelling previous training session...")
        training_state["cancel"] = True
        import time as _time
        for _ in range(20):  # Wait up to 10 seconds for it to stop
            _time.sleep(0.5)
            if not training_state["is_training"]:
                break
        training_state["cancel"] = False

    is_folder = request.form.get("is_folder", "false") == "true"
    description = request.form.get("description", "")
    finding_label = request.form.get("finding_label", "")
    epochs = int(request.form.get("epochs", 3))
    epochs = min(max(epochs, 1), 20)  # Clamp between 1 and 20

    # Get temp location preference (default: system)
    temp_location = request.form.get("temp_location", "system")
    
    if temp_location == "project":
        # Use a local 'temp_datasets' folder in the project directory
        # This helps avoid MAX_PATH issues on Windows vs deep AppData paths
        project_temp_root = os.path.join(os.getcwd(), "temp_datasets")
        os.makedirs(project_temp_root, exist_ok=True)
        dataset_dir = tempfile.mkdtemp(prefix="hg_dataset_", dir=project_temp_root)
        print(f"[HealthGuard AI] Using PROJECT temp directory: {dataset_dir}")
    else:
        # Use system temp directory (default)
        dataset_dir = tempfile.mkdtemp(prefix="hg_dataset_")
        print(f"[HealthGuard AI] Using SYSTEM temp directory: {dataset_dir}")

    extract_dir = os.path.join(dataset_dir, "extracted")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        if is_folder:
            # ─── Folder Upload: multiple files with relative paths ───
            folder_files = request.files.getlist("dataset_files")
            if not folder_files:
                return jsonify({"error": "No files received from folder upload."}), 400

            saved_count = 0
            for f in folder_files:
                # Use the original relative path to recreate folder structure
                relative_path = f.filename  # This contains the relative path
                if not relative_path:
                    continue

                # Sanitize path components but preserve directory structure
                parts = relative_path.replace("\\", "/").split("/")
                # Remove the root folder name (first part) - keep subfolders
                if len(parts) > 1:
                    clean_parts = parts[1:]  # Skip root folder name
                else:
                    clean_parts = parts

                # Sanitize each part
                clean_parts = [secure_filename(p) for p in clean_parts if p]
                if not clean_parts:
                    continue

                # Create subdirectories if needed
                if len(clean_parts) > 1:
                    sub_dir = os.path.join(extract_dir, *clean_parts[:-1])
                    os.makedirs(sub_dir, exist_ok=True)

                dest_path = os.path.join(extract_dir, *clean_parts)
                f.save(dest_path)
                saved_count += 1

            print(f"[HealthGuard AI] Folder upload: saved {saved_count} files to {extract_dir}")

            if saved_count == 0:
                return jsonify({"error": "No valid image files found in the uploaded folder."}), 400

        else:
            # ─── Archive / Single File Upload ───
            if "dataset" not in request.files:
                return jsonify({"error": "No dataset file provided"}), 400

            file = request.files["dataset"]
            if file.filename == "":
                return jsonify({"error": "No file selected"}), 400

            original_filename = secure_filename(file.filename)
            save_path = os.path.join(dataset_dir, original_filename)
            file.save(save_path)

            # Extract archive if needed
            if zipfile.is_zipfile(save_path):
                with zipfile.ZipFile(save_path, 'r') as zf:
                    zf.extractall(extract_dir)
                print(f"[HealthGuard AI] Extracted ZIP: {original_filename}")
            elif tarfile.is_tarfile(save_path):
                with tarfile.open(save_path, 'r:*') as tf:
                    tf.extractall(extract_dir)
                print(f"[HealthGuard AI] Extracted TAR: {original_filename}")
            else:
                # Not an archive — treat as a single image
                ext = os.path.splitext(original_filename)[1].lower()
                if ext in ('.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.dcm'):
                    shutil.copy2(save_path, os.path.join(extract_dir, original_filename))
                else:
                    return jsonify({"error": f"Unsupported file format: {ext}. Please upload a ZIP, TAR, or image file."}), 400

            # Handle multiple files uploaded via standard file input
            files = request.files.getlist("dataset")
            if len(files) > 1:
                for f in files[1:]:
                    fname = secure_filename(f.filename)
                    f.save(os.path.join(extract_dir, fname))

        # Find the actual image directory (sometimes Kaggle zips have a single subfolder)
        actual_dir = extract_dir
        items = os.listdir(extract_dir)
        if len(items) == 1 and os.path.isdir(os.path.join(extract_dir, items[0])):
            actual_dir = os.path.join(extract_dir, items[0])

        # Track training progress
        def progress_callback(pct, msg):
            training_state["progress"] = pct
            training_state["message"] = msg

        training_state["is_training"] = True
        training_state["progress"] = 0
        training_state["message"] = "Preparing dataset..."
        training_state["result"] = None
        training_state["cancel"] = False

        # Run training (passes training_state as cancel_flag for cancellation support)
        result = analyzer.train_on_dataset(
            dataset_dir=actual_dir,
            description=description,
            finding_label=finding_label,
            epochs=epochs,
            progress_callback=progress_callback,
            cancel_flag=training_state,
        )

        training_state["is_training"] = False
        training_state["progress"] = 100
        training_state["message"] = "Training complete!"
        training_state["result"] = result

        return jsonify(result), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        training_state["is_training"] = False
        training_state["progress"] = 0
        training_state["message"] = f"Training failed: {str(e)}"
        return jsonify({"error": f"Training failed: {str(e)}"}), 500

    finally:
        # CLEANUP: Delete the temp directory and all uploaded files
        try:
            if 'dataset_dir' in locals() and os.path.exists(dataset_dir):
                shutil.rmtree(dataset_dir)
                print(f"[HealthGuard AI] 🚮 CLEANUP: Deleted temporary training folder")
                print(f"                 Path: {dataset_dir}")
        except Exception as cleanup_error:
            print(f"[HealthGuard AI] Warning: Could not delete temp dir {dataset_dir}: {cleanup_error}")


@app.route("/api/train/status", methods=["GET"])
def training_status():
    """Get current training status."""
    return jsonify({
        "is_training": training_state["is_training"],
        "progress": training_state["progress"],
        "message": training_state["message"],
        "result": training_state["result"],
    })


@app.route("/api/results/<session_id>/<filename>", methods=["GET"])
def serve_result_image(session_id, filename):
    """Serve a result image (heatmap or annotated)."""
    results_dir = os.path.join(RESULTS_FOLDER, session_id)
    return send_from_directory(results_dir, filename)


@app.route("/api/report/<filename>", methods=["GET"])
def download_report(filename):
    """Download a generated PDF report."""
    return send_from_directory(
        REPORTS_FOLDER,
        filename,
        as_attachment=True,
        mimetype="application/pdf",
    )


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  HealthGuard AI - Medical Scan Analysis Engine")
    print("  Starting on http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=True)

