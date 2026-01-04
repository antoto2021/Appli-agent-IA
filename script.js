const { useState, useEffect, useRef } = React;
const { jsPDF } = window.jspdf;

// ==========================================
// 1. SERVICES (DB & FILES)
// ==========================================

// --- Mémoire Persistante (IndexedDB Wrapper) ---
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
                if (!db.objectStoreNames.contains('conversations')) {
                    db.createObjectStore('conversations', { keyPath: 'id' });
                }
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

// --- Gestion Fichiers (PDF Importer / Exporter) ---
const fileUtils = {
    readFile: (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ name: file.name, content: e.target.result });
            // On lit en texte pour l'analyse (code, csv, logs)
            reader.readAsText(file); 
        });
    },
    exportPDF: (messages) => {
        const doc = new jsPDF();
        doc.setFontSize(10);
        let y = 10;
        messages.forEach(m => {
            if(y > 280) { doc.addPage(); y = 10; }
            const txt = doc.splitTextToSize(`${m.role === 'user' ? 'VOUS' : 'IA'}: ${m.text.replace(/[*#]/g, '')}`, 180);
            doc.text(txt, 10, y);
            y += (txt.length * 5) + 5;
        });
        doc.save(`Agent_IA_Export_${Date.now()}.pdf`);
    }
};

// ==========================================
// 2. COMPOSANTS UI
// ==========================================

// --- Tutoriel Interactif (Style Engin de Levage) ---
const TutorialModal = ({ onClose }) => {
    const slides = [
        { icon: "fa-robot", title: "Agent System V6", desc: "Bienvenue. Cette version combine la puissance de l'IA avec vos outils métiers (Fichiers, PDF, Mémoire)." },
        { icon: "fa-key", title: "Configuration API", desc: "Indispensable : Cliquez sur la roue crantée (⚙️) pour entrer votre clé Google Gemini." },
        { icon: "fa-file-code", title: "Analyse de Fichiers", desc: "Glissez un fichier (Code, CSV, Texte) dans la zone de chat. L'agent l'analysera instantanément." },
        { icon: "fa-wifi", title: "Mode Offline", desc: "L'application fonctionne comme une appli native. Votre historique est sauvegardé localement." }
    ];
    const [step, setStep] = useState(0);

    return (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
            <div className="bg-white text-slate-800 rounded-2xl shadow-2xl max-w-xs w-full p-6 modal-content text-center relative">
                {/* Header Badge */}
                <div className="mb-4">
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Tutoriel</span>
                </div>
                
                {/* Icon */}
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg mb-4">
                    <i className={`fa-solid ${slides[step].icon}`}></i>
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-black text-slate-900 mb-2">{slides[step].title}</h3>
                <p className="text-sm text-slate-500 mb-6 h-16 leading-relaxed">{slides[step].desc}</p>
                
                {/* Navigation */}
                <div className="flex flex-col gap-4">
                    <div className="flex justify-center gap-1.5">
                        {slides.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200'}`}></div>
                        ))}
                    </div>
                    <button 
                        onClick={() => step < slides.length - 1 ? setStep(step + 1) : onClose()}
                        className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition active:scale-95"
                    >
                        {step === slides.length - 1 ? "Commencer 🚀" : "Suivant"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 3. APPLICATION PRINCIPALE
// ==========================================

const App = () => {
    // State global
    const [messages, setMessages] = useState([{ role: 'system', text: "👋 **Agent V6 en ligne.**\nJe suis prêt à analyser vos fichiers et répondre à vos questions." }]);
    const [input, setInput] = useState("");
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Modals & Settings
    const [showSettings, setShowSettings] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [apiKey, setApiKey] = useState(localStorage.getItem('agent_ia_apikey') || '');
    const [model, setModel] = useState(localStorage.getItem('agent_ia_model') || 'gemini-1.5-flash');

    // Init
    useEffect(() => {
        dbService.init();
        // Si c'est la première visite (pas de clé), on lance le tuto
        if (!localStorage.getItem('agent_ia_tuto_done') || !apiKey) {
            setShowTutorial(true);
        }
    }, []);

    // --- Actions ---

    const handleRefresh = () => {
        // Animation "Spin" puis reload complet (Tech: Suivi Investissement)
        const btn = document.getElementById('btn-refresh');
        if(btn) btn.classList.add('spin-once');
        setTimeout(() => window.location.reload(), 800);
    };

    const handleSend = async () => {
        if ((!input.trim() && files.length === 0) || isLoading) return;
        if (!apiKey) return setShowSettings(true);

        const currentFiles = [...files];
        const userMsg = { role: 'user', text: input, files: currentFiles.map(f => f.name) };
        const updatedHistory = [...messages, userMsg];
        
        setMessages(updatedHistory);
        setInput("");
        setFiles([]);
        setIsLoading(true);

        // Construction du Prompt avec les fichiers joints (Tech: RAG Simplifié)
        let contextBlock = "";
        if (currentFiles.length > 0) {
            contextBlock = "\n\n--- FICHIERS JOINTS ---\n" + currentFiles.map(f => `[FICHIER: ${f.name}]\n${f.content}`).join("\n\n----------------\n");
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: input + contextBlock }] }] })
            });
            const data = await response.json();
            
            if (data.error) throw new Error(data.error.message);
            
            const aiText = data.candidates[0].content.parts[0].text;
            const finalHistory = [...updatedHistory, { role: 'model', text: aiText }];
            
            setMessages(finalHistory);
            dbService.saveConversation({ id: Date.now(), title: input.substring(0,20), messages: finalHistory, timestamp: Date.now() });

        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', text: `❌ **Erreur API :** ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileDrop = async (e) => {
        // Gestion du Drag & Drop ou Input File
        const fileList = e.target.files || e.dataTransfer.files;
        if (!fileList) return;
        const processed = await Promise.all(Array.from(fileList).map(fileUtils.readFile));
        setFiles(prev => [...prev, ...processed]);
    };

    // --- Rendu UI ---

    return (
        <div className="h-screen flex flex-col relative" onDragOver={e => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFileDrop(e); }}>
            
            {/* 1. HEADER V6 */}
            <header className="h-16 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between px-4 z-20 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <i className="fa-solid fa-brain text-white"></i>
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-100 tracking-tight leading-tight">AGENT SYSTEM</h1>
                        <p className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider">V6.0 ONLINE</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => fileUtils.exportPDF(messages)} className="btn-icon" title="Exporter en PDF">
                        <i className="fa-solid fa-file-pdf"></i>
                    </button>
                    <div className="w-px h-6 bg-slate-700 mx-1"></div>
                    
                    {/* BOUTON REFRESH */}
                    <button id="btn-refresh" onClick={handleRefresh} className="btn-icon text-indigo-300" title="Rafraîchir / Update">
                        <i className="fa-solid fa-arrows-rotate"></i>
                    </button>
                    
                    {/* BOUTON INFO / TUTO */}
                    <button onClick={() => setShowTutorial(true)} className="btn-icon text-amber-300" title="Aide & Info">
                        <i className="fa-solid fa-question"></i>
                    </button>
                    
                    <div className="w-px h-6 bg-slate-700 mx-1"></div>
                    <button onClick={() => setShowSettings(true)} className={`btn-icon ${!apiKey ? 'text-red-400 animate-pulse bg-red-400/10' : ''}`}>
                        <i className="fa-solid fa-gear"></i>
                    </button>
                </div>
            </header>

            {/* 2. CHAT AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} fade-in-up`}>
                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-lg ${m.role === 'user' ? 'message-user' : 'message-ai'}`}>
                            {/* Rendu Markdown */}
                            <div className="prose prose-invert text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) }}></div>
                            {/* Badge Fichiers */}
                            {m.files && m.files.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-white/20 text-xs flex gap-2 items-center opacity-80">
                                    <i className="fa-solid fa-paperclip"></i> {m.files.length} fichier(s) analysé(s)
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-1 ml-4 p-2">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot"></div>
                    </div>
                )}
            </div>

            {/* 3. INPUT ZONE */}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#0b1121] via-[#0b1121] to-transparent pt-10 pb-6 px-4 z-10">
                <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-3 flex flex-col gap-2 shadow-2xl">
                    {/* Prévisualisation Fichiers */}
                    {files.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 px-1">
                            {files.map((f, i) => (
                                <div key={i} className="bg-slate-700/50 border border-slate-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 text-indigo-200 whitespace-nowrap">
                                    <i className="fa-regular fa-file-code"></i> {f.name}
                                    <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="hover:text-red-400"><i className="fa-solid fa-times"></i></button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="flex items-end gap-2">
                        <label className="p-3 text-slate-400 hover:text-white cursor-pointer transition active:scale-95">
                            <i className="fa-solid fa-paperclip text-lg"></i>
                            <input type="file" multiple className="hidden" onChange={handleFileDrop} />
                        </label>
                        <textarea 
                            value={input} onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                            placeholder="Message à l'Agent V6..."
                            className="flex-1 bg-transparent border-none outline-none text-white resize-none py-3 h-12 max-h-32 text-sm md:text-base placeholder-slate-600"
                        ></textarea>
                        <button onClick={handleSend} disabled={isLoading || (!input && files.length === 0)} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            <i className="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. MODALS (Tuto & Settings) */}
            {showTutorial && <TutorialModal onClose={() => { localStorage.setItem('agent_ia_tuto_done', 'true'); setShowTutorial(false); }} />}
            
            {showSettings && (
                <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-sm p-6 rounded-2xl shadow-2xl modal-content">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white"><i className="fa-solid fa-gear mr-2 text-slate-500"></i>Paramètres</h2>
                            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><i className="fa-solid fa-times"></i></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 block">Clé API Google Gemini</label>
                                <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('agent_ia_apikey', e.target.value); }} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none font-mono text-xs" placeholder="AIzaSy..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 block">Modèle IA</label>
                                <select value={model} onChange={e => { setModel(e.target.value); localStorage.setItem('agent_ia_model', e.target.value); }} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none text-sm">
                                    <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Expérimental)</option>
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rapide)</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Puissant)</option>
                                </select>
                            </div>
                            <div className="pt-4 border-t border-slate-800 text-center">
                                <p className="text-[10px] text-slate-600">Agent System V6 • Local Database</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Montage React
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
