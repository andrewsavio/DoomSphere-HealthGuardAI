// advocate.js

let selectedFile = null;

document.addEventListener('DOMContentLoaded', async () => {
    const dropZone = document.getElementById('advocateDropZone');
    const fileInput = document.getElementById('advocateFileInput');
    const previewContainer = document.getElementById('advocatePreviewContainer');
    const imagePreview = document.getElementById('advocateImagePreview');
    const clearBtn = document.getElementById('advocateClearBtn');
    const analyzeBtn = document.getElementById('advocateAnalyzeBtn');
    const form = document.getElementById('advocateForm');

    const loadingState = document.getElementById('advocateLoadingState');
    const loadingText = document.getElementById('advocateLoadingText');
    const ocrResultContainer = document.getElementById('ocrResultContainer');
    const ocrTextOutput = document.getElementById('ocrTextOutput');
    const resultsContainer = document.getElementById('advocateResultsContainer');
    const cardsGrid = document.getElementById('advocateCardsGrid');

    let ENV = {};
    try {
        const res = await fetch('/api/config');
        if (res.ok) ENV = await res.json();
    } catch (e) { }

    // --- Drag & Drop / File Selection ---
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-blue)';
        dropZone.style.background = 'rgba(59, 130, 246, 0.05)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        dropZone.style.background = 'rgba(0, 0, 0, 0.2)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        dropZone.style.background = 'rgba(0, 0, 0, 0.2)';

        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file. PDFs are not supported for this analysis.');
            return;
        }

        selectedFile = file;

        // Preview logic
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            dropZone.style.display = 'none';
            previewContainer.style.display = 'block';
            analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    clearBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        dropZone.style.display = 'flex';
        previewContainer.style.display = 'none';
        analyzeBtn.disabled = true;
        ocrResultContainer.style.display = 'none';
        resultsContainer.style.display = 'none';
    });

    // --- Processing Pipeline ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) return;

        // Reset UI
        analyzeBtn.style.display = 'none';
        loadingState.style.display = 'block';
        ocrResultContainer.style.display = 'none';
        resultsContainer.style.display = 'none';
        cardsGrid.innerHTML = '';

        try {
            loadingText.textContent = "Processing prescription and analyzing directly via Groq Vision AI...";

            // Read file as Base64
            const base64Image = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(selectedFile);
            });

            const reqData = new FormData();
            reqData.append("image_data", base64Image);

            const analysisRes = await fetch('/api/advocate/analyze', {
                method: 'POST',
                body: reqData
            });

            if (!analysisRes.ok) {
                const errData = await analysisRes.json();
                throw new Error(errData.error || "Groq analysis failed");
            }

            const analysisData = await analysisRes.json();

            // Show OCR results if returned
            if (analysisData.extracted_text) {
                ocrTextOutput.textContent = analysisData.extracted_text;
                ocrResultContainer.style.display = 'block';
            }

            renderAlternatives(analysisData);

        } catch (err) {
            console.error("Pipeline error:", err);
            alert("Error: " + (err.message || err));
            analyzeBtn.style.display = 'flex';
        } finally {
            loadingState.style.display = 'none';
        }
    });

    // --- Overview Modal ---
    function showOverviewModal(med) {
        let existing = document.getElementById('medOverlayModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'medOverlayModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const imgUrl = med.image_search_url
            ? med.image_search_url
            : `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(med.medicine_name + ' medicine')}`;

        modal.innerHTML = `
            <div style="background:#0f172a;border:2px solid var(--accent-blue);border-radius:16px;padding:28px;max-width:520px;width:90%;max-height:85vh;overflow-y:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
                <button onclick="this.closest('#medOverlayModal').remove()" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.1);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.1rem;">✕</button>
                <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
                    <a href="${imgUrl}" target="_blank" style="display:block;flex-shrink:0;">
                        <div style="width:64px;height:64px;border-radius:12px;background:linear-gradient(135deg,${med.color || '#0d9488'},${med.color2 || '#14b8a6'});display:flex;align-items:center;justify-content:center;font-size:1.6rem;cursor:pointer;" title="Click for medicine images">
                            ${med.emoji || '💊'}
                        </div>
                    </a>
                    <div>
                        <span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:${med.tagColor || 'var(--accent-green)'};">${med.system || 'Generic'}</span>
                        <h3 style="color:var(--text-primary);margin:2px 0;font-size:1.25rem;">${med.medicine_name}</h3>
                        <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">${med.manufacturer || ''}</p>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                    <div style="background:rgba(255,255,255,0.04);padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
                        <span style="font-size:0.7rem;color:var(--text-secondary);text-transform:uppercase;">Price</span>
                        <p style="color:var(--accent-green);font-weight:700;font-size:1.1rem;margin:4px 0 0;">₹${med.estimated_price || 'N/A'}</p>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
                        <span style="font-size:0.7rem;color:var(--text-secondary);text-transform:uppercase;">System</span>
                        <p style="color:var(--text-primary);font-weight:600;font-size:1rem;margin:4px 0 0;">${med.system || 'Modern'}</p>
                    </div>
                </div>
                ${med.key_ingredients ? `<div style="margin-bottom:14px;"><span style="font-size:0.75rem;text-transform:uppercase;color:var(--text-secondary);letter-spacing:0.5px;">Key Ingredients</span><p style="color:var(--accent-blue);font-size:0.9rem;margin:4px 0 0;">${med.key_ingredients}</p></div>` : ''}
                ${med.therapeutic_use ? `<div style="margin-bottom:14px;"><span style="font-size:0.75rem;text-transform:uppercase;color:var(--text-secondary);letter-spacing:0.5px;">Therapeutic Use</span><p style="color:var(--text-primary);font-size:0.9rem;margin:4px 0 0;">${med.therapeutic_use}</p></div>` : ''}
                ${med.overview ? `<div style="margin-bottom:14px;background:rgba(59,130,246,0.08);padding:14px;border-radius:10px;border:1px solid rgba(59,130,246,0.15);"><span style="font-size:0.75rem;text-transform:uppercase;color:var(--accent-blue);letter-spacing:0.5px;">Overview</span><p style="color:var(--text-primary);font-size:0.9rem;margin:6px 0 0;line-height:1.6;">${med.overview}</p></div>` : ''}
                <a href="${imgUrl}" target="_blank" class="btn btn-primary" style="width:100%;justify-content:center;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;margin-top:8px;"><i data-lucide="image" style="width:16px;height:16px;"></i> View Medicine Images</a>
            </div>
        `;
        document.body.appendChild(modal);
        lucide.createIcons();
    }

    // Expose globally for onclick
    window.showOverviewModal = showOverviewModal;

    function renderAlternatives(data) {
        if (!data.results || data.results.length === 0) {
            cardsGrid.innerHTML = `<div style="color: var(--text-secondary); grid-column: 1/-1; text-align:center;">No valid medical data found to compare.</div>`;
            resultsContainer.style.display = 'block';
            analyzeBtn.style.display = 'flex';
            return;
        }

        data.results.forEach((item, idx) => {
            // --- Full-width wrapper for this prescribed medicine ---
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'grid-column: 1/-1; margin-bottom: 32px;';

            // Quality bar helper — color is purely data-driven
            function qualityBar(pct) {
                const c = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
                const c2 = pct >= 70 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626';
                return `<div style="margin-top:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);">Quality Rating</span>
                        <span style="font-weight:700;color:${c};font-size:0.95rem;">${pct}%</span>
                    </div>
                    <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${c},${c2});border-radius:4px;transition:width 0.6s ease;"></div>
                    </div>
                </div>`;
            }

            function sideEffectsTags(effects, color) {
                if (!effects || effects.length === 0) return '';
                return `<div style="margin-top:8px;"><span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);">Side Effects</span>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">${effects.map(e => `<span style="padding:2px 8px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:12px;font-size:0.72rem;color:#fca5a5;">${e}</span>`).join('')}</div></div>`;
            }

            // Prescribed medicine header
            const origQuality = item.original_quality_percentage || 0;
            const origEffects = item.original_side_effects || [];
            wrapper.innerHTML = `
                <div style="background:#0f172a;border:2px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:20px;">
                    <span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);">Prescribed Medicine</span>
                    <h4 style="color:var(--text-primary);margin:4px 0 2px;font-size:1.25rem;">${item.original_medicine}</h4>
                    <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">Manufacturer: ${item.original_company || 'Unknown'} &nbsp;|&nbsp; Formula: <span style="color:var(--accent-green);">${item.formula}</span></p>
                    <p style="font-size:0.9rem;font-weight:600;color:#f87171;margin-top:6px;">Est. Price: ₹${item.original_estimated_price || 'N/A'}</p>
                    ${qualityBar(origQuality)}
                    ${sideEffectsTags(origEffects)}
                </div>
            `;

            // Build 4-column grid: Generic + Ayurveda + Siddha + Homeopathy
            const altGrid = document.createElement('div');
            altGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;';

            // --- GENERIC CARD ---
            const genericData = JSON.stringify({
                system: 'Generic (Modern)',
                medicine_name: item.suggested_medicine,
                manufacturer: item.suggested_company,
                estimated_price: item.suggested_estimated_price,
                overview: item.overview || item.quality_notes || '',
                key_ingredients: item.formula,
                therapeutic_use: item.quality_notes || '',
                image_search_url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.suggested_medicine + ' medicine tablet')}`,
                emoji: '💊', color: '#3b82f6', color2: '#2563eb', tagColor: 'var(--accent-blue)'
            }).replace(/'/g, "\\'").replace(/"/g, '&quot;');

            // Helper: Build pharmacy rows using Google Search (always works, never 404)
            function buildPharmacyRows(medName, manufacturer, btnColor1, btnColor2) {
                const q = encodeURIComponent(medName + (manufacturer ? ' ' + manufacturer : ''));
                const pharmacies = [
                    { name: 'PharmEasy', query: `buy ${medName} on PharmEasy price` },
                    { name: '1mg (Tata Health)', query: `buy ${medName} on 1mg price` },
                    { name: 'Netmeds', query: `buy ${medName} on Netmeds price` },
                    { name: 'Apollo Pharmacy', query: `buy ${medName} Apollo Pharmacy online price` },
                    { name: 'Amazon Health', query: `buy ${medName} medicine on Amazon India` },
                ];
                return pharmacies.map(p => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-size:0.8rem;">
                        <span style="color:var(--text-primary);">${p.name}</span>
                        <a href="https://www.google.com/search?q=${encodeURIComponent(p.query)}" target="_blank" style="padding:3px 10px;background:linear-gradient(135deg,${btnColor1},${btnColor2});color:#fff;border-radius:4px;font-size:0.75rem;font-weight:600;text-decoration:none;">Check Price</a>
                    </div>
                `).join('');
            }

            // pharma panel for generic
            const pharmacyRows = buildPharmacyRows(item.suggested_medicine, item.suggested_company, '#3b82f6', '#2563eb');
            const panelId = `pharmacyPanel_${idx}`;

            const genericCard = document.createElement('div');
            genericCard.style.cssText = 'background:#0f172a;border:2px solid var(--accent-blue);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:transform 0.2s,border-color 0.2s;';
            genericCard.onmouseover = () => { genericCard.style.transform = 'translateY(-3px)'; };
            genericCard.onmouseout = () => { genericCard.style.transform = 'translateY(0)'; };
            genericCard.innerHTML = `
                <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:var(--accent-blue);font-weight:700;">💊 Generic</span>
                <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${item.medicine_image_url || ''}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" style="width:44px;height:44px;border-radius:8px;object-fit:cover;background:#1e293b;border:1px solid rgba(255,255,255,0.1);">
                    <div style="width:44px;height:44px;min-width:44px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:none;align-items:center;justify-content:center;font-size:1.2rem;">💊</div>
                    <div>
                        <h5 style="color:var(--text-primary);margin:0;font-size:1rem;">${item.suggested_medicine}</h5>
                        <p style="font-size:0.78rem;color:var(--text-secondary);margin:2px 0 0;">${item.suggested_company}</p>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(59,130,246,0.1);padding:6px 10px;border-radius:6px;">
                    <span style="font-size:0.78rem;color:var(--text-secondary);">Price</span>
                    <span style="font-weight:700;color:var(--accent-green);">₹${item.suggested_estimated_price || '—'}</span>
                </div>
                ${qualityBar(item.suggested_quality_percentage || 0)}
                ${sideEffectsTags(item.suggested_side_effects || [])}
                <button type="button" onclick="event.stopPropagation();var p=document.getElementById('${panelId}');p.style.display=p.style.display==='none'?'flex':'none';" style="width:100%;padding:6px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;"><i data-lucide="store" style="width:12px;height:12px;vertical-align:middle;"></i> Compare Prices</button>
                <div id="${panelId}" style="display:none;flex-direction:column;gap:6px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(255,255,255,0.05);">
                    ${pharmacyRows}
                </div>
            `;
            // Store JSON on card
            const jsonHolder = document.createElement('div');
            jsonHolder.style.display = 'none';
            jsonHolder.dataset.medJson = JSON.stringify({
                system: 'Generic (Modern)', medicine_name: item.suggested_medicine, manufacturer: item.suggested_company,
                estimated_price: item.suggested_estimated_price, overview: item.overview || item.quality_notes || '',
                key_ingredients: item.formula, therapeutic_use: item.quality_notes || '',
                image_search_url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.suggested_medicine + ' medicine tablet')}`,
                emoji: '💊', color: '#3b82f6', color2: '#2563eb', tagColor: 'var(--accent-blue)'
            });
            genericCard.appendChild(jsonHolder);
            genericCard.onclick = () => showOverviewModal(JSON.parse(jsonHolder.dataset.medJson));
            altGrid.appendChild(genericCard);

            // --- TRADITIONAL MEDICINE CARDS (Ayurveda, Siddha, Homeopathy) ---
            const systemStyles = {
                'Ayurveda': { emoji: '🌿', color: '#059669', color2: '#10b981', tagColor: '#10b981', border: '#059669' },
                'Siddha': { emoji: '🧪', color: '#d97706', color2: '#f59e0b', tagColor: '#f59e0b', border: '#d97706' },
                'Homeopathy': { emoji: '⚗️', color: '#7c3aed', color2: '#8b5cf6', tagColor: '#8b5cf6', border: '#7c3aed' }
            };

            const altSystems = item.alternative_systems || [];
            altSystems.forEach((alt, aIdx) => {
                const st = systemStyles[alt.system] || systemStyles['Ayurveda'];
                const altCard = document.createElement('div');
                altCard.style.cssText = `background:#0f172a;border:2px solid ${st.border};border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:transform 0.2s;`;
                altCard.onmouseover = () => { altCard.style.transform = 'translateY(-3px)'; };
                altCard.onmouseout = () => { altCard.style.transform = 'translateY(0)'; };

                const altPanelId = `altPharmPanel_${idx}_${aIdx}`;
                const altPharmRows = buildPharmacyRows(alt.medicine_name, alt.manufacturer, st.color, st.color2);

                altCard.innerHTML = `
                    <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:${st.tagColor};font-weight:700;">${st.emoji} ${alt.system}</span>
                    ${alt.ayush_approved ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:4px;font-size:0.6rem;color:#10b981;font-weight:700;vertical-align:middle;">✅ AYUSH APPROVED</span>` : ''}
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:44px;height:44px;min-width:44px;border-radius:8px;background:linear-gradient(135deg,${st.color},${st.color2});display:flex;align-items:center;justify-content:center;font-size:1.2rem;">${st.emoji}</div>
                        <div>
                            <h5 style="color:var(--text-primary);margin:0;font-size:1rem;">${alt.medicine_name}</h5>
                            <p style="font-size:0.78rem;color:var(--text-secondary);margin:2px 0 0;">${alt.manufacturer || ''}</p>
                        </div>
                    </div>
                    <p style="font-size:0.78rem;color:var(--text-secondary);margin:0;line-height:1.4;"><strong style="color:${st.tagColor};">Ingredients:</strong> ${alt.key_ingredients || 'N/A'}</p>
                    ${alt.classical_reference ? `<div style="padding:5px 10px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:6px;"><span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;color:#a855f7;">📜 Classical Reference</span><p style="font-size:0.76rem;color:var(--text-primary);margin:2px 0 0;">${alt.classical_reference}</p></div>` : ''}
                    ${alt.dosage_info ? `<div style="padding:5px 10px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15);border-radius:6px;"><span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;color:#3b82f6;">💊 Dosage</span><p style="font-size:0.76rem;color:var(--text-primary);margin:2px 0 0;">${alt.dosage_info}</p></div>` : ''}
                    ${alt.contraindications ? `<div style="padding:5px 10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);border-radius:6px;"><span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;color:#ef4444;">⛔ Contraindications</span><p style="font-size:0.76rem;color:var(--text-secondary);margin:2px 0 0;">${alt.contraindications}</p></div>` : ''}
                    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(16,185,129,0.08);padding:6px 10px;border-radius:6px;">
                        <span style="font-size:0.78rem;color:var(--text-secondary);">Est. Price</span>
                        <span style="font-weight:700;color:var(--accent-green);">₹${alt.estimated_price || '—'}</span>
                    </div>
                    ${qualityBar(alt.quality_percentage || 0)}
                    ${sideEffectsTags(alt.side_effects || [])}
                    <button type="button" onclick="event.stopPropagation();var p=document.getElementById('${altPanelId}');p.style.display=p.style.display==='none'?'flex':'none';" style="width:100%;padding:6px;background:linear-gradient(135deg,${st.color},${st.color2});color:#fff;border:none;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;"><i data-lucide="store" style="width:12px;height:12px;vertical-align:middle;"></i> Compare Prices</button>
                    <div id="${altPanelId}" style="display:none;flex-direction:column;gap:6px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(255,255,255,0.05);">
                        ${altPharmRows}
                    </div>
                `;

                altCard.onclick = () => showOverviewModal({
                    system: alt.system, medicine_name: alt.medicine_name, manufacturer: alt.manufacturer,
                    estimated_price: alt.estimated_price, key_ingredients: alt.key_ingredients,
                    therapeutic_use: alt.therapeutic_use, overview: alt.overview,
                    emoji: st.emoji, color: st.color, color2: st.color2, tagColor: st.tagColor
                });
                altGrid.appendChild(altCard);
            });

            wrapper.appendChild(altGrid);

            // --- BEST RECOMMENDATION BANNER ---
            const best = item.best_recommendation;
            if (best) {
                const bestBanner = document.createElement('div');
                bestBanner.style.cssText = 'margin-top:16px;padding:16px 20px;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(59,130,246,0.1));border:2px solid #10b981;border-radius:12px;display:flex;align-items:center;gap:16px;';
                bestBanner.innerHTML = `
                    <div style="width:48px;height:48px;min-width:48px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🏆</div>
                    <div style="flex:1;">
                        <span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:#10b981;font-weight:700;">Best Overall Recommendation</span>
                        <h4 style="color:var(--text-primary);margin:2px 0;font-size:1.1rem;">${best.medicine_name} <span style="font-size:0.8rem;font-weight:400;color:var(--text-secondary);">(${best.system})</span></h4>
                        <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;line-height:1.5;">${best.reason}</p>
                    </div>
                `;
                wrapper.appendChild(bestBanner);
            }

            cardsGrid.appendChild(wrapper);
        });

        lucide.createIcons();
        resultsContainer.style.display = 'block';
        analyzeBtn.style.display = 'flex';
        analyzeBtn.innerHTML = `<i data-lucide="refresh-ccw"></i> Analyze Another`;
        lucide.createIcons();

        // ========== AUTO DRUG INTERACTION CHECK ==========
        // Collect all medicine names from the results
        const allMedicines = [];
        data.results.forEach(item => {
            if (item.original_medicine) allMedicines.push(item.original_medicine);
            if (item.suggested_medicine) allMedicines.push(item.suggested_medicine);
            const alts = item.alternative_systems || [];
            alts.forEach(a => { if (a.medicine_name) allMedicines.push(a.medicine_name); });
        });

        // Only check if 2+ medicines
        if (allMedicines.length >= 2) {
            runInteractionCheck(allMedicines);
        }
    }

    // ========== DRUG INTERACTION CHECKER ==========
    function runInteractionCheck(medicines) {
        // Create or reuse the interaction panel
        let panel = document.getElementById('interactionPanel');
        if (panel) panel.remove();

        panel = document.createElement('div');
        panel.id = 'interactionPanel';
        panel.style.cssText = 'margin-top:24px;padding:24px;background:#0f172a;border:2px solid #f59e0b;border-radius:16px;';
        panel.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">⚠️</div>
                <div>
                    <h3 style="color:var(--text-primary);margin:0;font-size:1.15rem;">Drug Interaction Check</h3>
                    <p style="font-size:0.8rem;color:var(--text-secondary);margin:2px 0 0;">Checking ${medicines.length} medicines for interactions...</p>
                </div>
            </div>
            <div id="interactionLoader" style="display:flex;align-items:center;gap:10px;padding:16px;background:rgba(245,158,11,0.08);border-radius:10px;">
                <div style="width:20px;height:20px;border:2px solid #f59e0b;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                <span style="color:var(--text-secondary);font-size:0.85rem;">Analyzing drug interactions via AI...</span>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;
        cardsGrid.parentElement.appendChild(panel);

        // Call the API
        fetch('/api/check-interactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ medicines })
        })
            .then(r => r.json())
            .then(result => {
                const loader = document.getElementById('interactionLoader');
                if (loader) loader.remove();

                if (result.error) {
                    panel.innerHTML += `<p style="color:#f87171;padding:12px;">${result.error}</p>`;
                    return;
                }

                renderInteractionResults(panel, result, medicines);
            })
            .catch(err => {
                const loader = document.getElementById('interactionLoader');
                if (loader) loader.innerHTML = `<p style="color:#f87171;">Failed to check interactions: ${err.message}</p>`;
            });
    }

    function renderInteractionResults(panel, result, medicines) {
        const sevColors = {
            severe: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#fca5a5', icon: '🔴', label: 'SEVERE' },
            moderate: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#fcd34d', icon: '🟡', label: 'MODERATE' },
            mild: { bg: 'rgba(16,185,129,0.08)', border: '#10b981', text: '#6ee7b7', icon: '🟢', label: 'MILD' },
            none: { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', text: '#93c5fd', icon: '✅', label: 'SAFE' },
        };

        // Risk summary banner
        const riskColor = (result.risk_summary || '').includes('HIGH') ? '#ef4444' :
            (result.risk_summary || '').includes('MODERATE') ? '#f59e0b' : '#10b981';

        let html = `
            <div style="padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid ${riskColor};border-radius:10px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
                <span style="font-size:1.4rem;">${riskColor === '#ef4444' ? '🚨' : riskColor === '#f59e0b' ? '⚠️' : '✅'}</span>
                <div>
                    <span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:${riskColor};font-weight:700;">Risk Summary</span>
                    <p style="color:var(--text-primary);margin:2px 0 0;font-size:0.95rem;font-weight:600;">${result.risk_summary || 'Analysis complete'}</p>
                </div>
            </div>
        `;

        // Medicines checked tags
        html += `<div style="margin-bottom:16px;"><span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);">Medicines Checked (${medicines.length})</span>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${medicines.map(m => `<span style="padding:3px 10px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:12px;font-size:0.75rem;color:#93c5fd;">${m}</span>`).join('')}</div></div>`;

        // Interaction cards
        const interactions = result.interactions || [];
        if (interactions.length > 0) {
            html += `<span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);display:block;margin-bottom:8px;">Interactions Found (${interactions.length})</span>`;
            html += `<div style="display:flex;flex-direction:column;gap:10px;">`;
            interactions.forEach(inter => {
                const s = sevColors[inter.severity] || sevColors.mild;
                const systems = (inter.affected_systems || []).map(sys => `<span style="padding:1px 6px;background:rgba(255,255,255,0.06);border-radius:4px;font-size:0.7rem;color:var(--text-secondary);">${sys}</span>`).join(' ');
                html += `
                    <div style="padding:14px;background:${s.bg};border:1px solid ${s.border}33;border-radius:10px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span style="font-size:1rem;">${s.icon}</span>
                            <span style="font-weight:700;color:${s.text};font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;">${s.label}</span>
                            <span style="color:var(--text-primary);font-weight:600;font-size:0.9rem;">${inter.medicine_1} + ${inter.medicine_2}</span>
                        </div>
                        <p style="color:var(--text-primary);font-size:0.85rem;margin:4px 0;line-height:1.5;"><strong style="color:${s.text};">Effect:</strong> ${inter.effect}</p>
                        <p style="color:var(--text-secondary);font-size:0.82rem;margin:4px 0;line-height:1.4;"><strong>Recommendation:</strong> ${inter.recommendation}</p>
                        ${systems ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">${systems}</div>` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        }

        // Safe combinations
        const safes = result.safe_combinations || [];
        if (safes.length > 0) {
            html += `<div style="margin-top:14px;"><span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);">Safe Combinations</span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${safes.map(s => `<span style="padding:3px 10px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:12px;font-size:0.75rem;color:#6ee7b7;">✅ ${s}</span>`).join('')}</div></div>`;
        }

        // General advice
        if (result.general_advice) {
            html += `<div style="margin-top:14px;padding:12px;background:rgba(59,130,246,0.08);border-radius:8px;border:1px solid rgba(59,130,246,0.15);"><span style="font-size:0.7rem;text-transform:uppercase;color:var(--accent-blue);">General Advice</span><p style="color:var(--text-primary);font-size:0.85rem;margin:4px 0 0;line-height:1.5;">${result.general_advice}</p></div>`;
        }

        panel.innerHTML += html;
    }

    // ========== MANUAL INTERACTION CHECKER (always visible) ==========
    const manualPanel = document.getElementById('manualInteractionChecker');
    if (manualPanel) {
        const checkBtn = document.getElementById('manualCheckBtn');
        const inputField = document.getElementById('manualMedInput');
        const resultDiv = document.getElementById('manualInteractionResult');

        if (checkBtn && inputField) {
            checkBtn.addEventListener('click', () => {
                const raw = inputField.value.trim();
                if (!raw) return;
                const meds = raw.split(',').map(m => m.trim()).filter(m => m.length > 0);
                if (meds.length < 2) {
                    resultDiv.innerHTML = '<p style="color:#f87171;font-size:0.85rem;">Enter at least 2 medicines separated by commas.</p>';
                    return;
                }
                resultDiv.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:12px;"><div style="width:18px;height:18px;border:2px solid #f59e0b;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div><span style="color:var(--text-secondary);font-size:0.85rem;">Checking...</span></div>`;

                fetch('/api/check-interactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ medicines: meds })
                })
                    .then(r => r.json())
                    .then(result => {
                        resultDiv.innerHTML = '';
                        if (result.error) {
                            resultDiv.innerHTML = `<p style="color:#f87171;">${result.error}</p>`;
                            return;
                        }
                        renderInteractionResults(resultDiv, result, meds);
                    })
                    .catch(err => {
                        resultDiv.innerHTML = `<p style="color:#f87171;">Error: ${err.message}</p>`;
                    });
            });
        }
    }

    // ========== AYUSH INTEGRATION HUB ==========
    const ayushSearchBtn = document.getElementById('ayushSearchBtn');
    const ayushSearchInput = document.getElementById('ayushSearchInput');
    const ayushSearchResult = document.getElementById('ayushSearchResult');

    if (ayushSearchBtn && ayushSearchInput) {
        // Enter key support
        ayushSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ayushSearchBtn.click(); });

        ayushSearchBtn.addEventListener('click', () => {
            const query = ayushSearchInput.value.trim();
            if (!query) return;

            ayushSearchResult.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:16px;background:rgba(16,185,129,0.08);border-radius:10px;"><div style="width:20px;height:20px;border:2px solid #10b981;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div><span style="color:var(--text-secondary);font-size:0.85rem;">Searching AYUSH treatments for "${query}"...</span></div>`;

            fetch('/api/ayush-lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            })
                .then(r => r.json())
                .then(result => {
                    ayushSearchResult.innerHTML = '';
                    if (result.error) {
                        ayushSearchResult.innerHTML = `<p style="color:#f87171;padding:8px;">${result.error}</p>`;
                        return;
                    }
                    renderAyushResults(ayushSearchResult, result);
                })
                .catch(err => {
                    ayushSearchResult.innerHTML = `<p style="color:#f87171;">Error: ${err.message}</p>`;
                });
        });
    }

    function renderAyushResults(container, result) {
        const systemStyles = {
            'Ayurveda': { emoji: '🌿', color: '#10b981', color2: '#059669', tagColor: '#6ee7b7', border: 'rgba(16,185,129,0.3)' },
            'Yoga & Naturopathy': { emoji: '🧘', color: '#8b5cf6', color2: '#7c3aed', tagColor: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
            'Unani': { emoji: '🏺', color: '#f59e0b', color2: '#d97706', tagColor: '#fcd34d', border: 'rgba(245,158,11,0.3)' },
            'Siddha': { emoji: '🔱', color: '#ef4444', color2: '#dc2626', tagColor: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
            'Homeopathy': { emoji: '⚗️', color: '#06b6d4', color2: '#0891b2', tagColor: '#67e8f9', border: 'rgba(6,182,212,0.3)' },
        };

        // Condition header
        let html = `<div style="margin-bottom:16px;padding:12px 16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">🌿</span>
            <div><span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:#10b981;font-weight:700;">AYUSH Treatments For</span>
            <p style="color:var(--text-primary);margin:2px 0 0;font-size:1.05rem;font-weight:600;">${result.condition}</p></div>
            <span style="margin-left:auto;padding:2px 8px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:4px;font-size:0.6rem;color:#10b981;font-weight:700;">✅ GOVT APPROVED</span>
        </div>`;

        // AYUSH result cards grid
        const items = result.ayush_results || [];
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">`;
        items.forEach(item => {
            const st = systemStyles[item.system] || systemStyles['Ayurveda'];
            const pct = item.quality_percentage || 0;
            const qColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
            const qColor2 = pct >= 70 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626';
            const seTags = (item.side_effects || []).map(e => `<span style="padding:1px 6px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:12px;font-size:0.68rem;color:#fca5a5;">${e}</span>`).join('');

            html += `<div style="background:#0f172a;border:2px solid ${st.border};border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:${st.tagColor};font-weight:700;">${st.emoji} ${item.system}</span>
                    ${item.ayush_approved ? `<span style="padding:1px 7px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:4px;font-size:0.58rem;color:#10b981;font-weight:700;">✅ AYUSH APPROVED</span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:40px;height:40px;min-width:40px;border-radius:8px;background:linear-gradient(135deg,${st.color},${st.color2});display:flex;align-items:center;justify-content:center;font-size:1.1rem;">${st.emoji}</div>
                    <div>
                        <h5 style="color:var(--text-primary);margin:0;font-size:0.95rem;">${item.medicine_name}</h5>
                        <p style="font-size:0.75rem;color:var(--text-secondary);margin:1px 0 0;">${item.manufacturer || ''}</p>
                    </div>
                </div>
                <p style="font-size:0.76rem;color:var(--text-secondary);margin:0;line-height:1.4;"><strong style="color:${st.tagColor};">Ingredients:</strong> ${item.key_ingredients || 'N/A'}</p>
                <p style="font-size:0.76rem;color:var(--text-secondary);margin:0;line-height:1.4;"><strong style="color:${st.tagColor};">Use:</strong> ${item.therapeutic_use || ''}</p>
                ${item.classical_reference ? `<div style="padding:5px 8px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:6px;"><span style="font-size:0.6rem;text-transform:uppercase;color:#a855f7;">📜 Classical Reference</span><p style="font-size:0.73rem;color:var(--text-primary);margin:2px 0 0;">${item.classical_reference}</p></div>` : ''}
                ${item.dosage_info ? `<div style="padding:5px 8px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15);border-radius:6px;"><span style="font-size:0.6rem;text-transform:uppercase;color:#3b82f6;">💊 Dosage</span><p style="font-size:0.73rem;color:var(--text-primary);margin:2px 0 0;">${item.dosage_info}</p></div>` : ''}
                ${item.contraindications ? `<div style="padding:5px 8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);border-radius:6px;"><span style="font-size:0.6rem;text-transform:uppercase;color:#ef4444;">⛔ Contraindications</span><p style="font-size:0.73rem;color:var(--text-secondary);margin:2px 0 0;">${item.contraindications}</p></div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(16,185,129,0.08);padding:5px 10px;border-radius:6px;">
                    <span style="font-size:0.75rem;color:var(--text-secondary);">Est. Price</span>
                    <span style="font-weight:700;color:var(--accent-green);">${item.estimated_price === 0 ? 'Free' : '₹' + (item.estimated_price || '—')}</span>
                </div>
                <div style="margin-top:2px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                        <span style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);">Quality</span>
                        <span style="font-weight:700;color:${qColor};font-size:0.85rem;">${pct}%</span>
                    </div>
                    <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${qColor},${qColor2});border-radius:3px;transition:width 0.6s;"></div>
                    </div>
                </div>
                ${seTags ? `<div><span style="font-size:0.6rem;text-transform:uppercase;color:var(--text-secondary);">Side Effects</span><div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">${seTags}</div></div>` : ''}
            </div>`;
        });
        html += `</div>`;

        // Lifestyle tips
        if (result.lifestyle_tips) {
            html += `<div style="margin-top:16px;padding:14px;background:rgba(16,185,129,0.08);border-radius:10px;border:1px solid rgba(16,185,129,0.15);">
                <span style="font-size:0.7rem;text-transform:uppercase;color:#10b981;font-weight:700;">🌱 AYUSH Lifestyle Tips</span>
                <p style="color:var(--text-primary);font-size:0.85rem;margin:6px 0 0;line-height:1.6;">${result.lifestyle_tips}</p>
            </div>`;
        }

        // When to see doctor
        if (result.when_to_see_doctor) {
            html += `<div style="margin-top:10px;padding:14px;background:rgba(239,68,68,0.08);border-radius:10px;border:1px solid rgba(239,68,68,0.15);">
                <span style="font-size:0.7rem;text-transform:uppercase;color:#ef4444;font-weight:700;">🏥 When to See a Doctor</span>
                <p style="color:var(--text-primary);font-size:0.85rem;margin:6px 0 0;line-height:1.6;">${result.when_to_see_doctor}</p>
            </div>`;
        }

        container.innerHTML = html;
    }
});
