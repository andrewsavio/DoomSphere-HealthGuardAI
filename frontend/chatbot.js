/**
 * HealthGuard AI - Native Chatbot Logic
 * Interfaces directly with the Groq API for streaming inference without Flutter compiling.
 */

// UI Elements
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatForm = document.getElementById('chatForm');
const messagesStream = document.getElementById('messagesStream');
const chatLanguageMenu = document.getElementById('chatLanguage');
const quickPrompts = document.querySelectorAll('.quick-prompt-btn');

// Image Upload UI
const chatImageInput = document.getElementById('chatImageInput');
const triggerImageUploadBtn = document.getElementById('triggerImageUploadBtn');
const chatImagePreviewContainer = document.getElementById('chatImagePreviewContainer');
const chatImagePreview = document.getElementById('chatImagePreview');
const removeChatImageBtn = document.getElementById('removeChatImageBtn');

// State
let messageHistory = [];
let isTyping = false;
let selectedImageFile = null;
let currentSessionId = null; // Tracks active Supabase session record
let currentInsuranceContext = null;

// Parse URL Parameters for Insurance Context
const urlParams = new URLSearchParams(window.location.search);
const insuranceContextParam = urlParams.get('insurance_context');
if (insuranceContextParam) {
    try {
        currentInsuranceContext = JSON.parse(decodeURIComponent(insuranceContextParam));
        console.log("Loaded Insurance Context:", currentInsuranceContext);
    } catch (e) {
        console.error("Failed to parse insurance context", e);
    }
}

// Configuration
const CHAT_MODEL = 'claude-opus-4-6';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
let GROQ_API_KEY = '';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch API Key from backend securely for text-only fallbacks
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const data = await response.json();
            GROQ_API_KEY = data.groq_api_key;
        }
    } catch (err) {
        console.error("Failed to load generic config for API keys", err);
    }

    // Auto-message for insurance context
    if (currentInsuranceContext) {
        const initialContextMsg = `I am looking at the following insurance policy you recommended:

**Name:** ${currentInsuranceContext.name}
**Provider:** ${currentInsuranceContext.provider}
**Analysis:** ${currentInsuranceContext.analysis}

Could you explain more about this, or should I ask my specific doubts?`;

        // Trigger AI Response using existing flow
        setTimeout(() => {
            handleUserMessage(initialContextMsg);
        }, 500);
    }

    // Image Upload Handlers
    if (triggerImageUploadBtn) {
        triggerImageUploadBtn.addEventListener('click', () => chatImageInput.click());
    }

    if (chatImageInput) {
        chatImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                selectedImageFile = e.target.files[0];
                chatImagePreview.src = URL.createObjectURL(selectedImageFile);
                chatImagePreviewContainer.style.display = 'flex';
                sendBtn.disabled = false;
                sendBtn.style.opacity = '1';
            }
        });
    }

    if (removeChatImageBtn) {
        removeChatImageBtn.addEventListener('click', () => {
            selectedImageFile = null;
            chatImageInput.value = '';
            chatImagePreviewContainer.style.display = 'none';
            if (chatInput.value.trim().length === 0) {
                sendBtn.disabled = true;
                sendBtn.style.opacity = '0.5';
            }
        });
    }

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight) + 'px';

        if ((chatInput.value.trim().length > 0 || selectedImageFile) && !isTyping) {
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
        } else {
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.5';
        }
    });

    // Handle Enter to submit (Shift+Enter for newline)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) {
                chatForm.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Form Submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        await handleUserMessage(text);
    });

    // Quick Prompts
    quickPrompts.forEach(btn => {
        btn.addEventListener('click', async () => {
            const text = btn.textContent.replace(/^[^\s]+\s/, ''); // Remove emoji prefix
            await handleUserMessage(text);
        });
    });

    // New Chat Button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            currentSessionId = null;
            messageHistory = [];
            messagesStream.innerHTML = `
                <div class="message system-message welcome-wrapper">
                    <div class="welcome-box">
                        <div class="welcome-icon">
                            <i data-lucide="sparkles"></i>
                        </div>
                        <h3>Hello! I'm HealthGuard AI</h3>
                        <p>I can help you understand medical reports, explain medications, and provide wellness tips.</p>
                        <div class="quick-prompts">
                            <button class="quick-prompt-btn" onclick="handleUserMessage('Explain my medication')">💊 Explain my medication</button>
                            <button class="quick-prompt-btn" onclick="handleUserMessage('What does my blood test mean?')">🩸 What does my blood test mean?</button>
                            <button class="quick-prompt-btn" onclick="handleUserMessage('Wellness tips for today')">🏃 Wellness tips for today</button>
                            <button class="quick-prompt-btn" onclick="handleUserMessage('Diet recommendations')">🍎 Diet recommendations</button>
                        </div>
                    </div>
                </div>
            `;
            lucide.createIcons();
            document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
        });
    }

    // Wait for Supabase to initialize from app.js then load history
    setTimeout(loadChatHistory, 1000);
});

async function loadChatHistory() {
    const list = document.getElementById('chatHistoryList');
    if (!list) return;

    if (!window.supabaseClient || !window.currentUser) {
        list.innerHTML = '<div style="padding: 15px; color: var(--text-secondary); font-size: 0.9rem;">Please log in to view history</div>';
        return;
    }

    try {
        const { data: sessions, error } = await window.supabaseClient
            .from('chat_sessions')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        if (!sessions || sessions.length === 0) {
            list.innerHTML = '<div style="padding: 15px; color: var(--text-secondary); font-size: 0.9rem;">No previous chats</div>';
            return;
        }

        list.innerHTML = '';
        sessions.forEach(session => {
            const div = document.createElement('div');
            div.className = `history-item ${currentSessionId === session.id ? 'active' : ''}`;
            const date = new Date(session.updated_at).toLocaleDateString();
            div.innerHTML = `
                <i data-lucide="message-square"></i>
                <div class="history-content">
                    <div class="history-title">${session.title}</div>
                    <div class="history-date">${date}</div>
                </div>
            `;
            div.onclick = () => loadSessionMessages(session.id, div);
            list.appendChild(div);
        });
        lucide.createIcons();
    } catch (err) {
        console.error("Failed to load sessions:", err);
        list.innerHTML = '<div style="padding: 15px; color: var(--accent-red); font-size: 0.9rem;">Failed to load history</div>';
    }
}

async function loadSessionMessages(sessionId, element) {
    if (!window.supabaseClient) return;

    // Update UI active state
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    currentSessionId = sessionId;
    messagesStream.innerHTML = '<div style="text-align: center; padding: 40px;"><i data-lucide="loader-2" class="spin"></i> Loading...</div>';
    lucide.createIcons();

    try {
        const { data: messages, error } = await window.supabaseClient
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        messagesStream.innerHTML = '';
        messageHistory = [];

        messages.forEach(msg => {
            messageHistory.push({ role: msg.role, content: msg.content });
            renderMessage(msg.content, msg.role); // uses existing logic
        });

    } catch (err) {
        console.error("Failed to load messages:", err);
        messagesStream.innerHTML = '<div style="text-align: center; color: var(--accent-red); padding: 40px;">Failed to load messages</div>';
    }
}

async function handleUserMessage(text) {
    if (isTyping) return;

    const hasImage = !!selectedImageFile;
    const imageUrl = hasImage ? URL.createObjectURL(selectedImageFile) : null;
    const imageToProcess = selectedImageFile;

    // Clear Input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatImagePreviewContainer.style.display = 'none';
    selectedImageFile = null;
    chatImageInput.value = '';
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';

    // Remove welcome box if present
    const welcome = document.querySelector('.welcome-wrapper');
    if (welcome) welcome.remove();

    // 1. Render User Message
    renderMessage(text, 'user', imageUrl);
    messageHistory.push({ role: 'user', content: text });

    // 2. Render Typing Indicator
    isTyping = true;
    showTypingIndicator(hasImage);

    // 3. Perform AI Request
    try {
        let aiResponse = "";
        if (hasImage) {
            aiResponse = await sendPuterChatRequest(text, imageToProcess);
        } else {
            aiResponse = await sendGroqChatRequest(text);
        }

        // Remove typing
        hideTypingIndicator();

        // 4. Render AI Message
        renderMessage(aiResponse, 'assistant');
        messageHistory.push({ role: 'assistant', content: aiResponse });

        // 5. Async Save to Supabase (if logged in)
        saveInteractionToSupabase(text, aiResponse);

    } catch (err) {
        hideTypingIndicator();
        console.error("HealthGuard AI Error:", err);
        const errMsg = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
        renderMessage(`⚠️ Error connecting to HealthGuard AI: ${errMsg}`, 'system');
    } finally {
        isTyping = false;
        if (chatInput.value.trim() !== '' || selectedImageFile) sendBtn.disabled = false;
    }
}

function renderMessage(content, role, imageUrl = null) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role === 'user' ? 'user-message' : 'system-message'}`;

    if (role === 'user') {
        if (imageUrl) {
            wrapper.innerHTML = `
                <img src="${imageUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 8px; display: block;">
                <div>${content ? content.replace(/</g, '&lt;') : ''}</div>
            `;
        } else {
            wrapper.textContent = content;
        }
    } else {
        wrapper.innerHTML = `
            <div class="system-icon">
                <i data-lucide="sparkles"></i>
            </div>
            <div class="system-bubble">
                ${formatAIResponse(content)}
            </div>
        `;
    }

    messagesStream.appendChild(wrapper);
    if (window.lucide) lucide.createIcons();

    // Smooth scroll to bottom
    messagesStream.scrollTo({
        top: messagesStream.scrollHeight,
        behavior: 'smooth'
    });
}

function showTypingIndicator(isImageAnalysis) {
    const typingUI = document.createElement('div');
    typingUI.className = 'message system-message typing-indicator-wrapper';
    typingUI.id = 'typingIndicator';

    // Dynamic text
    const textOptions = isImageAnalysis ?
        ["Scanning medical image...", "Applying vision models...", "Synthesizing insights...", "Generating detailed response..."] :
        ["Analyzing medical data...", "Synthesizing insights...", "Evaluating health parameters...", "Generating response..."];

    const randomText = textOptions[0];

    typingUI.innerHTML = `
        <div class="system-icon">
            <i data-lucide="sparkles"></i>
        </div>
        <div class="typing-indicator" style="flex-direction: column; align-items: flex-start; gap: 8px;">
            <div style="font-size: 0.85rem; color: var(--accent-cyan); font-weight: 600;" id="typingText">${randomText}</div>
            <div style="display: flex; gap: 4px;">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    messagesStream.appendChild(typingUI);
    lucide.createIcons();
    messagesStream.scrollTop = messagesStream.scrollHeight;

    let cycleCount = 1;
    window.typingInterval = setInterval(() => {
        const el = document.getElementById('typingText');
        if (el) {
            el.innerText = textOptions[cycleCount % textOptions.length];
            cycleCount++;
        } else {
            clearInterval(window.typingInterval);
        }
    }, 2500);
}

function hideTypingIndicator() {
    if (window.typingInterval) clearInterval(window.typingInterval);
    const typingUI = document.getElementById('typingIndicator');
    if (typingUI) typingUI.remove();
}

/**
 * Converts LLM Markdown to HTML visually targeting standard health domains.
 */
function formatAIResponse(text) {
    let html = text
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Newlines to P
        .split('\n\n')
        .map(p => `<div>${p.replace(/\n/g, '<br/>')}</div>`)
        .join('');

    // Simple list processing
    html = html.replace(/(?:<br\/>|^)• (.*?)(?:<br\/>|$)/g, '<li>$1</li>');
    if (html.includes('<li>')) {
        html = `<ul>${html}</ul>`;
    }

    return html;
}

/**
 * Puter.js AI caller replacing API keys with free Cloud API
 */
async function sendPuterChatRequest(latestMessage, imageFile) {
    if (typeof puter === 'undefined') {
        throw new Error("Puter.js is missing. Please check your connection.");
    }

    const currentLanguage = chatLanguageMenu ? chatLanguageMenu.value : 'English';

    const systemPrompt = `You are HealthGuard AI, a compassionate, knowledgeable healthcare assistant designed for patients in India. Your advice should be relevant to the Indian healthcare system. Your role:
1. MEDICAL ACCURACY: Provide medically accurate info but constantly note you're not a doctor.
2. PLAIN LANGUAGE: Explain medical concepts in simple terms.
3. INSTRUCTION: The user prefers chatting in ${currentLanguage}. Respond exclusively in ${currentLanguage}.
4. SCOPE: Discuss general health topics, interpret common lab values, and suggest when to see a doctor. Never diagnose.
${currentInsuranceContext ? `\n\n5. INSURANCE CONTEXT: The user is asking about the following insurance policy. Answer questions specifically based on this data:\nName: ${currentInsuranceContext.name}\nProvider: ${currentInsuranceContext.provider}\nAnalysis: ${currentInsuranceContext.analysis}\nLink: ${currentInsuranceContext.websiteLink}` : ''}`;

    let combinedPrompt = systemPrompt + "\n\n--- Chat History ---\n";

    const contextWindow = messageHistory.slice(-6);
    contextWindow.forEach(msg => {
        combinedPrompt += `${msg.role === 'user' ? 'Patient' : 'HealthGuard AI'}: ${msg.content}\n\n`;
    });

    combinedPrompt += `Patient: ${latestMessage}\nHealthGuard AI:`;

    const options = {
        model: 'gpt-5-nano'
    };

    let response;

    if (imageFile) {
        try {
            if (!window.supabaseClient) {
                console.warn("Supabase client not immediately found. Attempting inline initialization...");
                const res = await fetch('/api/config');
                const tempConfig = await res.json();
                if (window.supabase && tempConfig.supabase_url && tempConfig.supabase_anon_key) {
                    window.supabaseClient = supabase.createClient(tempConfig.supabase_url, tempConfig.supabase_anon_key);
                } else {
                    throw new Error("Supabase client not available and could not be recovered via /api/config. Check .env keys.");
                }
            }

            console.log("Uploading image to Supabase external storage...");
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { data, error } = await window.supabaseClient.storage
                .from('chat_images')
                .upload(fileName, imageFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: publicUrlData } = window.supabaseClient.storage
                .from('chat_images')
                .getPublicUrl(fileName);

            const publicUrl = publicUrlData.publicUrl;

            console.log("Image uploaded to public CDN, sending to puter.ai.chat:", publicUrl);
            response = await puter.ai.chat(combinedPrompt, publicUrl, options);
        } catch (uploadErr) {
            console.error("Failed to upload image to Supabase:", uploadErr);
            throw new Error(`Unable to upload image for analysis. Ensure the 'chat_images' storage bucket is created via SQL. Details: ${uploadErr.message}`);
        }
    } else {
        response = await puter.ai.chat(combinedPrompt, options);
    }

    let textResponse = "";
    if (typeof response === "string") {
        textResponse = response;
    } else if (response?.message?.content) {
        if (Array.isArray(response.message.content)) {
            textResponse = response.message.content.map(b => b.text || b.toString()).join("");
        } else {
            textResponse = String(response.message.content);
        }
    } else if (response?.text) {
        textResponse = response.text;
    } else if (response != null) {
        textResponse = String(response);
    }

    if (!textResponse) {
        throw new Error("Received empty response from Puter AI");
    }

    return textResponse;
}

async function sendGroqChatRequest(latestMessage) {
    if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing. Groq requires backend configuration.");
    }

    const currentLanguage = chatLanguageMenu ? chatLanguageMenu.value : 'English';

    const systemPrompt = `You are HealthGuard AI, a compassionate, knowledgeable healthcare assistant designed for patients in India. Your advice should be relevant to the Indian healthcare system. Your role:
1. MEDICAL ACCURACY: Provide medically accurate info but constantly note you're not a doctor.
2. PLAIN LANGUAGE: Explain medical concepts in simple terms.
3. INSTRUCTION: The user prefers chatting in ${currentLanguage}. Respond exclusively in ${currentLanguage}.
4. SCOPE: Discuss general health topics, interpret common lab values, and suggest when to see a doctor. Never diagnose.
${currentInsuranceContext ? `\n\n5. INSURANCE CONTEXT: The user is asking about the following insurance policy. Answer questions specifically based on this data:\nName: ${currentInsuranceContext.name}\nProvider: ${currentInsuranceContext.provider}\nAnalysis: ${currentInsuranceContext.analysis}\nLink: ${currentInsuranceContext.websiteLink}` : ''}`;

    const messages = [{ role: 'system', content: systemPrompt }];

    const contextWindow = messageHistory.slice(-6);
    contextWindow.forEach(msg => messages.push({ role: msg.role, content: msg.content }));

    messages.push({ role: 'user', content: latestMessage });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048
        })
    });

    if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error?.message || response.statusText);
    }

    const json = await response.json();
    return json.choices[0].message.content;
}

async function saveInteractionToSupabase(userMsg, aiMsg) {
    if (!window.supabaseClient || !window.currentUser) return; // Supabase not loaded or user not logged in

    try {
        console.log("Saving interaction to Cloud DB for user:", window.currentUser.id);

        let sessionId = currentSessionId;

        // 1. If it's a completely new chat, generate a Session container first
        if (!sessionId) {
            let titleStr = userMsg;
            if (titleStr.length > 30) titleStr = titleStr.substring(0, 30) + '...';

            const { data: newSession, error: sessionErr } = await window.supabaseClient
                .from('chat_sessions')
                .insert([{
                    user_id: window.currentUser.id,
                    title: titleStr
                }])
                .select()
                .single();

            if (sessionErr) throw sessionErr;

            sessionId = newSession.id;
            currentSessionId = sessionId; // Locally lock into this session

            // Refresh the sidebar instantly to show the brand new session!
            loadChatHistory();
        } else {
            // Touch the session so it pops to the "top" of the "Last Updated" sequence
            await window.supabaseClient.from('chat_sessions').update({ updated_at: new Date() }).eq('id', sessionId);
        }

        // 2. Insert both the human prompt and the system response
        const messagesToInsert = [
            { session_id: sessionId, user_id: window.currentUser.id, role: 'user', content: userMsg },
            { session_id: sessionId, user_id: window.currentUser.id, role: 'assistant', content: aiMsg }
        ];

        const { error: msgErr } = await window.supabaseClient
            .from('chat_messages')
            .insert(messagesToInsert);

        if (msgErr) throw msgErr;
    } catch (err) {
        console.error("Silently failed to save messages to DB:", err);
    }
}
