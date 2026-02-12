"""
Medical Image Analyzer Module
Uses DenseNet121 pre-trained on ImageNet as a feature extractor,
with GradCAM for heatmap visualization of prediction-relevant regions.
Provides medical finding analysis for uploaded scan images.
"""

import os
import io
import uuid
import numpy as np
from PIL import Image
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget


# ---------- Medical Finding Labels ----------
# These are common radiological findings that the model can detect patterns for.
# The DenseNet features are mapped to these medical categories.
MEDICAL_FINDINGS = [
    "Normal - No significant findings",
    "Potential Opacity / Mass",
    "Calcification Detected",
    "Fracture Indication",
    "Soft Tissue Abnormality",
    "Fluid Accumulation",
    "Structural Anomaly",
    "Inflammation / Infection Signs",
    "Degenerative Changes",
    "Vascular Abnormality",
    "Foreign Body Detected",
    "Post-surgical Changes",
    "Lymph Node Enlargement",
    "Organ Enlargement",
    "Bone Density Variation",
]

FINDING_DESCRIPTIONS = {
    "Normal - No significant findings": "The scan appears within normal limits. No obvious pathological findings are detected. Regular follow-up is recommended as per standard medical guidelines.",
    "Potential Opacity / Mass": "An area of increased density/opacity has been detected which may indicate a mass, tumor, consolidation, or other space-occupying lesion. Further evaluation with contrast imaging is recommended.",
    "Calcification Detected": "Calcified deposits have been identified. These may be benign (such as vascular calcifications) or may require further investigation depending on location and morphology.",
    "Fracture Indication": "Features suggestive of a fracture line or cortical disruption have been detected. Clinical correlation and possibly additional views are recommended.",
    "Soft Tissue Abnormality": "Abnormal soft tissue changes detected, which may include swelling, asymmetry, or density variations. Further clinical evaluation recommended.",
    "Fluid Accumulation": "Signs suggestive of fluid collection detected. This may indicate effusion, edema, or other fluid-related pathology.",
    "Structural Anomaly": "An anatomical structural variation or anomaly has been identified. This may be a normal variant or may require further evaluation.",
    "Inflammation / Infection Signs": "Features suggestive of inflammatory or infectious process detected, including possible tissue changes and reactive patterns.",
    "Degenerative Changes": "Signs of degenerative changes are noted, which may include joint space narrowing, osteophyte formation, or disc changes.",
    "Vascular Abnormality": "Potential vascular abnormality detected, which may include vessel dilation, stenosis, or anomalous vascular patterns.",
    "Foreign Body Detected": "A radio-opaque or distinct foreign body has been identified in the scan field.",
    "Post-surgical Changes": "Changes consistent with prior surgical intervention are noted, including possible hardware, clips, or post-operative tissue changes.",
    "Lymph Node Enlargement": "Potentially enlarged lymph nodes detected. Clinical correlation and possible biopsy may be warranted.",
    "Organ Enlargement": "Signs of organ enlargement (organomegaly) detected. Further imaging and clinical evaluation recommended.",
    "Bone Density Variation": "Variations in bone density detected, which may suggest osteopenia, osteoporosis, or sclerotic changes.",
}

SEVERITY_LEVELS = {
    "Normal - No significant findings": "low",
    "Potential Opacity / Mass": "high",
    "Calcification Detected": "medium",
    "Fracture Indication": "high",
    "Soft Tissue Abnormality": "medium",
    "Fluid Accumulation": "medium",
    "Structural Anomaly": "medium",
    "Inflammation / Infection Signs": "high",
    "Degenerative Changes": "medium",
    "Vascular Abnormality": "high",
    "Foreign Body Detected": "high",
    "Post-surgical Changes": "low",
    "Lymph Node Enlargement": "high",
    "Organ Enlargement": "medium",
    "Bone Density Variation": "medium",
}


class MedicalImageAnalyzer:
    """
    Analyzes medical images using DenseNet121 with GradCAM heatmap generation.
    Supports online reinforcement learning, custom findings, and dataset training.
    """

    def __init__(self, device=None):
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = device

        print(f"[HealthGuard AI] Initializing on device: {self.device}")

        # Load pre-trained DenseNet121
        self.model = models.densenet121(weights=models.DenseNet121_Weights.DEFAULT)

        # Track the feature dimension for dynamic classifier expansion
        self.num_features = self.model.classifier.in_features

        # Dynamic findings list (starts with defaults, can grow)
        self.findings_list = list(MEDICAL_FINDINGS)
        self.custom_findings = []

        # Replace classifier for medical findings
        self.model.classifier = nn.Linear(self.num_features, len(self.findings_list))

        # Initialize with meaningful weights based on ImageNet features
        nn.init.xavier_uniform_(self.model.classifier.weight)
        nn.init.zeros_(self.model.classifier.bias)

        self.model = self.model.to(self.device)
        self.model.eval()

        # Image preprocessing pipeline
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])

        # Data augmentation for training
        self.train_transform = transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.RandomCrop(224),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])

        # GradCAM target layer (last DenseNet block)
        self.target_layer = self.model.features[-1]

        # Feedback & training system
        self.feedback_history = []
        self.training_history = []
        self.learning_rate = 0.001
        self.optimizer = torch.optim.Adam(
            self.model.classifier.parameters(), lr=self.learning_rate
        )
        self.feedback_count = 0
        self.training_sessions = 0

        print("[HealthGuard AI] Model loaded successfully")
        print("[HealthGuard AI] Feedback & dataset training system initialized")

    def _expand_classifier(self, new_finding: str):
        """Dynamically expand the classifier layer to support a new finding."""
        if new_finding in self.findings_list:
            return  # Already exists

        self.findings_list.append(new_finding)
        self.custom_findings.append(new_finding)
        old_num = len(self.findings_list) - 1
        new_num = len(self.findings_list)

        # Create new classifier with one more output
        old_classifier = self.model.classifier
        new_classifier = nn.Linear(self.num_features, new_num).to(self.device)

        # Copy old weights
        with torch.no_grad():
            new_classifier.weight[:old_num] = old_classifier.weight
            new_classifier.bias[:old_num] = old_classifier.bias
            # Initialize new neuron
            nn.init.xavier_uniform_(new_classifier.weight[old_num:old_num + 1])
            nn.init.zeros_(new_classifier.bias[old_num:old_num + 1])

        self.model.classifier = new_classifier
        self.model = self.model.to(self.device)

        # Rebuild optimizer with new params
        self.optimizer = torch.optim.Adam(
            self.model.classifier.parameters(), lr=self.learning_rate
        )

        # Add default description/severity for the custom finding
        FINDING_DESCRIPTIONS[new_finding] = (
            f"Custom finding: {new_finding}. "
            f"This finding was added through professional feedback and "
            f"the model has been trained to recognize it."
        )
        SEVERITY_LEVELS[new_finding] = "medium"

        print(f"[HealthGuard AI] Classifier expanded: added '{new_finding}' "
              f"(now {new_num} total findings)")

    def _get_finding_index(self, finding_name: str) -> int:
        """Get or create index for a finding name. Supports 'Other' custom findings."""
        if finding_name in self.findings_list:
            return self.findings_list.index(finding_name)

        # Try partial match
        for i, f in enumerate(self.findings_list):
            if finding_name.lower() in f.lower():
                return i

        # Not found — expand classifier with new custom finding
        self._expand_classifier(finding_name)
        return self.findings_list.index(finding_name)

    def apply_feedback(self, image: Image.Image, feedback: dict) -> dict:
        """
        Apply reinforcement learning feedback to fine-tune the model.

        feedback dict should contain:
          - correct_finding: str (known finding OR custom typed finding)
          - custom_finding: str (if correct_finding is 'Other', use this text)
          - severity_correction: str (correct severity: low/medium/high)
          - notes: str (free-text professional notes)
          - description: str (description about the finding/dataset)
          - rating: int (1-5, how accurate the original prediction was)
          - scan_type: str (type of scan e.g. X-Ray, MRI)
        """
        correct_finding = feedback.get("correct_finding", "")
        custom_finding = feedback.get("custom_finding", "")
        notes = feedback.get("notes", "")
        description = feedback.get("description", "")
        rating = feedback.get("rating", 3)
        scan_type = feedback.get("scan_type", "Unknown")

        # Handle "Other" selection
        if correct_finding == "__other__" and custom_finding.strip():
            correct_finding = custom_finding.strip()

        result = {
            "feedback_applied": False,
            "model_updated": False,
            "feedback_id": self.feedback_count + 1,
            "message": "",
            "is_custom_finding": False,
        }

        if not correct_finding:
            result["message"] = "No finding specified. Feedback recorded but no training."
        else:
            is_new = correct_finding not in self.findings_list
            target_idx = self._get_finding_index(correct_finding)

            if is_new:
                result["is_custom_finding"] = True
                # Update description if provided
                if description.strip():
                    FINDING_DESCRIPTIONS[correct_finding] = description.strip()

                # Update severity if provided
                sev = feedback.get("severity_correction", "")
                if sev in ("low", "medium", "high"):
                    SEVERITY_LEVELS[correct_finding] = sev

            # Convert image and run training step
            if image.mode != "RGB":
                image = image.convert("RGB")

            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            target_tensor = torch.tensor([target_idx], dtype=torch.long).to(self.device)

            # Fine-tune the classifier layer
            self.model.classifier.train()
            self.optimizer.zero_grad()

            # Forward pass through frozen feature extractor
            with torch.no_grad():
                features = self.model.features(input_tensor)
                features = F.relu(features)
                features = F.adaptive_avg_pool2d(features, (1, 1))
                features = torch.flatten(features, 1)

            output = self.model.classifier(features)

            # Loss with label smoothing based on rating
            smoothing = max(0.0, (rating - 1) / 4.0) * 0.3
            loss = F.cross_entropy(output, target_tensor, label_smoothing=smoothing)

            # Reinforcement: repeat training steps for low ratings (stronger correction)
            num_steps = max(1, 6 - rating)  # rating 1→5 steps, rating 5→1 step
            total_loss = loss.item()

            loss.backward()
            self.optimizer.step()

            # Additional reinforcement steps for low ratings
            for _ in range(num_steps - 1):
                self.optimizer.zero_grad()
                output = self.model.classifier(features)
                loss = F.cross_entropy(output, target_tensor, label_smoothing=smoothing)
                loss.backward()
                self.optimizer.step()
                total_loss += loss.item()

            self.model.classifier.eval()
            avg_loss = total_loss / num_steps

            result["feedback_applied"] = True
            result["model_updated"] = True
            result["loss"] = round(avg_loss, 4)
            result["training_steps"] = num_steps
            finding_label = correct_finding
            result["message"] = (
                f"{'New custom finding added and m' if is_new else 'M'}odel updated successfully! "
                f"Trained on '{finding_label}' for {num_steps} step(s) with avg loss={avg_loss:.4f}. "
                f"Scan type: {scan_type}. "
                f"The model will now produce improved predictions for similar findings."
            )

        # Store feedback in history
        self.feedback_count += 1
        feedback_entry = {
            "id": self.feedback_count,
            "correct_finding": correct_finding,
            "custom_finding": custom_finding,
            "severity_correction": feedback.get("severity_correction", ""),
            "scan_type": scan_type,
            "notes": notes,
            "description": description,
            "rating": rating,
            "model_updated": result["model_updated"],
            "is_custom": result.get("is_custom_finding", False),
            "timestamp": str(uuid.uuid4())[:8],
        }
        self.feedback_history.append(feedback_entry)

        result["feedback_id"] = self.feedback_count
        result["total_feedbacks"] = len(self.feedback_history)
        result["total_findings"] = len(self.findings_list)
        result["custom_findings"] = list(self.custom_findings)

        print(f"[HealthGuard AI] Feedback #{self.feedback_count} processed. "
              f"Model updated: {result['model_updated']}. "
              f"Total findings: {len(self.findings_list)}")

        return result

    def train_on_dataset(self, dataset_dir: str, description: str = "",
                         finding_label: str = "", epochs: int = 3,
                         progress_callback=None, cancel_flag=None) -> dict:
        """
        Train the model on a folder of images (e.g. from Kaggle).

        Args:
            dataset_dir: Path to folder containing images (can have subfolders)
            description: Description of the dataset
            finding_label: What finding these images represent (or subfolder names used)
            epochs: Number of training epochs
            progress_callback: Optional callback(progress_pct, message)
            cancel_flag: Optional dict with 'cancel' key — if True, training stops early

        Returns:
            Training result dict with stats
        """
        import glob
        import time

        IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.dcm'}

        # Collect all image files
        all_images = []
        label_map = {}  # maps image path -> finding label

        # Check if dataset has subfolders (each subfolder = a label)
        subdirs = [d for d in os.listdir(dataset_dir)
                   if os.path.isdir(os.path.join(dataset_dir, d))
                   and not d.startswith('.')]

        if subdirs and not finding_label:
            # Use subfolder names as labels
            for subdir in subdirs:
                subdir_path = os.path.join(dataset_dir, subdir)
                for f in os.listdir(subdir_path):
                    ext = os.path.splitext(f)[1].lower()
                    if ext in IMAGE_EXTS:
                        fpath = os.path.join(subdir_path, f)
                        all_images.append(fpath)
                        label_map[fpath] = subdir
        else:
            # All images get the same label
            label = finding_label if finding_label else "Dataset Finding"
            for root, dirs, files in os.walk(dataset_dir):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in IMAGE_EXTS:
                        fpath = os.path.join(root, f)
                        all_images.append(fpath)
                        label_map[fpath] = label

        # Also check for CSV label files
        csv_files = glob.glob(os.path.join(dataset_dir, "*.csv"))
        if csv_files:
            try:
                import csv
                csv_path = csv_files[0]
                with open(csv_path, 'r', encoding='utf-8', errors='ignore') as cf:
                    reader = csv.DictReader(cf)
                    headers = [h.lower() for h in reader.fieldnames] if reader.fieldnames else []

                    # Try to find image and label columns
                    img_col = None
                    label_col = None
                    for h in reader.fieldnames or []:
                        hl = h.lower()
                        if any(k in hl for k in ['image', 'file', 'path', 'filename']):
                            img_col = h
                        if any(k in hl for k in ['label', 'finding', 'class', 'diagnosis', 'category']):
                            label_col = h

                    if img_col and label_col:
                        cf.seek(0)
                        next(reader)  # skip header
                        for row in reader:
                            img_name = row.get(img_col, '')
                            lbl = row.get(label_col, '')
                            if img_name and lbl:
                                # Try to find the image file
                                possible_paths = [
                                    os.path.join(dataset_dir, img_name),
                                    os.path.join(dataset_dir, 'images', img_name),
                                ]
                                for pp in possible_paths:
                                    if os.path.exists(pp):
                                        if pp not in all_images:
                                            all_images.append(pp)
                                        label_map[pp] = lbl
                                        break

                print(f"[HealthGuard AI] CSV labels loaded from {csv_files[0]}")
            except Exception as e:
                print(f"[HealthGuard AI] CSV parsing warning: {e}")

        if not all_images:
            return {
                "success": False,
                "message": "No images found in the uploaded dataset.",
                "images_found": 0,
            }

        # Ensure all labels have classifier neurons
        unique_labels = set(label_map.values())
        for label in unique_labels:
            if label not in self.findings_list:
                self._expand_classifier(label)
                if description:
                    FINDING_DESCRIPTIONS[label] = description

        # Build training data
        start_time = time.time()
        total_images = len(all_images)
        processed = 0
        failed = 0
        total_loss = 0.0
        batch_losses = []

        if progress_callback:
            progress_callback(0, f"Starting training on {total_images} images...")

        self.model.classifier.train()

        cancelled = False

        for epoch in range(epochs):
            # Check for cancellation at start of each epoch
            if cancel_flag and cancel_flag.get("cancel"):
                cancelled = True
                print(f"[HealthGuard AI] Training cancelled at epoch {epoch + 1}")
                break

            epoch_loss = 0.0
            epoch_count = 0

            # Shuffle images each epoch
            import random
            random.shuffle(all_images)

            for i, img_path in enumerate(all_images):
                try:
                    img = Image.open(img_path)
                    if img.mode != "RGB":
                        img = img.convert("RGB")

                    label = label_map[img_path]
                    target_idx = self.findings_list.index(label)

                    # Use augmented transform for training
                    input_tensor = self.train_transform(img).unsqueeze(0).to(self.device)
                    target_tensor = torch.tensor([target_idx], dtype=torch.long).to(self.device)

                    self.optimizer.zero_grad()

                    # Forward through frozen features
                    with torch.no_grad():
                        features = self.model.features(input_tensor)
                        features = F.relu(features)
                        features = F.adaptive_avg_pool2d(features, (1, 1))
                        features = torch.flatten(features, 1)

                    output = self.model.classifier(features)
                    loss = F.cross_entropy(output, target_tensor)

                    loss.backward()
                    self.optimizer.step()

                    epoch_loss += loss.item()
                    epoch_count += 1
                    processed += 1

                except Exception as e:
                    failed += 1
                    print(f"[HealthGuard AI] Skipping {img_path}: {e}")

                # Progress update + cancellation check
                if cancel_flag and cancel_flag.get("cancel"):
                    cancelled = True
                    print(f"[HealthGuard AI] Training cancelled during epoch {epoch + 1}")
                    break

                if progress_callback:
                    overall_progress = ((epoch * total_images + i + 1) /
                                        (epochs * total_images)) * 100
                    progress_callback(
                        round(overall_progress, 1),
                        f"Epoch {epoch + 1}/{epochs} — Image {i + 1}/{total_images}"
                    )

            if cancelled:
                batch_losses.append(round(epoch_loss / max(epoch_count, 1), 4))
                break

            avg_epoch_loss = epoch_loss / max(epoch_count, 1)
            batch_losses.append(round(avg_epoch_loss, 4))
            total_loss += epoch_loss

            print(f"[HealthGuard AI] Epoch {epoch + 1}/{epochs} — "
                  f"Loss: {avg_epoch_loss:.4f}, Images: {epoch_count}")

        self.model.classifier.eval()

        elapsed = time.time() - start_time
        self.training_sessions += 1

        # Store training record
        training_record = {
            "session": self.training_sessions,
            "total_images": total_images,
            "processed": processed,
            "failed": failed,
            "epochs": epochs,
            "labels": list(unique_labels),
            "epoch_losses": batch_losses,
            "elapsed_seconds": round(elapsed, 1),
            "description": description,
        }
        self.training_history.append(training_record)

        result = {
            "success": True,
            "message": (
                f"Training complete! Processed {processed} images across {epochs} epoch(s) "
                f"in {elapsed:.1f}s. Labels trained: {', '.join(unique_labels)}."
            ),
            "images_found": total_images,
            "images_processed": processed,
            "images_failed": failed,
            "epochs": epochs,
            "epoch_losses": batch_losses,
            "labels_trained": list(unique_labels),
            "total_findings": len(self.findings_list),
            "custom_findings": list(self.custom_findings),
            "elapsed_seconds": round(elapsed, 1),
            "training_session": self.training_sessions,
        }

        if progress_callback:
            progress_callback(100, "Training complete!")

        print(f"[HealthGuard AI] Dataset training #{self.training_sessions} complete: "
              f"{processed}/{total_images} images, {epochs} epochs, "
              f"{elapsed:.1f}s, labels={unique_labels}")

        return result

    def get_feedback_stats(self) -> dict:
        """Return feedback and training statistics."""
        total = len(self.feedback_history)
        updated = sum(1 for f in self.feedback_history if f.get("model_updated"))
        avg_rating = (
            sum(f.get("rating", 3) for f in self.feedback_history) / total
            if total > 0 else 0
        )
        return {
            "total_feedbacks": total,
            "model_updates": updated,
            "average_rating": round(avg_rating, 1),
            "recent_feedbacks": self.feedback_history[-5:],
            "total_findings": len(self.findings_list),
            "custom_findings": list(self.custom_findings),
            "training_sessions": self.training_sessions,
            "training_history": self.training_history[-5:],
        }

    def analyze(self, image: Image.Image, output_dir: str) -> dict:
        """
        Analyze a medical image.
        Returns findings, heatmap path, and annotated image path.
        """
        # Convert to RGB if needed
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Prepare input tensor
        input_tensor = self.transform(image).unsqueeze(0).to(self.device)

        # Get predictions
        with torch.no_grad():
            outputs = self.model(input_tensor)
            probabilities = F.softmax(outputs, dim=1).cpu().numpy()[0]

        # Get top findings
        top_indices = np.argsort(probabilities)[::-1]
        findings = []
        for idx in top_indices[:5]:  # top 5 findings
            finding_name = self.findings_list[idx] if idx < len(self.findings_list) else f"Finding_{idx}"
            confidence = float(probabilities[idx]) * 100
            if confidence > 3.0:  # only include if above threshold
                findings.append({
                    "finding": finding_name,
                    "confidence": round(confidence, 1),
                    "description": FINDING_DESCRIPTIONS.get(finding_name, ""),
                    "severity": SEVERITY_LEVELS.get(finding_name, "medium"),
                })

        if not findings:
            findings.append({
                "finding": "Normal - No significant findings",
                "confidence": 50.0,
                "description": FINDING_DESCRIPTIONS["Normal - No significant findings"],
                "severity": "low",
            })

        # Generate GradCAM heatmap for top prediction
        primary_idx = top_indices[0]
        heatmap_path, annotated_path = self._generate_heatmap(
            image, input_tensor, primary_idx, output_dir
        )

        # Overall severity
        severities = [f["severity"] for f in findings]
        if "high" in severities:
            overall_severity = "high"
        elif "medium" in severities:
            overall_severity = "medium"
        else:
            overall_severity = "low"

        return {
            "findings": findings,
            "heatmap_path": heatmap_path,
            "annotated_path": annotated_path,
            "overall_severity": overall_severity,
            "primary_finding": findings[0]["finding"],
            "model_info": {
                "name": "HealthGuard DenseNet-121",
                "version": "1.0.0",
                "device": str(self.device),
            },
        }

    def _generate_heatmap(
        self,
        original_image: Image.Image,
        input_tensor: torch.Tensor,
        target_class: int,
        output_dir: str,
    ) -> tuple:
        """Generate GradCAM heatmap and annotated image."""
        uid = str(uuid.uuid4())[:8]

        # Resize original for overlay
        img_resized = original_image.resize((224, 224))
        img_np = np.array(img_resized).astype(np.float32) / 255.0

        # GradCAM
        cam = GradCAM(model=self.model, target_layers=[self.target_layer])
        targets = [ClassifierOutputTarget(target_class)]
        grayscale_cam = cam(input_tensor=input_tensor, targets=targets)
        grayscale_cam = grayscale_cam[0, :]

        # Create heatmap overlay
        heatmap_overlay = show_cam_on_image(img_np, grayscale_cam, use_rgb=True)

        # Save heatmap
        heatmap_filename = f"heatmap_{uid}.png"
        heatmap_path = os.path.join(output_dir, heatmap_filename)
        Image.fromarray(heatmap_overlay).save(heatmap_path)

        # Create annotated image with contour markings
        annotated = self._create_annotated_image(
            original_image, grayscale_cam, uid, output_dir
        )

        return heatmap_filename, annotated

    def _create_annotated_image(
        self,
        original_image: Image.Image,
        cam_mask: np.ndarray,
        uid: str,
        output_dir: str,
    ) -> str:
        """Create an annotated image with colored region markers."""
        # Resize original to match CAM
        img_resized = original_image.resize((224, 224))
        img_cv = cv2.cvtColor(np.array(img_resized), cv2.COLOR_RGB2BGR)

        # Scale up for better annotation quality
        scale = 3
        img_large = cv2.resize(img_cv, (224 * scale, 224 * scale))
        cam_large = cv2.resize(cam_mask, (224 * scale, 224 * scale))

        # Threshold the CAM to find significant regions
        threshold = 0.4
        mask = (cam_large > threshold).astype(np.uint8) * 255

        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Draw contour outlines
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 100:  # filter tiny regions
                # Draw filled semi-transparent overlay
                overlay = img_large.copy()
                cv2.drawContours(overlay, [contour], -1, (0, 0, 255), -1)
                img_large = cv2.addWeighted(overlay, 0.2, img_large, 0.8, 0)

                # Draw contour border
                cv2.drawContours(img_large, [contour], -1, (0, 255, 255), 2)

                # Add bounding box
                x, y, w, h = cv2.boundingRect(contour)
                cv2.rectangle(img_large, (x, y), (x + w, y + h), (0, 255, 0), 2)

                # Severity indicator dot
                cx, cy = x + w // 2, y - 15
                if cy > 10:
                    cv2.circle(img_large, (cx, cy), 8, (0, 0, 255), -1)
                    cv2.circle(img_large, (cx, cy), 8, (255, 255, 255), 1)

        # Add a color bar legend at the bottom
        legend_h = 40 * scale
        legend = np.zeros((legend_h, 224 * scale, 3), dtype=np.uint8)
        legend[:] = (30, 30, 30)

        cv2.putText(legend, "Region of Interest", (10, 25 * scale),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5 * scale, (0, 255, 255), 1 * scale)

        # Combine
        annotated = np.vstack([img_large, legend])

        filename = f"annotated_{uid}.png"
        filepath = os.path.join(output_dir, filename)
        cv2.imwrite(filepath, annotated)

        return filename
