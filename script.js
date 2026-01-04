/**
 * =================================================================
 * NEXUS AGENT V6.2 - PRECISION LINK EDITION
 * =================================================================
 * Correctifs :
 * 1. Prompt "URL Extractor" : Force l'IA à récupérer le lien source exact.
 * 2. Fallback "Deep Search" : Si le lien échoue, génère une requête ciblée.
 * 3. Nettoyage JSON renforcé pour éviter les erreurs de parsing.
 */

// ==========================================
// 1. CONFIGURATION & SYSTÈME
// ==========================================
const config = {
    apiKey: localStorage.getItem('nexus_api_key_v5') || '',
    activeModel: localStorage.getItem('nexus_active_model_v5') || null,
    
    // On privilégie les modèles PRO pour la précision des liens
    fallbackModels: ['gemini-1.5-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash'],
    
    githubUser: 'antoto2021',
    githubRepo: 'Appli-agent-ia',
    localHash: localStorage.getItem('nexus_app_hash') || 'v6.2_precision_link',

    init: () => {
        const el = document.getElementById('info-local-v');
        if(el) el.innerText = config.localHash;
    },

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

    // --- SCANNER INTELLIGENT ---
    startDeepScan: async () => {
        const keyInput = document.getElementById('api-key-input').value.trim();
        const countEl = document.getElementById('tested-count');
        document.getElementById('connection-log').innerHTML = ''; 
        document.getElementById('save-btn').disabled = true;

        if (!keyInput) { config.log("Erreur: Clé vide", "error"); return; }

        config.log("1. Récupération des modèles...", "info");
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

        config.log("2. Recherche compatibilité Google Search...");
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

    checkUpdate: async () => {
        const remoteDisplay = document.getElementById('info-remote-v');
        remoteDisplay.innerText = "Checking...";
        remoteDisplay.classList.add("animate-pulse");
        try {
            const response = await fetch(`https://api.github.com/repos/${config.githubUser}/${config.githubRepo}/commits/main`);
            if(response.ok) {
                const data = await response.json();
                const shortHash = data.sha.substring(0, 7);
                remoteDisplay.innerText = shortHash;
                remoteDisplay.classList.remove("animate-pulse");
                localStorage.setItem('nexus_app_hash', shortHash);
                if(shortHash !== config.localHash) remoteDisplay.innerHTML += " <span class='text-amber-400'>(Update!)</span>";
                else remoteDisplay.innerHTML += " <span class='text-slate-500'>(À jour)</span>";
            } else throw new Error();
        } catch (e) {
            remoteDisplay.innerText = "Erreur réseau";
            remoteDisplay.classList.add('text-red-400');
        }
    },

    saveAndClose: () => {
        localStorage.setItem('nexus_api_key_v5', config.apiKey);
        localStorage.setItem('nexus_active_model_v5', config.activeModel);
        ui.toggleSettings();
        ui.addSystemMessage(`Système connecté sur : <b>${config.activeModel}</b><br><span class="text-xs opacity-70">Extraction de liens V6.2 activée.</span>`);
        ui.updateStatus(true);
    }
};

// ==========================================
// 2. INTERFACE UTILISATEUR (UI)
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
        if (!modal.classList.contains('hidden')) config.init();
    },

    refreshApp: () => {
        const btn = document.getElementById('btn-refresh');
        btn.classList.add('spin-once');
        setTimeout(() => window.location.reload(), 800);
    },

    exportPDF: () => {
        if (!window.jspdf) return alert('Erreur PDF Lib');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(10);
        let y = 10;
        document.querySelectorAll('#chat-history > div').forEach(div => {
             const text = div.innerText.replace(/\n/g, ' ');
             const lines = doc.splitTextToSize(text, 180);
             doc.text(lines, 10, y);
             y += (lines.length * 5) + 5;
             if (y > 280) { doc.addPage(); y = 10; }
        });
        doc.save(`Nexus_Rapport_${Date.now()}.pdf`);
    },

    updateStatus: (connected) => {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('model-status');
        if(connected) {
            dot.className = "w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
            text.innerText = `Online: ${config.activeModel}`;
            text.className = "text-[10px] text-green-400 font-mono";
        } else {
            dot.className = "w-2 h-2 rounded-full bg-red-500";
            text.innerText = "Déconnecté";
        }
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

    addUserMessage: (text, isSystem = false) => {
        const historyDiv = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = "flex justify-end fade-in";
        div.innerHTML = `<div class="${isSystem ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'user-message text-white'} rounded-2xl rounded-tr-none p-3 max-w-[85%] text-sm shadow-lg"><div class="prose prose-invert">${marked.parse(text)}</div></div>`;
        historyDiv.appendChild(div);
        ui.scrollToBottom();
    },

    addSystemMessage: (contentHtml) => {
        const historyDiv = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = "flex gap-4 fade-in w-full";
        div.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex-shrink-0 flex items-center justify-center mt-1 shadow-lg shadow-indigo-900/50">
                <i class="fa-solid fa-robot text-white text-xs"></i>
            </div>
            <div class="flex-1 min-w-0 text-sm leading-relaxed space-y-2"><div class="prose prose-invert">${contentHtml}</div></div>`;
        historyDiv.appendChild(div);
        ui.scrollToBottom();
    },

    toggleLoading: (show) => {
        document.getElementById('loading-indicator').classList.toggle('hidden', !show);
        ui.scrollToBottom();
    },

    // --- LOGIQUE MODALE OFFRE (Cœur de la correction) ---
    openJobModal: (jobId) => {
        const job = jobDataMap.get(jobId);
        if (!job) return;

        document.getElementById('modal-title').innerText = job.title || "Poste";
        document.getElementById('modal-company').innerText = job.company || "Entreprise";
        document.getElementById('modal-location').innerText = job.location || "Lieu non précisé";
        document.getElementById('modal-salary').innerText = job.salary || "Non communiqué";
        document.getElementById('modal-contract').innerText = job.contract_type || "Type contrat inconnu";
        document.getElementById('modal-duration').innerText = job.duration || "Indéterminé";
        document.getElementById('modal-source').innerText = job.source || "Web";
        
        // Contenu riche
        document.getElementById('modal-desc').innerHTML = marked.parse(job.description_long || job.description || "Pas de détails.");

        // --- INTELLIGENT DEEP LINKING (Le Correctif) ---
        // 1. Si l'IA nous a donné une URL valide et longue (pas juste "linkedin.com"), on l'utilise.
        let finalUrl = job.url;
        
        // 2. Si l'URL est suspecte (trop courte, placeholder "SEARCH", ou domaine racine), on bascule sur la recherche ciblée.
        const isUrlSuspicious = !finalUrl || finalUrl === 'SEARCH' || finalUrl.includes('fake') || finalUrl.length < 20 || (finalUrl.includes('indeed.com') && !finalUrl.includes('viewjob'));
        
        if (isUrlSuspicious) {
            // Construction d'une requête "Dorks" pour cibler la page exacte
            // Exemple : site:indeed.com "Développeur" "Google"
            const qTitle = job.title.replace(/[^a-zA-Z0-9 ]/g, ''); // Nettoyage
            const qCompany = job.company.replace(/[^a-zA-Z0-9 ]/g, '');
            
            // On privilégie la source détectée
            let siteFilter = "";
            if (job.source && job.source.toLowerCase().includes('linkedin')) siteFilter = "site:linkedin.com/jobs";
            else if (job.source && job.source.toLowerCase().includes('indeed')) siteFilter = "site:indeed.com";
            else if (job.source && job.source.toLowerCase().includes('welcome')) siteFilter = "site:welcometothejungle.com";
            
            const query = encodeURIComponent(`${siteFilter} "${qTitle}" "${qCompany}"`);
            finalUrl = `https://www.google.com/search?q=${query}`;
        }

        const linkBtn = document.getElementById('modal-link');
        linkBtn.href = finalUrl;
        linkBtn.innerHTML = isUrlSuspicious 
            ? `Trouver l'annonce (Recherche Ciblée) <i class="fa-solid fa-magnifying-glass ml-2"></i>` 
            : `Postuler (Lien Direct) <i class="fa-solid fa-arrow-up-right-from-square ml-2"></i>`;

        // Logo
        const logoImg = document.getElementById('modal-logo');
        if (job.logo_url && job.logo_url !== "null") logoImg.src = job.logo_url;
        else logoImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company || 'Job')}&background=random&color=fff&size=128`;

        // Missions List
        const missionList = document.getElementById('modal-missions');
        missionList.innerHTML = '';
        if (job.missions && Array.isArray(job.missions) && job.missions.length > 0) {
            job.missions.forEach(m => {
                const li = document.createElement('li'); li.innerText = m; missionList.appendChild(li);
            });
        } else {
            missionList.innerHTML = "<li class='italic text-slate-500'>Voir description complète ci-dessous</li>";
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
                    <div class="bg-slate-800 border border-slate-700 p-3 rounded-xl hover:border-indigo-500 transition-colors group relative flex flex-col h-full">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center gap-2 overflow-hidden">
                                <div class="w-8 h-8 rounded bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-400">
                                    ${job.company ? job.company.substring(0,2).toUpperCase() : 'JO'}
                                </div>
                                <h3 class="font-bold text-indigo-400 truncate pr-2 text-sm">${job.title}</h3>
                            </div>
                            <span class="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-700 whitespace-nowrap">${job.source || 'Web'}</span>
                        </div>
                        <div class="text-xs text-slate-400 mb-2 font-mono flex gap-2 items-center">
                            <span>${job.company}</span>
                            <span class="w-1 h-1 bg-slate-600 rounded-full"></span>
                            <span class="text-green-400">${job.salary || 'N.C.'}</span>
                        </div>
                        <p class="text-xs text-slate-300 line-clamp-3 mb-3 flex-1">${job.description}</p>
                        <div class="pt-2 border-t border-slate-700/50 flex justify-end">
                            <button onclick="ui.openJobModal('${id}')" class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded transition-colors font-medium w-full shadow-lg">
                                Détails & Postuler
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            return `<div class="mb-2 text-slate-300">🔎 Offres trouvées :</div><div class="grid grid-cols-1 md:grid-cols-2 gap-3">${items}</div>`;
        }
        else if (data.type === 'images') {
            return `
                <div class="mb-2 text-slate-300">Inspirations : ${data.query}</div>
                <div class="grid grid-cols-2 gap-2">
                    ${data.keywords.map(k => `
                        <div class="aspect-video bg-slate-800 rounded-lg overflow-hidden relative border border-slate-700">
                            <img src="https://source.unsplash.com/400x300/?${encodeURIComponent(k)}" class="w-full h-full object-cover opacity-80 hover:opacity-100 transition-all">
                            <div class="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-1 text-[10px] text-white truncate">${k}</div>
                        </div>`).join('')}
                </div>`;
        }
        return `<div class="glass-message rounded-2xl rounded-tl-none p-4">${marked.parse(data.content || "")}</div>`;
    }
};

// ==========================================
// 3. MOTEUR IA (AGENT + GOOGLE GROUNDING)
// ==========================================
const agent = {
    contextFiles: [],
    
    send: async () => {
        const input = document.getElementById('user-input');
        const text = input.value.trim();
        
        if (!text || !config.apiKey || !config.activeModel) { 
            if(!text) return; 
            ui.toggleSettings(); 
            return; 
        }

        input.value = ''; 
        ui.addUserMessage(text); 
        ui.toggleLoading(true);

        // --- SYSTEM PROMPT (ANTI-FAKE LINK) ---
        const systemPrompt = `
        Rôle: Chasseur de Têtes Expert.
        
        TACHE PRINCIPALE:
        Trouve des offres d'emploi réelles sur le Web via Google Search.
        
        IMPORTANT - GESTION DES LIENS:
        1. Tu DOIS essayer de copier l'URL exacte de l'offre (commençant par https://...).
        2. SI TU NE PEUX PAS copier l'URL exacte, écris "SEARCH" dans le champ 'url'. NE PAS INVENTER D'URL.
        3. Copie INTÉGRALEMENT la description de l'offre (long texte).
        
        FORMAT DE REPONSE (JSON STRICT):
        {
            "type": "job_list",
            "items": [
                {
                    "title": "Titre exact",
                    "company": "Entreprise",
                    "location": "Ville",
                    "salary": "Salaire",
                    "contract_type": "Type",
                    "source": "Source (ex: LinkedIn)",
                    "url": "URL_EXACTE_OU_SEARCH", 
                    "description": "Accroche courte",
                    "description_long": "TEXTE COMPLET DE L'ANNONCE...",
                    "missions": ["Mission 1", "Mission 2"]
                }
            ]
        }
        
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
            let d;
            try {
                // Essai avec Google Search
                d = await executeRequest(true); 
            } catch (searchError) {
                console.warn("Mode Search échoué, repli...", searchError);
                ui.addSystemMessage(`<div class="text-[10px] text-amber-500 mb-2 italic">⚠️ Mode Recherche limité. Résultats théoriques.</div>`);
                d = await executeRequest(false);
            }
            
            let rawText = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
            let cleanJson = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
            
            try { 
                const jsonData = JSON.parse(cleanJson);
                if(jsonData.type === 'job_list' && jsonData.items.length === 0) throw new Error("Empty list");
                ui.addSystemMessage(ui.renderWidget(jsonData)); 
            } catch(e) { 
                ui.addSystemMessage(`<div class="glass-message p-4">${marked.parse(rawText)}</div>`); 
            }

        } catch (finalError) {
            ui.addSystemMessage(`<div class="text-red-400 text-xs p-3 border border-red-500/50 rounded bg-slate-800">Erreur : ${finalError.message}</div>`);
        }
        ui.toggleLoading(false);
    }
};

// --- BOOTSTRAP ---
document.getElementById('user-input').addEventListener('keypress', (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agent.send(); } 
});

if (config.apiKey && config.activeModel) {
    ui.updateStatus(true);
    config.init();
} else {
    setTimeout(() => ui.toggleSettings(), 800);
}
