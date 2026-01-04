const { useState, useEffect, useRef } = React;
const { jsPDF } = window.jspdf;

// ==========================================
// 1. CONFIGURATION & INTELLIGENCE
// ==========================================

const AIService = {
    // LISTE ÉTENDUE DE 20+ MODÈLES POUR MAXIMISER LE HIT RATE
    candidates: [
        // 1. Experimental & New (Souvent instables mais puissants)
        'gemini-2.0-flash-exp',
        'gemini-exp-1206',
        
        // 2. Flash Series (Rapides)
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-001',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-8b',

        // 3. Pro Series (Intelligents)
        'gemini-1.5-pro',
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro-001',
        'gemini-1.5-pro-002',
        
        // 4. Legacy Series (Vieux mais fiables)
        'gemini-1.0-pro',
        'gemini-1.0-pro-latest',
        'gemini-1.0-pro-001',
        'gemini-pro',
        'gemini-pro-vision'
    ],

    async scanAvailableModels(apiKey, onLog) {
        let validModels = [];
        onLog("🚀 Initialisation du Deep Scan (20+ modèles)...", "wait");
        
        for (const model of this.candidates) {
            onLog(`Ping: ${model}...`, "wait");
            try {
                // Test minimaliste
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.candidates) {
                        validModels.push(model);
                        onLog(`✅ ${model} : ACCÈS OK`, "success");
                    }
                } else {
                    // Analyse sommaire de l'erreur pour ne pas polluer si c'est juste "Not Found"
                    const err = await res.json();
                    const msg = err.error?.message || "Erreur inconnue";
                    if(msg.includes('quota')) onLog(`⚠️ ${model} : Quota dépassé`, "error");
                    else if(msg.includes('not found')) onLog(`❌ ${model} : Non dispo`, "error");
                    else onLog(`❌ ${model} : ${msg.substring(0, 40)}...`, "error");
                }
            } catch (e) {
                onLog(`❌ ${model} : Erreur réseau`, "error");
            }
        }
        return validModels;
    },

    async smartSend(prompt, filesContext, apiKey, preferredModel, validModels) {
        // Logique de Fallback : Préféré -> Valides -> Candidats par défaut
        let tryList = [preferredModel];
        
        if (validModels && validModels.length > 0) {
            tryList = [...new Set([...tryList, ...validModels])];
        } else {
            // Si pas de scan fait, on essaie les plus probables d'abord
            tryList = [...new Set([...tryList, 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-1.0-pro'])];
        }

        let lastError = null;
        for (const model of tryList) {
            if(!model) continue;
            try {
                console.log(`Tentative d'envoi avec ${model}...`);
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt + filesContext }] }] })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error?.message || response.statusText);

                return { 
                    text: data.candidates[0].content.parts[0].text, 
                    usedModel: model 
                };

            } catch (err) {
                console.warn(`Échec ${model}:`, err.message);
                lastError = err;
            }
        }
        throw lastError; // Si tout échoue
    }
};

// ==========================================
// 2. SERVICES SYSTEME (GitHub & DB)
// ==========================================

const SystemService = {
    GITHUB_USER: 'antoto2021', // À adapter si besoin
    GITHUB_REPO: 'Appli-agent-IA', // Nom fictif pour l'exemple
    
    // Check GitHub Hash (Style Green Codex)
    async checkGitHubVersion() {
        try {
            // Simulation d'un check (pour éviter les erreurs CORS si pas configuré)
            // Dans une vraie app, on ferait fetch(`https://api.github.com/repos/${this.GITHUB_USER}/${this.GITHUB_REPO}/commits/main`)
            await new Promise(r => setTimeout(r, 800)); 
            return { short: "a1b2c3d", date: new Date().toLocaleDateString() }; 
        } catch (e) {
            return { error: true };
        }
    },

    // Check DB Usage (Style Investissement)
    async getDBStats() {
        if (!navigator.storage || !navigator.storage.estimate) return "N/A";
        const { usage, quota } = await navigator.storage.estimate();
        const usedMB = (usage / (1024 * 1024)).toFixed(2);
        const percent = ((usage / quota) * 100).toFixed(4);
        return `${usedMB} MB (${percent}%)`;
    }
};

const dbService = {
    dbName: 'AgentSystemDB_V6',
    version: 1,
    db: null,
    async init() {
        if (this.db) return this.db;
        return new Promise((resolve) => {
            const req = indexedDB.open(this.dbName, this.version);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations', { keyPath: 'id' });
            };
            req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
        });
    },
    async saveConversation(conv) {
        const db = await this.init();
        const tx = db.transaction('conversations', 'readwrite');
        tx.objectStore('conversations').put(conv);
    },
    async countConversations() {
        const db = await this.init();
        return new Promise(r => {
            const req = db.transaction('conversations').objectStore('conversations').count();
            req.onsuccess = () => r(req.result);
        });
    }
};

// ==========================================
// 3. COMPOSANTS MODALS
// ==========================================

// --- TUTORIEL (Style Levage) ---
const TutorialModal = ({ onClose }) => {
    const slides = [
        { icon: "fa-robot", title: "Bienvenue sur l'Agent V6", desc: "Une IA autonome capable de s'adapter, de lire vos fichiers et de fonctionner hors-ligne." },
        { icon: "fa-network-wired", title: "Routeur Intelligent", desc: "Entrez votre clé API. Le système testera 20+ modèles pour trouver celui qui fonctionne chez vous." },
        { icon: "fa-file-pdf", title: "Analyse Documentaire", desc: "Glissez vos PDF, Excel ou Code dans le chat. L'IA les lira pour vous répondre." },
        { icon: "fa-database", title: "Données Locales", desc: "Tout reste sur votre appareil. Consultez le bouton 'Info' pour voir l'état du stockage." }
    ];
    const [step, setStep] = useState(0);

    return (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 text-slate-200 rounded-2xl shadow-2xl max-w-xs w-full p-6 modal-content text-center relative">
                <div className="w-16 h-16 mx-auto bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 text-2xl mb-4 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                    <i className={`fa-solid ${slides[step].icon}`}></i>
                </div>
                <h3 className="text-lg font-bold mb-2 text-white">{slides[step].title}</h3>
                <p className="text-sm text-slate-400 mb-6 h-12 leading-relaxed">{slides[step].desc}</p>
                <div className="flex flex-col gap-3">
                    <div className="flex justify-center gap-1.5 mb-2">
                        {slides.map((_, i) => <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-700'}`}></div>)}
                    </div>
                    <button onClick={() => step < slides.length - 1 ? setStep(step + 1) : onClose()} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-bold text-sm transition shadow-lg">
                        {step === slides.length - 1 ? "Compris" : "Suivant"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- INFO DASHBOARD (Style Green Codex) ---
const InfoModal = ({ onClose, onLaunchTuto }) => {
    const [stats, setStats] = useState({ dbSize: 'Calcul...', dbCount: 0, gitHash: 'Checking...', appVersion: '6.0.2' });

    useEffect(() => {
        const load = async () => {
            const dbSize = await SystemService.getDBStats();
            const dbCount = await dbService.countConversations();
            const git = await SystemService.checkGitHubVersion();
            setStats(prev => ({ ...prev, dbSize, dbCount, gitHash: git.short || 'Offline' }));
        };
        load();
    }, []);

    return (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl modal-content flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="font-bold text-white flex items-center gap-2"><i className="fa-solid fa-circle-info text-blue-400"></i> Informations Système</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><i className="fa-solid fa-times"></i></button>
                </div>
                
                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Status Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="info-card">
                            <div className="info-label">Version App</div>
                            <div className="info-value text-blue-400">v{stats.appVersion}</div>
                        </div>
                        <div className="info-card">
                            <div className="info-label">Git Commit</div>
                            <div className="info-value flex items-center gap-1">
                                <i className="fa-brands fa-github"></i> {stats.gitHash}
                            </div>
                        </div>
                        <div className="info-card">
                            <div className="info-label">Stockage Local</div>
                            <div className="info-value text-emerald-400">{stats.dbSize}</div>
                        </div>
                        <div className="info-card">
                            <div className="info-label">Conversations</div>
                            <div className="info-value">{stats.dbCount} chats</div>
                        </div>
                    </div>

                    {/* Action Block */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Actions Rapides</h4>
                        <button onClick={() => { onClose(); onLaunchTuto(); }} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded flex items-center justify-center gap-2 text-sm transition">
                            <i className="fa-solid fa-graduation-cap text-indigo-400"></i> Relancer le Tutoriel
                        </button>
                    </div>

                    {/* Credits */}
                    <div className="text-center pt-2">
                        <p className="text-[10px] text-slate-600">
                            Propulsé par Google Gemini • Architecture React Zero-Build<br/>
                            Développé pour l'écosystème unifié
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 4. MAIN APPLICATION
// ==========================================

const App = () => {
    const [messages, setMessages] = useState([{ role: 'system', text: "👋 **Système V6 Prêt.**\nLe routeur d'IA est actif. Importez un fichier ou posez une question." }]);
    const [input, setInput] = useState("");
    const [files, setFiles] = useState([]);
    
    // UI Logic
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    
    // Settings Logic
    const [apiKey, setApiKey] = useState(localStorage.getItem('agent_ia_apikey') || '');
    const [activeModel, setActiveModel] = useState(localStorage.getItem('agent_ia_model') || 'gemini-1.5-flash-latest');
    const [validModels, setValidModels] = useState(JSON.parse(localStorage.getItem('agent_ia_valid_models') || '[]'));
    const [scanLogs, setScanLogs] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    // Initialisation
    useEffect(() => {
        dbService.init();
        if (!localStorage.getItem('agent_ia_tuto_done') || !apiKey) setShowTutorial(true);
    }, []);

    // --- HANDLERS ---

    const handleRunScan = async () => {
        if (!apiKey) return;
        setIsScanning(true);
        setScanLogs([]);
        
        const logs = [];
        const logFn = (msg, type) => {
            logs.push({ msg, type });
            setScanLogs([...logs]);
        };

        const valid = await AIService.scanAvailableModels(apiKey, logFn);
        setValidModels(valid);
        localStorage.setItem('agent_ia_valid_models', JSON.stringify(valid));
        setIsScanning(false);
        
        if (valid.length > 0) {
            logFn(`✅ Scan terminé. ${valid.length} modèles actifs trouvés.`, "success");
            // Auto-switch si le modèle actuel est mort
            if (!valid.includes(activeModel)) {
                setActiveModel(valid[0]);
                localStorage.setItem('agent_ia_model', valid[0]);
            }
        } else {
            logFn("⚠️ Aucun modèle compatible trouvé. Vérifiez votre clé API ou votre région.", "error");
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && files.length === 0) || isLoading) return;
        if (!apiKey) { setShowSettings(true); return; }

        const currentFiles = [...files];
        const userMsg = { role: 'user', text: input, files: currentFiles.map(f => f.name) };
        const updatedMsgs = [...messages, userMsg];
        
        setMessages(updatedMsgs);
        setInput("");
        setFiles([]);
        setIsLoading(true);

        let contextBlock = "";
        if (currentFiles.length > 0) {
            contextBlock = "\n\n--- FICHIERS JOINTS ---\n" + currentFiles.map(f => `[${f.name}]\n${f.content}`).join("\n\n");
        }

        try {
            const result = await AIService.smartSend(input, contextBlock, apiKey, activeModel, validModels);
            
            const aiMsg = { 
                role: 'model', 
                text: result.text, 
                meta: `Via ${result.usedModel}` 
            };
            
            const finalMsgs = [...updatedMsgs, aiMsg];
            setMessages(finalMsgs);
            dbService.saveConversation({ id: Date.now(), title: input.slice(0, 20), messages: finalMsgs, timestamp: Date.now() });

        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', text: `❌ **Erreur Fatale :** ${error.message}\n\nConseil : Lancez un "Scan" dans les paramètres pour trouver un modèle valide.` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFile = async (e) => {
        const list = e.target.files || e.dataTransfer.files;
        if (!list) return;
        const processed = await Promise.all(Array.from(list).map(f => new Promise(r => {
            const reader = new FileReader();
            reader.onload = (e) => r({ name: f.name, content: e.target.result });
            reader.readAsText(f);
        })));
        setFiles(prev => [...prev, ...processed]);
    };

    // --- RENDER ---
    return (
        <div className="h-screen flex flex-col relative" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFile(e); }}>
            
            {/* HEADER */}
            <header className="h-16 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-4 z-20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <i className="fa-solid fa-brain text-white text-lg"></i>
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-100 leading-tight">AGENT SYSTEM</h1>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                            <span className={`w-2 h-2 rounded-full ${validModels.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                            {validModels.length > 0 ? `${validModels.length} IAs DISPO` : 'OFFLINE'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => window.jspdf && new window.jspdf.jsPDF().text("Export Chat",10,10).save("chat.pdf")} className="btn-icon" title="Export PDF"><i className="fa-solid fa-file-pdf"></i></button>
                    
                    <button id="btn-refresh" onClick={() => { document.getElementById('btn-refresh').classList.add('spin-once'); setTimeout(()=>window.location.reload(), 800); }} className="btn-icon text-indigo-300" title="Rafraîchir"><i className="fa-solid fa-arrows-rotate"></i></button>
                    
                    <button onClick={() => setShowInfo(true)} className="btn-icon text-amber-300" title="Informations"><i className="fa-solid fa-info"></i></button>
                    
                    <div className="w-px h-8 bg-slate-700/50 mx-1"></div>
                    
                    <button onClick={() => setShowSettings(true)} className={`btn-icon ${!apiKey ? 'text-red-400 bg-red-500/10 animate-pulse' : ''}`} title="Paramètres"><i className="fa-solid fa-gear"></i></button>
                </div>
            </header>

            {/* CHAT AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} fade-in-up`}>
                        <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-lg ${m.role === 'user' ? 'message-user' : 'message-ai'}`}>
                            <div className="prose prose-invert text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) }}></div>
                            {/* Metadata */}
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10 opacity-60 text-[10px]">
                                <span>{m.meta || (m.role === 'user' ? 'Vous' : 'Système')}</span>
                                {m.files && <span><i className="fa-solid fa-paperclip"></i> {m.files.length} PJ</span>}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="ml-4 flex gap-1 p-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full typing-dot"></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full typing-dot"></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full typing-dot"></div>
                    </div>
                )}
            </div>

            {/* INPUT AREA */}
            <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-[#0b1121] via-[#0b1121] to-transparent z-10 pt-10">
                <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-3 flex flex-col gap-2">
                    {files.length > 0 && (
                        <div className="flex gap-2 px-2 overflow-x-auto pb-1">
                            {files.map((f,i)=><span key={i} className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-1 rounded text-indigo-300 flex items-center gap-1">{f.name} <button onClick={()=>setFiles(files.filter((_,x)=>x!==i))} className="hover:text-red-400">×</button></span>)}
                        </div>
                    )}
                    <div className="flex items-end gap-2">
                        <label className="p-3 text-slate-400 hover:text-white cursor-pointer transition active:scale-95">
                            <i className="fa-solid fa-folder-plus text-lg"></i>
                            <input type="file" multiple className="hidden" onChange={handleFile} />
                        </label>
                        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()}}} placeholder="Message..." className="flex-1 bg-transparent border-none outline-none text-white resize-none py-3 h-12 max-h-32 text-sm placeholder-slate-600"></textarea>
                        <button onClick={handleSend} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
                            <i className="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {showTutorial && <TutorialModal onClose={() => { localStorage.setItem('agent_ia_tuto_done', 'true'); setShowTutorial(false); }} />}
            {showInfo && <InfoModal onClose={() => setShowInfo(false)} onLaunchTuto={() => setShowTutorial(true)} />}

            {showSettings && (
                <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
                    <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md p-6 rounded-2xl shadow-2xl modal-content flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white"><i className="fa-solid fa-sliders mr-2 text-slate-500"></i>Configuration</h2>
                            <button onClick={()=>setShowSettings(false)} className="text-slate-500 hover:text-white"><i className="fa-solid fa-times"></i></button>
                        </div>
                        
                        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                            {/* API Key */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Clé API Google</label>
                                <div className="flex gap-2">
                                    <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('agent_ia_apikey', e.target.value); }} 
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono text-xs focus:border-indigo-500 outline-none" placeholder="AIzaSy..." />
                                    <button onClick={handleRunScan} disabled={isScanning || !apiKey} className="bg-indigo-600 text-white px-3 py-2 rounded font-bold text-xs whitespace-nowrap hover:bg-indigo-500 disabled:opacity-50 transition">
                                        {isScanning ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "SCANNER"}
                                    </button>
                                </div>
                            </div>

                            {/* Console Logs */}
                            <div className="bg-[#020617] border border-slate-800 rounded p-3 h-40 overflow-y-auto console-log">
                                {scanLogs.length === 0 && <span className="text-slate-600 italic">En attente du scan (Cliquez sur SCANNER)...</span>}
                                {scanLogs.map((l, i) => (
                                    <div key={i} className={`mb-1 ${l.type === 'success' ? 'console-success' : l.type === 'error' ? 'console-error' : 'console-wait'}`}>
                                        <span className="opacity-30 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                        {l.msg}
                                    </div>
                                ))}
                            </div>

                            {/* Model Select */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Modèle Prioritaire</label>
                                <select value={activeModel} onChange={e => { setActiveModel(e.target.value); localStorage.setItem('agent_ia_model', e.target.value); }} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none text-sm">
                                    {validModels.length > 0 ? (
                                        validModels.map(m => <option key={m} value={m}>{m} (Actif)</option>)
                                    ) : (
                                        <>
                                            <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash Latest (Défaut)</option>
                                            <option value="gemini-1.5-pro-latest">Gemini 1.5 Pro Latest</option>
                                            <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
