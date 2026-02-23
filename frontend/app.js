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
    const multiPreviewGrid = document.getElementById("multiPreviewGrid");
    const previewFilename = document.getElementById("previewFilename");
    const previewFilesize = document.getElementById("previewFilesize");
    const removeFileBtn = document.getElementById("removeFileBtn");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const loadingOverlay = document.getElementById("loadingOverlay");
    const progressBar = document.getElementById("progressBar");
    const resultsSection = document.getElementById("resultsSection");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    const newScanBtn = document.getElementById("newScanBtn");
    const exploreInsurancesBtn = document.getElementById("exploreInsurancesBtn");
    const scanInsuranceResults = document.getElementById("scanInsuranceResults");
    const scanInsuranceList = document.getElementById("scanInsuranceList");
    const navStatus = document.getElementById("navStatus");
    const navbar = document.getElementById("navbar");
    const authStatusText = document.getElementById("authStatusText");
    const navAuthLink = document.getElementById("navAuthLink");
    const userProfileMenu = document.getElementById("userProfileMenu");
    const profileName = document.getElementById("profileName");
    const logoutBtn = document.getElementById("logoutBtn");

    // ---------- Global Config & Auth State ----------
    const API_BASE = window.location.origin;
    window.AppConfig = {};
    window.currentUser = null;
    let currentScanData = null; // Store scan data for insurance prompt

    async function initializeSystemConfig() {
        try {
            const res = await fetch(`${API_BASE}/api/config`);
            if (res.ok) {
                window.AppConfig = await res.json();

                // Init Supabase if loaded
                if (window.supabase && AppConfig.supabase_url && AppConfig.supabase_anon_key) {
                    window.supabaseClient = supabase.createClient(
                        AppConfig.supabase_url,
                        AppConfig.supabase_anon_key
                    );

                    // Trigger global Auth listener
                    setupAuthListener();
                } else if (window.supabase) {
                    console.warn("Supabase keys missing. Check .env!");
                }
            }
        } catch (err) {
            console.error("Failed to fetch system config:", err);
        }
    }

    function setupAuthListener() {
        if (!window.supabaseClient) return;

        // Immediately check current session
        window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session);
        });

        // Listen for changes
        window.supabaseClient.auth.onAuthStateChange((_event, session) => {
            handleAuthChange(session);
        });
    }

    function handleAuthChange(session) {
        if (session && session.user) {
            window.currentUser = session.user;

            // Name resolution
            let displayName = "Student";
            if (session.user.user_metadata && session.user.user_metadata.full_name) {
                displayName = session.user.user_metadata.full_name.split(' ')[0];
            } else if (session.user.email) {
                displayName = session.user.email.split('@')[0];
            }

            if (authStatusText) {
                authStatusText.innerHTML = `Welcome, <b>${displayName}</b>`;
                if (navStatus.querySelector('.status-dot')) {
                    navStatus.querySelector('.status-dot').style.background = "var(--accent-green)";
                }
            }

            if (userProfileMenu && profileName && logoutBtn) {
                userProfileMenu.style.display = 'flex';
                profileName.textContent = displayName;
                if (navAuthLink) navAuthLink.style.display = 'none';

                logoutBtn.onclick = async () => {
                    await window.supabaseClient.auth.signOut();
                    window.location.reload();
                };
            } else if (navAuthLink) {
                navAuthLink.style.display = 'block';
                navAuthLink.innerHTML = `<i data-lucide="log-out"></i> Logout`;
                navAuthLink.href = "#";
                navAuthLink.onclick = async (e) => {
                    e.preventDefault();
                    await window.supabaseClient.auth.signOut();
                    window.location.reload();
                };
            }
        } else {
            window.currentUser = null;
            if (authStatusText) {
                authStatusText.textContent = "System Online";
            }
            if (userProfileMenu) userProfileMenu.style.display = 'none';
            if (navAuthLink) {
                navAuthLink.style.display = 'block';
                navAuthLink.innerHTML = `Login`;
                navAuthLink.href = "/login";
                navAuthLink.onclick = null;
            }

            // Route protection handled in HTML head
        }
    }

    // Call init
    initializeSystemConfig();

    // Feedback DOM References
    const feedbackForm = document.getElementById("feedbackForm");
    const feedbackSuccess = document.getElementById("feedbackSuccess");
    const starRating = document.getElementById("starRating");
    const ratingText = document.getElementById("ratingText");
    const correctFinding = document.getElementById("correctFinding");
    const customFindingWrapper = document.getElementById("customFindingWrapper");
    const customFindingInput = document.getElementById("customFindingInput");
    const feedbackDescription = document.getElementById("feedbackDescription");
    // feedbackScanTag removed
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

    let selectedFiles = [];
    let currentReportUrl = null;
    let currentSessionId = null;
    let currentScanType = "Unknown";
    let selectedRating = 0;
    let selectedSeverity = "";
    let selectedDatasetFiles = null;
    let isDatasetFolder = false;
    let selectedEpochs = 3;
    let batchReportFilenames = [];  // for Download All

    // ---------- API Base URL ----------

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
    if (uploadZone) {
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
                handleFiles(files);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                handleFiles(e.target.files);
            }
        });
    }

    function handleFiles(fileList) {
        const validFiles = [];
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            if (file.type.startsWith("image/")) {
                validFiles.push(file);
            }
        }
        if (validFiles.length === 0) {
            alert("Please upload valid image files.");
            return;
        }

        selectedFiles = validFiles;

        // Summary text
        previewFilename.textContent = validFiles.length === 1 ? validFiles[0].name : `${validFiles.length} scans selected`;
        const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
        previewFilesize.textContent = formatFileSize(totalSize);

        // Build thumbnail grid
        multiPreviewGrid.innerHTML = "";
        validFiles.forEach((file, idx) => {
            const thumb = document.createElement("div");
            thumb.className = "multi-preview-thumb";
            const img = document.createElement("img");
            img.alt = file.name;
            const reader = new FileReader();
            reader.onload = (ev) => { img.src = ev.target.result; };
            reader.readAsDataURL(file);
            const label = document.createElement("span");
            label.className = "multi-preview-label";
            label.textContent = file.name.length > 18 ? file.name.substring(0, 15) + "..." : file.name;
            thumb.appendChild(img);
            thumb.appendChild(label);
            multiPreviewGrid.appendChild(thumb);
        });

        uploadZone.classList.add("hidden");
        previewArea.classList.remove("hidden");
        lucide.createIcons();
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener("click", () => {
            resetUpload();
        });
    }

    function resetUpload() {
        selectedFiles = [];
        fileInput.value = "";
        multiPreviewGrid.innerHTML = "";
        uploadZone.classList.remove("hidden");
        previewArea.classList.add("hidden");
        resultsSection.classList.add("hidden");
        const batchSec = document.getElementById("batchResultsSection");
        if (batchSec) batchSec.classList.add("hidden");
        currentSessionId = null;
        batchReportFilenames = [];
        resetFeedbackForm();
        if (scanInsuranceResults) scanInsuranceResults.classList.add("hidden");
    }

    // ---------- Analyze ----------
    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", () => {
            if (selectedFiles.length === 0) return;
            startAnalysis();
        });
    }

    // ---------- Puter.js Free AI Analysis (try before API keys) ----------
    async function tryPuterAnalysis(file, patientName, scanType, bodyPart, patientDescription) {
        if (typeof puter === "undefined") {
            console.log("[Puter] ❌ Puter.js not loaded (puter object undefined)");
            return null;
        }
        if (!puter.ai || !puter.ai.chat) {
            console.log("[Puter] ❌ puter.ai.chat not available");
            return null;
        }

        try {
            console.log("[Puter] 🟢 Attempting free AI analysis via Puter.js...");

            // Convert file to data URL for Puter vision (same as providing an image URL)
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            console.log("[Puter] Image converted to data URL, size:", Math.round(dataUrl.length / 1024), "KB");

            const prompt = `You are an expert medical AI assistant specialized in radiology. Analyze the provided medical scan image.
Patient Name: ${patientName || "Anonymous"}
Scan Type: ${scanType || "Unknown"}
Body Part: ${bodyPart || "Unknown"}
${patientDescription ? "Patient History/Symptoms: " + patientDescription : ""}

Analyze this medical scan image in detail and return a valid JSON object ONLY, with NO markdown formatting, NO code blocks, matching this exact structure:
{
    "findings": [
        {"finding": "Name of finding", "confidence": 95.0, "description": "Medical description", "severity": "low/medium/high"}
    ],
    "overall_severity": "low/medium/high",
    "primary_finding": "Most significant finding name",
    "detailed_report": {
        "header": {
            "patient_name": "${patientName || "Anonymous"}", "modality": "...", "scan_date": "${new Date().toLocaleDateString()}", "body_part": "${bodyPart || "Unknown"}",
            "ai_version": "HealthGuard DenseNet-121 v2.5", "physician": "AI Analysis"
        },
        "quality": {
            "image_clarity": "Diagnostic quality score (e.g. 98%)", "artifacts": "None/Motion/etc",
            "contrast": "Optimal/Suboptimal", "slice_completeness": "Yes/No"
        },
        "structures": {
            "Lungs / Primary Region": "Detailed observation...",
            "Mediastinum / Heart": "Detailed observation...",
            "Bones / Skeletal": "Detailed observation...",
            "Soft Tissues": "Detailed observation..."
        },
        "metrics": [
            {"parameter": "Relevant Metric", "result": "Value", "normal": "Range", "status": "Normal/Abnormal"}
        ],
        "risks": [
            {"pathology": "Condition", "probability": "Percentage", "risk_category": "Severity"}
        ],
        "summary": "Comprehensive clinical summary of the case.",
        "recommendations": ["Recommendation 1", "Recommendation 2"],
        "confidence": "Overall confidence score (e.g. 98%)"
    }
}`;

            // Models from Puter.js docs that support vision
            const modelsToTry = ["gpt-4o", "gpt-4.1", "gpt-5-nano"];
            let lastErr = null;

            for (const model of modelsToTry) {
                try {
                    console.log(`[Puter] 🔄 Trying model: ${model}...`);

                    // puter.ai.chat(prompt, imageUrl, options) - per official Puter.js tutorial
                    const response = await Promise.race([
                        puter.ai.chat(prompt, dataUrl, { model: model }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout 60s")), 60000))
                    ]);

                    console.log("[Puter] Got response from", model, "- type:", typeof response);

                    // Extract text from response (Puter returns various formats)
                    let text = "";
                    if (typeof response === "string") {
                        text = response;
                    } else if (response?.message?.content) {
                        // Object with message.content
                        if (Array.isArray(response.message.content)) {
                            text = response.message.content.map(b => b.text || b.toString()).join("");
                        } else {
                            text = String(response.message.content);
                        }
                    } else if (response?.text) {
                        text = response.text;
                    } else if (response != null) {
                        text = String(response);
                    }

                    if (!text || text === "[object Object]" || text.length < 20) {
                        console.warn(`[Puter] ⚠️ ${model} returned empty/short text, trying next model`);
                        lastErr = "Empty response";
                        continue;
                    }

                    console.log("[Puter] Response text length:", text.length);

                    // Clean markdown code blocks and parse JSON
                    text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

                    // Try to extract JSON if there's extra text around it
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        text = jsonMatch[0];
                    }

                    const data = JSON.parse(text);

                    if (data.findings && data.findings.length > 0) {
                        console.log(`[Puter] ✅ Analysis succeeded with ${model}! Findings:`, data.findings.length);
                        return data;
                    } else {
                        console.warn(`[Puter] ⚠️ ${model} returned JSON but no findings`);
                        lastErr = "No findings in response";
                    }
                } catch (e) {
                    console.warn(`[Puter] ❌ Model ${model} failed:`, e.message || e);
                    lastErr = e;
                }
            }

            console.log("[Puter] All models failed, falling back to backend API keys. Last error:", lastErr);
            return null;
        } catch (err) {
            console.warn("[Puter] Analysis error, falling back to backend API keys:", err);
            return null;
        }
    }

    // Google Translate Free API for Web Results
    async function translateText(text, targetLang) {
        if (!text || targetLang === "en") return text;
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const data = await res.json();
            let translated = "";
            if (data && data[0]) {
                for (let i = 0; i < data[0].length; i++) {
                    if (data[0][i][0]) translated += data[0][i][0];
                }
            }
            return translated || text;
        } catch (e) {
            console.error("Translation error:", e);
            return text;
        }
    }

    async function translateAnalysisData(data, targetLang) {
        if (targetLang === "en") return data;
        try {
            const trans = async (t) => await translateText(t, targetLang);
            if (data.analysis) {
                if (data.analysis.primary_finding) data.analysis.primary_finding = await trans(data.analysis.primary_finding);
                if (data.analysis.detailed_report) {
                    const dr = data.analysis.detailed_report;
                    if (dr.summary) dr.summary = await trans(dr.summary);
                    if (dr.recommendations) {
                        for (let i = 0; i < dr.recommendations.length; i++) {
                            dr.recommendations[i] = await trans(dr.recommendations[i]);
                        }
                    }
                    if (dr.structures) {
                        for (let key in dr.structures) {
                            dr.structures[key] = await trans(dr.structures[key]);
                        }
                    }
                    if (dr.metrics) {
                        for (let m of dr.metrics) {
                            if (m.parameter) m.parameter = await trans(m.parameter);
                            if (m.result) m.result = await trans(m.result);
                            if (m.normal) m.normal = await trans(m.normal);
                            // skip m.status to keep CSS classes
                        }
                    }
                    if (dr.risks) {
                        for (let r of dr.risks) {
                            if (r.pathology) r.pathology = await trans(r.pathology);
                            if (r.probability) r.probability = await trans(r.probability);
                            if (r.risk_category) r.risk_category = await trans(r.risk_category);
                        }
                    }
                }
                if (data.analysis.findings) {
                    for (let f of data.analysis.findings) {
                        if (f.finding) f.finding = await trans(f.finding);
                        if (f.description) f.description = await trans(f.description);
                    }
                }
            }
            if (data.scan_type && data.scan_type.scan_type) {
                data.scan_type.scan_type = await trans(data.scan_type.scan_type);
            }
        } catch (e) { console.error(e); }
        return data;
    }

    async function startAnalysis() {
        // Show loading
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
        }, 1500);

        try {
            const formData = new FormData();
            const isBatch = selectedFiles.length > 1;

            // ---------- COMPRESS IMAGES ----------
            const compressPromises = selectedFiles.map(file => {
                return new Promise((resolve) => {
                    if (typeof Compressor === 'undefined') {
                        console.warn("[Compressor] Compressor is not defined (likely cached HTML or blocked CDN). Using original image.");
                        resolve(file);
                        return;
                    }

                    new Compressor(file, {
                        quality: 0.6,
                        maxWidth: 1600,
                        maxHeight: 1600,
                        success(result) {
                            resolve(new File([result], file.name, { type: result.type || 'image/jpeg' }));
                        },
                        error(err) {
                            console.warn("[Compressor] Failed, using original:", err);
                            resolve(file); // fallback
                        }
                    });
                });
            });

            const processedFiles = await Promise.all(compressPromises);

            // Append compressed files under 'images' key (for batch) or 'image' (single)
            processedFiles.forEach((f) => {
                formData.append(isBatch ? "images" : "image", f);
            });

            // Add metadata
            const patientNameInput = document.getElementById("patientNameInput");
            const scanTypeInput = document.getElementById("scanTypeInput");
            const bodyPartInput = document.getElementById("bodyPartInput");
            const patientDescriptionInput = document.getElementById("patientDescriptionInput");

            const patientName = patientNameInput ? patientNameInput.value : "";
            const scanType = scanTypeInput ? scanTypeInput.value : "";
            const bodyPart = bodyPartInput ? bodyPartInput.value : "";
            const patientDesc = patientDescriptionInput ? patientDescriptionInput.value : "";

            if (patientName) formData.append("patient_name", patientName);
            if (scanType) formData.append("scan_type", scanType);
            if (bodyPart) formData.append("body_part", bodyPart);
            if (patientDesc) formData.append("patient_description", patientDesc);

            if (window.currentUser && window.currentUser.id) {
                formData.append("user_id", window.currentUser.id);
            }

            // ---- Try Puter.js free AI analysis first (for any upload) ----
            // Try on the first file to verify Puter is working
            console.log("[Puter] Starting Puter.js analysis attempt...");
            const puterResult = await tryPuterAnalysis(
                processedFiles[0], patientName, scanType, bodyPart, patientDesc
            );
            if (puterResult) {
                formData.append("puter_result", JSON.stringify(puterResult));
                console.log("[Puter] ✅ Pre-analyzed result attached to form data");
            } else {
                console.log("[Puter] ⚠️ Puter analysis returned null, will use API keys on backend");
            }

            const endpoint = isBatch ? `${API_BASE}/api/analyze-batch` : `${API_BASE}/api/analyze`;

            const response = await fetch(endpoint, {
                method: "POST",
                body: formData,
            });

            clearInterval(stepInterval);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Analysis failed");
            }

            let data = await response.json();

            // Language Translation
            const languageSelect = document.getElementById("languageSelect");
            const targetLang = languageSelect ? languageSelect.value : "en";
            if (targetLang !== "en") {
                const loadH2 = document.querySelector(".loading-content h2");
                if (loadH2) loadH2.textContent = `Translating Web Report to ${targetLang.toUpperCase()}...`;
                if (isBatch) {
                    for (let i = 0; i < data.results.length; i++) {
                        data.results[i] = await translateAnalysisData(data.results[i], targetLang);
                    }
                } else {
                    data = await translateAnalysisData(data, targetLang);
                }
                if (loadH2) loadH2.textContent = "Analyzing Your Scan";
            }

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

            // Display results
            if (isBatch) {
                displayBatchResults(data.results);
            } else {
                displayResults(data);
            }
        } catch (err) {
            clearInterval(stepInterval);
            loadingOverlay.classList.add("hidden");
            document.body.style.overflow = "";

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
        currentScanData = data; // Save for external features
        // Store session ID for feedback
        currentSessionId = data.session_id;

        // Scan Type
        const scanType = data.scan_type;
        currentScanType = scanType.scan_type || "Unknown";
        // scanTypeValue removed
        // scanTypeConf removed

        // Update scan type in feedback panel - handled by editable input now
        // feedbackScanTag removed

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
        // 2. Primary Finding Description (Detailed Report)
        // We now use innerHTML because the backend sends formatted HTML
        // 2. Primary Finding Description (Detailed Report)
        // Description is already handled in the findingsList loop below

        // 3. Scan Type (Auto-fill but allow editing)
        const feedbackScanTypeInput = document.getElementById("feedbackScanTypeInput");
        if (feedbackScanTypeInput) {
            feedbackScanTypeInput.value = scanType.scan_type;
        }

        // Model & Source Info
        const modelName = data.analysis.model_info.name;
        // Source info hidden per user request

        document.getElementById("modelValue").textContent = modelName;
        document.getElementById("modelDevice").textContent = `Device: ${data.analysis.model_info.device}`;

        // 4. Prediction Score (New Feature)
        // Extract confidence from detailed report or findings
        let confidenceScore = 0;
        if (data.analysis.detailed_report && data.analysis.detailed_report.confidence) {
            // Try to parse "98%" or "0.98"
            const confStr = String(data.analysis.detailed_report.confidence).replace("%", "");
            confidenceScore = parseFloat(confStr);
            if (confidenceScore <= 1) confidenceScore *= 100; // Handle 0.98
        } else if (data.analysis.findings && data.analysis.findings.length > 0) {
            confidenceScore = data.analysis.findings[0].confidence || 0;
        }

        // Display Score prominently next to severity
        const scoreDisplay = document.createElement("div");
        scoreDisplay.className = "prediction-score-badge summary-card"; // Added summary-card class for consistent styling
        scoreDisplay.innerHTML = `
            <div class="score-label" style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">AI Confidence</div>
            <div class="score-value" style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${Math.round(confidenceScore)}/100</div>
        `;

        // Insert after severity card if not already there
        const existingScore = document.querySelector(".prediction-score-badge");
        if (existingScore) existingScore.remove();

        // Use existing severityCard variable (declared above)
        if (severityCard && severityCard.parentNode) {
            severityCard.parentNode.insertBefore(scoreDisplay, severityCard.nextSibling);
        }

        // Styling is now partly handled by summary-card class, plus specific overrides
        scoreDisplay.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-width: 100px;
            margin-left: 12px;
            background: rgba(255, 255, 255, 0.05); /* Ensure visibility */
        `;

        // Images section removed per user request

        // Render Heatmap (New Feature)
        const existingHeatmap = document.getElementById("heatmapDisplayContainer");
        if (existingHeatmap) existingHeatmap.remove();

        if (data.images && data.images.heatmap) {
            const heatmapContainer = document.createElement("div");
            heatmapContainer.id = "heatmapDisplayContainer";
            heatmapContainer.className = "summary-card";
            heatmapContainer.style.cssText = `
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                margin-top: 16px;
                padding: 16px;
                background: rgba(255, 255, 255, 0.03);
            `;

            heatmapContainer.innerHTML = `
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="camera" style="width: 16px; height: 16px;"></i> Hi-Res CAM Analysis
                </div>
                <img src="${data.images.heatmap}" alt="Scan Heatmap" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            `;

            // Insert after the flex container holding severity and score
            if (severityCard && severityCard.parentNode && severityCard.parentNode.parentNode) {
                severityCard.parentNode.after(heatmapContainer);
            }

            // --- Add Puter.js Image Generation Button UI ---
            const existingVizContainer = document.getElementById("medicalVizContainer");
            if (existingVizContainer) existingVizContainer.remove();

            const vizContainer = document.createElement("div");
            vizContainer.id = "medicalVizContainer";
            vizContainer.style.cssText = `
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                margin-top: 20px;
                padding: 20px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255,255,255,0.05);
                border-radius: 12px;
            `;

            const generateBtn = document.createElement("button");
            generateBtn.className = "btn btn-primary";
            generateBtn.style.cssText = `
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border: none;
                padding: 12px 24px;
                color: white;
                font-weight: 600;
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
            `;
            generateBtn.innerHTML = `<i data-lucide="image" style="width:18px;height:18px;"></i> Generate 3D Organ Visualization`;

            const resultBox = document.createElement("div");
            resultBox.id = "vizResultBox";
            resultBox.style.cssText = `margin-top: 16px; text-align: center; width: 100%;`;

            vizContainer.appendChild(generateBtn);
            vizContainer.appendChild(resultBox);
            heatmapContainer.after(vizContainer);
            lucide.createIcons();

            // Function to run Image Generation
            generateBtn.addEventListener("click", async () => {
                if (typeof puter === 'undefined' || !puter.ai) {
                    alert("Puter.js is not loaded or available.");
                    return;
                }

                generateBtn.disabled = true;
                generateBtn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width:18px;height:18px;"></i> Generating Visualization...`;
                lucide.createIcons();
                resultBox.innerHTML = "<p style='color: var(--text-secondary); font-size: 0.9rem;'>Creating High-Resolution 3D medical visualization...</p>";

                try {
                    // Create strong prompt using body part and primary finding
                    let bodyPart = "the organ";
                    let finding = "medical conditions";
                    if (data.analysis.detailed_report && data.analysis.detailed_report.header) {
                        bodyPart = data.analysis.detailed_report.header.body_part || bodyPart;
                    }
                    finding = data.analysis.primary_finding || finding;

                    const prompt = `Highly detailed 3D photorealistic medical visualization of a human ${bodyPart}, clearly highlighting areas indicating ${finding}. Microscopic and macroscopic view combination, cinematic volumetric lighting, cyan and glowing red warning colors, incredibly sharp focus, professional medical textbook render style, exceptional clarity.`;

                    // Call Puter.js
                    const imageElement = await puter.ai.txt2img(prompt, { model: "black-forest-labs/flux.2-pro" });

                    // Style the resulting image
                    imageElement.style.maxWidth = "100%";
                    imageElement.style.maxHeight = "400px";
                    imageElement.style.borderRadius = "8px";
                    imageElement.style.border = "1px solid rgba(255,255,255,0.1)";
                    imageElement.style.boxShadow = "0 8px 25px rgba(0,0,0,0.5)";

                    // Show in DOM
                    resultBox.innerHTML = "";
                    resultBox.appendChild(imageElement);

                    // Extract base64 and send to backend
                    const canvas = document.createElement('canvas');
                    canvas.width = imageElement.naturalWidth || imageElement.width || 1024;
                    canvas.height = imageElement.naturalHeight || imageElement.height || 1024;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imageElement, 0, 0);
                    const base64Data = canvas.toDataURL('image/png');

                    resultBox.innerHTML += "<p style='color: var(--accent-green); font-size: 0.85rem; margin-top: 8px;'>Updating PDF Report...</p>";

                    const updateRes = await fetch('/api/update_report_viz', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            session_id: data.session_id,
                            image_base64: base64Data
                        })
                    });

                    if (updateRes.ok) {
                        const updateData = await updateRes.json();
                        resultBox.innerHTML += "<p style='color: var(--accent-green); font-size: 0.85rem; margin-top: 4px;'><i data-lucide='check-circle'></i> Attached to PDF Report successfully!</p>";
                        // Update the download link if needed, though it usually uses the same path `/api/report/{filename}`
                        if (updateData.report_url) {
                            const dlBtn = document.getElementById("downloadReportBtn");
                            if (dlBtn) dlBtn.onclick = () => window.open(updateData.report_url, '_blank');
                        }
                    } else {
                        resultBox.innerHTML += "<p style='color: var(--accent-red); font-size: 0.85rem; margin-top: 4px;'><i data-lucide='alert-triangle'></i> Failed to attach to PDF.</p>";
                    }
                    lucide.createIcons();
                } catch (e) {
                    console.error("Image generation error:", e);
                    resultBox.innerHTML = `<p style='color: var(--accent-red);'><i data-lucide="x-circle"></i> Error generating image: ${e.message}</p>`;
                    lucide.createIcons();
                } finally {
                    generateBtn.style.display = 'none'; // Hide button after it succeeds/fails
                }
            });

        }

        // Findings List
        const findingsList = document.getElementById("findingsList");
        findingsList.innerHTML = "";

        if (data.analysis.detailed_report) {
            const report = data.analysis.detailed_report;

            // Container
            const container = document.createElement("div");
            container.className = "report-container";

            // 1. Info Grid
            const headerVars = report.header;
            const headerGrid = document.createElement("div");
            headerGrid.className = "report-header-grid";
            headerGrid.innerHTML = `
                <div class="report-kv"><span class="report-label">Patient Name</span><span class="report-value">${headerVars.patient_name}</span></div>
                <div class="report-kv"><span class="report-label">Modality</span><span class="report-value">${headerVars.modality}</span></div>
                <div class="report-kv"><span class="report-label">Scan Date</span><span class="report-value">${headerVars.scan_date}</span></div>
                <div class="report-kv"><span class="report-label">Body Part</span><span class="report-value">${headerVars.body_part}</span></div>
                <div class="report-kv"><span class="report-label">AI Engine</span><span class="report-value">${headerVars.ai_version}</span></div>
            `;
            container.appendChild(headerGrid);

            // 2. Structural Analysis
            const structureSec = document.createElement("div");
            structureSec.className = "report-section";
            let structureHTML = `<div class="report-section-title"><i data-lucide="layers"></i>Structural Analysis</div>`;
            for (const [region, desc] of Object.entries(report.structures)) {
                structureHTML += `<div class="report-text-block" style="margin-bottom: 8px;"><strong>${region}:</strong> ${desc}</div>`;
            }
            structureSec.innerHTML = structureHTML;
            container.appendChild(structureSec);

            // 3. Metrics
            const metricsSec = document.createElement("div");
            metricsSec.className = "report-section";
            let metricsHTML = `<div class="report-section-title"><i data-lucide="bar-chart-2"></i>Quantitative Metrics</div>`;
            metricsHTML += `<table class="report-table"><thead><tr><th>Parameter</th><th>Result</th><th>Normal Range</th><th>Status</th></tr></thead><tbody>`;
            report.metrics.forEach(m => {
                const statusClass = m.status === 'Normal' ? 'status-normal' : m.status === 'Abnormal' ? 'status-abnormal' : 'status-review';
                metricsHTML += `<tr><td>${m.parameter}</td><td>${m.result}</td><td>${m.normal}</td><td class="${statusClass}">${m.status}</td></tr>`;
            });
            metricsHTML += `</tbody></table>`;
            metricsSec.innerHTML = metricsHTML;
            container.appendChild(metricsSec);

            // 4. Risk Stratification
            const riskSec = document.createElement("div");
            riskSec.className = "report-section";
            let riskHTML = `<div class="report-section-title"><i data-lucide="alert-circle"></i>Risk Stratification</div>`;
            riskHTML += `<table class="report-table"><thead><tr><th>Pathology</th><th>Probability</th><th>Risk Category</th></tr></thead><tbody>`;
            report.risks.forEach(r => {
                riskHTML += `<tr><td>${r.pathology}</td><td>${r.probability}</td><td>${r.risk_category}</td></tr>`;
            });
            riskHTML += `</tbody></table>`;
            riskSec.innerHTML = riskHTML;
            container.appendChild(riskSec);

            // 5. Summary
            const summarySec = document.createElement("div");
            summarySec.className = "report-section";
            summarySec.innerHTML = `
                <div class="report-section-title"><i data-lucide="file-text"></i>Clinical Interpretation</div>
                <div class="report-text-block">${report.summary}</div>
            `;
            container.appendChild(summarySec);

            // 6. Recommendations
            const recSec = document.createElement("div");
            recSec.className = "report-section";
            let recHTML = `<div class="report-section-title"><i data-lucide="check-square"></i>Recommendations</div><ul class="report-list">`;
            report.recommendations.forEach(r => {
                recHTML += `<li>${r}</li>`;
            });
            recHTML += `</ul>`;
            recSec.innerHTML = recHTML;
            container.appendChild(recSec);

            // 7. Confidence (Prediction Score)
            const confSec = document.createElement("div");
            confSec.className = "report-section";
            confSec.innerHTML = `
                <div class="report-section-title"><i data-lucide="shield-check"></i>AI Confidence</div>
                 <div class="report-text-block"><strong>Overall Confidence:</strong> ${report.confidence}</div>
            `;
            container.appendChild(confSec);

            // 8. Visual Analysis (Re-enabled per request)
            if (data.analysis.annotated_path) {
                const visualSec = document.createElement("div");
                visualSec.className = "report-section";
                visualSec.innerHTML = `
                    <div class="report-section-title"><i data-lucide="eye"></i>Visual AI Analysis</div>
                    <div class="report-text-block" style="margin-bottom: 12px;">
                        The image below highlights the specific regions the AI analyzed to determine the findings. 
                        Warmer colors (red/orange) indicate areas of high interest.
                    </div>
                    <div style="display: flex; justify-content: center; background: #000; padding: 10px; border-radius: 8px;">
                        <img src="${API_BASE}/results/${data.analysis.annotated_path}" 
                             alt="AI Analyzed Scan" 
                             style="max-width: 100%; max-height: 400px; object-fit: contain; border-radius: 4px;">
                    </div>
                `;
                container.appendChild(visualSec);
            }

            findingsList.appendChild(container);

            // Initialize new icons
            setTimeout(() => {
                if (window.lucide) window.lucide.createIcons();
            }, 100);

        } else {
            // Fallback to simple list
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
        }

        // Scan Type Bars (Removed)
        // const scanBars = document.getElementById("scanTypeBars");
        // ... (removed logic)

        // Report URL (Prefer Supabase Cloud CDN if configured)
        currentReportUrl = data.report.supabase_report_url || data.report.download_url;

        // Medical Visualization
        const medicalVizPanel = document.getElementById("medicalVizPanel");
        const medicalVizImage = document.getElementById("medicalVizImage");
        const vizScanId = document.getElementById("vizScanId");

        if (data.images && data.images.medical_viz) {
            medicalVizImage.src = `${API_BASE}${data.images.medical_viz}`;
            if (vizScanId) vizScanId.textContent = data.session_id.substring(0, 8).toUpperCase();
            medicalVizPanel.classList.remove("hidden");
        } else {
            if (medicalVizPanel) medicalVizPanel.classList.add("hidden");
        }

        // Reset feedback form for new results
        resetFeedbackForm();

        // Show results section
        resultsSection.classList.remove("hidden");

        // Re-init icons
        lucide.createIcons();

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

        // ---------- AUTO-TRAIN THE MODEL ----------
        // Send the AI/API result natively back as ground truth immediately
        autoTrainModel(data);
    }

    // ---------- Download PDF ----------
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener("click", () => {
            if (currentReportUrl) {
                window.open(currentReportUrl, "_blank");
            }
        });
    }

    // ---------- New Scan ----------
    if (newScanBtn) {
        newScanBtn.addEventListener("click", () => {
            resetUpload();
            if (resultsSection) resultsSection.classList.add("hidden");
            const batchSec = document.getElementById("batchResultsSection");
            if (batchSec) batchSec.classList.add("hidden");
            const uploadEl = document.getElementById("upload");
            if (uploadEl) uploadEl.scrollIntoView({ behavior: "smooth" });
        });
    }

    // ---------- Explore Insurances ----------
    if (exploreInsurancesBtn) {
        exploreInsurancesBtn.addEventListener("click", async () => {
            if (!currentScanData) return;

            // Show loading state on button
            exploreInsurancesBtn.disabled = true;
            exploreInsurancesBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Fetching Recommendations...';
            if (window.lucide) lucide.createIcons();

            scanInsuranceResults.classList.remove("hidden");
            scanInsuranceList.innerHTML = '<div style="text-align:center; padding: 20px;"><i data-lucide="loader-2" class="spin"></i> AI is analyzing scan findings to recommend relevant Indian Insurances...</div>';
            if (window.lucide) lucide.createIcons();

            try {
                let findingsSummary = "Normal";
                let severity = "Low";

                if (currentScanData.analysis) {
                    severity = currentScanData.analysis.overall_severity || "Low";
                    if (currentScanData.analysis.findings && currentScanData.analysis.findings.length > 0) {
                        findingsSummary = currentScanData.analysis.findings.map(f => f.finding).join(", ");
                    } else if (currentScanData.analysis.primary_finding) {
                        findingsSummary = currentScanData.analysis.primary_finding;
                    }
                }

                const organ = currentScanData.scan_type?.scan_type || "Unknown Body Part";

                const prompt = `You are an expert Indian health insurance advisor. 
The patient just uploaded a medical scan for: ${organ}.
The AI analysis found these issues: ${findingsSummary}
The overall severity is: ${severity}.

Based strictly on this data, recommend the top 3 Indian health insurances that provide the best coverage, treatment benefits, and lowest waiting periods for conditions related to these findings (${organ} / ${findingsSummary}).

IMPORTANT: You must respond ONLY with a valid JSON array. Do not include any other text or markdown block backticks.
Format each recommendation exactly like this:
[
  {
    "name": "Insurance Name",
    "provider": "Provider Name",
    "analysis": "In-depth analysis of why this specific insurance is best suited for the user's scan findings, detailing organ-specific limits and waiting periods.",
    "websiteLink": "Actual website URL for the insurance provider"
  }
]`;

                let groqKey = window.AppConfig?.groq_insurance_key || window.AppConfig?.groq_api_key;

                if (!groqKey) {
                    throw new Error("No Groq API key configured. Cannot fetch recommendations.");
                }

                let rawResponse = '';
                try {
                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${groqKey}`
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.2
                        })
                    });

                    if (!response.ok) {
                        const errObj = await response.json();
                        throw new Error(errObj.error?.message || "Groq API Request Failed");
                    }

                    const dataObj = await response.json();
                    rawResponse = dataObj.choices[0].message.content;
                } catch (apiErr) {
                    throw new Error(`Groq Analysis Failed: ${apiErr.message}`);
                }

                // Parse standard JSON
                rawResponse = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
                const insurances = JSON.parse(rawResponse);

                if (!Array.isArray(insurances)) throw new Error("Invalid AI Response Array");

                scanInsuranceList.innerHTML = '';
                insurances.forEach(insurance => {
                    const card = document.createElement('div');
                    card.className = 'summary-card';
                    card.style.display = 'flex';
                    card.style.flexDirection = 'column';
                    card.style.gap = '10px';

                    const contextPayload = encodeURIComponent(JSON.stringify(insurance));

                    card.innerHTML = `
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">
                            ${insurance.name} 
                            <span style="font-size: 13px; font-weight: normal; color: var(--text-secondary); background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px; margin-left: 8px;">${insurance.provider}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">${insurance.analysis}</div>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            <a href="${insurance.websiteLink}" target="_blank" class="btn btn-outline btn-sm" style="flex: 1; border-color: rgba(255,255,255,0.1);">
                                <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Visit site
                            </a>
                            <a href="/chatbot?insurance_context=${contextPayload}" class="btn btn-primary btn-sm" style="flex: 1; background: var(--accent-teal); color: #000; font-weight: 600;">
                                <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i> Ask AI about this policy
                            </a>
                        </div>
                    `;
                    scanInsuranceList.appendChild(card);
                });

            } catch (err) {
                console.error("Insurance AI Error:", err);
                scanInsuranceList.innerHTML = `<div style="color: var(--accent-red); padding: 10px; text-align: center;">Failed to generate recommendations: ${err.message}</div>`;
            } finally {
                // Restore Button
                exploreInsurancesBtn.disabled = false;
                exploreInsurancesBtn.innerHTML = '<i data-lucide="shield"></i> Explore Relevant Insurances';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // ---------- Batch Results (Accordion) ----------
    function displayBatchResults(resultsArray) {
        const batchSection = document.getElementById("batchResultsSection");
        const batchAccordion = document.getElementById("batchAccordion");
        const batchSummary = document.getElementById("batchResultsSummary");

        // Hide single-scan results
        resultsSection.classList.add("hidden");

        // Summary
        const successCount = resultsArray.filter(r => !r.error).length;
        batchSummary.textContent = `${successCount} of ${resultsArray.length} scans analyzed successfully`;

        // Collect report filenames for Download All
        batchReportFilenames = resultsArray.filter(r => r.report).map(r => r.report.filename);

        // Build accordion items
        batchAccordion.innerHTML = "";

        resultsArray.forEach((result, idx) => {
            const item = document.createElement("div");
            item.className = "batch-accordion-item";

            // Determine severity color
            let severityColor = "var(--accent-green)";
            let severityLabel = "";
            if (!result.error) {
                const sev = result.analysis.overall_severity;
                severityLabel = sev.toUpperCase();
                if (sev === "high") severityColor = "var(--accent-red)";
                else if (sev === "medium") severityColor = "var(--accent-yellow)";
            }

            // Header
            const header = document.createElement("div");
            header.className = "accordion-header";
            header.innerHTML = `
                        < div class="accordion-header-left" >
                    <span class="accordion-index">${idx + 1}</span>
                    <i data-lucide="file-image" class="accordion-file-icon"></i>
                    <span class="accordion-filename">${result.filename}</span>
                    ${!result.error ? `<span class="accordion-severity" style="color:${severityColor}">${severityLabel}</span>` : `<span class="accordion-error-badge">ERROR</span>`}
                </div >
                        <div class="accordion-header-right">
                            ${!result.error ? `<button class="btn btn-ghost btn-sm accordion-download-btn" data-url="${result.report.supabase_report_url || result.report.download_url}" title="Download PDF"><i data-lucide="download"></i></button>` : ""}
                            <i data-lucide="chevron-down" class="accordion-chevron"></i>
                        </div>
                    `;

            // Body
            const body = document.createElement("div");
            body.className = "accordion-body";

            if (result.error) {
                body.innerHTML = `< div class="accordion-error" > ${result.error}</div > `;
            } else {
                body.innerHTML = buildAccordionBodyHTML(result);
            }

            item.appendChild(header);
            item.appendChild(body);
            batchAccordion.appendChild(item);

            // Toggle expand/collapse
            header.addEventListener("click", (e) => {
                // Don't toggle if download button was clicked
                if (e.target.closest(".accordion-download-btn")) return;
                item.classList.toggle("expanded");
            });

            // Individual download
            const dlBtn = header.querySelector(".accordion-download-btn");
            if (dlBtn) {
                dlBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    window.open(dlBtn.dataset.url, "_blank");
                });
            }
        });

        // Auto-expand first item
        const firstItem = batchAccordion.querySelector(".batch-accordion-item");
        if (firstItem) firstItem.classList.add("expanded");

        // Show section
        batchSection.classList.remove("hidden");
        lucide.createIcons();
        batchSection.scrollIntoView({ behavior: "smooth", block: "start" });

        // ---------- AUTO-TRAIN THE MODEL ----------
        // Send successful batch AI/API results natively back as ground truth
        resultsArray.filter(r => !r.error).forEach(result => {
            autoTrainModel(result);
        });
    }

    // ---------- AUTO-TRAIN BACKGROUND API FUNCTION ----------
    async function autoTrainModel(data) {
        if (!data || !data.session_id) return;

        try {
            console.log(`[Auto - Train] 🤖 Sending automatic training data back to DenseNet - 121 for session: ${data.session_id}...`);

            const payload = {
                session_id: data.session_id,
                correct_finding: data.analysis.primary_finding,
                severity_correction: data.analysis.overall_severity,
                notes: "Auto-trained from API & Puter.js results immediately upon client delivery.",
                description: data.analysis.description || "Synthesized finding automatically verified by auxiliary AI.",
                rating: 5, // Treat API as ground truth
                scan_type: data.scan_type.scan_type || "Unknown"
            };

            const response = await fetch(`/ api / feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`[Auto - Train] ✅ Model successfully trained on scan! Loss: ${result.loss}`);
            } else {
                console.warn("[Auto-Train] ⚠️ Background training request failed.", await response.text());
            }
        } catch (e) {
            console.error("[Auto-Train] ❌ Error triggering background auto-train:", e);
        }
    }

    function buildAccordionBodyHTML(result) {
        const analysis = result.analysis;
        let html = "";

        // Primary finding + severity
        html += `< div class= "accordion-result-summary" > `;
        html += `< div class= "accordion-result-row" > <strong>Primary Finding:</strong> ${analysis.primary_finding}</div > `;
        html += `< div class= "accordion-result-row" ><strong>Severity:</strong> <span style="color:${analysis.overall_severity === 'high' ? 'var(--accent-red)' : analysis.overall_severity === 'medium' ? 'var(--accent-yellow)' : 'var(--accent-green)'}">${analysis.overall_severity.toUpperCase()}</span></div > `;
        html += `< div class= "accordion-result-row" > <strong>Model:</strong> ${analysis.model_info.name}(${analysis.model_info.device})</div > `;
        html += `</div > `;

        // Detailed report (if available)
        if (analysis.detailed_report) {
            const report = analysis.detailed_report;

            // Clinical interpretation
            if (report.summary) {
                html += `< div class= "accordion-detail-section" > `;
                html += `< div class= "accordion-detail-title" > Clinical Interpretation</div > `;
                html += `< div class= "accordion-detail-text" > ${report.summary}</div > `;
                html += `</div > `;
            }

            // Metrics table
            if (report.metrics && report.metrics.length > 0) {
                html += `< div class= "accordion-detail-section" > `;
                html += `< div class= "accordion-detail-title" > Quantitative Metrics</div > `;
                html += `< table class= "report-table" ><thead><tr><th>Parameter</th><th>Result</th><th>Normal</th><th>Status</th></tr></thead><tbody>`;
                report.metrics.forEach(m => {
                    const sc = m.status === 'Normal' ? 'status-normal' : m.status === 'Abnormal' ? 'status-abnormal' : 'status-review';
                    html += `<tr><td>${m.parameter}</td><td>${m.result}</td><td>${m.normal}</td><td class="${sc}">${m.status}</td></tr>`;
                });
                html += `</tbody></table ></div > `;
            }

            // Recommendations
            if (report.recommendations && report.recommendations.length > 0) {
                html += `< div class= "accordion-detail-section" > `;
                html += `< div class= "accordion-detail-title" > Recommendations</div > `;
                html += `< ul class= "report-list" > `;
                report.recommendations.forEach(r => { html += `< li > ${r}</li > `; });
                html += `</ul ></div > `;
            }
        }

        // Findings list
        if (analysis.findings && analysis.findings.length > 0) {
            html += `< div class= "accordion-detail-section" > `;
            html += `< div class= "accordion-detail-title" > All Findings</div > `;
            analysis.findings.forEach(f => {
                html += `< div class= "accordion-finding" > `;
                html += `< span class= "finding-severity-badge ${f.severity}" > ${f.severity}</span > `;
                html += `< span class= "accordion-finding-name" > ${f.finding}</span > `;
                html += `< span class= "accordion-finding-conf" > ${f.confidence} %</span > `;
                html += `</div > `;
            });
            html += `</div > `;
        }

        return html;
    }

    // ---------- Download All Reports (ZIP) ----------
    const downloadAllBtn = document.getElementById("downloadAllBtn");
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener("click", async () => {
            if (batchReportFilenames.length === 0) {
                alert("No reports available to download.");
                return;
            }
            downloadAllBtn.disabled = true;
            downloadAllBtn.querySelector("i")?.classList.add("spin");

            try {
                const response = await fetch(`${API_BASE} / api / reports / download - all`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filenames: batchReportFilenames }),
                });

                if (!response.ok) throw new Error("Failed to download reports");

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "HealthGuard_AI_Reports.zip";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (err) {
                alert("Download Error: " + err.message);
                console.error(err);
            } finally {
                downloadAllBtn.disabled = false;
                downloadAllBtn.querySelector("i")?.classList.remove("spin");
            }
        });
    }

    // ---------- New Batch Scan ----------
    const newBatchScanBtn = document.getElementById("newBatchScanBtn");
    if (newBatchScanBtn) {
        newBatchScanBtn.addEventListener("click", () => {
            resetUpload();
            const batchSec = document.getElementById("batchResultsSection");
            if (batchSec) batchSec.classList.add("hidden");
            resultsSection.classList.add("hidden");
            document.getElementById("upload").scrollIntoView({ behavior: "smooth" });
        });
    }

    // =============================================
    // ========== FEEDBACK SYSTEM ==========
    // =============================================

    // ---------- Star Rating ----------
    const starBtns = starRating ? starRating.querySelectorAll(".star-btn") : [];
    if (starBtns.length > 0) {
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
    }

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
    const sevBtns = severityButtons ? severityButtons.querySelectorAll(".severity-btn") : [];
    if (sevBtns.length > 0) {
        sevBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                selectedSeverity = btn.dataset.severity;
                sevBtns.forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
            });
        });
    }

    // ---------- Custom Finding Toggle ----------
    if (correctFinding && customFindingWrapper) {
        correctFinding.addEventListener("change", () => {
            if (correctFinding.value === "__other__") {
                customFindingWrapper.classList.remove("hidden");
                customFindingInput.focus();
            } else {
                customFindingWrapper.classList.add("hidden");
                customFindingInput.value = "";
            }
        });
    }

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
        // Reset feedbackScanTypeInput if it exists
        const feedbackScanTypeInput = document.getElementById("feedbackScanTypeInput");
        if (feedbackScanTypeInput) {
            feedbackScanTypeInput.value = "";
        }
    }

    // ---------- Submit Feedback ----------
    if (submitFeedbackBtn) {
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

            // Determine final finding
            let finalFinding = correctFinding.value;
            let isCustom = false;
            if (finalFinding === "__other__") {
                finalFinding = customFindingInput.value.trim();
                isCustom = true;
            }

            // Get edited scan type
            const feedbackScanTypeInput = document.getElementById("feedbackScanTypeInput");
            const editedScanType = feedbackScanTypeInput ? feedbackScanTypeInput.value : "Unknown";

            // Prepare payload
            const payload = {
                session_id: currentSessionId,
                rating: selectedRating,
                correct_finding: finalFinding,
                severity_correction: selectedSeverity,
                scan_type: editedScanType, // Send the edited scan type
                notes: feedbackNotes.value,
                description: feedbackDescription.value,
                custom_finding_is_new: isCustom,
            };
            try {
                const response = await fetch(`${API_BASE} / api / feedback`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
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
                < div class= "feedback-stat-item" >
                        <span class="feedback-stat-value">${result.feedback_id}</span>
                        <span class="feedback-stat-label">Feedback ID</span>
                    </div >
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
                    ` : ""
                    }
                    ${result.loss !== undefined ? `
                    <div class="feedback-stat-item">
                        <span class="feedback-stat-value">${result.loss}</span>
                        <span class="feedback-stat-label">Avg Loss</span>
                    </div>
                    ` : ""
                    }
                    ${result.total_findings ? `
                    <div class="feedback-stat-item">
                        <span class="feedback-stat-value">${result.total_findings}</span>
                        <span class="feedback-stat-label">Total Findings</span>
                    </div>
                    ` : ""
                    }
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
    }

    // ---------- Re-Analyze with Updated Model ----------
    if (reanalyzeBtn) {
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
                    progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}% `;
                    currentStep++;
                }
            }, 1200);

            try {
                const response = await fetch(`${API_BASE} /api/reanalyze`, {
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
    }

    // ---------- Add More Feedback ----------
    if (addMoreFeedbackBtn) {
        addMoreFeedbackBtn.addEventListener("click", () => {
            resetFeedbackForm();
            if (feedbackForm) feedbackForm.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }

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
        trainingFilesize.textContent = `${formatFileSize(totalSize)}${subfolders.size > 0 ? ` • ${subfolders.size} subfolders` : ""} `;
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

            // Get selected temp location
            const tempLocation = document.querySelector('input[name="tempLocation"]:checked')?.value || "system";
            formData.append("temp_location", tempLocation);

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
                        trainingProgressFill.style.width = `${uploadPct} % `;
                        trainingProgressPct.textContent = `${uploadPct} % `;

                        const loadedMB = (e.loaded / 1048576).toFixed(1);
                        const totalMB = (e.total / 1048576).toFixed(1);
                        trainingStatusMessage.textContent = `Uploading: ${loadedMB} MB / ${totalMB} MB(${fileCount} files)`;
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

                xhr.open("POST", `${API_BASE} / api / train`);
                xhr.timeout = 0; // No timeout for large uploads
                xhr.send(formData);
            });

            // Poll training progress while waiting for server response
            let trainingPollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${API_BASE} / api / train / status`);
                    const status = await statusRes.json();
                    if (status.is_training && status.progress > 0) {
                        // Map server progress (0-100) to bar progress (50-100)
                        const serverPct = 50 + Math.round(status.progress * 0.5);
                        trainingProgressFill.style.width = `${serverPct} % `;
                        trainingProgressPct.textContent = `${serverPct} % `;
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
< div class= "feedback-stat-item" >
                        <span class="feedback-stat-value">${result.images_processed || 0}</span>
                        <span class="feedback-stat-label">Images Processed</span>
                    </div >
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
                    ` : ""
                    }
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

