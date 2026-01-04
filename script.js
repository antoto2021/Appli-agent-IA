const { useState, useEffect, useRef } = React;
const { jsPDF } = window.jspdf;

// ==========================================
// 1. SERVICE INTELLIGENT (ROUTEUR IA)
// ==========================================
const AIService = {
    // Liste des modèles à tester (du plus récent au plus vieux)
    candidates: [
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro'
    ],

    // Teste une clé et retourne les modèles valides
    async scanAvailableModels(apiKey, onLog) {
        let validModels = [];
        onLog("🚀 Démarrage du Deep Scan...", "wait");
        
        for (const model of this.candidates) {
            onLog(`Testing: ${model}...`, "wait");
            try {
                // On tente un prompt ultra-léger pour vérifier l'accès
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.candidates) {
                        validModels.push(model);
                        onLog(`✅ ${model}: ACTIF`, "success");
                    }
                } else {
                    const err = await res.json();
                    onLog(`❌ ${model}: ${err.error?.message || 'Erreur'}`, "error");
                }
            } catch (e) {
                onLog(`❌ ${model}: Network Error`, "error");
            }
        }
        return validModels;
    },

    // Envoi intelligent avec bascule automatique (Fallback)
    async smartSend(prompt, filesContext, apiKey, preferredModel, validModels) {
        // On construit la liste d'essai : Le préféré d'abord, puis les autres
        let tryList = [preferredModel];
        if (validModels && validModels.length > 0) {
            // Ajouter les autres modèles valides qui ne sont pas le préféré
            const others = validModels.filter(m => m !== preferredModel);
            tryList = [...tryList, ...others];
        } else {
            // Si pas de liste valide connue, on utilise les candidats par défaut en backup
            tryList = [...tryList, ...this.candidates.filter(m => m !== preferredModel)];
        }

        // Boucle de tentative
        let lastError = null;
        for (const model of tryList) {
            try {
                console.log(`Tentative avec ${model}...`);
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt + filesContext }] }] })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || response.statusText);
                }

                // Si succès, on retourne la réponse et le modèle utilisé
                return { 
                    text: data.candidates[0].content.parts[0].text, 
                    usedModel: model 
                };

            } catch (err) {
                console.warn(`Échec sur ${model}:`, err.message);
                lastError = err;
                // On continue la boucle vers le prochain modèle...
            }
        }
        
        // Si tout a échoué
        throw lastError;
    }
};

// ==========================================
// 2. DATABASE (Mémoire)
// ==========================================
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
    }
};

// ==========================================
// 3. COMPOSANTS UI
// ==========================================

const TutorialModal = ({ onClose }) => {
    const slides = [
        { icon: "fa-robot", title: "Smart Router IA", desc: "Cette application teste automatiquement tous les modèles IA disponibles pour trouver celui qui fonctionne." },
        { icon: "fa-key", title: "Scan & Configuration", desc: "Dans les paramètres, entrez votre clé. Le système scannera vos accès pour valider la clé." },
        { icon: "fa-shield-halved", title: "Résilience", desc: "Si le modèle principal échoue (quota, erreur), l'agent bascule seul sur une autre IA." },
        { icon: "fa-file-import", title: "Fichiers & PDF", desc: "Glissez vos documents. Ils sont analysés localement et envoyés au modèle le plus performant." }
    ];
    const [step, setStep] = useState(0);
    return (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-xs w-full p-6 modal-content text-center">
                <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-2xl mb-4">
                    <i className={`fa-solid ${slides[step].icon}`}></i>
                </div>
                <h3 className="text-xl font-bold mb-2">{slides[step].title}</h3>
                <p className="text-sm text-slate-500 mb-6 h-16">{slides[step].desc}</p>
                <div className="flex flex-col gap-4">
                    <div className="flex justify-center gap-1">
                        {slides.map((_, i) => <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-200'}`}></div>)}
                    </div>
                    <button onClick={() => step < slides.length - 1 ? setStep(step + 1) : onClose()} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm">
                        {step === slides.length - 1 ? "C'est parti !" : "Suivant"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 4. MAIN APP
// ==========================================

const App = () => {
    // Data State
    const [messages, setMessages] = useState([{ role: 'system', text: "👋 **Système V6 Prêt.**\nJe choisirai automatiquement le meilleur modèle IA pour vous répondre." }]);
    const [input, setInput] = useState("");
    const [files, setFiles] = useState([]);
    
    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    
    // Config State
    const [apiKey, setApiKey] = useState(localStorage.getItem('agent_ia_apikey') || '');
    const [activeModel, setActiveModel] = useState(localStorage.getItem('agent_ia_model') || 'gemini-1.5-flash');
    const [validModels, setValidModels] = useState(JSON.parse(localStorage.getItem('agent_ia_valid_models') || '[]'));
    
    // Scan Logs
    const [scanLogs, setScanLogs] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        dbService.init();
        if (!localStorage.getItem('agent_ia_tuto_done') || !apiKey) setShowTutorial(true);
    }, []);

    // --- LOGIC ---

    const handleRunScan = async () => {
        if (!apiKey) return;
        setIsScanning(true);
        setScanLogs([]); // Reset logs
        
        const logs = [];
        const logFn = (msg, type) => {
            logs.push({ msg, type });
            setScanLogs([...logs]); // Force update
        };

        const valid = await AIService.scanAvailableModels(apiKey, logFn);
        
        setValidModels(valid);
        localStorage.setItem('agent_ia_valid_models', JSON.stringify(valid));
        setIsScanning(false);
        
        if (valid.length > 0) {
            // Si le modèle actuel n'est pas dans la liste valide, on prend le premier valide
            if (!valid.includes(activeModel)) {
                setActiveModel(valid[0]);
                localStorage.setItem('agent_ia_model', valid[0]);
            }
            logFn("✅ Sauvegarde terminée. Clé valide.", "success");
        } else {
            logFn("⚠️ Aucun modèle compatible trouvé.", "error");
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && files.length === 0) || isLoading) return;
        if (!apiKey) { setShowSettings(true); return; }

        const currentFiles = [...files];
        const userMsg = { role: 'user', text: input, files: currentFiles.map(f => f.name) };
        const updatedHistory = [...messages, userMsg];
        
        setMessages(updatedHistory);
        setInput("");
        setFiles([]);
        setIsLoading(true);

        // Context Construction
        let contextBlock = "";
        if (currentFiles.length > 0) {
            contextBlock = "\n\n--- CONTENU FICHIERS ---\n" + currentFiles.map(f => `[${f.name}]\n${f.content}`).join("\n\n");
        }

        try {
            // APPEL AU ROUTEUR INTELLIGENT
            const result = await AIService.smartSend(input, contextBlock, apiKey, activeModel, validModels);
            
            const aiMsg = { 
                role: 'model', 
                text: result.text, 
                meta: `Répondu par ${result.usedModel}` // On stocke quel modèle a répondu
            };
            
            const finalHistory = [...updatedHistory, aiMsg];
            setMessages(finalHistory);
            dbService.saveConversation({ id: Date.now(), title: input.substring(0,20), messages: finalHistory, timestamp: Date.now() });

        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', text: `❌ **Échec total :** Impossible d'obtenir une réponse de l'IA (Tous les modèles ont échoué).\nErreur: ${error.message}` }]);
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
        <div className="h-screen flex flex-col relative" onDragOver={e => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFile(e); }}>
            
            {/* HEADER */}
            <header className="h-16 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between px-4 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 flex items-center justify-center shadow-lg">
                        <i className="fa-solid fa-network-wired text-white"></i>
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-100 leading-tight">AGENT ROUTER</h1>
                        <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            {validModels.length > 0 ? `${validModels.length} IAs ACTIVES` : 'OFFLINE'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => window.jspdf && new window.jspdf.jsPDF().text(JSON.stringify(messages),10,10).save("export.pdf")} className="btn-icon"><i className="fa-solid fa-download"></i></button>
                    <button onClick={() => { const b=document.getElementById('btn-ref'); if(b)b.classList.add('spin-once'); setTimeout(()=>window.location.reload(),800); }} id="btn-ref" className="btn-icon"><i className="fa-solid fa-arrows-rotate"></i></button>
                    <button onClick={() => setShowSettings(true)} className={`btn-icon ${!apiKey ? 'text-red-400 bg-red-500/10' : ''}`}><i className="fa-solid fa-gear"></i></button>
                </div>
            </header>

            {/* CHAT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} fade-in-up`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-lg ${m.role === 'user' ? 'message-user' : 'message-ai'}`}>
                            <div className="prose prose-invert text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) }}></div>
                            {/* Metadata Badge (Quel modèle a répondu ?) */}
                            {m.meta && (
                                <div className="mt-2 text-[10px] opacity-50 border-t border-white/10 pt-1 flex justify-between">
                                    <span><i className="fa-solid fa-microchip"></i> {m.meta}</span>
                                </div>
                            )}
                            {m.files && (
                                <div className="mt-2 text-[10px] bg-black/20 p-1 rounded inline-block">📎 {m.files.length} fichiers</div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && <div className="ml-4 flex gap-1"><div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div><div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div><div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div></div>}
            </div>

            {/* INPUT */}
            <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-[#0b1121] via-[#0b1121] to-transparent z-10">
                <div className="max-w-3xl mx-auto glass-panel rounded-2xl p-3 flex flex-col gap-2">
                    {files.length > 0 && <div className="flex gap-2 px-2 overflow-x-auto">{files.map((f,i)=><span key={i} className="text-[10px] bg-slate-700 px-2 py-1 rounded text-white">{f.name} <button onClick={()=>setFiles(files.filter((_,x)=>x!==i))} className="ml-1 text-red-300">×</button></span>)}</div>}
                    <div className="flex items-end gap-2">
                        <label className="p-3 text-slate-400 hover:text-white cursor-pointer"><i className="fa-solid fa-folder-open"></i><input type="file" multiple className="hidden" onChange={handleFile} /></label>
                        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()}}} placeholder="Message..." className="flex-1 bg-transparent border-none outline-none text-white resize-none py-3 h-12 max-h-32 text-sm"></textarea>
                        <button onClick={handleSend} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl shadow-lg transition"><i className="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>

            {/* MODAL SETTINGS (SCAN CONSOLE) */}
            {showSettings && (
                <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-sm p-6 rounded-2xl shadow-2xl modal-content flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white"><i className="fa-solid fa-server mr-2"></i>Configuration IA</h2>
                            <button onClick={()=>setShowSettings(false)} className="text-slate-500 hover:text-white"><i className="fa-solid fa-times"></i></button>
                        </div>
                        
                        <div className="space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Clé API Gemini</label>
                                <div className="flex gap-2">
                                    <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('agent_ia_apikey', e.target.value); }} 
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono text-xs focus:border-indigo-500 outline-none" placeholder="AIzaSy..." />
                                    <button onClick={handleRunScan} disabled={isScanning || !apiKey} className="bg-indigo-600 text-white px-3 py-2 rounded font-bold text-xs whitespace-nowrap hover:bg-indigo-500 disabled:opacity-50">
                                        {isScanning ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "SCANNER"}
                                    </button>
                                </div>
                            </div>

                            {/* CONSOLE DE LOGS */}
                            <div className="bg-black/50 border border-slate-800 rounded p-3 h-32 overflow-y-auto console-log">
                                {scanLogs.length === 0 && <span className="text-slate-600 italic">En attente du scan...</span>}
                                {scanLogs.map((l, i) => (
                                    <div key={i} className={`mb-1 ${l.type === 'success' ? 'console-success' : l.type === 'error' ? 'console-error' : 'console-wait'}`}>
                                        <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                        {l.msg}
                                    </div>
                                ))}
                            </div>

                            {/* SELECTEUR MODELE (Peuplé par le scan) */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Modèle Préféré (Prioritaire)</label>
                                <select value={activeModel} onChange={e => { setActiveModel(e.target.value); localStorage.setItem('agent_ia_model', e.target.value); }} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none text-sm">
                                    {validModels.length > 0 ? (
                                        validModels.map(m => <option key={m} value={m}>{m}</option>)
                                    ) : (
                                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Défaut)</option>
                                    )}
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">Si ce modèle échoue, les autres seront testés automatiquement.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {showTutorial && <TutorialModal onClose={()=>{localStorage.setItem('agent_ia_tuto_done','true');setShowTutorial(false)}} />}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
