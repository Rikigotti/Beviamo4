
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Intervention, 
  InterventionType, 
  SyncStatus, 
  Casetta, 
  PhotoData
} from './types';
import { 
  CASETTE_MOCK 
} from './constants';
import { 
  loadCurrentDraft, 
  saveCurrentDraft, 
  loadHistory,
  createNewIntervention,
  clearCurrentDraft,
  exportDatabase,
  importDatabase,
  getWorkspaceId,
  setWorkspaceId,
  syncWithCloud,
  pushToCloud
} from './dbService';
import { 
  CheckIcon, 
  CameraIcon, 
  RefreshIcon, 
  TrashIcon, 
  SearchIcon
} from './Icons';

const App: React.FC = () => {
  // --- Auth & Cloud State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('beviamo_auth_v1') === 'true');
  const [workspaceKey, setWorkspaceKey] = useState(getWorkspaceId());
  
  // --- App State ---
  const [intervention, setIntervention] = useState<Intervention>(loadCurrentDraft());
  const [history, setHistory] = useState<Intervention[]>(loadHistory());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Intervention | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Auto-sync all'avvio se abbiamo una chiave
    if (workspaceKey && isOnline) {
      handleCloudSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) saveCurrentDraft(intervention);
  }, [intervention, isAuthenticated]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Cloud Handlers ---
  const handleCloudSync = async () => {
    if (!workspaceKey) {
      setToast({ message: "Configura una chiave di team per sincronizzare", type: "info" });
      return;
    }
    setIsSyncing(true);
    const result = await syncWithCloud();
    setIsSyncing(false);
    if (result.success) {
      setHistory(loadHistory());
      if (result.added > 0) {
        setToast({ message: `Sincronizzato! Ricevuti ${result.added} nuovi interventi dal team.`, type: 'success' });
      }
    } else {
      setToast({ message: "Errore di sincronizzazione cloud", type: "error" });
    }
  };

  const handleSaveWorkspaceKey = () => {
    setWorkspaceId(workspaceKey);
    setToast({ message: "Chiave del team salvata!", type: "success" });
    handleCloudSync();
  };

  // --- Data Handlers ---
  const updateIntervention = useCallback((updates: Partial<Intervention>) => {
    setIntervention(prev => ({ ...prev, ...updates, updatedAt: Date.now() }));
  }, []);

  const handleChecklistCheck = (id: string) => {
    setIntervention(prev => ({
      ...prev,
      checklist: {
        ...prev.checklist!,
        checks: { ...prev.checklist?.checks, [id]: !prev.checklist?.checks[id] }
      }
    }));
  };

  const handleCasettaSelect = (c: Casetta) => {
    updateIntervention({ casettaId: c.id, casettaLabel: `${c.id} • ${c.nome} (${c.comune})` });
    setSearchTerm('');
    setShowSearchDropdown(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newPhoto: PhotoData = { id: crypto.randomUUID(), dataUrl: reader.result as string, timestamp: Date.now() };
        setIntervention(prev => ({ ...prev, fotos: [...prev.fotos, newPhoto] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSync = async () => {
    if (!intervention.casettaId) {
      setToast({ message: 'Seleziona un Punto Acqua', type: 'error' });
      return;
    }
    setIsSyncing(true);
    
    const syncedIntervention = { ...intervention, syncStatus: SyncStatus.SYNCED };
    const success = await pushToCloud(syncedIntervention);
    
    setIsSyncing(false);
    if (success) {
      setHistory(loadHistory());
      handleNewIntervention();
      setToast({ message: 'Report inviato e sincronizzato con il team!', type: 'success' });
    } else {
      setToast({ message: 'Salvataggio locale OK, errore invio Cloud. Riprova più tardi.', type: 'error' });
    }
  };

  const handleNewIntervention = () => {
    setIntervention(createNewIntervention());
    clearCurrentDraft();
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const tech = (e.target as any).techId.value;
    const pin = (e.target as any).pin.value;
    if (tech.toUpperCase() === 'TECH01' && pin === '2025') {
      setIsAuthenticated(true);
      localStorage.setItem('beviamo_auth_v1', 'true');
      localStorage.setItem('beviamo_tech_name', 'Mario Rossi');
    } else {
      setToast({ message: "Credenziali errate", type: "error" });
    }
  };

  const filteredCasette = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return CASETTE_MOCK.filter(c => c.nome.toLowerCase().includes(lower) || c.comune.toLowerCase().includes(lower) || c.id.toLowerCase().includes(lower));
  }, [searchTerm]);

  const filteredHistory = useMemo(() => {
    if (!intervention.casettaId) return history;
    return history.filter(h => h.casettaId === intervention.casettaId);
  }, [history, intervention.casettaId]);

  const checklistSections = [
    { title: 'Sicurezza e Pre-Intervento', items: ['sec1_dpi', 'sec1_area', 'sec1_ele', 'sec1_press'], labels: ['DPI', 'Sicurezza Area', 'Elettricità', 'Pressione'] },
    { title: 'Involucro', items: ['sec2_clean', 'sec2_seal', 'sec2_cond'], labels: ['Pulizia', 'Guarnizioni', 'Condensa'] },
    { title: 'Idraulica', items: ['sec3_pipe', 'sec3_valve', 'sec3_reg'], labels: ['Tubi', 'Valvole', 'Riduttore'] }
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-beviamo-dark">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-white/10 backdrop-blur-xl p-10 rounded-4xl border border-white/10 text-center">
          <h1 className="text-3xl font-bold text-white mb-8">BEVIAMO<span className="text-beviamo-accent">.TECH</span></h1>
          <div className="space-y-4">
            <input name="techId" className="w-full bg-white/5 border border-white/20 rounded-2xl px-6 py-4 text-white outline-none focus:border-beviamo-accent" placeholder="ID Tecnico (TECH01)" />
            <input name="pin" type="password" className="w-full bg-white/5 border border-white/20 rounded-2xl px-6 py-4 text-white outline-none focus:border-beviamo-accent" placeholder="PIN (2025)" />
            <button type="submit" className="w-full py-5 rounded-2xl beviamo-gradient text-white font-bold uppercase tracking-widest shadow-xl">Accedi</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-40">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-[100] border-b border-beviamo-primary/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 beviamo-gradient rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24"><path d="M12 21.5c-4.4 0-8-3.6-8-8 0-4.1 4.3-9.5 7.1-12.2.5-.5 1.3-.5 1.8 0 2.8 2.7 7.1 8.1 7.1 12.2 0 4.4-3.6 8-8 8z"/></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-beviamo-dark leading-none">BEVIAMO<span className="text-beviamo-primary">.NET</span></h1>
              <p className="text-[9px] font-bold text-beviamo-primary/60 uppercase tracking-widest">Team Sync Active</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={handleCloudSync} className={`p-2.5 rounded-xl transition-all ${isSyncing ? 'animate-spin text-beviamo-primary' : 'text-slate-400'}`}>
                <RefreshIcon size={20} />
             </button>
             <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold border flex items-center gap-2 ${workspaceKey ? 'bg-green-50 border-green-200 text-green-600' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
               <span className={`w-1.5 h-1.5 rounded-full ${workspaceKey ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></span>
               {workspaceKey ? 'SYNC ON' : 'SYNC OFF'}
             </div>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 relative z-10">
        {/* Punto Acqua */}
        <div className="beviamo-card rounded-4xl p-6 md:p-8 relative z-[200] overflow-visible">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-beviamo-dark uppercase">1. Punto Acqua</h2>
            <button onClick={() => setShowHistoryPanel(true)} className="p-2 rounded-full bg-beviamo-light text-beviamo-primary"><RefreshIcon size={18}/></button>
          </div>
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-beviamo-primary/30"><SearchIcon size={22} /></div>
            <input type="text" className="w-full pl-14 pr-6 py-5 rounded-3xl beviamo-input text-lg font-semibold outline-none" placeholder="Cerca impianto..." value={searchTerm || (intervention.casettaId ? intervention.casettaLabel : '')} onChange={(e) => { setSearchTerm(e.target.value); setShowSearchDropdown(true); if (intervention.casettaId) updateIntervention({ casettaId: '', casettaLabel: '' }); }} onFocus={() => setShowSearchDropdown(true)} />
            {showSearchDropdown && searchTerm && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-beviamo-primary/10 rounded-3xl shadow-2xl z-[999] max-h-60 overflow-y-auto">
                {filteredCasette.map(c => (
                  <button key={c.id} className="w-full text-left px-6 py-4 border-b border-slate-50 hover:bg-beviamo-light" onClick={() => handleCasettaSelect(c)}>
                    <span className="block font-bold text-beviamo-dark">{c.nome}</span>
                    <span className="text-xs text-slate-400">{c.comune}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tipo Intervento */}
        <div className="beviamo-card rounded-4xl p-8">
          <h2 className="text-lg font-bold text-beviamo-dark uppercase mb-6">2. Tipo Intervento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[InterventionType.MANUTENZIONE_ORDINARIA, InterventionType.GUASTO, InterventionType.ALTRO].map((type) => (
              <button key={type} onClick={() => updateIntervention({ tipoIntervento: type })} className={`py-5 px-4 rounded-3xl border-2 font-bold text-[10px] uppercase tracking-widest transition-all ${intervention.tipoIntervento === type ? 'border-beviamo-primary bg-beviamo-primary text-white shadow-lg' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>{type}</button>
            ))}
          </div>
        </div>

        {/* Note Speciali se Guasto */}
        {(intervention.tipoIntervento === InterventionType.GUASTO) && (
          <div className="beviamo-card rounded-4xl p-8 border-2 border-red-100 animate-in slide-in-from-top-4">
            <h2 className="text-red-600 font-bold uppercase mb-4">Dettagli Guasto Urgente</h2>
            <textarea className="w-full bg-red-50/50 p-6 rounded-3xl border-2 border-transparent focus:bg-white focus:border-red-500 text-base font-semibold min-h-[300px] outline-none" placeholder="Descrivi il problema riscontrato..." value={intervention.note} onChange={(e) => updateIntervention({ note: e.target.value })} />
          </div>
        )}

        {/* Checklist */}
        {intervention.tipoIntervento === InterventionType.MANUTENZIONE_ORDINARIA && (
          <div className="beviamo-card rounded-4xl overflow-hidden shadow-xl">
            <div className="beviamo-gradient px-8 py-6 text-white font-bold uppercase tracking-widest">Protocollo Ordinario</div>
            <div className="p-8 space-y-8">
              {checklistSections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{section.title}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {section.items.map((itemId, iIdx) => (
                      <button key={itemId} onClick={() => handleChecklistCheck(itemId)} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${intervention.checklist?.checks[itemId] ? 'border-beviamo-primary bg-beviamo-light text-beviamo-primary' : 'border-slate-100 text-slate-500'}`}>
                        <span className="text-[10px] font-bold uppercase">{section.labels[iIdx]}</span>
                        <CheckIcon size={16} className={intervention.checklist?.checks[itemId] ? 'opacity-100' : 'opacity-20'} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Foto */}
        <div className="beviamo-card rounded-4xl p-8">
          <h2 className="text-lg font-bold text-beviamo-dark uppercase mb-6">3. Documentazione Foto</h2>
          <div className="grid grid-cols-3 gap-4">
            <label className="aspect-square rounded-3xl border-2 border-dashed border-beviamo-primary/20 bg-beviamo-light/30 flex flex-col items-center justify-center text-beviamo-primary cursor-pointer hover:bg-beviamo-light/50 transition-all"><CameraIcon size={32}/><input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} /></label>
            {intervention.fotos.map(f => (
              <div key={f.id} className="relative aspect-square rounded-3xl overflow-hidden group">
                <img src={f.dataUrl} className="w-full h-full object-cover" onClick={() => setFullScreenImage(f.dataUrl)}/>
                <button onClick={() => updateIntervention({ fotos: intervention.fotos.filter(p => p.id !== f.id) })} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer Sync */}
      <footer className="fixed bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-4xl z-[150]">
        <div className="bg-beviamo-dark/95 backdrop-blur-2xl rounded-[2.5rem] p-4 flex items-center justify-between border border-white/10 shadow-2xl">
          <div className="hidden sm:flex flex-col ml-6 text-white">
            <span className="text-[9px] font-bold text-beviamo-accent uppercase tracking-widest">Shared Workspace</span>
            <span className="text-[11px] font-medium opacity-60">{workspaceKey || 'Nessun Cloud configurato'}</span>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={handleNewIntervention} className="flex-1 sm:flex-none px-8 py-5 rounded-3xl bg-white/5 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Annulla</button>
            <button onClick={handleSync} disabled={isSyncing} className={`flex-[2] sm:flex-none px-12 py-5 rounded-3xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${isSyncing ? 'bg-slate-700 text-white' : 'bg-beviamo-primary text-white shadow-xl shadow-beviamo-primary/30'}`}>
              {isSyncing ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin"></div> : "Invia & Sincronizza"}
            </button>
          </div>
        </div>
      </footer>

      {/* History & Cloud Settings Panel */}
      {showHistoryPanel && (
        <div className="fixed inset-0 z-[500] flex justify-end">
          <div className="absolute inset-0 bg-beviamo-dark/40 backdrop-blur-sm" onClick={() => setShowHistoryPanel(false)} />
          <aside className="relative w-full max-w-lg bg-white h-full shadow-2xl animate-in slide-in-from-right flex flex-col">
            <div className="beviamo-gradient px-8 py-10 text-white">
              <h2 className="text-2xl font-bold uppercase">Gestione Team</h2>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">Sincronizzazione Cloud</p>
            </div>
            
            <div className="flex-grow overflow-y-auto p-8 space-y-8">
              {/* Cloud Settings */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Impostazioni Cloud</h3>
                <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium italic">Inserisci la chiave condivisa con i tuoi colleghi (max 5 utenti suggeriti).</p>
                  <input value={workspaceKey} onChange={(e) => setWorkspaceKey(e.target.value.toUpperCase())} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 font-bold text-beviamo-dark focus:border-beviamo-primary outline-none" placeholder="Esempio: TEAM-NORD-2025" />
                  <button onClick={handleSaveWorkspaceKey} className="w-full py-3 bg-beviamo-dark text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest">Salva Chiave</button>
                </div>
              </div>

              {/* Data Tools */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { const url = exportDatabase(); const a = document.createElement('a'); a.href = url; a.download = 'backup.json'; a.click(); }} className="p-4 bg-slate-100 rounded-2xl text-[10px] font-bold text-slate-600 uppercase flex flex-col items-center gap-2"><TrashIcon size={18}/> Backup Locale</button>
                <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-slate-100 rounded-2xl text-[10px] font-bold text-slate-600 uppercase flex flex-col items-center gap-2"><RefreshIcon size={18}/> Importa JSON</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => { const reader = new FileReader(); reader.onload = (ev) => { const res = importDatabase(ev.target?.result as string); if(res.success) setHistory(loadHistory()); }; reader.readAsText(e.target.files![0]); }} />
              </div>

              {/* History List */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ultimi Interventi Team</h3>
                <div className="space-y-3">
                  {filteredHistory.length > 0 ? filteredHistory.map((h) => (
                    <div key={h.id} onClick={() => setSelectedHistoryItem(h)} className="p-5 bg-white border border-slate-100 rounded-3xl hover:border-beviamo-primary cursor-pointer transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(h.createdAt).toLocaleDateString()}</span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${h.tipoIntervento === InterventionType.GUASTO ? 'bg-red-50 text-red-600' : 'bg-beviamo-light text-beviamo-primary'}`}>{h.tipoIntervento}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-relaxed">"{h.note || 'Nessuna nota'}"</p>
                    </div>
                  )) : <div className="text-center py-10 opacity-30 text-[10px] font-bold uppercase">Nessuna attività cloud</div>}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {selectedHistoryItem && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-beviamo-dark/80 backdrop-blur-md" onClick={() => setSelectedHistoryItem(null)}>
          <div className="w-full max-w-2xl bg-white rounded-4xl p-8 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-beviamo-dark mb-2">Dettaglio Intervento</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Report ID: {selectedHistoryItem.id.slice(0,8)}</p>
            <div className="p-6 bg-slate-50 rounded-3xl mb-8">
              <p className="text-sm font-semibold text-slate-700 italic">"{selectedHistoryItem.note}"</p>
            </div>
            <button onClick={() => setSelectedHistoryItem(null)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-[10px] tracking-widest">Chiudi</button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[1000] px-8 py-4 rounded-3xl shadow-2xl text-white font-bold text-[10px] uppercase tracking-widest animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-beviamo-primary' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
          {toast.message}
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 bg-black/95 z-[1100] flex items-center justify-center p-6" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="max-w-full max-h-full rounded-3xl object-contain" />
        </div>
      )}
    </div>
  );
};

export default App;
