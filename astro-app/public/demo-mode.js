/**
 * Demo mode: intercepts backend API calls with canned sample data so the
 * frontend can be explored end-to-end before a real backend is deployed.
 * Disable by setting window.DEMO_MODE = false (see astro pages) once
 * PUBLIC_API_BASE_URL points at a real backend.
 */
(function () {
    if (!window.DEMO_MODE) return;

    const DEMO_TAG = "[Demo Mode]";
    console.info(`${DEMO_TAG} No backend configured — serving sample data. Set PUBLIC_API_BASE_URL to connect a real one.`);

    function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

    const sampleFindings = [
        { finding: "Ground-glass opacity", confidence: 87.4, description: "Hazy increased opacity in the right upper lobe, sample data only.", severity: "medium" },
        { finding: "Mild cardiomegaly", confidence: 42.1, description: "Slightly enlarged cardiac silhouette, sample data only.", severity: "low" },
        { finding: "Normal - No significant findings", confidence: 12.3, description: "No acute abnormality detected in remaining fields.", severity: "low" },
    ];

    const sampleAnalyzeResponse = {
        session_id: "demo-session-0001",
        scan_type: { scan_type: "Chest X-Ray", confidence: 96.5 },
        analysis: {
            findings: sampleFindings,
            overall_severity: "medium",
            primary_finding: sampleFindings[0].finding,
            description: sampleFindings[0].description,
            model_info: { name: "HealthGuard DenseNet-121 (Demo)", device: "cpu" },
            detailed_report: {
                header: {
                    patient_name: "Demo Patient",
                    modality: "Chest X-Ray",
                    scan_date: new Date().toISOString().slice(0, 10),
                    body_part: "Thorax",
                    ai_version: "HealthGuard DenseNet-121 v2.5 (Demo)",
                    physician: "Sample Data (Demo Mode)",
                },
                structures: {
                    "Lungs": "Patchy ground-glass opacity noted in the right upper lobe (sample data).",
                    "Heart": "Cardiac silhouette within upper-normal limits (sample data).",
                    "Bones": "No acute osseous abnormality (sample data).",
                },
                metrics: [
                    { parameter: "Cardiothoracic ratio", result: "0.52", normal: "< 0.50", status: "Review" },
                    { parameter: "Lung field opacity", result: "Elevated", normal: "Clear", status: "Abnormal" },
                ],
                risks: [
                    { pathology: "Pneumonia", probability: "34%", risk_category: "Moderate" },
                    { pathology: "Pleural effusion", probability: "8%", risk_category: "Low" },
                ],
                summary: "Sample clinical interpretation: findings are consistent with a mild inflammatory process in the right upper lobe. This is demo data, not a real diagnosis.",
                recommendations: [
                    "This is sample/demo output — no real backend is connected yet.",
                    "Once connected, recommendations here reflect the AI model's actual output.",
                ],
                confidence: "87.4%",
            },
        },
        images: {
            heatmap: "/demo/sample-heatmap.png",
            annotated: "/demo/sample-annotated.png",
            medical_viz: null,
        },
        report: {
            filename: "demo-report.pdf",
            download_url: null,
            supabase_report_url: null,
        },
    };

    const sampleAdvocateResponse = {
        ocr_text: "Rx: Sample Medicine 500mg — twice daily after food (demo data).",
        cards: [
            { name: "Sample Medicine 500mg", purpose: "Pain & fever relief (demo data)", dosage: "1 tablet twice daily", quality_score: 82 },
        ],
    };

    const sampleInteractionsResponse = {
        interactions: [
            { pair: "Sample Medicine A + Sample Medicine B", severity: "low", note: "No clinically significant interaction found (demo data)." },
        ],
    };

    const sampleAyushResponse = {
        results: [
            { system: "Ayurveda", name: "Sample Herbal Remedy", description: "Traditional remedy example (demo data)." },
        ],
    };

    // Non-empty so login.html/admin.html's "keys missing" guards pass — the actual
    // client is our fake shim below, these values are never used to reach a real Supabase.
    const sampleConfigResponse = { supabase_url: "https://demo.supabase.local", supabase_anon_key: "demo-anon-key", demo: true };
    const sampleHealthResponse = { status: "ok", demo: true };
    const sampleFeedbackResponse = { feedback_id: "demo-fb-0001", status: "recorded", demo: true };
    const sampleTrainStatusResponse = { is_training: false, progress: 100, message: "Demo mode — no training performed.", demo: true };
    const sampleGroqChatResponse = {
        choices: [{ message: { content: "This is a sample assistant reply (demo mode — no backend connected yet)." } }],
    };

    const ROUTES = [
        { test: (p) => p.endsWith("/api/config"), body: sampleConfigResponse },
        { test: (p) => p.endsWith("/api/health"), body: sampleHealthResponse },
        { test: (p) => p.endsWith("/api/analyze-batch"), body: { results: [sampleAnalyzeResponse] } },
        { test: (p) => p.endsWith("/api/analyze"), body: sampleAnalyzeResponse },
        { test: (p) => p.endsWith("/api/reanalyze"), body: { ...sampleAnalyzeResponse, is_reanalysis: true } },
        { test: (p) => p.endsWith("/api/update_report_viz"), body: { status: "ok", demo: true } },
        { test: (p) => p.endsWith("/api/feedback"), body: sampleFeedbackResponse },
        { test: (p) => p.endsWith("/api/feedback/stats"), body: { total_feedback: 0, demo: true } },
        { test: (p) => p.endsWith("/api/train/status"), body: sampleTrainStatusResponse },
        { test: (p) => p.endsWith("/api/train"), body: { status: "demo", message: "Training is disabled in demo mode." } },
        { test: (p) => p.endsWith("/api/reports/download-all"), body: { error: "Report download is unavailable in demo mode." }, status: 503 },
        { test: (p) => p.endsWith("/api/advocate/analyze"), body: sampleAdvocateResponse },
        { test: (p) => p.endsWith("/api/check-interactions"), body: sampleInteractionsResponse },
        { test: (p) => p.endsWith("/api/ayush-lookup"), body: sampleAyushResponse },
        { test: (p) => p.includes("api.groq.com"), body: sampleGroqChatResponse },
    ];

    const realFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        const route = ROUTES.find((r) => r.test(url));
        if (!route) return realFetch(input, init);

        // /api/config gates page init (auth client creation) everywhere it's called —
        // an artificial delay here made the "submit before init finishes" race trivial to hit.
        if (!url.endsWith("/api/config")) {
            await delay(500 + Math.random() * 400);
        }
        return new Response(JSON.stringify(route.body), {
            status: route.status || 200,
            headers: { "Content-Type": "application/json" },
        });
    };

    // ---- Fake Supabase client: auth + minimal data, backed by localStorage ----
    // Locks window.supabase before the real @supabase/supabase-js CDN script (loaded
    // later in each page) can overwrite it — see the writable:false below.
    const DEFAULT_DEMO_USERS = [
        { id: "demo-patient", email: "patient@demo.com", password: "demo1234", role: "patient", full_name: "Demo Patient" },
        { id: "demo-doctor", email: "doctor@demo.com", password: "demo1234", role: "doctor", full_name: "Demo Doctor" },
        { id: "demo-admin", email: "admin@demo.com", password: "demo1234", role: "admin", full_name: "Demo Admin" },
    ];

    function loadDemoUsers() {
        try {
            const raw = localStorage.getItem("demo_users");
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore, fall through to seed defaults */ }
        localStorage.setItem("demo_users", JSON.stringify(DEFAULT_DEMO_USERS));
        return DEFAULT_DEMO_USERS.slice();
    }
    function saveDemoUsers(users) {
        try { localStorage.setItem("demo_users", JSON.stringify(users)); } catch (e) { /* ignore */ }
    }
    function loadDemoSession() {
        try { return JSON.parse(localStorage.getItem("demo_session")); } catch (e) { return null; }
    }
    // Several pages have their own early "prevent UI flash" guard that checks raw
    // localStorage for a real-Supabase-shaped `sb-<ref>-auth-token` key *before* our
    // async getSession() ever runs — write/remove that key too so those guards see us.
    const FLASH_GUARD_KEY = "sb-demo-auth-token";
    function saveDemoSession(session) {
        try {
            if (session) {
                localStorage.setItem("demo_session", JSON.stringify(session));
                localStorage.setItem(FLASH_GUARD_KEY, JSON.stringify(session));
            } else {
                localStorage.removeItem("demo_session");
                localStorage.removeItem(FLASH_GUARD_KEY);
            }
        } catch (e) { /* ignore */ }
    }
    function toSupabaseUser(u) {
        return { id: u.id, email: u.email, user_metadata: { full_name: u.full_name, role: u.role } };
    }

    const authListeners = [];
    function notifyAuth(session) {
        authListeners.forEach((cb) => { try { cb(session ? "SIGNED_IN" : "SIGNED_OUT", session); } catch (e) { /* ignore listener errors */ } });
    }

    function makeQueryBuilder(table) {
        let insertRows = null;
        let single = false;
        const builder = {
            select() { return this; },
            order() { return this; },
            limit() { return this; },
            eq() { return this; },
            update() { return this; },
            insert(rows) { insertRows = rows; return this; },
            single() { single = true; return this; },
            then(resolve) {
                if (insertRows) {
                    const rows = insertRows.map((r, i) => ({ id: `demo-${table}-${Date.now()}-${i}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r }));
                    resolve({ data: single ? rows[0] : rows, error: null });
                } else if (table === "profiles") {
                    const users = loadDemoUsers().map((u) => ({ full_name: u.full_name, email: u.email, role: u.role, updated_at: new Date().toISOString() }));
                    resolve({ data: single ? users[0] || null : users, error: null });
                } else {
                    resolve({ data: single ? null : [], error: null });
                }
            },
        };
        return builder;
    }

    const fakeSupabaseClient = {
        auth: {
            async getSession() { return { data: { session: loadDemoSession() }, error: null }; },
            onAuthStateChange(cb) {
                authListeners.push(cb);
                return { data: { subscription: { unsubscribe() { const i = authListeners.indexOf(cb); if (i >= 0) authListeners.splice(i, 1); } } } };
            },
            async signUp({ email, password, options }) {
                const users = loadDemoUsers();
                const role = (options && options.data && options.data.role) || "patient";
                const full_name = (options && options.data && options.data.full_name) || email.split("@")[0];
                let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
                if (!user) {
                    user = { id: "demo-" + Date.now(), email, password, role, full_name };
                    users.push(user);
                } else {
                    user.password = password; user.role = role; user.full_name = full_name;
                }
                saveDemoUsers(users);
                const session = { user: toSupabaseUser(user) };
                saveDemoSession(session);
                notifyAuth(session);
                return { data: { user: session.user, session }, error: null };
            },
            async signInWithPassword({ email, password }) {
                const users = loadDemoUsers();
                const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
                if (!user || user.password !== password) {
                    return {
                        data: { user: null, session: null },
                        error: { message: "Invalid demo credentials. Try patient@demo.com / doctor@demo.com / admin@demo.com with password demo1234." },
                    };
                }
                const session = { user: toSupabaseUser(user) };
                saveDemoSession(session);
                notifyAuth(session);
                return { data: { user: session.user, session }, error: null };
            },
            async signOut() {
                saveDemoSession(null);
                notifyAuth(null);
                return { error: null };
            },
        },
        from(table) { return makeQueryBuilder(table); },
        storage: {
            from() {
                return {
                    async list() { return { data: [], error: null }; },
                    async upload() { return { data: { path: "demo/sample-scan.png" }, error: null }; },
                    getPublicUrl() { return { data: { publicUrl: "/demo/sample-scan.png" } }; },
                };
            },
        },
    };

    try {
        Object.defineProperty(window, "supabase", {
            value: { createClient: () => fakeSupabaseClient },
            writable: false,
            configurable: false,
        });
    } catch (e) {
        // Real supabase-js already claimed window.supabase first — fall back to overwriting it directly.
        window.supabase = { createClient: () => fakeSupabaseClient };
    }

    document.addEventListener("DOMContentLoaded", () => {
        const banner = document.createElement("div");
        banner.textContent = "Demo Mode — showing sample data, no backend connected";
        banner.style.cssText = [
            "position:fixed", "top:0", "left:0", "right:0", "z-index:99999",
            "background:#f59e0b", "color:#1a1a1a", "font:600 12px/1.4 system-ui,sans-serif",
            "text-align:center", "padding:6px 10px",
        ].join(";");
        document.body.prepend(banner);
        document.body.style.marginTop = "28px";
    });
})();
