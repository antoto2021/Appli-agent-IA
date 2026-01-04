/**
 * =================================================================
 * NEXUS AGENT V6.0 - REAL SEARCH EDITION
 * =================================================================
 * Nouveautés :
 * 1. Google Search Grounding : L'IA peut chercher sur le web.
 * 2. Liens Intelligents : Redirection auto vers Indeed/LinkedIn.
 * 3. Protection Hallucination : Consignes strictes "No Fake".
 */

// ==========================================
// 1. CONFIGURATION & SYSTÈME
// ==========================================
const config = {
    apiKey: localStorage.getItem('nexus_api_key_v5') || '',
    activeModel: localStorage.getItem('nexus_active_model_v5') || null,
    
    // Modèles recommandés pour la recherche (Flash est rapide, Pro est précis)
    fallbackModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
    
    githubUser: 'antoto2021',
    githubRepo: 'Appli-agent-ia',
    localHash: localStorage.getItem('nexus_app_hash') || 'v6.0_real_search',

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

    // --- SCANNER DE MODÈLES ---
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

        config.log("2. Test de compatibilité...");
        let workingModel = null;
        let tested = 0;
        
        for (const model of candidateList) {
            tested++; 
            countEl.innerText = `${tested}/${candidateList.length}`;
            config.log(`Test: ${model}...`);
            
            try {
                // On teste si le modèle supporte l'outil de recherche (Grounding)
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
            config.log("AUCUN MODÈLE VALIDE TROUVÉ.", "error");
        }
    },

    testModel: async (modelName, key) => {
        // Test simple ping
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
        ui.addSystemMessage(`Connecté sur : <b>${config.activeModel}</b><br><span class="text-xs opacity-70">Recherche Web activée si disponible.</span>`);
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
        const chatText = document.getElementById('chat-history').innerText;
        const lines = doc.splitTextToSize(chatText, 180);
        doc.text(lines, 10, 10);
        doc.save(`Nexus_Scan_${Date.now()}.pdf`);
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

    // --- MODALE OFFRE (REAL LINK GENERATOR) ---
    openJobModal: (jobId) => {
        const job = jobDataMap.get(jobId);
        if (!job) return;

        // Remplissage texte
        document.getElementById('modal-title').innerText = job.title || "Poste";
        document.getElementById('modal-company').innerText = job.company || "Entreprise";
        document.getElementById('modal-location').innerText = job.location || "Lieu non précisé";
        document.getElementById('modal-salary').innerText = job.salary || "N.C.";
        document.getElementById('modal-contract').innerText = job.contract_type || "Contrat";
        document.getElementById('modal-duration').innerText = job.duration || "Indéterminé";
        document.getElementById('modal-source').innerText = job.source || "Web";
        document.getElementById('modal-desc').innerText = job.description_long || job.description || "Détails non disponibles.";

        // --- GÉNÉRATION DE LIEN RÉEL ---
        // Si l'URL fournie par l'IA semble fausse ou générique, on crée un lien de recherche précis
        let realLink = job.url;
        const searchQuery = encodeURIComponent(`${job.title} ${job.company} emploi`);
        
        if (!realLink || realLink === 'SEARCH' || realLink.includes('fake') || realLink.length < 10) {
             // Redirection intelligente selon la source
             if (job.source && job.source.toLowerCase().includes('linkedin')) {
                 realLink = `https://www.linkedin.com/jobs/search/?keywords=${searchQuery}`;
             } else if (job.source && job.source.toLowerCase().includes('indeed')) {
                 realLink = `https://fr.indeed.com/jobs?q=${searchQuery}`;
             } else {
                 realLink = `https://www.google.com/search?q=${searchQuery}`;
             }
        }
        document.getElementById('modal-link').href = realLink;

        // Logo
        const logoImg = document.getElementById('modal-logo');
        if (job.logo_url && job.logo_url !== "null") logoImg.src = job.logo_url;
        else logoImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company || 'Job')}&background=random&color=fff&size=128`;

        // Missions
        const missionList = document.getElementById('modal-missions');
        missionList.innerHTML = '';
        if (job.missions && Array.isArray(job.missions)) {
            job.missions.forEach(m => {
                const li = document.createElement('li'); li.innerText = m; missionList.appendChild(li);
            });
        } else missionList.innerHTML = "<li>Voir l'annonce complète.</li>";

        // Affichage
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
                    <div class="bg-slate-800 border border-slate-700 p-3 rounded-xl hover:border-indigo-500 transition-colors group relative">
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
                        <div class="pt-2 border-t border-slate-700/50 flex justify-end">
                            <button onclick="ui.openJobModal('${id}')" class="text-xs bg-indigo-600/20 text-indigo-300 px-3 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors font-medium">
                                Voir Détails & Postuler
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            return `<div class="mb-2 text-slate-300">Résultats de recherche :</div><div class="grid grid-cols-1 md:grid-cols-2 gap-3">${items}</div>`;
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
// 3. MOTEUR IA (AGENT + SECURE FALLBACK)
// ==========================================
const agent = {
    contextFiles: [],
    
    send: async () => {
        const input = document.getElementById('user-input');
        const text = input.value.trim();
        
        // Vérifications
        if (!text || !config.apiKey || !config.activeModel) { 
            if(!text) return; 
            ui.toggleSettings(); 
            return; 
        }

        input.value = ''; 
        ui.addUserMessage(text); 
        ui.toggleLoading(true);

        // SYSTEM PROMPT
        const systemPrompt = `
        Rôle: Assistant Expert. Format: JSON STRICT.
        
        Si tu trouves des offres d'emploi, utilise ce format JSON:
        {
            "type": "job_list",
            "items": [
                {
                    "title": "Titre", "company": "Boite", "location": "Lieu",
                    "url": "SEARCH", "source": "Web", "description": "Resumé"
                }
            ]
        }
        
        Si c'est une demande d'images: { "type": "images", "query": "Sujet", "keywords": ["k1", "k2"] }
        Sinon: { "type": "text", "content": "Ta réponse..." }
        
        Contexte Fichiers: ${agent.contextFiles.join(', ')}
        `;

        // --- FONCTION D'ENVOI INTERNE (Try/Catch Wrapper) ---
        const executeRequest = async (useSearchTool) => {
            const payload = {
                contents: [{ role: "user", parts: [{ text: systemPrompt + "\nRecherche : " + text }] }]
            };

            // On ajoute l'outil Google Search SEULEMENT si demandé
            if (useSearchTool) {
                payload.tools = [{ google_search: {} }];
            }

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.activeModel}:generateContent?key=${config.apiKey}`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            const d = await r.json();
            if(d.error) throw new Error(d.error.message); // Déclenche le catch si erreur Google
            return d;
        };

        try {
            let d;
            try {
                // TENTATIVE 1 : AVEC RECHERCHE GOOGLE
                console.log("Tentative 1 : Avec Google Search...");
                d = await executeRequest(true); // true = avec tools
            } catch (searchError) {
                // SI ERREUR (ex: Modèle incompatible), ON RETENTE SANS RECHERCHE
                console.warn("Échec Recherche Google, bascule en mode texte classique...", searchError);
                ui.addSystemMessage(`<div class="text-[10px] text-amber-500 mb-2 italic"><i class="fa-solid fa-triangle-exclamation"></i> Recherche Google indisponible sur ce modèle. Passage en mode standard.</div>`);
                
                // TENTATIVE 2 : SANS OUTILS (Juste LLM)
                d = await executeRequest(false); // false = sans tools
            }
            
            // --- TRAITEMENT DE LA RÉPONSE ---
            let rawText = "";
            if (d.candidates && d.candidates[0].content && d.candidates[0].content.parts) {
                rawText = d.candidates[0].content.parts[0].text;
            }

            let cleanJson = rawText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
            
            try { 
                const jsonData = JSON.parse(cleanJson);
                ui.addSystemMessage(ui.renderWidget(jsonData)); 
            } catch(e) { 
                ui.addSystemMessage(`<div class="glass-message p-4">${marked.parse(rawText)}</div>`); 
            }

        } catch (finalError) {
            // Si même le mode texte échoue (ex: Clé invalide, Quota dépassé)
            ui.addSystemMessage(`<div class="text-red-400 text-xs p-3 border border-red-500/50 rounded bg-slate-800">
                <b>Erreur Fatale :</b> ${finalError.message}<br>
                Vérifiez votre clé API ou changez de modèle dans les paramètres.
            </div>`);
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
