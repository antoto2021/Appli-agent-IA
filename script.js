/**
 * =================================================================
 * NEXUS AGENT V6.3 - SAFE LINKS EDITION
 * =================================================================
 * Changement de paradigme :
 * 1. On ne demande plus d'URL à l'IA (trop d'hallucinations).
 * 2. On génère nous-mêmes 3 liens de recherche (Google, LinkedIn, Indeed).
 * 3. Ces liens ne peuvent PAS faire d'erreur 404.
 */

// ==========================================
// 1. CONFIGURATION
// ==========================================
const config = {
    apiKey: localStorage.getItem('nexus_api_key_v5') || '',
    activeModel: localStorage.getItem('nexus_active_model_v5') || null,
    fallbackModels: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    githubUser: 'antoto2021',
    githubRepo: 'Appli-agent-ia',
    localHash: 'v6.3_safe_links',

    init: () => {
        const el = document.getElementById('info-local-v');
        if(el) el.innerText = config.localHash;
    },

    // --- LOGGING ---
    log: (msg, type = 'info') => {
        const consoleEl = document.getElementById('connection-log');
        const line = document.createElement('div');
        line.className = "console-line";
        if (type === 'error') line.classList.add("text-red-400");
        else if (type === 'success') line.classList.add("text-green-400", "font-bold");
        else line.classList.add("text-slate-300");
        line.innerHTML = `<span class="opacity-30 mr-2">${new Date().toLocaleTimeString().split(' ')[0]}</span>${msg}`;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    },

    // --- DEEP SCAN ---
    startDeepScan: async () => {
        const keyInput = document.getElementById('api-key-input').value.trim();
        const countEl = document.getElementById('tested-count');
        document.getElementById('connection-log').innerHTML = ''; 
        document.getElementById('save-btn').disabled = true;

        if (!keyInput) { config.log("Erreur: Clé vide", "error"); return; }

        config.log("1. Récupération modèles...", "info");
        let candidateList = [];
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyInput}`);
            if (response.ok) {
                const data = await response.json();
                candidateList = data.models
                    .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
                    .map(m => m.name.replace('models/', ''))
                    .sort().reverse(); 
                config.log(`OK: ${candidateList.length} modèles trouvés.`);
            } else throw new Error("Erreur liste");
        } catch (e) {
            config.log("Utilisation liste de secours.", "error");
            candidateList = config.fallbackModels;
        }

        config.log("2. Test de connexion...");
        let workingModel = null;
        let tested = 0;
        
        for (const model of candidateList) {
            tested++; 
            countEl.innerText = `${tested}/${candidateList.length}`;
            config.log(`Test: ${model}...`);
            try {
                await config.testModel(model, keyInput);
                workingModel = model;
                config.log(`>>> SUCCÈS : ${model}`, "success");
                break;
            } catch (e) { /* continue */ }
        }

        if (workingModel) {
            config.apiKey = keyInput;
            config.activeModel = workingModel;
            document.getElementById('save-btn').disabled = false;
            config.log("✅ Prêt. Sauvegardez.", "success");
        } else {
            config.log("AUCUN MODÈLE VALIDE.", "error");
        }
    },

    testModel: async (modelName, key) => {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Ping" }] }], generationConfig: { maxOutputTokens: 1 } })
        });
        if (!r.ok) throw new Error();
    },

    saveAndClose: () => {
        localStorage.setItem('nexus_api_key_v5', config.apiKey);
        localStorage.setItem('nexus_active_model_v5', config.activeModel);
        ui.toggleSettings();
        ui.addSystemMessage(`Système connecté sur : <b>${config.activeModel}</b><br><span class="text-xs opacity-70">Mode Smart Links Activé.</span>`);
        ui.updateStatus(true);
    },
    
    // Ajout de la fonction checkUpdate manquante
    checkUpdate: async () => {
        const remoteDisplay = document.getElementById('info-remote-v');
        remoteDisplay.innerText = "Checking...";
        try {
            const response = await fetch(`https://api.github.com/repos/${config.githubUser}/${config.githubRepo}/commits/main`);
            if(response.ok) {
                const data = await response.json();
                const shortHash = data.sha.substring(0, 7);
                remoteDisplay.innerText = shortHash;
                localStorage.setItem('nexus_app_hash', shortHash);
            }
        } catch (e) { remoteDisplay.innerText = "Err"; }
    }
};

// ==========================================
// 2. UI & LOGIQUE DE LIENS
// ==========================================
const jobDataMap = new Map();

const ui = {
    toggleSettings: () => {
        const modal = document.getElementById('settings-modal');
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) document.getElementById('api-key-input').value = config.apiKey;
    },
    toggleInfo: () => {
        const modal = document.getElementById('info-modal');
        modal.classList.toggle('hidden');
        if(!modal.classList.contains('hidden')) config.init();
    },
    refreshApp: () => {
        document.getElementById('btn-refresh').classList.add('spin-once');
        setTimeout(() => window.location.reload(), 800);
    },
    exportPDF: () => {
        if (!window.jspdf) return alert('Erreur PDF');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(document.getElementById('chat-history').innerText, 10, 10);
        doc.save('export.pdf');
    },
    updateStatus: (c) => {
        document.getElementById('status-dot').className = c ? "w-2 h-2 rounded-full bg-green-500" : "w-2 h-2 rounded-full bg-red-500";
        document.getElementById('model-status').innerText = c ? `Online: ${config.activeModel}` : "Déconnecté";
    },
    handleFileUpload: (input) => {
        if(input.files.length > 0) {
            const names = Array.from(input.files).map(f => f.name).join(', ');
            ui.addUserMessage(`[Fichiers joints: ${names}]`, true);
            agent.contextFiles.push(...Array.from(input.files).map(f => f.name));
        }
    },
    scrollToBottom: () => {
        const c = document.getElementById('chat-container');
        c.scrollTop = c.scrollHeight;
    },
    addUserMessage: (text) => {
        const div = document.createElement('div');
        div.className = "flex justify-end fade-in";
        div.innerHTML = `<div class="user-message text-white rounded-2xl rounded-tr-none p-3 max-w-[85%] text-sm shadow-lg"><div class="prose prose-invert">${marked.parse(text)}</div></div>`;
        document.getElementById('chat-history').appendChild(div);
        ui.scrollToBottom();
    },
    addSystemMessage: (html) => {
        const div = document.createElement('div');
        div.className = "flex gap-4 fade-in w-full";
        div.innerHTML = `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex-shrink-0 flex items-center justify-center mt-1"><i class="fa-solid fa-robot text-white text-xs"></i></div><div class="flex-1 min-w-0 text-sm leading-relaxed space-y-2"><div class="prose prose-invert">${html}</div></div>`;
        document.getElementById('chat-history').appendChild(div);
        ui.scrollToBottom();
    },
    toggleLoading: (show) => document.getElementById('loading-indicator').classList.toggle('hidden', !show),

    // --- LE COEUR DE LA SOLUTION : MODALE & LIENS ---
    openJobModal: (jobId) => {
        const job = jobDataMap.get(jobId);
        if (!job) return;

        // Remplissage des champs
        document.getElementById('modal-title').innerText = job.title || "Poste";
        document.getElementById('modal-company').innerText = job.company || "Entreprise";
        document.getElementById('modal-location').innerText = job.location || "Lieu non précisé";
        document.getElementById('modal-salary').innerText = job.salary || "N.C.";
        document.getElementById('modal-contract').innerText = job.contract_type || "Type inconnu";
        document.getElementById('modal-duration').innerText = job.duration || "Indéterminé";
        document.getElementById('modal-source').innerText = job.source || "Web";
        document.getElementById('modal-desc').innerHTML = marked.parse(job.description_long || job.description || "Détails non fournis.");

        // Logo
        const logoImg = document.getElementById('modal-logo');
        if (job.logo_url && job.logo_url !== "null") logoImg.src = job.logo_url;
        else logoImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company || 'Job')}&background=random&color=fff&size=128`;

        // Missions
        const missionList = document.getElementById('modal-missions');
        missionList.innerHTML = '';
        if (job.missions && job.missions.length) {
            job.missions.forEach(m => { const li = document.createElement('li'); li.innerText = m; missionList.appendChild(li); });
        } else missionList.innerHTML = "<li class='text-slate-500 italic'>Voir la description complète.</li>";

        // --- GÉNÉRATION DES 3 LIENS SÉCURISÉS ---
        const qTitle = encodeURIComponent(job.title);
        const qCompany = encodeURIComponent(job.company);
        const qFull = encodeURIComponent(`${job.title} ${job.company}`);
        const qLoc = encodeURIComponent(job.location || "");

        // 1. Google Jobs (Le plus fiable pour l'agrégation)
        const googleLink = `https://www.google.com/search?ibp=htl;jobs&q=${qFull}`;
        
        // 2. LinkedIn (Recherche filtrée)
        const linkedinLink = `https://www.linkedin.com/jobs/search/?keywords=${qFull}&location=${qLoc}`;

        // 3. Indeed (Recherche filtrée)
        const indeedLink = `https://fr.indeed.com/jobs?q=${qTitle}+${qCompany}&l=${qLoc}`;

        // Injection des boutons dans le nouveau Footer
        const actionsDiv = document.getElementById('modal-actions');
        if(actionsDiv) {
            actionsDiv.innerHTML = `
                <a href="${googleLink}" target="_blank" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-2 rounded-lg border border-slate-700 transition-colors group">
                    <i class="fa-brands fa-google text-lg text-white group-hover:text-blue-400 mb-1"></i>
                    <span class="text-[10px] text-slate-400 font-bold">Google Jobs</span>
                </a>
                <a href="${linkedinLink}" target="_blank" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-[#0a66c2] p-2 rounded-lg border border-slate-700 transition-colors group">
                    <i class="fa-brands fa-linkedin text-lg text-white mb-1"></i>
                    <span class="text-[10px] text-slate-400 group-hover:text-white font-bold">LinkedIn</span>
                </a>
                <a href="${indeedLink}" target="_blank" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-[#2557a7] p-2 rounded-lg border border-slate-700 transition-colors group">
                    <span class="text-lg font-bold text-white mb-1 font-serif">i</span>
                    <span class="text-[10px] text-slate-400 group-hover:text-white font-bold">Indeed</span>
                </a>
            `;
        }

        const modal = document.getElementById('job-modal');
        const content = document.getElementById('job-modal-content');
        modal.classList.remove('hidden');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    },

    closeJobModal: () => {
        const modal = document.getElementById('job-modal');
        const content = document.getElementById('job-modal-content');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    },

    renderWidget: (data) => {
        if (data.type === 'job_list') {
            const items = data.items.map((job, index) => {
                const id = `job_${Date.now()}_${index}`;
                jobDataMap.set(id, job);
                return `
                    <div class="bg-slate-800 border border-slate-700 p-3 rounded-xl hover:border-indigo-500 transition-colors flex flex-col h-full">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center gap-2 overflow-hidden">
                                <div class="w-8 h-8 rounded bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-400">
                                    ${job.company ? job.company.substring(0,2).toUpperCase() : 'JO'}
                                </div>
                                <h3 class="font-bold text-indigo-400 truncate pr-2 text-sm">${job.title}</h3>
                            </div>
                        </div>
                        <div class="text-xs text-slate-400 mb-2 font-mono flex gap-2 items-center">
                            <span>${job.company}</span>
                            <span class="w-1 h-1 bg-slate-600 rounded-full"></span>
                            <span class="text-green-400">${job.salary || 'N.C.'}</span>
                        </div>
                        <p class="text-xs text-slate-300 line-clamp-3 mb-3 flex-1">${job.description}</p>
                        <div class="pt-2 border-t border-slate-700/50 flex justify-end">
                            <button onclick="ui.openJobModal('${id}')" class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded font-medium w-full shadow-lg">
                                Voir Détails & Postuler
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            return `<div class="mb-2 text-slate-300">🔎 Offres détectées :</div><div class="grid grid-cols-1 md:grid-cols-2 gap-3">${items}</div>`;
        }
        else if (data.type === 'images') {
            return `<div class="grid grid-cols-2 gap-2">${data.keywords.map(k=>`<div class="aspect-video bg-slate-800 rounded relative overflow-hidden"><img src="https://source.unsplash.com/400x300/?${encodeURIComponent(k)}" class="w-full h-full object-cover"><span class="absolute bottom-0 w-full bg-black/50 text-[10px] text-white p-1 truncate">${k}</span></div>`).join('')}</div>`;
        }
        return `<div class="glass-message rounded-2xl rounded-tl-none p-4">${marked.parse(data.content || "")}</div>`;
    }
};

// ==========================================
// 3. AGENT IA
// ==========================================
const agent = {
    contextFiles: [],
    send: async () => {
        const input = document.getElementById('user-input');
        const text = input.value.trim();
        if (!text || !config.apiKey || !config.activeModel) { if(!text) return; ui.toggleSettings(); return; }

        input.value = ''; ui.addUserMessage(text); ui.toggleLoading(true);

        // SYSTEM PROMPT : On ne demande plus d'URL à l'IA pour éviter les hallucinations.
        // On demande du contenu riche (description) pour l'affichage.
        const systemPrompt = `
        Rôle: Chasseur de Têtes Senior.
        Objectif: Trouver des offres RÉELLES sur le web (Google Search).
        
        FORMAT JSON STRICT:
        {
            "type": "job_list",
            "items": [
                {
                    "title": "Titre exact",
                    "company": "Entreprise",
                    "location": "Ville",
                    "salary": "Salaire estimé",
                    "contract_type": "CDI/Freelance/...",
                    "source": "Site trouvé (ex: HelloWork)",
                    "description": "Phrase d'accroche (20 mots)",
                    "description_long": "COPIE ICI LE TEXTE COMPLET DE L'OFFRE (Minimum 100 mots). C'est crucial pour l'utilisateur.",
                    "missions": ["Liste", "des", "tâches"]
                }
            ]
        }
        
        Si pas d'offre: { "type": "text", "content": "Explication..." }
        Contexte Fichiers: ${agent.contextFiles.join(', ')}
        `;

        const executeRequest = async (useSearchTool) => {
            const payload = {
                contents: [{ role: "user", parts: [{ text: systemPrompt + "\nRecherche : " + text }] }]
            };
            if (useSearchTool) payload.tools = [{ google_search: {} }];

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.activeModel}:generateContent?key=${config.apiKey}`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            const d = await r.json();
            if(d.error) throw new Error(d.error.message);
            return d;
        };

        try {
            // Tentative avec Search
            let d;
            try { d = await executeRequest(true); } 
            catch (e) { 
                ui.addSystemMessage(`<div class="text-[10px] text-amber-500 italic">⚠️ Recherche Web indisponible. Mode connaissance.</div>`);
                d = await executeRequest(false); 
            }
            
            let rawText = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
            let cleanJson = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
            
            try { 
                const jsonData = JSON.parse(cleanJson);
                if(jsonData.type === 'job_list' && jsonData.items.length === 0) throw new Error("Empty");
                ui.addSystemMessage(ui.renderWidget(jsonData)); 
            } catch(e) { 
                ui.addSystemMessage(`<div class="glass-message p-4">${marked.parse(rawText)}</div>`); 
            }

        } catch (e) {
            ui.addSystemMessage(`<div class="text-red-400 text-xs p-3 bg-slate-800 rounded">Erreur: ${e.message}</div>`);
        }
        ui.toggleLoading(false);
    }
};

// Start
document.getElementById('user-input').addEventListener('keypress', (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agent.send(); } 
});
if (config.apiKey && config.activeModel) { ui.updateStatus(true); config.init(); } 
else setTimeout(() => ui.toggleSettings(), 800);
