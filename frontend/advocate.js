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

            // Quality bar helper
            function qualityBar(pct, color1, color2) {
                const c = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
                return `<div style="margin-top:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);">Quality Rating</span>
                        <span style="font-weight:700;color:${c};font-size:0.95rem;">${pct}%</span>
                    </div>
                    <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${color1 || c},${color2 || c});border-radius:4px;transition:width 0.6s ease;"></div>
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
                    ${qualityBar(origQuality, '#f87171', '#ef4444')}
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
                ${qualityBar(item.suggested_quality_percentage || 0, '#3b82f6', '#2563eb')}
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
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:44px;height:44px;min-width:44px;border-radius:8px;background:linear-gradient(135deg,${st.color},${st.color2});display:flex;align-items:center;justify-content:center;font-size:1.2rem;">${st.emoji}</div>
                        <div>
                            <h5 style="color:var(--text-primary);margin:0;font-size:1rem;">${alt.medicine_name}</h5>
                            <p style="font-size:0.78rem;color:var(--text-secondary);margin:2px 0 0;">${alt.manufacturer || ''}</p>
                        </div>
                    </div>
                    <p style="font-size:0.78rem;color:var(--text-secondary);margin:0;line-height:1.4;"><strong style="color:${st.tagColor};">Ingredients:</strong> ${alt.key_ingredients || 'N/A'}</p>
                    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(16,185,129,0.08);padding:6px 10px;border-radius:6px;">
                        <span style="font-size:0.78rem;color:var(--text-secondary);">Est. Price</span>
                        <span style="font-weight:700;color:var(--accent-green);">₹${alt.estimated_price || '—'}</span>
                    </div>
                    ${qualityBar(alt.quality_percentage || 0, st.color, st.color2)}
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
    }
});
