"""
HealthGuard AI - Flask Backend Server
Provides REST API endpoints for medical scan analysis.
"""

import os
from dotenv import load_dotenv
load_dotenv()
import uuid
import json
import shutil
import zipfile
import tarfile
import tempfile
import threading
import io
import requests
import base64
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from PIL import Image
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge

from backend.scan_classifier import classify_scan_type
from backend.analyzer import MedicalImageAnalyzer, MEDICAL_FINDINGS
from backend.report_generator import generate_report, compress_pdf

# ---------- Configuration ----------
import tempfile
RESULTS_FOLDER = os.path.join(tempfile.gettempdir(), "HealthGuard_results")
REPORTS_FOLDER = os.path.join(tempfile.gettempdir(), "HealthGuard_reports")
FEEDBACK_FOLDER = os.path.join(os.path.dirname(__file__), "feedback")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff", "tif", "dcm", "webp"}
DATASET_EXTENSIONS = {"zip", "tar", "gz", "tgz", "tar.gz", "7z", "rar"}

# Supabase Credentials
SUPABASE_URL = os.getenv("project_url")
SUPABASE_KEY = os.getenv("anon_key")

supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client, Client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[HealthGuard AI] ✅ Supabase Python client initialized")
    except Exception as e:
        print(f"[HealthGuard AI] ⚠️ Failed to initialize Supabase client: {e}")

def _save_to_supabase(data_dict, image_bytes, user_id=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[HealthGuard AI] ⚠️ Supabase credentials missing locally.")
        return
    try:
        payload = dict(data_dict)
        if user_id:
            payload["user_id"] = user_id
        if image_bytes:
            payload["scan_image_base64"] = base64.b64encode(image_bytes).decode('utf-8')
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        resp = requests.post(f"{SUPABASE_URL}/rest/v1/scan_results", json=payload, headers=headers, timeout=10)
        if resp.status_code in [200, 201]:
            print("[HealthGuard AI] ✅ Successfully pushed results and image to Supabase!")
        else:
            print(f"[HealthGuard AI] ❌ Failed to push to Supabase: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"[HealthGuard AI] ❌ Error pushing to Supabase: {str(e)}")
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
def serve_root():
    # Redirect root to login page as the default landing
    return send_from_directory("frontend", "login.html")

@app.route("/analyze")
def serve_analyze():
    return send_from_directory("frontend", "index.html")

@app.route("/features")
def serve_features():
    return send_from_directory("frontend", "features.html")

@app.route("/insurance")
def serve_insurance():
    return send_from_directory("frontend", "insurance.html")

@app.route("/about")
def serve_about():
    return send_from_directory("frontend", "about.html")

@app.route("/about-patient")
def serve_about_patient():
    return send_from_directory("frontend", "about_patient.html")

@app.route("/about-doctor")
def serve_about_doctor():
    return send_from_directory("frontend", "about_doctor.html")

@app.route("/chatbot")
@app.route("/chatbot/")
def serve_chatbot_index():
    return send_from_directory("frontend", "chatbot.html")

@app.route("/login")
@app.route("/login/")
def serve_login():
    return send_from_directory("frontend", "login.html")

@app.route("/admin")
@app.route("/admin/")
def serve_admin():
    return send_from_directory("frontend", "admin.html")


@app.route("/advocate")
@app.route("/advocate/")
def serve_advocate():
    return send_from_directory("frontend", "advocate.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("frontend", path)


@app.route("/api/config", methods=["GET"])
def get_config():
    """Exposes public/safe configuration variables to the frontend JS."""
    return jsonify({
        "supabase_url": SUPABASE_URL or os.getenv("SUPABASE_URL", ""),
        "supabase_anon_key": SUPABASE_KEY or os.getenv("SUPABASE_ANON_KEY", ""),
        "groq_api_key": os.getenv("GROQ_API_KEY", ""),
        "groq_insurance_key": os.getenv("groq_insurance", os.getenv("GROQ_INSURANCE_KEY", ""))
    })


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

        # Read image to memory directly
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        upload_path = None # Deprecated parameter for legacy dict compat

        # Step 1: Classify scan type
        scan_type_result = classify_scan_type(image)

        # Step 2: Analyze with ML model + generate heatmap
        # Step 2: Analyze with ML model
        results_dir = os.path.join(RESULTS_FOLDER, session_id)
        os.makedirs(results_dir, exist_ok=True)

        # Get metadata from form
        patient_name = request.form.get("patient_name", "")
        scan_type_input = request.form.get("scan_type", "")
        body_part = request.form.get("body_part", "")
        patient_description = request.form.get("patient_description", "")
        user_id = request.form.get("user_id", "")
        
        # Check for pre-analyzed result from Puter.js (frontend free AI)
        puter_result = None
        puter_result_raw = request.form.get("puter_result", "")
        if puter_result_raw:
            try:
                puter_result = json.loads(puter_result_raw)
                print("[HealthGuard AI] 🟢 Received pre-analyzed result from Puter.js (free AI)")
            except json.JSONDecodeError:
                print("[HealthGuard AI] ⚠️ Failed to parse Puter.js result, will use API keys")
        
        # Use user input for scan type if provided, otherwise use classifier result
        final_scan_type = scan_type_input if scan_type_input else scan_type_result.get("scan_type", "Unknown")
        scan_type_result["scan_type"] = final_scan_type

        analysis_result = analyzer.analyze(
            image=image, 
            output_dir=results_dir,
            patient_name=patient_name,
            scan_type=final_scan_type,
            body_part=body_part,
            patient_description=patient_description,
            puter_result=puter_result
        )

        # Step 3: Generate PDF report
        report_filename = generate_report(
            scan_type_result=scan_type_result,
            analysis_result=analysis_result,
            original_filename=original_filename,
            output_dir=REPORTS_FOLDER,
            images_dir=results_dir,
            detailed_report=analysis_result.get("detailed_report")
        )

        # --- Cloud PDF Compression & Storage ---
        report_path = os.path.join(REPORTS_FOLDER, report_filename)
        compressed_path = os.path.join(REPORTS_FOLDER, "compressed_" + report_filename)
        supabase_report_url = None

        if supabase_client:
            print("[HealthGuard AI] 🗜️ Compressing PDF report...")
            is_compressed = compress_pdf(report_path, compressed_path)
            final_upload_path = compressed_path if is_compressed else report_path

            try:
                file_size_kb = os.path.getsize(final_upload_path) // 1024
                with open(final_upload_path, "rb") as f:
                    pdf_bytes = f.read()

                # Upload to Supabase Storage
                storage_path = f"{session_id}/{report_filename}"
                print(f"[HealthGuard AI] ☁️ Uploading PDF to Supabase ({file_size_kb}KB)...")
                
                supabase_client.storage.from_("reports").upload(
                    file=pdf_bytes,
                    path=storage_path,
                    file_options={"content-type": "application/pdf"}
                )

                # Get public URL
                supabase_report_url = supabase_client.storage.from_("reports").get_public_url(storage_path)
                print(f"[HealthGuard AI] ✅ Uploaded PDF to Supabase: {supabase_report_url}")

                # Insert tracking row
                supabase_client.table("scan_reports").insert({
                    "session_id": session_id,
                    "patient_name": patient_name,
                    "scan_type": final_scan_type,
                    "severity": analysis_result["overall_severity"],
                    "file_name": report_filename,
                    "file_size_kb": file_size_kb,
                    "storage_path": storage_path,
                    "user_id": user_id if user_id else None
                }).execute()
                print("[HealthGuard AI] ✅ Created DB record for PDF report.")

            except Exception as e:
                print(f"[HealthGuard AI] ⚠️ Supabase PDF Upload Error: {e}")



        # Save session data to disk for persistence (fixes "Session not found" after restart)
        # 1. Save original image copy
        persistence_path = os.path.join(results_dir, "original_scan.png")
        image.save(persistence_path)
        
        # 2. Save metadata
        metadata = {
            "original_filename": original_filename,
            "scan_type_result": scan_type_result,
            "patient_name": patient_name,
            "upload_path": upload_path,
            "analysis_result": analysis_result
        }
        with open(os.path.join(results_dir, "session_metadata.json"), "w") as f:
            json.dump(metadata, f)

        # Store session in memory
        session_store[session_id] = {
            "upload_path": upload_path,
            "original_filename": original_filename,
            "scan_type_result": scan_type_result,
            "persistence_path": persistence_path
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
                "detailed_report": analysis_result.get("detailed_report"),
            },
            "images": {
                "heatmap": f"/api/results/{session_id}/{analysis_result['heatmap_path']}" if analysis_result.get('heatmap_path') else None,
                "annotated": f"/api/results/{session_id}/{analysis_result['annotated_path']}" if analysis_result.get('annotated_path') else None,
                "medical_viz": f"/api/results/{session_id}/{analysis_result['medical_viz_path']}" if analysis_result.get('medical_viz_path') else None,
            },
            "report": {
                "filename": report_filename,
                "download_url": f"/api/report/{report_filename}",
                "supabase_report_url": supabase_report_url
            },
        }
        # Async-capable push to Supabase
        threading.Thread(target=_save_to_supabase, args=(response, image_bytes, user_id)).start()

        return jsonify(response), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    """
    Submit feedback to fine-tune the model via reinforcement learning.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        session_id = data.get("session_id", "")
        
        # Try to recover session from disk if not in memory
        image = None
        if session_id not in session_store:
            # Check for persisted session
            session_dir = os.path.join(RESULTS_FOLDER, session_id)
            persisted_img = os.path.join(session_dir, "original_scan.png")
            persisted_meta = os.path.join(session_dir, "session_metadata.json")
            
            if os.path.exists(persisted_img):
                print(f"[HealthGuard] Recovered session {session_id} from disk")
                image = Image.open(persisted_img)
                # Ensure we have RGB
                if image.mode != "RGB":
                    image = image.convert("RGB")
                    
                # Restore to session_store for this request context
                session_store[session_id] = {"recovered": True}
            else:
                return jsonify({"error": "Session not found. Please re-upload the scan."}), 404
        else:
            # Load from in-memory session (or original upload path)
            session_data = session_store[session_id]
            # Prefer persistence path if available (safer), else upload path
            img_path = session_data.get("persistence_path", session_data.get("upload_path"))
            if img_path and os.path.exists(img_path):
                image = Image.open(img_path)
            else:
                 # One last try check results folder
                session_dir = os.path.join(RESULTS_FOLDER, session_id)
                persisted_img = os.path.join(session_dir, "original_scan.png")
                if os.path.exists(persisted_img):
                    image = Image.open(persisted_img)
                else:
                    return jsonify({"error": "Original image file not found. Please re-upload."}), 404

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
        image = Image.open(session_data.get("persistence_path") or session_data.get("upload_path"))
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


@app.route("/api/update_report_viz", methods=["POST"])
def update_report_viz():
    """
    Called by the frontend after generating a 3D med-viz using Puter.js.
    Updates the session metadata and regenerates the PDF report to include it.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        session_id = data.get("session_id")
        viz_base64 = data.get("image_base64")
        
        if not session_id or not viz_base64:
            return jsonify({"error": "Missing session_id or image_base64"}), 400
            
        session_dir = os.path.join(RESULTS_FOLDER, session_id)
        if not os.path.exists(session_dir):
            return jsonify({"error": "Session not found"}), 404
            
        # 1. Save Base64 image to disk
        # Strip data URL prefix if present
        if viz_base64.startswith("data:image"):
            viz_base64 = viz_base64.split(",")[1]
            
        import base64
        img_bytes = base64.b64decode(viz_base64)
        viz_filename = f"medical_viz.png"
        viz_path = os.path.join(session_dir, viz_filename)
        
        with open(viz_path, "wb") as f:
            f.write(img_bytes)
            
        # 2. Update metadata
        metadata_path = os.path.join(session_dir, "session_metadata.json")
        if not os.path.exists(metadata_path):
            return jsonify({"error": "Session metadata not found"}), 404
            
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
            
        if "analysis_result" not in metadata:
            return jsonify({"error": "Analysis data not found in session"}), 404
            
        # Add viz path to analysis_result
        metadata["analysis_result"]["medical_viz_path"] = viz_filename
        
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)
            
        # 3. Regenerate PDF
        report_filename = generate_report(
            scan_type_result=metadata["scan_type_result"],
            analysis_result=metadata["analysis_result"],
            original_filename=metadata["original_filename"],
            output_dir=REPORTS_FOLDER,
            images_dir=session_dir,
            detailed_report=metadata["analysis_result"].get("detailed_report")
        )
        
        # Determine paths
        report_path = os.path.join(REPORTS_FOLDER, report_filename)
        compressed_path = os.path.join(REPORTS_FOLDER, f"comp_{report_filename}")
        final_report_path = report_path
        
        if compress_pdf(report_path, compressed_path):
            os.remove(report_path)
            os.rename(compressed_path, report_path)
            
        # Return new download URL
        return jsonify({
            "success": True, 
            "message": "Report updated with 3D visualization",
            "report_url": f"/api/report/{report_filename}",
            "medical_viz_url": f"/api/results/{session_id}/{viz_filename}"
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to update report: {str(e)}"}), 500



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


@app.route("/api/analyze-batch", methods=["POST"])
def analyze_batch():
    """
    Analyze multiple uploaded medical scan images in one request.
    Expects multipart form data with one or more 'images' files.
    Shared metadata (patient_name, scan_type, body_part, patient_description)
    applies to every image in the batch.
    Returns a JSON array of per-scan result objects.
    """
    files = request.files.getlist("images")
    if not files or all(f.filename == "" for f in files):
        return jsonify({"error": "No image files provided"}), 400

    # Shared metadata
    patient_name = request.form.get("patient_name", "")
    scan_type_input = request.form.get("scan_type", "")
    body_part = request.form.get("body_part", "")
    patient_description = request.form.get("patient_description", "")
    user_id = request.form.get("user_id", "")

    # Check for pre-analyzed result from Puter.js (frontend free AI)
    puter_result = None
    puter_result_raw = request.form.get("puter_result", "")
    if puter_result_raw:
        try:
            puter_result = json.loads(puter_result_raw)
            print("[HealthGuard AI] 🟢 Received pre-analyzed result from Puter.js (free AI)")
        except json.JSONDecodeError:
            print("[HealthGuard AI] ⚠️ Failed to parse Puter.js result, will use API keys")

    results = []

    for idx, file in enumerate(files):
        if file.filename == "" or not allowed_file(file.filename):
            results.append({
                "filename": file.filename or "unknown",
                "error": "Invalid file format",
            })
            continue

        try:
            session_id = str(uuid.uuid4())[:12]
            original_filename = secure_filename(file.filename)

            # Read image to memory directly
            image_bytes = file.read()
            image = Image.open(io.BytesIO(image_bytes))
            upload_path = None

            # Step 1: Classify scan type
            scan_type_result = classify_scan_type(image)
            final_scan_type = scan_type_input if scan_type_input else scan_type_result.get("scan_type", "Unknown")
            scan_type_result["scan_type"] = final_scan_type

            # Step 2: Analyze with ML model
            # Use Puter result for first file only (subsequent files use API keys / server Puter)
            results_dir = os.path.join(RESULTS_FOLDER, session_id)
            os.makedirs(results_dir, exist_ok=True)

            analysis_result = analyzer.analyze(
                image=image,
                output_dir=results_dir,
                patient_name=patient_name,
                scan_type=final_scan_type,
                body_part=body_part,
                patient_description=patient_description,
                puter_result=puter_result if idx == 0 else None,
            )

            # Step 3: Generate PDF report
            report_filename = generate_report(
                scan_type_result=scan_type_result,
                analysis_result=analysis_result,
                original_filename=original_filename,
                output_dir=REPORTS_FOLDER,
                images_dir=results_dir,
                detailed_report=analysis_result.get("detailed_report"),
            )

            # Persist session
            persistence_path = os.path.join(results_dir, "original_scan.png")
            image.save(persistence_path)

            metadata = {
                "original_filename": original_filename,
                "scan_type_result": scan_type_result,
                "patient_name": patient_name,
                "upload_path": upload_path,
            }
            with open(os.path.join(results_dir, "session_metadata.json"), "w") as f:
                json.dump(metadata, f)

            session_store[session_id] = {
                "upload_path": upload_path,
                "original_filename": original_filename,
                "scan_type_result": scan_type_result,
                "persistence_path": persistence_path,
            }

            result_payload = {
                "filename": original_filename,
                "session_id": session_id,
                "scan_type": scan_type_result,
                "analysis": {
                    "findings": analysis_result["findings"],
                    "overall_severity": analysis_result["overall_severity"],
                    "primary_finding": analysis_result["primary_finding"],
                    "description": analysis_result["findings"][0].get("description", ""),
                    "model_info": analysis_result["model_info"],
                    "detailed_report": analysis_result.get("detailed_report"),
                },
                "images": {
                    "heatmap": f"/api/results/{session_id}/{analysis_result['heatmap_path']}" if analysis_result.get('heatmap_path') else None,
                    "annotated": f"/api/results/{session_id}/{analysis_result['annotated_path']}" if analysis_result.get('annotated_path') else None,
                    "medical_viz": f"/api/results/{session_id}/{analysis_result['medical_viz_path']}" if analysis_result.get('medical_viz_path') else None,
                },
                "report": {
                    "filename": report_filename,
                    "download_url": f"/api/report/{report_filename}",
                },
            }
            results.append(result_payload)
            threading.Thread(target=_save_to_supabase, args=(result_payload, image_bytes, user_id)).start()

        except Exception as e:
            import traceback
            traceback.print_exc()
            results.append({
                "filename": file.filename or "unknown",
                "error": f"Analysis failed: {str(e)}",
            })

    return jsonify({"results": results}), 200


@app.route("/api/reports/download-all", methods=["POST"])
def download_all_reports():
    """
    Download multiple PDF reports as a single ZIP file.
    Expects JSON body: { "filenames": ["report1.pdf", "report2.pdf", ...] }
    """
    try:
        data = request.get_json()
        if not data or "filenames" not in data:
            return jsonify({"error": "No filenames provided"}), 400

        filenames = data["filenames"]
        if not filenames:
            return jsonify({"error": "Empty filenames list"}), 400

        # Create ZIP in memory
        import io
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for fname in filenames:
                safe_name = secure_filename(fname)
                report_path = os.path.join(REPORTS_FOLDER, safe_name)
                if os.path.exists(report_path):
                    zf.write(report_path, safe_name)

        zip_buffer.seek(0)

        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name="HealthGuard_AI_Reports.zip",
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to create ZIP: {str(e)}"}), 500


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


# ---------- Drug Interaction Checker ----------
@app.route("/api/check-interactions", methods=["POST"])
def check_drug_interactions():
    """
    Check interactions between multiple medicines.
    Expects JSON: { "medicines": ["Medicine A", "Medicine B", ...] }
    Returns interaction data with severity levels.
    """
    try:
        data = request.get_json()
        medicines = data.get("medicines", [])

        if len(medicines) < 2:
            return jsonify({"error": "Please provide at least 2 medicines to check interactions."}), 400

        groq_key = os.getenv("groq_insurance")
        if not groq_key:
            return jsonify({"error": "Groq API key not configured."}), 500

        from groq import Groq
        client = Groq(api_key=groq_key)

        medicine_list = ", ".join(medicines)

        prompt = f"""You are an expert pharmacologist AI. Analyze all possible drug interactions between these medicines: {medicine_list}

For EACH interaction pair found, provide:
1. The two medicines involved
2. Severity level: "severe" (dangerous, avoid), "moderate" (use with caution), "mild" (minor, monitor), or "none" (safe together)
3. What happens when taken together (the interaction effect)
4. Clinical recommendation
5. Which body systems are affected

Return strictly as a valid JSON object:
{{
    "total_medicines": {len(medicines)},
    "interactions_found": true/false,
    "risk_summary": "Overall risk level: HIGH/MODERATE/LOW/SAFE",
    "interactions": [
        {{
            "medicine_1": "Name of first medicine",
            "medicine_2": "Name of second medicine",
            "severity": "severe/moderate/mild/none",
            "effect": "What happens when taken together",
            "recommendation": "What the patient should do",
            "affected_systems": ["Liver", "Kidneys", "Heart"]
        }}
    ],
    "safe_combinations": ["Medicine A + Medicine B"],
    "general_advice": "Overall advice for the patient"
}}

Be thorough and accurate. Check every possible pair combination. Do not include any other text except the JSON object."""

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_completion_tokens=2000
        )

        raw = response.choices[0].message.content.strip()
        # Clean markdown
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)
        return jsonify(result), 200

    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse AI response", "raw": raw}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Interaction check failed: {str(e)}"}), 500


# ---------- AYUSH Integration Hub ----------
@app.route("/api/ayush-lookup", methods=["POST"])
def ayush_lookup():
    """
    Search AYUSH medicines by condition/symptom.
    Expects JSON: { "query": "cold and cough" } or { "query": "diabetes" }
    Returns medicines from Ayurveda, Yoga, Unani, Siddha, and Homeopathy.
    """
    try:
        data = request.get_json()
        query = data.get("query", "").strip()

        if not query:
            return jsonify({"error": "Please provide a condition or symptom to search."}), 400

        groq_key = os.getenv("groq_insurance")
        if not groq_key:
            return jsonify({"error": "Groq API key not configured."}), 500

        from groq import Groq
        client = Groq(api_key=groq_key)

        prompt = f"""You are an expert AYUSH (Ayurveda, Yoga, Unani, Siddha, Homeopathy) specialist AI based in India with deep knowledge of the Ministry of AYUSH approved formulations.

A patient is looking for AYUSH treatments for: "{query}"

For each of the 5 AYUSH systems, suggest the BEST real medicine/treatment. Include government-approved medicines only.

Return strictly as a valid JSON object:
{{
    "condition": "{query}",
    "ayush_results": [
        {{
            "system": "Ayurveda",
            "medicine_name": "Real Ayurvedic medicine name",
            "manufacturer": "Manufacturer (Dabur, Himalaya, Patanjali, Baidyanath, etc.)",
            "estimated_price": 150,
            "key_ingredients": "List of main herbs/ingredients",
            "therapeutic_use": "How it treats the condition",
            "overview": "3-4 sentence detailed description of the medicine and its benefits",
            "ayush_approved": true,
            "classical_reference": "Classical text reference (e.g., Charaka Samhita, Bhavaprakasha)",
            "dosage_info": "Exact dosage, timing, and how to take (e.g., 2 tablets twice daily after meals with warm water)",
            "contraindications": "Who should NOT take this medicine",
            "quality_percentage": 75,
            "side_effects": ["List of side effects"]
        }},
        {{
            "system": "Yoga & Naturopathy",
            "medicine_name": "Specific yoga practice/asana or naturopathy treatment",
            "manufacturer": "N/A",
            "estimated_price": 0,
            "key_ingredients": "Type of practice (pranayama, asana, mudra, diet therapy)",
            "therapeutic_use": "How this practice helps the condition",
            "overview": "Detailed description of the practice and benefits",
            "ayush_approved": true,
            "classical_reference": "Classical text (e.g., Hatha Yoga Pradipika, Yoga Sutras of Patanjali)",
            "dosage_info": "How often and how long to practice (e.g., 15 minutes twice daily, morning and evening)",
            "contraindications": "Who should avoid this practice",
            "quality_percentage": 80,
            "side_effects": ["None if practiced correctly"]
        }},
        {{
            "system": "Unani",
            "medicine_name": "Real Unani medicine name",
            "manufacturer": "Manufacturer (Hamdard, Rex, Dehlvi, etc.)",
            "estimated_price": 130,
            "key_ingredients": "Key ingredients",
            "therapeutic_use": "How it treats the condition",
            "overview": "Detailed description",
            "ayush_approved": true,
            "classical_reference": "Classical text (e.g., Al-Qanun fil Tibb by Ibn Sina, Kitab al-Shifa)",
            "dosage_info": "Dosage with timing",
            "contraindications": "Who should avoid",
            "quality_percentage": 70,
            "side_effects": ["Side effects if any"]
        }},
        {{
            "system": "Siddha",
            "medicine_name": "Real Siddha medicine name",
            "manufacturer": "Manufacturer or traditional source",
            "estimated_price": 120,
            "key_ingredients": "Key herbs/minerals",
            "therapeutic_use": "How it treats the condition",
            "overview": "Detailed description",
            "ayush_approved": true,
            "classical_reference": "Classical text (e.g., Siddha Vaithiya Thirattu, Agathiyar Gunavagadam, Theraiyar Sekarappa)",
            "dosage_info": "Dosage with timing",
            "contraindications": "Who should avoid",
            "quality_percentage": 70,
            "side_effects": ["Side effects if any"]
        }},
        {{
            "system": "Homeopathy",
            "medicine_name": "Real Homeopathic medicine name",
            "manufacturer": "Manufacturer (SBL, Dr Reckeweg, Schwabe, Boiron, etc.)",
            "estimated_price": 100,
            "key_ingredients": "Main potency/ingredient",
            "therapeutic_use": "How it treats the condition",
            "overview": "Detailed description",
            "ayush_approved": true,
            "classical_reference": "Materia Medica source",
            "dosage_info": "Potency and dosage (e.g., 30C, 4 globules 3 times daily)",
            "contraindications": "Contraindications if any",
            "quality_percentage": 65,
            "side_effects": ["Side effects if any"]
        }}
    ],
    "lifestyle_tips": "3-4 general lifestyle tips from AYUSH perspective for managing this condition",
    "when_to_see_doctor": "When the patient should consult a modern medicine doctor instead of relying solely on AYUSH"
}}

IMPORTANT: Only suggest real, genuine medicines/treatments. Be accurate with classical text references. Do not include any text except the JSON object."""

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_completion_tokens=3000
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)
        return jsonify(result), 200

    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse AI response", "raw": raw}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"AYUSH lookup failed: {str(e)}"}), 500


@app.route("/api/advocate/analyze", methods=["POST"])
def analyze_prescription():
    """
    Takes a base64 image of a prescription, processes it directly with Groq Vision, 
    and returns cheaper identical formulas.
    """
    try:
        image_data = request.form.get("image_data")
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400

        # Use groq_insurance key as primary
        groq_api_key = os.getenv("groq_insurance") or os.getenv("GROQ_API_KEY") or os.getenv("GROQ_INSURANCE_KEY")
        if not groq_api_key:
            return jsonify({"error": "groq_insurance API key is not configured in .env"}), 500

        from groq import Groq
        client = Groq(api_key=groq_api_key)

        # Ensure base64 string is properly formatted for Groq request
        if image_data.startswith("data:image"):
            base64_url = image_data
        else:
            base64_url = f"data:image/jpeg;base64,{image_data}"

        prompt = f"""
        You are an expert pharmacology, Ayurveda, Siddha, and Homeopathy specialist AI based in India.
        I have provided an image of a patient's prescription (handwritten or printed).
        
        First, carefully read and extract all the text from the prescription image.
        Then, use that extracted text to find all prescribed medicines.
        For each medicine found, analyze:
        1. The medicine name, company/manufacturer, estimated price in INR, and exact formula/composition.
        2. Rate the quality of the prescribed medicine as a percentage (0-100) based on brand reputation, bioavailability, manufacturing standards, and efficacy.
        3. List common side effects of the prescribed medicine.
        4. Suggest a cheaper GENERIC alternative with the EXACT SAME composition. Rate its quality percentage and list its side effects too.
        5. Also suggest relevant alternatives from 3 traditional medicine systems: Ayurveda, Siddha, and Homeopathy.
           For each traditional alternative, find a real medicine that treats the same condition/symptoms. Include quality percentage and side effects.
        6. Finally, pick the BEST overall recommendation among all alternatives considering price, quality, and fewer side effects.
        
        Return the result strictly as a valid JSON object matching this schema:
        {{
            "extracted_text": "The raw text you successfully read from the image",
            "results": [
                {{
                    "original_medicine": "Name of prescribed medicine",
                    "original_company": "Name of manufacturer",
                    "original_estimated_price": 500,
                    "formula": "The chemical composition",
                    "original_quality_percentage": 85,
                    "original_side_effects": ["Nausea", "Headache", "Dizziness"],
                    "suggested_medicine": "Name of cheaper generic alternative",
                    "suggested_company": "Manufacturer of generic alternative",
                    "suggested_estimated_price": 200,
                    "quality_notes": "A brief note on why this is a good alternative",
                    "medicine_image_url": "A real product image URL of the suggested medicine",
                    "overview": "A 2-3 sentence overview of what this medicine does, its uses, and who should take it",
                    "suggested_quality_percentage": 80,
                    "suggested_side_effects": ["Nausea", "Mild stomach upset"],
                    "alternative_systems": [
                        {{
                            "system": "Ayurveda",
                            "medicine_name": "Name of the Ayurvedic medicine",
                            "manufacturer": "Company like Dabur, Patanjali, Himalaya etc",
                            "estimated_price": 150,
                            "key_ingredients": "List of key herbs/ingredients",
                            "therapeutic_use": "How this medicine treats the same condition",
                            "overview": "Detailed 3-4 sentence description",
                            "quality_percentage": 75,
                            "side_effects": ["Mild gastric irritation"],
                            "ayush_approved": true,
                            "classical_reference": "Name of classical Ayurvedic text (e.g., Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya)",
                            "dosage_info": "Recommended dosage (e.g., 2 tablets twice daily after meals with warm water)",
                            "contraindications": "Who should NOT take this (e.g., pregnant women, children under 5)"
                        }},
                        {{
                            "system": "Siddha",
                            "medicine_name": "Name of the Siddha medicine",
                            "manufacturer": "Company or traditional source",
                            "estimated_price": 120,
                            "key_ingredients": "List of key herbs/minerals",
                            "therapeutic_use": "How this medicine treats the same condition",
                            "overview": "Detailed 3-4 sentence description",
                            "quality_percentage": 70,
                            "side_effects": ["Rare allergic reactions"],
                            "ayush_approved": true,
                            "classical_reference": "Name of classical Siddha text (e.g., Siddha Vaithiya Thirattu, Agathiyar Gunavagadam)",
                            "dosage_info": "Recommended dosage with timing and how to take",
                            "contraindications": "Who should NOT take this medicine"
                        }},
                        {{
                            "system": "Homeopathy",
                            "medicine_name": "Name of the Homeopathic medicine",
                            "manufacturer": "Company like SBL, Dr Reckeweg, Schwabe etc",
                            "estimated_price": 100,
                            "key_ingredients": "The main potency/ingredient",
                            "therapeutic_use": "How this medicine treats the same condition",
                            "overview": "Detailed 3-4 sentence description",
                            "quality_percentage": 65,
                            "side_effects": ["No known side effects"],
                            "ayush_approved": true,
                            "classical_reference": "Materia Medica reference or proving source",
                            "dosage_info": "Recommended potency and dosage (e.g., 30C, 4 globules 3 times daily)",
                            "contraindications": "Any contraindications or interactions to avoid"
                        }}
                    ],
                    "best_recommendation": {{
                        "medicine_name": "The best overall alternative medicine name",
                        "system": "Generic/Ayurveda/Siddha/Homeopathy",
                        "reason": "Why this is the best choice considering price, quality, and side effects"
                    }}
                }}
            ]
        }}
        
        IMPORTANT: Provide real, accurate medicine names from each system. Quality percentages should be realistic.
        Do not include any other text except the JSON object.
        """

        # Using Llama 4 Scout (multimodal) for direct image-to-JSON OCR+Reasoning
        response = client.chat.completions.create(
            messages=[
                {
                    "role": "user", 
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": base64_url,
                            },
                        }
                    ]
                }
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.2,
            response_format={"type": "json_object"}
        )

        response_content = response.choices[0].message.content
        parsed_response = json.loads(response_content)
        
        return jsonify(parsed_response)

    except Exception as e:
        print(f"[HealthGuard AI] ⚠️ Advocate Analysis Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  HealthGuard AI - Medical Scan Analysis Engine")
    print("  Starting on http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=True)

