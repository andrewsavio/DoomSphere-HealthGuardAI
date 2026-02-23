document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const ageSlider = document.getElementById('ageSlider');
    const ageValue = document.getElementById('ageValue');
    const insureWhoGroup = document.getElementById('insureWhoGroup');
    const citySelect = document.getElementById('citySelect');
    const incomeSelect = document.getElementById('incomeSelect');
    const medicalGroup = document.getElementById('medicalGroup');
    const form = document.getElementById('insuranceForm');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const resultsContainer = document.getElementById('resultsContainer');
    const insuranceResults = document.getElementById('insuranceResults');
    const otherMedicalContainer = document.getElementById('otherMedicalContainer');
    const otherMedicalInput = document.getElementById('otherMedicalInput');

    // Age Slider sync
    ageSlider.addEventListener('input', (e) => {
        ageValue.textContent = `${e.target.value} Years`;
    });

    // Pill Toggle Logic
    const togglePill = (btn, group, isMultiSelect = false) => {
        if (!isMultiSelect) {
            // Single select mode
            group.querySelectorAll('.pill-btn').forEach(b => {
                b.classList.remove('active');
                b.textContent = b.dataset.value; // Remove checkmark
            });
            btn.classList.add('active');
            btn.textContent = `✓ ${btn.dataset.value}`;
        } else {
            // Multi select logic (for medical)
            if (btn.dataset.value === 'None') {
                // If "None" is clicked, clear others
                group.querySelectorAll('.pill-btn').forEach(b => {
                    b.classList.remove('active');
                    if (b.dataset.value === 'None') {
                        b.classList.add('active');
                        b.textContent = `✓ None`;
                    } else {
                        b.textContent = b.dataset.value;
                    }
                });

                // Hide Other input
                if (group.id === 'medicalGroup') {
                    otherMedicalContainer.style.display = 'none';
                    otherMedicalInput.value = '';
                }
            } else {
                // Uncheck None if active
                const noneBtn = group.querySelector('[data-value="None"]');
                noneBtn.classList.remove('active');
                noneBtn.textContent = 'None';

                btn.classList.toggle('active');
                if (btn.classList.contains('active')) {
                    btn.textContent = `✓ ${btn.dataset.value}`;
                } else {
                    btn.textContent = btn.dataset.value;
                }

                // Show/Hide Other input
                if (group.id === 'medicalGroup' && btn.dataset.value === 'Other') {
                    otherMedicalContainer.style.display = btn.classList.contains('active') ? 'block' : 'none';
                    if (!btn.classList.contains('active')) otherMedicalInput.value = '';
                }

                // If all unchecked, recheck None
                const anyActive = group.querySelectorAll('.pill-btn.active').length > 0;
                if (!anyActive) {
                    noneBtn.classList.add('active');
                    noneBtn.textContent = `✓ None`;
                }
            }
        }
    };

    // Setup Listeners
    insureWhoGroup.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => togglePill(btn, insureWhoGroup, false));
    });

    medicalGroup.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => togglePill(btn, medicalGroup, true));
    });

    // Handle Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Gather Data
        const age = ageSlider.value;
        const insureSelection = insureWhoGroup.querySelector('.active').dataset.value;
        const city = citySelect.value;
        const income = incomeSelect.value;

        let conditions = Array.from(medicalGroup.querySelectorAll('.active'))
            .map(btn => btn.dataset.value).filter(val => val !== 'Other');

        // Add custom text if 'Other' is checked
        if (medicalGroup.querySelector('.pill-btn[data-value="Other"]').classList.contains('active')) {
            const customConditions = otherMedicalInput.value.trim();
            if (customConditions) {
                conditions.push(customConditions);
            }
        }

        const conditionsString = conditions.length > 0 ? conditions.join(', ') : 'None';

        const requestData = { age, insureSelection, city, income, conditions: conditionsString };

        // Show Loading
        loadingOverlay.style.display = 'flex';
        insuranceResults.style.display = 'none';
        resultsContainer.innerHTML = '';

        try {
            await fetchAndRenderInsurances(requestData);
        } catch (error) {
            console.error(error);
            resultsContainer.innerHTML = `<div class="error-msg">Failed to load recommendations. ${error.message}</div>`;
            insuranceResults.style.display = 'block';
        } finally {
            loadingOverlay.style.display = 'none';
        }
    });

    async function fetchAndRenderInsurances(data) {
        const prompt = `
You are an expert Indian health insurance advisor. 
Based on these details, recommend the top 3 Indian health insurances that best match these preferences:
- Eldest member age: ${data.age}
- Insuring: ${data.insureSelection}
- City Tier: ${data.city}
- Family Income: ${data.income}
- Existing Medical Conditions: ${data.conditions}

IMPORTANT: You must respond ONLY with a valid JSON array. Do not include markdown \`\`\`json text. 
Format each recommendation exactly like this:
[
  {
    "name": "Insurance Name",
    "provider": "Provider Name",
    "analysis": "In-depth analysis of why it suits the criteria, limits, waiting periods for conditions.",
    "websiteLink": "Actual website URL for the insurance provider"
  }
]
`;

        let groqKey = '';
        try {
            const res = await fetch('/api/config');
            const config = await res.json();
            groqKey = config.groq_insurance_key || config.groq_api_key;
        } catch (e) {
            console.warn("Failed to fetch config, looking for fallback...", e);
        }

        if (!groqKey) {
            throw new Error("No Groq API key configured. Please set groq_insurance or GROQ_API_KEY in .env");
        }

        console.log("Requesting Groq API for Insurance...");
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
        } catch (error) {
            throw new Error(`Groq API Error: ${error.message}`);
        }

        // Parse JSON
        let insurances;
        try {
            // Clean markdown if present
            rawResponse = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            insurances = JSON.parse(rawResponse);
        } catch (e) {
            throw new Error('AI returned an invalid response format.');
        }

        if (!Array.isArray(insurances)) throw new Error('AI Response was not a list.');

        // Render
        insurances.forEach(insurance => {
            const card = document.createElement('div');
            card.className = 'insurance-card';

            // Encode context for the chatbot
            const contextPayload = encodeURIComponent(JSON.stringify(insurance));

            card.innerHTML = `
                <div class="insurance-title">
                    ${insurance.name} 
                    <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary); background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px;">${insurance.provider}</span>
                </div>
                <div class="insurance-desc">${insurance.analysis}</div>
                <div class="insurance-actions">
                    <a href="${insurance.websiteLink}" target="_blank" class="btn btn-outline">
                        <i data-lucide="external-link" style="width: 16px; height: 16px;"></i> Visit site
                    </a>
                    <a href="/chatbot?insurance_context=${contextPayload}" class="btn btn-primary" style="background: var(--accent-blue); border-color: var(--accent-blue); color: white; box-shadow: 0 4px 15px rgba(88, 101, 242, 0.4);">
                        <i data-lucide="message-circle" style="width: 16px; height: 16px;"></i> Chat with AI
                    </a>
                </div>
            `;
            resultsContainer.appendChild(card);
        });

        insuranceResults.style.display = 'block';
        lucide.createIcons();
    }
});
