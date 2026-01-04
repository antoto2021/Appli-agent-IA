const { useState, useEffect, useRef } = React;
const { jsPDF } = window.jspdf;

// --- DB SERVICE (Mémoire) ---
const dbService = {
    dbName: 'AgentSystemDB',
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

// --- TUTORIAL MODAL (Style Engin de Levage) ---
const TutorialModal = ({ onClose }) => {
    const slides = [
        { icon: "fa-robot", title: "Agent System V6", desc: "Bienvenue dans votre nouvelle interface unifiée. PWA, Offline, et Analyse de fichiers." },
        { icon: "fa-key", title: "Configuration", desc: "Cliquez sur la roue crantée pour configurer votre clé API Gemini (Google AI)." },
        { icon: "fa-file-pdf", title: "Analyse Docs", desc: "Glissez un PDF ou CSV dans le chat. L'IA l'analysera instantanément (RAG Local)." },
        { icon: "fa-database", title: "Mémoire Locale", desc: "Tout est stocké dans votre appareil via IndexedDB. Rien n'est perdu si vous quittez." }
    ];
    const [step, setStep] = useState(0);

    return (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
            <div className="bg-white text-slate-800 rounded-2xl shadow-2xl max-w-xs w-full p-6 modal-content text-center relative">
                <button onClick={onClose} className="absolute top-2 right-3 text-slate-300 hover:text-slate-500"><i className="fa-solid fa-times"></i></button>
                
                {/* Icon Circle */}
                <div className="bg-indigo-100 text-indigo-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
                    <i className={`fa-solid ${slides[step].icon}`}></i>
                </div>
                
                <h3 className="text-xl font-bold mb-2 text-slate-800">{slides[step].title}</h3>
                <p className="text-slate-500 text-sm mb-6 h-12 leading-relaxed">{slides[step].desc}</p>
                
                {/* Dots */}
                <div className="flex justify-center gap-1.5 mb-6">
                    {slides.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200'}`}></div>
                    ))}
                </div>

                <button 
                    onClick={() => step < slides.length - 1 ? setStep(step + 1) : onClose()}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                >
                    {step === slides.length - 1 ? "Compris ! ✅" : "Suivant"}
                </button>
            </div>
        </div>
    );
};

// --- APP COMPONENT ---
const App = () => {
    const [messages, setMessages] = useState([{ role: 'system', text: "👋 **Système V6 prêt.**\nImportez un fichier ou posez une question." }]);
    const [input, setInput] = useState("");
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    
    // Config
    const [apiKey, setApiKey] = useState(localStorage.getItem('agent_ia_apikey') || '');
    const [model, setModel] = useState(localStorage.getItem('agent_ia_model') || 'gemini-1.5-flash');

    useEffect(() => {
        dbService.init();
        if (!localStorage.getItem('agent_ia_tuto_done')) setShowTutorial(true);
    }, []);

    // Actions
    const handleRefresh = () => {
        // Animation visuelle puis reload (Style Investissement)
        const btn = document.getElementById('btn-refresh');
        if(btn) btn.classList.add('spin-once');
        setTimeout(() => window.location.reload(), 800);
    };

    const handleSend = async () => {
        if (!input.trim() && files.length === 0) return;
        if (!apiKey) return setShowSettings(true);

        const newMsg = { role: 'user', text: input, files: files.map(f => f.name) };
        const updatedMsgs = [...messages, newMsg];
        setMessages(updatedMsgs);
        setInput("");
        setIsLoading(true);

        // Prepare Prompt
        let fileContext = "";
        if (files.length > 0) fileContext = "\n\n--- FICHIERS ---\n" + files.map(f => `[${f.name}]\n${f.content}`).join("\n\n");
        const fullPrompt = `${input} ${fileContext}`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            
            const aiText = data.candidates[0].content.parts[0].text;
            const finalMsgs = [...updatedMsgs, { role: 'model', text: aiText }];
            setMessages(finalMsgs);
            dbService.saveConversation({ id: Date.now(), title: input.slice(0, 30), messages: finalMsgs, timestamp: Date.now() });
        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', text: `❌ **Erreur:** ${error.message}` }]);
        } finally {
            setIsLoading(false);
            setFiles([]);
        }
    };

    const handleFile = async (e) => {
        const list = Array.from(e.target.files || e.dataTransfer.files);
        const processed = await Promise.all(list.map(f => new Promise(r => {
            const reader = new FileReader();
            reader.onload = (e) => r({ name: f.name, content: e.target.result });
            reader.readAsText(f);
        })));
        setFiles(prev => [...prev, ...processed]);
    };

    return (
        <div className="h-screen flex flex-col relative" onDragOver={e => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFile(e); }}>
            
            {/* --- HEADER --- */}
            <header className="h-16 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between px-4 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <i className="fa-solid fa-robot text-white text-sm"></i>
                    </div>
                    <div>
                        <h1 className="font-bold text-sm tracking-wide text-slate-100">AGENT IA</h1>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> V6.0 ONLINE
                        </div>
                    </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center gap-2">
                    <button id="btn-refresh" onClick={handleRefresh} className="btn-icon" title="Rafraîchir l'application">
                        <i className="fa-solid fa-arrows-rotate"></i>
                    </button>
                    <button onClick={() => setShowTutorial(true)} className="btn-icon" title="Info / Tutoriel">
                        <i className="fa-solid fa-info"></i>
                    </button>
                    <div className="w-px h-6 bg-slate-700 mx-1"></div>
                    <button onClick={() => setShowSettings(true)} className={`btn-icon ${!apiKey ? 'text-red-400 bg-red-400/10 animate-pulse' : ''}`}>
                        <i className="fa-solid fa-gear"></i>
                    </button>
                </div>
            </header>

            {/* --- CHAT --- */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${m.role === 'user' ? 'message-user' : 'message-ai'}`}>
                            <div className="prose prose-invert text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) }}></div>
                            {m.files && m.files.length > 0 && (
                                <div className="mt-2 text-xs opacity-70 border-t border-white/20 pt-1">📎 {m.files.length} fichier(s)</div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && <div className="ml-2 text-indigo-400 text-xs animate-pulse">L'agent réfléchit...</div>}
            </div>

            {/* --- INPUT --- */}
            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#0b1121] via-[#0b1121] to-transparent z-10">
                <div className="max-w-3xl mx-auto glass-panel rounded-2xl p-2 flex flex-col gap-2">
                    {files.length > 0 && (
                        <div className="flex gap-2 px-2 overflow-x-auto pb-1">
                            {files.map((f, i) => <span key={i} className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 truncate max-w-[100px]">{f.name}</span>)}
                        </div>
                    )}
                    <div className="flex items-end gap-2">
                        <label className="p-3 text-slate-400 hover:text-white cursor-pointer transition">
                            <i className="fa-solid fa-paperclip"></i>
                            <input type="file" multiple className="hidden" onChange={handleFile} />
                        </label>
                        <textarea 
                            value={input} onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                            placeholder="Message..."
                            className="flex-1 bg-transparent border-none outline-none text-white resize-none py-3 h-12 max-h-32"
                        ></textarea>
                        <button onClick={handleSend} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition shadow-lg">
                            <i className="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}
            {showTutorial && <TutorialModal onClose={() => { localStorage.setItem('agent_ia_tuto_done', 'true'); setShowTutorial(false); }} />}
            
            {showSettings && (
                <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-sm p-6 rounded-xl shadow-2xl modal-content">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white">Paramètres</h2>
                            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><i className="fa-solid fa-times"></i></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">API Key</label>
                                <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('agent_ia_apikey', e.target.value); }} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Modèle</label>
                                <select value={model} onChange={e => { setModel(e.target.value); localStorage.setItem('agent_ia_model', e.target.value); }} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1">
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rapide)</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Intelligent)</option>
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
