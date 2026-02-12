/**
 * HealthGuard AI — Frontend Application
 * Handles file upload, API communication, result rendering, and feedback loop.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // ---------- DOM References ----------
    const uploadZone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("fileInput");
    const uploadContent = document.getElementById("uploadContent");
    const previewArea = document.getElementById("previewArea");
    const previewImage = document.getElementById("previewImage");
    const previewFilename = document.getElementById("previewFilename");
    const previewFilesize = document.getElementById("previewFilesize");
    const removeFileBtn = document.getElementById("removeFileBtn");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const loadingOverlay = document.getElementById("loadingOverlay");
    const progressBar = document.getElementById("progressBar");
    const resultsSection = document.getElementById("resultsSection");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    const newScanBtn = document.getElementById("newScanBtn");
    const navStatus = document.getElementById("navStatus");
    const navbar = document.getElementById("navbar");

    // Feedback DOM References
    const feedbackForm = document.getElementById("feedbackForm");
    const feedbackSuccess = document.getElementById("feedbackSuccess");
    const starRating = document.getElementById("starRating");
    const ratingText = document.getElementById("ratingText");
    const correctFinding = document.getElementById("correctFinding");
    const customFindingWrapper = document.getElementById("customFindingWrapper");
    const customFindingInput = document.getElementById("customFindingInput");
    const feedbackDescription = document.getElementById("feedbackDescription");
    const feedbackScanTag = document.getElementById("feedbackScanTag");
    const severityButtons = document.getElementById("severityButtons");
    const feedbackNotes = document.getElementById("feedbackNotes");
    const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
    const feedbackMessage = document.getElementById("feedbackMessage");
    const feedbackStatsMini = document.getElementById("feedbackStatsMini");
    const reanalyzeBtn = document.getElementById("reanalyzeBtn");
    const addMoreFeedbackBtn = document.getElementById("addMoreFeedbackBtn");

    // Training DOM References
    const trainingUploadZone = document.getElementById("trainingUploadZone");
    const datasetFileInput = document.getElementById("datasetFileInput");
    const trainUploadContent = document.getElementById("trainUploadContent");
    const trainingFilePreview = document.getElementById("trainingFilePreview");
    const trainingFilename = document.getElementById("trainingFilename");
    const trainingFilesize = document.getElementById("trainingFilesize");
    const removeDatasetBtn = document.getElementById("removeDatasetBtn");
    const datasetDescription = document.getElementById("datasetDescription");
    const datasetFindingLabel = document.getElementById("datasetFindingLabel");
    const startTrainingBtn = document.getElementById("startTrainingBtn");
    const trainingProgressPanel = document.getElementById("trainingProgressPanel");
    const trainingProgressFill = document.getElementById("trainingProgressFill");
    const trainingProgressPct = document.getElementById("trainingProgressPct");
    const trainingStatusMessage = document.getElementById("trainingStatusMessage");
    const trainingResultPanel = document.getElementById("trainingResultPanel");
    const trainingResultMessage = document.getElementById("trainingResultMessage");
    const trainingResultStats = document.getElementById("trainingResultStats");
    const trainAnotherBtn = document.getElementById("trainAnotherBtn");

    let selectedFile = null;
    let currentReportUrl = null;
    let currentSessionId = null;
    let currentScanType = "Unknown";
    let selectedRating = 0;
    let selectedSeverity = "";
    let selectedDatasetFiles = null; // Array of files (for folder) or single file
    let isDatasetFolder = false;
    let selectedEpochs = 3;

    // ---------- API Base URL ----------
    const API_BASE = window.location.origin;

    // ---------- Rating labels ----------
    const ratingLabels = [
        "",
        "Very Inaccurate",
        "Somewhat Inaccurate",
        "Partially Accurate",
        "Mostly Accurate",
        "Very Accurate",
    ];

    // ---------- Health Check ----------
    async function checkHealth() {
        try {
            const res = await fetch(`${API_BASE}/api/health`);
            if (res.ok) {
                const data = await res.json();
                navStatus.innerHTML = `
                    <div class="status-dot pulse"></div>
                    <span>${data.model} • ${data.device}</span>
                `;
            }
        } catch {
            navStatus.innerHTML = `
                <div class="status-dot" style="background: var(--accent-red);"></div>
                <span style="color: var(--accent-red);">Offline</span>
            `;
        }
    }
    checkHealth();

    // ---------- Navbar Scroll ----------
    window.addEventListener("scroll", () => {
        if (window.scrollY > 40) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    // ---------- File Upload ----------
    uploadZone.addEventListener("click", () => fileInput.click());

    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("drag-over");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("drag-over");
    });

    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("drag-over");
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        // Validate file type
        const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/bmp", "image/tiff", "image/webp"];
        if (!validTypes.some(t => file.type.startsWith("image/"))) {
            alert("Please upload a valid image file.");
            return;
        }

        selectedFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
        };
        reader.readAsDataURL(file);

        previewFilename.textContent = file.name;
        previewFilesize.textContent = formatFileSize(file.size);

        uploadZone.classList.add("hidden");
        previewArea.classList.remove("hidden");

        // Re-init icons
        lucide.createIcons();
    }

    removeFileBtn.addEventListener("click", () => {
        resetUpload();
    });

    function resetUpload() {
        selectedFile = null;
        fileInput.value = "";
        previewImage.src = "";
        uploadZone.classList.remove("hidden");
        previewArea.classList.add("hidden");
        resultsSection.classList.add("hidden");
        currentSessionId = null;
        resetFeedbackForm();
    }

    // ---------- Analyze ----------
    analyzeBtn.addEventListener("click", () => {
        if (!selectedFile) return;
        startAnalysis();
    });

    async function startAnalysis() {
        // Show loading
        loadingOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        // Animate loading steps
        const steps = ["step1", "step2", "step3", "step4"];
        let currentStep = 0;

        const stepInterval = setInterval(() => {
            if (currentStep > 0) {
                document.getElementById(steps[currentStep - 1]).classList.remove("active");
                document.getElementById(steps[currentStep - 1]).classList.add("done");
            }
            if (currentStep < steps.length) {
                document.getElementById(steps[currentStep]).classList.add("active");
                progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
                currentStep++;
            }
        }, 1500);

        try {
            const formData = new FormData();
            formData.append("image", selectedFile);

            const response = await fetch(`${API_BASE}/api/analyze`, {
                method: "POST",
                body: formData,
            });

            clearInterval(stepInterval);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Analysis failed");
            }

            const data = await response.json();

            // Complete all steps
            steps.forEach((s) => {
                const el = document.getElementById(s);
                el.classList.remove("active");
                el.classList.add("done");
            });
            progressBar.style.width = "100%";

            // Wait a moment to show completion
            await sleep(800);

            // Hide loading
            loadingOverlay.classList.add("hidden");
            document.body.style.overflow = "";

            // Reset step states for next use
            steps.forEach((s) => {
                const el = document.getElementById(s);
                el.classList.remove("active", "done");
            });
            progressBar.style.width = "0%";

            // Display results
            displayResults(data);
        } catch (err) {
            clearInterval(stepInterval);
            loadingOverlay.classList.add("hidden");
            document.body.style.overflow = "";

            // Reset steps
            steps.forEach((s) => {
                const el = document.getElementById(s);
                el.classList.remove("active", "done");
            });
            progressBar.style.width = "0%";

            alert("Analysis Error: " + err.message);
            console.error(err);
        }
    }

    // ---------- Display Results ----------
    function displayResults(data) {
        // Store session ID for feedback
        currentSessionId = data.session_id;

        // Scan Type
        const scanType = data.scan_type;
        currentScanType = scanType.scan_type || "Unknown";
        document.getElementById("scanTypeValue").textContent = scanType.scan_type;
        document.getElementById("scanTypeConf").textContent = `${scanType.confidence}% confidence`;

        // Update scan type in feedback panel
        feedbackScanTag.textContent = scanType.scan_type;

        // Severity
        const severity = data.analysis.overall_severity;
        const severityEl = document.getElementById("severityValue");
        severityEl.textContent = severity.toUpperCase();
        const severityCard = document.getElementById("severityCard");
        severityCard.className = `summary-card severity-card severity-${severity}`;
        severityEl.style.color = severity === "high" ? "var(--accent-red)" :
            severity === "medium" ? "var(--accent-yellow)" : "var(--accent-green)";

        // Primary Finding
        document.getElementById("primaryFindingValue").textContent = data.analysis.primary_finding;

        // Model
        document.getElementById("modelValue").textContent = data.analysis.model_info.name;
        document.getElementById("modelDevice").textContent = `Device: ${data.analysis.model_info.device}`;

        // Images
        document.getElementById("heatmapImage").src = data.images.heatmap;
        document.getElementById("annotatedImage").src = data.images.annotated;

        // Findings List
        const findingsList = document.getElementById("findingsList");
        findingsList.innerHTML = "";
        data.analysis.findings.forEach((f) => {
            const item = document.createElement("div");
            item.className = `finding-item severity-${f.severity}`;
            item.innerHTML = `
                <span class="finding-severity-badge ${f.severity}">${f.severity}</span>
                <div class="finding-details">
                    <div class="finding-name">${f.finding}</div>
                    <div class="finding-description">${f.description}</div>
                    <div class="finding-confidence">Confidence: ${f.confidence}%</div>
                </div>
            `;
            findingsList.appendChild(item);
        });

        // Scan Type Bars
        const scanBars = document.getElementById("scanTypeBars");
        scanBars.innerHTML = "";
        const allScores = scanType.all_scores || [];
        allScores.forEach((item, idx) => {
            const [name, score] = item;
            const bar = document.createElement("div");
            bar.className = "scan-bar";
            bar.innerHTML = `
                <span class="scan-bar-label">${name}</span>
                <div class="scan-bar-track">
                    <div class="scan-bar-fill ${idx === 0 ? "top" : ""}" style="width: 0%"></div>
                </div>
                <span class="scan-bar-value">${score}%</span>
            `;
            scanBars.appendChild(bar);

            // Animate bar fill
            requestAnimationFrame(() => {
                setTimeout(() => {
                    bar.querySelector(".scan-bar-fill").style.width = `${score}%`;
                }, idx * 100);
            });
        });

        // Report URL
        currentReportUrl = data.report.download_url;

        // Reset feedback form for new results
        resetFeedbackForm();

        // Show results section
        resultsSection.classList.remove("hidden");

        // Re-init icons
        lucide.createIcons();

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ---------- Download PDF ----------
    downloadPdfBtn.addEventListener("click", () => {
        if (currentReportUrl) {
            window.open(currentReportUrl, "_blank");
        }
    });

    // ---------- New Scan ----------
    newScanBtn.addEventListener("click", () => {
        resetUpload();
        resultsSection.classList.add("hidden");
        document.getElementById("upload").scrollIntoView({ behavior: "smooth" });
    });

    // =============================================
    // ========== FEEDBACK SYSTEM ==========
    // =============================================

    // ---------- Star Rating ----------
    const starBtns = starRating.querySelectorAll(".star-btn");
    starBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            selectedRating = parseInt(btn.dataset.rating);
            updateStarDisplay();
        });

        btn.addEventListener("mouseenter", () => {
            const hoverRating = parseInt(btn.dataset.rating);
            highlightStars(hoverRating);
            ratingText.textContent = ratingLabels[hoverRating];
        });

        btn.addEventListener("mouseleave", () => {
            highlightStars(selectedRating);
            ratingText.textContent = selectedRating > 0 ? ratingLabels[selectedRating] : "Select a rating";
        });
    });

    function updateStarDisplay() {
        highlightStars(selectedRating);
        ratingText.textContent = selectedRating > 0 ? ratingLabels[selectedRating] : "Select a rating";
    }

    function highlightStars(count) {
        starBtns.forEach((btn) => {
            const r = parseInt(btn.dataset.rating);
            if (r <= count) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    // ---------- Severity Buttons ----------
    const sevBtns = severityButtons.querySelectorAll(".severity-btn");
    sevBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            selectedSeverity = btn.dataset.severity;
            sevBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    // ---------- Custom Finding Toggle ----------
    correctFinding.addEventListener("change", () => {
        if (correctFinding.value === "__other__") {
            customFindingWrapper.classList.remove("hidden");
            customFindingInput.focus();
        } else {
            customFindingWrapper.classList.add("hidden");
            customFindingInput.value = "";
        }
    });

    // ---------- Reset Feedback Form ----------
    function resetFeedbackForm() {
        selectedRating = 0;
        selectedSeverity = "";
        updateStarDisplay();
        sevBtns.forEach((b) => b.classList.remove("active"));
        correctFinding.value = "";
        customFindingWrapper.classList.add("hidden");
        customFindingInput.value = "";
        feedbackNotes.value = "";
        feedbackDescription.value = "";
        feedbackForm.classList.remove("hidden");
        feedbackSuccess.classList.add("hidden");
    }

    // ---------- Submit Feedback ----------
    submitFeedbackBtn.addEventListener("click", async () => {
        if (!currentSessionId) {
            alert("No active session. Please analyze a scan first.");
            return;
        }

        if (selectedRating === 0) {
            alert("Please select an accuracy rating.");
            return;
        }

        if (!correctFinding.value) {
            alert("Please select the correct medical finding.");
            return;
        }

        // Validate custom finding if 'Other' is selected
        if (correctFinding.value === "__other__" && !customFindingInput.value.trim()) {
            alert("Please type the custom medical finding name.");
            customFindingInput.focus();
            return;
        }

        // Disable button
        submitFeedbackBtn.disabled = true;
        submitFeedbackBtn.querySelector("span").textContent = "Training AI Model...";

        try {
            const response = await fetch(`${API_BASE}/api/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    correct_finding: correctFinding.value,
                    custom_finding: customFindingInput.value.trim(),
                    severity_correction: selectedSeverity,
                    notes: feedbackNotes.value,
                    description: feedbackDescription.value,
                    rating: selectedRating,
                    scan_type: currentScanType,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Feedback submission failed");
            }

            const result = await response.json();

            // Show success state
            feedbackForm.classList.add("hidden");
            feedbackSuccess.classList.remove("hidden");

            // Display feedback message
            feedbackMessage.textContent = result.message;

            // Display mini stats
            feedbackStatsMini.innerHTML = `
                <div class="feedback-stat-item">
                    <span class="feedback-stat-value">${result.feedback_id}</span>
                    <span class="feedback-stat-label">Feedback ID</span>
                </div>
                <div class="feedback-stat-item">
                    <span class="feedback-stat-value">${result.total_feedbacks}</span>
                    <span class="feedback-stat-label">Total Feedbacks</span>
                </div>
                <div class="feedback-stat-item">
                    <span class="feedback-stat-value">${result.model_updated ? "✓" : "—"}</span>
                    <span class="feedback-stat-label">Model Updated</span>
                </div>
                ${result.training_steps ? `
                <div class="feedback-stat-item">
                    <span class="feedback-stat-value">${result.training_steps}</span>
                    <span class="feedback-stat-label">Training Steps</span>
                </div>
                ` : ""}
                ${result.loss !== undefined ? `
                <div class="feedback-stat-item">
                    <span class="feedback-stat-value">${result.loss}</span>
                    <span class="feedback-stat-label">Avg Loss</span>
                </div>
                ` : ""}
                ${result.total_findings ? `
                <div class="feedback-stat-item">
                    <span class="feedback-stat-value">${result.total_findings}</span>
                    <span class="feedback-stat-label">Total Findings</span>
                </div>
                ` : ""}
            `;

            // Re-init icons
            lucide.createIcons();

            // Scroll to feedback success
            feedbackSuccess.scrollIntoView({ behavior: "smooth", block: "center" });

        } catch (err) {
            alert("Feedback Error: " + err.message);
            console.error(err);
        } finally {
            submitFeedbackBtn.disabled = false;
            submitFeedbackBtn.querySelector("span").textContent = "Submit Feedback & Train AI";
        }
    });

    // ---------- Re-Analyze with Updated Model ----------
    reanalyzeBtn.addEventListener("click", async () => {
        if (!currentSessionId) {
            alert("No active session for re-analysis.");
            return;
        }

        // Show loading overlay
        loadingOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        const steps = ["step1", "step2", "step3", "step4"];
        let currentStep = 0;

        const stepInterval = setInterval(() => {
            if (currentStep > 0) {
                document.getElementById(steps[currentStep - 1]).classList.remove("active");
                document.getElementById(steps[currentStep - 1]).classList.add("done");
            }
            if (currentStep < steps.length) {
                document.getElementById(steps[currentStep]).classList.add("active");
                progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
                currentStep++;
            }
        }, 1200);

        try {
            const response = await fetch(`${API_BASE}/api/reanalyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: currentSessionId,
                }),
            });

            clearInterval(stepInterval);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Re-analysis failed");
            }

            const data = await response.json();

            // Complete all steps
            steps.forEach((s) => {
                const el = document.getElementById(s);
                el.classList.remove("active");
                el.classList.add("done");
            });
            progressBar.style.width = "100%";

            await sleep(800);

            // Hide loading
            loadingOverlay.classList.add("hidden");
            document.body.style.overflow = "";

            // Reset step states
            steps.forEach((s) => {
                const el = document.getElementById(s);
                el.classList.remove("active", "done");
            });
            progressBar.style.width = "0%";

            // Update results with new data
            displayResults(data);

        } catch (err) {
            clearInterval(stepInterval);
            loadingOverlay.classList.add("hidden");
            document.body.style.overflow = "";

            steps.forEach((s) => {
                const el = document.getElementById(s);
                el.classList.remove("active", "done");
            });
            progressBar.style.width = "0%";

            alert("Re-Analysis Error: " + err.message);
            console.error(err);
        }
    });

    // ---------- Add More Feedback ----------
    addMoreFeedbackBtn.addEventListener("click", () => {
        resetFeedbackForm();
        feedbackForm.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // =============================================
    // ========== DATASET TRAINING SYSTEM ==========
    // =============================================

    // Epoch selector — presets + custom input
    const epochBtns = document.querySelectorAll(".epoch-btn");
    const epochHint = document.getElementById("epochHint");
    const epochCustomInput = document.getElementById("epochCustomInput");
    const epochHints = {
        1: "1 epoch — Quick test, minimal training",
        3: "3 epochs — Recommended for most datasets",
        5: "5 epochs — Thorough training for larger datasets",
        10: "10 epochs — Extended training for precision",
    };

    function updateEpochHint(val) {
        if (epochHints[val]) {
            epochHint.textContent = epochHints[val];
        } else if (val <= 2) {
            epochHint.textContent = `${val} epoch${val > 1 ? 's' : ''} — Light, quick training`;
        } else if (val <= 10) {
            epochHint.textContent = `${val} epochs — Moderate training`;
        } else if (val <= 30) {
            epochHint.textContent = `${val} epochs — Deep training, may take a while`;
        } else {
            epochHint.textContent = `${val} epochs — Extensive training, this will take time`;
        }
    }

    epochBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            selectedEpochs = parseInt(btn.dataset.epochs);
            epochBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            epochCustomInput.value = selectedEpochs;
            updateEpochHint(selectedEpochs);
        });
    });

    if (epochCustomInput) {
        epochCustomInput.addEventListener("input", () => {
            const val = parseInt(epochCustomInput.value);
            if (!isNaN(val) && val >= 1 && val <= 100) {
                selectedEpochs = val;
                // Deselect preset buttons if value doesn't match any
                epochBtns.forEach((b) => {
                    if (parseInt(b.dataset.epochs) === val) {
                        b.classList.add("active");
                    } else {
                        b.classList.remove("active");
                    }
                });
                updateEpochHint(val);
            }
        });
    }

    // Dataset Upload Zone — with folder support
    const browseFolderBtn = document.getElementById("browseFolderBtn");
    const browseFilesBtn = document.getElementById("browseFilesBtn");
    const datasetFolderInput = document.getElementById("datasetFolderInput");

    if (browseFolderBtn) {
        browseFolderBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            datasetFolderInput.click();
        });
    }

    if (browseFilesBtn) {
        browseFilesBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            datasetFileInput.click();
        });
    }

    if (trainingUploadZone) {
        // Only handle drag-and-drop on the zone itself, not click
        trainingUploadZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            trainingUploadZone.classList.add("drag-over");
        });

        trainingUploadZone.addEventListener("dragleave", () => {
            trainingUploadZone.classList.remove("drag-over");
        });

        trainingUploadZone.addEventListener("drop", (e) => {
            e.preventDefault();
            trainingUploadZone.classList.remove("drag-over");
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                // Check if it looks like a folder upload (multiple images)
                const imageFiles = files.filter(f => f.type.startsWith("image/"));
                if (imageFiles.length > 1) {
                    handleDatasetFolder(files);
                } else {
                    handleDatasetFiles(files[0]);
                }
            }
        });
    }

    // Standard file input (ZIP, TAR, images)
    if (datasetFileInput) {
        datasetFileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                handleDatasetFiles(e.target.files[0]);
            }
        });
    }

    // Folder input (webkitdirectory)
    if (datasetFolderInput) {
        datasetFolderInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                handleDatasetFolder(Array.from(e.target.files));
            }
        });
    }

    // Handle a single file (ZIP/TAR/image)
    function handleDatasetFiles(file) {
        selectedDatasetFiles = [file];
        isDatasetFolder = false;
        trainingFilename.textContent = file.name;
        trainingFilesize.textContent = formatFileSize(file.size);
        trainUploadContent.classList.add("hidden");
        trainingFilePreview.classList.remove("hidden");
        startTrainingBtn.disabled = false;
        lucide.createIcons();
    }

    // Handle folder upload (multiple files from webkitdirectory)
    function handleDatasetFolder(files) {
        // Filter to only image files
        const imageExts = [".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".webp"];
        const imageFiles = files.filter(f => {
            const name = f.name.toLowerCase();
            return imageExts.some(ext => name.endsWith(ext));
        });

        if (imageFiles.length === 0) {
            alert("No image files found in the selected folder. Please select a folder containing medical images (.png, .jpg, .tiff, etc.).");
            return;
        }

        selectedDatasetFiles = imageFiles;
        isDatasetFolder = true;

        // Get folder name from first file's path
        const firstPath = imageFiles[0].webkitRelativePath || imageFiles[0].name;
        const folderName = firstPath.split("/")[0] || "Selected Folder";

        // Count total size
        const totalSize = imageFiles.reduce((sum, f) => sum + f.size, 0);

        // Count subfolders
        const subfolders = new Set();
        imageFiles.forEach(f => {
            const parts = (f.webkitRelativePath || "").split("/");
            if (parts.length > 2) {
                subfolders.add(parts[1]);
            }
        });

        trainingFilename.textContent = `📁 ${folderName} (${imageFiles.length} images)`;
        trainingFilesize.textContent = `${formatFileSize(totalSize)}${subfolders.size > 0 ? ` • ${subfolders.size} subfolders` : ""}`;
        trainUploadContent.classList.add("hidden");
        trainingFilePreview.classList.remove("hidden");
        startTrainingBtn.disabled = false;
        lucide.createIcons();
    }

    if (removeDatasetBtn) {
        removeDatasetBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            resetDatasetUpload();
        });
    }

    function resetDatasetUpload() {
        selectedDatasetFiles = null;
        isDatasetFolder = false;
        datasetFileInput.value = "";
        datasetFolderInput.value = "";
        trainUploadContent.classList.remove("hidden");
        trainingFilePreview.classList.add("hidden");
        startTrainingBtn.disabled = true;
    }

    // Start Training Button
    if (startTrainingBtn) {
        startTrainingBtn.addEventListener("click", async () => {
            if (!selectedDatasetFiles || selectedDatasetFiles.length === 0) {
                alert("Please select a dataset folder or file first.");
                return;
            }

            // Show progress panel
            trainingProgressPanel.classList.remove("hidden");
            trainingResultPanel.classList.add("hidden");
            startTrainingBtn.disabled = true;
            startTrainingBtn.querySelector("span").textContent = "Training in Progress...";

            trainingProgressFill.style.width = "0%";
            trainingProgressPct.textContent = "0%";
            trainingStatusMessage.textContent = "Preparing upload...";

            const formData = new FormData();
            formData.append("description", datasetDescription.value);
            formData.append("finding_label", datasetFindingLabel.value);
            formData.append("epochs", selectedEpochs);
            formData.append("is_folder", isDatasetFolder ? "true" : "false");

            if (isDatasetFolder) {
                selectedDatasetFiles.forEach((file) => {
                    const relativePath = file.webkitRelativePath || file.name;
                    formData.append("dataset_files", file, relativePath);
                });
                formData.append("folder_name", selectedDatasetFiles[0].webkitRelativePath.split("/")[0] || "dataset");
            } else {
                formData.append("dataset", selectedDatasetFiles[0]);
            }

            const fileCount = isDatasetFolder ? selectedDatasetFiles.length : 1;
            trainingStatusMessage.textContent = `Uploading ${fileCount} file${fileCount > 1 ? 's' : ''}...`;

            // Use XMLHttpRequest for real-time upload progress
            const xhr = new XMLHttpRequest();

            const uploadPromise = new Promise((resolve, reject) => {
                // --- Upload progress (0% to 50% of the bar) ---
                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        const uploadPct = Math.round((e.loaded / e.total) * 50);
                        trainingProgressFill.style.width = `${uploadPct}%`;
                        trainingProgressPct.textContent = `${uploadPct}%`;

                        const loadedMB = (e.loaded / 1048576).toFixed(1);
                        const totalMB = (e.total / 1048576).toFixed(1);
                        trainingStatusMessage.textContent = `Uploading: ${loadedMB} MB / ${totalMB} MB (${fileCount} files)`;
                    }
                });

                xhr.upload.addEventListener("load", () => {
                    trainingProgressFill.style.width = "50%";
                    trainingProgressPct.textContent = "50%";
                    trainingStatusMessage.textContent = "Upload complete! Server is processing & training...";
                });

                xhr.addEventListener("load", () => {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(result);
                        } else {
                            reject(new Error(result.error || "Training failed"));
                        }
                    } catch (e) {
                        reject(new Error("Invalid response from server"));
                    }
                });

                xhr.addEventListener("error", () => {
                    reject(new Error("Network error during upload"));
                });

                xhr.addEventListener("timeout", () => {
                    reject(new Error("Upload timed out"));
                });

                xhr.open("POST", `${API_BASE}/api/train`);
                xhr.timeout = 0; // No timeout for large uploads
                xhr.send(formData);
            });

            // Poll training progress while waiting for server response
            let trainingPollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${API_BASE}/api/train/status`);
                    const status = await statusRes.json();
                    if (status.is_training && status.progress > 0) {
                        // Map server progress (0-100) to bar progress (50-100)
                        const serverPct = 50 + Math.round(status.progress * 0.5);
                        trainingProgressFill.style.width = `${serverPct}%`;
                        trainingProgressPct.textContent = `${serverPct}%`;
                        trainingStatusMessage.textContent = status.message || "Training...";
                    }
                } catch (e) {
                    // Ignore poll errors
                }
            }, 1500);

            try {
                const result = await uploadPromise;
                clearInterval(trainingPollInterval);

                // Update progress to 100%
                trainingProgressFill.style.width = "100%";
                trainingProgressPct.textContent = "100%";
                trainingStatusMessage.textContent = "Training complete!";

                await sleep(600);

                // Show result panel
                trainingProgressPanel.classList.add("hidden");
                trainingResultPanel.classList.remove("hidden");

                trainingResultMessage.textContent = result.message;

                // Build stats
                trainingResultStats.innerHTML = `
                    <div class="feedback-stat-item">
                        <span class="feedback-stat-value">${result.images_processed || 0}</span>
                        <span class="feedback-stat-label">Images Processed</span>
                    </div>
                    <div class="feedback-stat-item">
                        <span class="feedback-stat-value">${result.epochs || 0}</span>
                        <span class="feedback-stat-label">Epochs</span>
                    </div>
                    <div class="feedback-stat-item">
                        <span class="feedback-stat-value">${result.elapsed_seconds || 0}s</span>
                        <span class="feedback-stat-label">Duration</span>
                    </div>
                    <div class="feedback-stat-item">
                        <span class="feedback-stat-value">${(result.labels_trained || []).length}</span>
                        <span class="feedback-stat-label">Labels Trained</span>
                    </div>
                    <div class="feedback-stat-item">
                        <span class="feedback-stat-value">${result.total_findings || 0}</span>
                        <span class="feedback-stat-label">Total Findings</span>
                    </div>
                    ${result.epoch_losses && result.epoch_losses.length > 0 ? `
                    <div class="feedback-stat-item">
                        <span class="feedback-stat-value">${result.epoch_losses[result.epoch_losses.length - 1]}</span>
                        <span class="feedback-stat-label">Final Loss</span>
                    </div>
                    ` : ""}
                `;

                lucide.createIcons();
                trainingResultPanel.scrollIntoView({ behavior: "smooth", block: "center" });

            } catch (err) {
                clearInterval(trainingPollInterval);
                trainingProgressPanel.classList.add("hidden");
                alert("Training Error: " + err.message);
                console.error(err);
            } finally {
                startTrainingBtn.disabled = false;
                startTrainingBtn.querySelector("span").textContent = "Start Training";
            }
        });
    }

    // Train Another Dataset
    if (trainAnotherBtn) {
        trainAnotherBtn.addEventListener("click", () => {
            trainingResultPanel.classList.add("hidden");
            resetDatasetUpload();
            datasetDescription.value = "";
            datasetFindingLabel.value = "";
            selectedEpochs = 3;
            epochBtns.forEach((b) => b.classList.remove("active"));
            epochCustomInput.value = 3;
            updateEpochHint(3);
            trainingUploadZone.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }

    // ---------- Utilities ----------
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // ---------- Intersection Observer for animations ----------
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.animation = "fadeInUp 0.6s ease-out forwards";
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe feature cards and pipeline steps
    document.querySelectorAll(".feature-card, .pipeline-step").forEach((el) => {
        el.style.opacity = "0";
        observer.observe(el);
    });
});

