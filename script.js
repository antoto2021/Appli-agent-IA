/**
 * =================================================================
 * NEXUS AGENT V5.2 - MOTEUR PRINCIPAL
 * =================================================================
 * Ce fichier gère toute la logique de l'application :
 * 1. Configuration & Scan IA (Deep Scan)
 * 2. Interface Utilisateur (UI), Modales, Notifications
 * 3. Moteur IA (Envoi vers Gemini, Parsing JSON)
 * 4. Gestion des Liens Intelligents (Fix pour les liens 404)
 */

// ==========================================
// 1. CONFIGURATION & MISE À JOUR
// ==========================================
const config = {
    // Stockage local des clés et modèles préférés
    apiKey: localStorage.getItem('nexus_api_key_v5') || '',
    activeModel: localStorage.getItem('nexus_active_model_v5') || null,
    
    // Modèles de secours si le scan automatique échoue
    fallbackModels: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    
    // --- GITHUB UPDATE CONFIG ---
    githubUser: 'antoto2021',
    githubRepo: 'Appli-agent-ia', // Nom du repo mis à jour
    localHash: localStorage.getItem('nexus_app_hash') || 'init_v5.2',

    // Initialisation : Affiche le hash local au démarrage
    init: () => {
        const el = document.getElementById('info-local-v');
        if(el) el.innerText = config.localHash;
    },

    // Fonction de log pour la console du scan (dans les paramètres)
    log: (msg, type = 'info') => {
        const consoleEl = document.getElementById('connection-log');
        const line = document.createElement('div');
        line.className = "console-line";
        // Couleurs selon le type de message
        if (type === 'error') line.classList.add("text-red-400");
        else if (type === 'success') line.classList.add("text-green-400", "font-bold");
        else line.classList.add("text-slate-300");
        
        line.innerHTML = `<span class="opacity-30 mr-2">${new Date().toLocaleTimeString().split(' ')[0]}</span>${msg}`;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    },

    // --- DEEP SCAN INTELLIGENT ---
    // Récupère dynamiquement la liste des modèles disponibles pour la clé API fournie
    startDeepScan: async () => {
        const keyInput = document.getElementById('api-key-input').value.trim();
        const countEl = document.getElementById('tested-count');
        document.getElementById('connection-log').innerHTML = ''; 
        document.getElementById('save-btn').disabled = true;

        if (!keyInput) { config.log("Erreur: Clé vide", "error"); return; }

        config.log("1. Récupération liste modèles...", "info");
        let candidateList = [];
        
        try {
            // Appel à l'API Google pour lister les modèles
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyInput}`);
            if (response.ok) {
                const data = await response.json();
                // Filtre uniquement les modèles capables de générer du texte
                candidateList = data.models
                    .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
                    .map(m => m.name.replace('models/', ''))
                    .sort().reverse(); 
                config.log(`OK: ${candidateList.length} modèles détectés.`);
            } else {
                throw new Error("Impossible de lister les modèles");
            }
        } catch (e) {
            config.log("API Liste échouée. Mode Secours.", "error");
            candidateList = config.fallbackModels;
        }

        // Test de connexion sur chaque modèle
        config.log("2. Test de connexion...");
        let workingModel = null;
        let tested = 0;
        
        for (const model of candidateList) {
            tested++; 
            countEl.innerText = `${tested}/${candidateList.length}`;
            config.log(`Test: ${model}...`);
            
            try {
                // Envoi d'un ping minimaliste
                await config.testModel(model, keyInput);
                workingModel = model;
                config.log(`>>> SUCCÈS : ${model}`, "success");
                break; // On s'arrête au premier succès
            } catch (e) {
                // Echec silencieux pour passer au suivant
            }
        }

        if (workingModel) {
            config.apiKey = keyInput;
            config.activeModel = workingModel;
            document.getElementById('save-btn').disabled = false;
            config.log("✅ Prêt à sauvegarder.", "success");
        } else {
            config.log("ECHEC TOTAL: Aucun modèle valide.", "error");
        }
    },

    // Fonction unitaire de test
    testModel: async (modelName, key) => {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Ping" }] }], generationConfig: { maxOutputTokens: 1 } })
        });
        if (!r.ok) throw new Error();
    },

    // --- VÉRIFICATION GITHUB (VERSION CHECK) ---
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
                
                // Sauvegarde pour le futur
                localStorage.setItem('nexus_app_hash', shortHash);
                
                if(shortHash !== config.localHash) {
                    remoteDisplay.innerHTML += " <span class='text-amber-400'>(Update dispo!)</span>";
                } else {
                    remoteDisplay.innerHTML += " <span class='text-slate-500'>(À jour)</span>";
                }
            } else {
                throw new Error("Repo introuvable");
            }
        } catch (e) {
            remoteDisplay.innerText = "Erreur co.";
            remoteDisplay.classList.add('text-red-400');
        }
    },

    saveAndClose: () => {
        localStorage.setItem('nexus_api_key_v5', config.apiKey);
        localStorage.setItem('nexus_active_model_v5', config.activeModel);
        ui.toggleSettings();
        ui.addSystemMessage(`Système connecté sur : <b>${config.activeModel}</b>`);
        ui.updateStatus(true);
    }
};

// ==========================================
// 2. INTERFACE UTILISATEUR (UI)
// ==========================================
const jobDataMap = new Map(); // Stocke les données des jobs temporairement

const ui = {
    // Ouvre/Ferme le modal Paramètres
    toggleSettings: () => {
        const modal = document.getElementById('settings-modal');
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
            document.getElementById('api-key-input').value = config.apiKey;
        }
    },

    // Ouvre/Ferme le modal Info Système
    toggleInfo: () => {
        const modal = document.getElementById('info-modal');
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
            config.init(); // Rafraichit l'affichage du hash local
        }
    },

    // Rafraichit la page (Bouton Header)
    refreshApp: () => {
        const btn = document.getElementById('btn-refresh');
        btn.classList.add('spin-once');
        setTimeout(() => window.location.reload(), 800);
    },

    // Exporte la conversation en PDF (Bouton Header)
    exportPDF: () => {
        if (!window.jspdf) return alert('Erreur librairie PDF');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text("Rapport Nexus Agent", 10, 10);
        doc.setFontSize(10);
        
        // Récupère tout le texte du chat
        const chatText = document.getElementById('chat-history').innerText;
        const lines = doc.splitTextToSize(chatText, 180);
        
        doc.text(lines, 10, 20);
        doc.save(`Nexus_Export_${Date.now()}.pdf`);
    },

    // Met à jour le point de statut en bas de page
    updateStatus: (connected) => {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('model-status');
        if(connected) {
            dot.className = "w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
            text.innerText = `Connecté: ${config.activeModel}`;
            text.className = "text-[10px] text-green-400 font-mono";
        } else {
            dot.className = "w-2 h-2 rounded-full bg-red-500";
            text.innerText = "Déconnecté";
        }
    },

    // Gère l'upload de fichier (visuel dans le chat)
    handleFileUpload: (input) => {
        if(input.files.length > 0) {
            const names = Array.from(input.files).map(f => f.name).join(', ');
            ui.addUserMessage(`[Fichiers ajoutés: ${names}]`, true);
            agent.contextFiles.push(...Array.from(input.files).map(f => f.name));
        }
    },

    scrollToBottom: () => {
        const c = document.getElementById('chat-container');
        c.scrollTop = c.scrollHeight;
    },

    // Ajoute un message utilisateur
    addUserMessage: (text, isSystem = false) => {
        const historyDiv = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = "flex justify-end fade-in";
        div.innerHTML = `<div class="${isSystem ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'user-message text-white'} rounded-2xl rounded-tr-none p-3 max-w-[85%] text-sm shadow-lg"><div class="prose prose-invert">${marked.parse(text)}</div></div>`;
        historyDiv.appendChild(div);
        ui.scrollToBottom();
    },

    // Ajoute un message système (AI)
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

    // --- LOGIQUE MODALE JOB (CORRECTIF LIENS) ---
    openJobModal: (jobId) => {
        const job = jobDataMap.get(jobId);
        if (!job) return;

        // Remplissage des champs texte
        document.getElementById('modal-title').innerText = job.title || "Titre non spécifié";
        document.getElementById('modal-company').innerText = job.company || "Entreprise confidentielle";
        document.getElementById('modal-location').innerText = job.location || "Non spécifié";
        document.getElementById('modal-salary').innerText = job.salary || "N.C.";
        document.getElementById('modal-contract').innerText = job.contract_type || "Freelance";
        document.getElementById('modal-duration').innerText = job.duration || "Indéterminée";
        document.getElementById('modal-source').innerText = job.source || "Web";
        document.getElementById('modal-desc').innerText = job.description_long || job.description || "Pas de description détaillée.";
        
        // --- CORRECTIF LIENS INTELLIGENTS ---
        // Si le lien est vide, invalide ou "fake", on génère une recherche Google
        let targetUrl = job.url;
        if (!targetUrl || targetUrl.includes('fake-link') || targetUrl === '#' || targetUrl === 'SEARCH') {
            const query = encodeURIComponent(`${job.title} ${job.company} emploi`);
            targetUrl = `https://www.google.com/search?q=${query}`;
        }
        document.getElementById('modal-link').href = targetUrl;
        
        // Gestion du Logo (Fallback si erreur)
        const logoImg = document.getElementById('modal-logo');
        if (job.logo_url && job.logo_url !== "null") {
            logoImg.src = job.logo_url;
        } else {
            logoImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company || 'Job')}&background=random&color=fff&size=128`;
        }

        // Remplissage liste missions
        const missionList = document.getElementById('modal-missions');
        missionList.innerHTML = '';
        if (job.missions && Array.isArray(job.missions)) {
            job.missions.forEach(m => {
                const li = document.createElement('li');
                li.innerText = m;
                missionList.appendChild(li);
            });
        } else {
            missionList.innerHTML = "<li>Détails non fournis.</li>";
        }

        // Affichage avec animation
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

    // Construit le HTML pour les Widgets (Job cards, Images)
    renderWidget: (data) => {
        if (data.type === 'job_list') {
            const renderedItems = data.items.map((job, index) => {
                const uniqueId = `job_${Date.now()}_${index}`;
                jobDataMap.set(uniqueId, job); // Stocke l'objet job pour récupération
                
                return `
                    <div class="bg-slate-800 border border-slate-700 p-3 rounded-xl hover:border-indigo-500 transition-colors group relative">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center gap-2 overflow-hidden">
                                <div class="w-8 h-8 rounded bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-400">
                                    ${job.company ? job.company.substring(0,2).toUpperCase() : 'JO'}
                                </div>
                                <h3 class="font-bold text-indigo-400 truncate pr-2 text-sm">${job.title}</h3>
                            </div>
                            <span class="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-700 whitespace-nowrap">${job.source || 'Aggr.'}</span>
                        </div>
                        <div class="text-xs text-slate-400 mb-2 font-mono flex gap-2 items-center">
                            <span>${job.company}</span>
                            <span class="w-1 h-1 bg-slate-600 rounded-full"></span>
                            <span class="text-green-400">${job.salary || 'N.C.'}</span>
                        </div>
                        <p class="text-xs text-slate-300 line-clamp-2 mb-3">${job.description}</p>
                        <div class="pt-2 border-t border-slate-700/50 flex justify-end">
                            <button onclick="ui.openJobModal('${uniqueId}')" class="text-xs bg-indigo-600/20 text-indigo-300 px-3 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors font-medium">
                                Voir les détails
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="mb-2 text-slate-300">Offres trouvées :</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${renderedItems}
                </div>`;
        } else if (data.type === 'images') {
            // Widget Images (Inspiration)
            return `
                <div class="mb-2 text-slate-300">Inspirations pour : <span class="italic text-indigo-400">${data.query}</span></div>
                <div class="grid grid-cols-2 gap-2">
                    ${data.keywords.map(k => `
                        <div class="aspect-video bg-slate-800 rounded-lg overflow-hidden relative border border-slate-700 group">
                            <img src="https://source.unsplash.com/400x300/?${encodeURIComponent(k)}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110" onerror="this.parentElement.style.display='none'">
                            <div class="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2 pt-4 text-[10px] text-white truncate font-mono">${k}</div>
                        </div>
                    `).join('')}
                </div>`;
        }
        // Fallback: Texte Markdown standard
        return `<div class="glass-message rounded-2xl rounded-tl-none p-4">${marked.parse(data.content || "")}</div>`;
    }
};

// ==========================================
// 3. MOTEUR IA (AGENT)
// ==========================================
const agent = {
    contextFiles: [],
    
    // Envoi du message à Gemini
    send: async () => {
        const input = document.getElementById('user-input');
        const text = input.value.trim();
        
        // Vérifications pré-envoi
        if (!text || !config.apiKey || !config.activeModel) { 
            if(!text) return; 
            ui.toggleSettings(); 
            return; 
        }

        input.value = ''; 
        ui.addUserMessage(text); 
        ui.toggleLoading(true);

        // SYSTEM PROMPT : La "recette" pour forcer le JSON et les liens
        const systemPrompt = `
        Rôle: Assistant Freelance Expert. 
        Format de réponse: JSON STRICT (PAS de markdown autour).
        
        Si tu ne trouves pas de lien réel pour une offre, mets la valeur "SEARCH" dans le champ 'url'.
        
        STRUCTURE JSON ATTENDUE POUR OFFRES:
        {
            "type": "job_list",
            "items": [
                {
                    "title": "Titre",
                    "company": "Entreprise",
                    "salary": "Salaire/TJM",
                    "duration": "Durée",
                    "contract_type": "Freelance/CDI",
                    "location": "Lieu",
                    "source": "Source",
                    "description": "Courte desc",
                    "description_long": "Longue desc",
                    "missions": ["m1", "m2"],
                    "logo_url": "null",
                    "url": "SEARCH" 
                }
            ]
        }
        
        POUR LE RESTE: { "type": "text", "content": "Ta réponse markdown..." }
        
        Contexte Fichiers: ${agent.contextFiles.join(', ')}
        `;

        try {
            // Appel API Gemini
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.activeModel}:generateContent?key=${config.apiKey}`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: systemPrompt + "\nUser Query: " + text }] }] })
            });
            const d = await r.json();
            if(d.error) throw new Error(d.error.message);
            
            // Nettoyage du JSON (Gemini ajoute parfois ```json au début)
            let raw = d.candidates[0].content.parts[0].text
                .replace(/^```json\s*/, '')
                .replace(/^```\s*/, '')
                .replace(/\s*```$/, '');
            
            try { 
                // Essai de parsing JSON et affichage Widget
                ui.addSystemMessage(ui.renderWidget(JSON.parse(raw))); 
            } catch(e) { 
                // Si le JSON est cassé, on affiche le texte brut
                ui.addSystemMessage(`<div class="glass-message p-4">${marked.parse(raw)}</div>`); 
            }
        } catch (e) {
            ui.addSystemMessage(`<div class="text-red-400 text-xs p-3 border border-red-500/50 rounded bg-slate-800">Erreur: ${e.message}</div>`);
        }
        ui.toggleLoading(false);
    }
};

// ==========================================
// 4. LISTENERS (Démarrage)
// ==========================================

// Envoi avec la touche Entrée
document.getElementById('user-input').addEventListener('keypress', (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agent.send(); } 
});

// Vérification de connexion au démarrage
if (config.apiKey && config.activeModel) {
    ui.updateStatus(true);
    config.init();
} else {
    setTimeout(() => ui.toggleSettings(), 800);
}
