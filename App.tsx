
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  loadSyncQueue, 
  saveSyncQueue, 
  loadHistory,
  addToHistory,
  createNewIntervention,
  clearCurrentDraft 
} from './dbService';
import { 
  CheckIcon, 
  AlertIcon, 
  CameraIcon, 
  RefreshIcon, 
  TrashIcon, 
  SearchIcon
} from './Icons';

const App: React.FC = () => {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('beviamo_auth_v1') === 'true';
  });
  const [loginForm, setLoginForm] = useState({ techId: '', pin: '' });
  const [loginError, setLoginError] = useState('');

  // --- App State ---
  const [intervention, setIntervention] = useState<Intervention>(loadCurrentDraft());
  const [syncQueue, setSyncQueue] = useState<Intervention[]>(loadSyncQueue());
  const [history, setHistory] = useState<Intervention[]>(loadHistory());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Intervention | null>(null);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      saveCurrentDraft(intervention);
      setLastAutoSave(Date.now());
    }
  }, [intervention, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      saveSyncQueue(syncQueue);
    }
  }, [syncQueue, isAuthenticated]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Auth Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.techId.toUpperCase() === 'TECH01' && loginForm.pin === '2025') {
      setIsAuthenticated(true);
      localStorage.setItem('beviamo_auth_v1', 'true');
      localStorage.setItem('beviamo_tech_name', 'Mario Rossi');
      setLoginError('');
    } else {
      setLoginError('Credenziali non valide. Riprova.');
    }
  };

  const handleLogout = () => {
    if (confirm('Sicuro di voler chiudere la sessione tecnica?')) {
      setIsAuthenticated(false);
      localStorage.removeItem('beviamo_auth_v1');
      localStorage.removeItem('beviamo_tech_name');
    }
  };

  // --- Data Handlers ---
  const updateIntervention = useCallback((updates: Partial<Intervention>) => {
    setIntervention(prev => ({
      ...prev,
      ...updates,
      updatedAt: Date.now()
    }));
  }, []);

  const handleChecklistCheck = (id: string) => {
    setIntervention(prev => ({
      ...prev,
      checklist: {
        ...prev.checklist!,
        checks: {
          ...prev.checklist?.checks,
          [id]: !prev.checklist?.checks[id]
        }
      }
    }));
  };

  const handleCasettaSelect = (c: Casetta) => {
    updateIntervention({
      casettaId: c.id,
      casettaLabel: `${c.id} • ${c.nome} (${c.comune})`
    });
    setSearchTerm('');
    setShowSearchDropdown(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newPhoto: PhotoData = {
          id: crypto.randomUUID(),
          dataUrl: reader.result as string,
          timestamp: Date.now()
        };
        setIntervention(prev => ({
          ...prev,
          fotos: [...prev.fotos, newPhoto]
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (id: string) => {
    updateIntervention({
      fotos: intervention.fotos.filter(f => f.id !== id)
    });
  };

  const handleSync = async () => {
    if (!intervention.casettaId) {
      setToast({ message: 'Seleziona prima un Punto Acqua', type: 'error' });
      return;
    }
    setIsSyncing(true);
    setTimeout(() => {
      const synced = { ...intervention, syncStatus: SyncStatus.SYNCED };
      addToHistory(synced);
      setHistory(loadHistory());
      setIsSyncing(false);
      handleNewIntervention();
      setToast({ message: 'Report inviato correttamente!', type: 'success' });
    }, 1200);
  };

  const handleNewIntervention = () => {
    setIntervention(createNewIntervention());
    clearCurrentDraft();
    setLastAutoSave(Date.now());
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredCasette = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return CASETTE_MOCK.filter(c => 
      c.nome.toLowerCase().includes(lower) || 
      c.comune.toLowerCase().includes(lower) || 
      c.id.toLowerCase().includes(lower)
    );
  }, [searchTerm]);

  const lastAutoSaveString = useMemo(() => {
    if (!lastAutoSave) return null;
    return new Date(lastAutoSave).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }, [lastAutoSave]);

  const filteredHistory = useMemo(() => {
    if (!intervention.casettaId) return [];
    return history.filter(h => h.casettaId === intervention.casettaId);
  }, [history, intervention.casettaId]);

  const checklistSections = [
    { title: 'Sicurezza e Pre-Intervento', items: ['sec1_dpi', 'sec1_area', 'sec1_ele', 'sec1_press', 'sec1_leak'], labels: ['DPI indossati', 'Area in sicurezza', 'Alimentazione disatt.', 'Pressione scaricata', 'Assenza perdite pre'] },
    { title: 'Struttura e Involucro', items: ['sec2_state', 'sec2_clean', 'sec2_seal', 'sec2_cond', 'sec2_vent'], labels: ['Stato generale', 'Pulizia int/est', 'Guarnizioni porte', 'Assenza condensa', 'Griglie/Filtri aria'] },
    { title: 'Impianto Idraulico', items: ['sec3_pipe', 'sec3_joint', 'sec3_work_press', 'sec3_valve', 'sec3_reg'], labels: ['Controllo tubazioni', 'Verifica raccordi', 'Pressione esercizio', 'Elettrovalvole', 'Riduttore press.'] }
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-beviamo-dark">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-beviamo-primary/20 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-beviamo-accent/20 blur-[100px] animate-pulse delay-700"></div>
        <div className="w-full max-w-md bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-700">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 beviamo-gradient rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 shadow-beviamo-primary/40">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-white fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21.5c-4.4 0-8-3.6-8-8 0-4.1 4.3-9.5 7.1-12.2.5-.5 1.3-.5 1.8 0 2.8 2.7 7.1 8.1 7.1 12.2 0 4.4-3.6 8-8 8zm0-17.7C9.3 6.9 6 11.2 6 13.5c0 3.3 2.7 6 6 6s6-2.7 6-6c0-2.3-3.3-6.6-6-9.7z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-semibold text-white tracking-tighter uppercase">BEVIAMO<span className="text-beviamo-accent">.TECH</span></h1>
            <p className="text-white/50 text-[10px] font-medium tracking-[0.4em] uppercase mt-2">Accesso Riservato Tecnici</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-white/40 uppercase tracking-widest ml-1">ID Matricola</label>
              <input type="text" className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-medium focus:border-beviamo-accent focus:bg-white/10 outline-none transition-all" placeholder="TECH01" value={loginForm.techId} onChange={(e) => setLoginForm({...loginForm, techId: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-white/40 uppercase tracking-widest ml-1">PIN Segreto</label>
              <input type="password" className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-medium focus:border-beviamo-accent focus:bg-white/10 outline-none transition-all" placeholder="••••" value={loginForm.pin} onChange={(e) => setLoginForm({...loginForm, pin: e.target.value})} />
            </div>
            {loginError && <p className="text-red-400 text-xs font-medium text-center animate-pulse">{loginError}</p>}
            <button type="submit" className="w-full py-5 rounded-2xl beviamo-gradient text-white font-semibold text-xs tracking-[0.3em] uppercase shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Accedi</button>
          </form>
          <p className="text-center text-white/20 text-[9px] mt-10 font-medium tracking-widest uppercase">© 2025 Beviamo.net</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-40">
      <header className="bg-white/70 backdrop-blur-md sticky top-0 z-[100] border-b border-beviamo-primary/10 shadow-sm px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 beviamo-gradient rounded-full flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.5c-4.4 0-8-3.6-8-8 0-4.1 4.3-9.5 7.1-12.2.5-.5 1.3-.5 1.8 0 2.8 2.7 7.1 8.1 7.1 12.2 0 4.4-3.6 8-8 8zm0-17.7C9.3 6.9 6 11.2 6 13.5c0 3.3 2.7 6 6 6s6-2.7 6-6c0-2.3-3.3-6.6-6-9.7z"/></svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-semibold text-beviamo-dark tracking-tighter uppercase leading-tight">BEVIAMO<span className="text-beviamo-primary">.NET</span></h1>
              <p className="text-[9px] font-medium text-beviamo-primary/60 uppercase tracking-[0.2em] leading-none">Gestione Tecnica</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-[10px] font-semibold text-beviamo-dark uppercase">{localStorage.getItem('beviamo_tech_name')}</span>
                <span className="text-[8px] text-slate-400 font-medium uppercase tracking-widest">Matricola: TECH01</span>
             </div>
             <button onClick={handleLogout} className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all border border-slate-200"><TrashIcon size={18} /></button>
             <div className={`px-3 py-1.5 rounded-full text-[10px] font-medium border flex items-center gap-2 transition-all ${isOnline ? 'bg-beviamo-light/50 border-beviamo-primary/20 text-beviamo-primary' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
               <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-beviamo-primary animate-pulse' : 'bg-orange-500'}`}></span>
               {isOnline ? 'ONLINE' : 'OFFLINE'}
             </div>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 relative z-10">
        <div className="beviamo-card rounded-4xl p-6 md:p-8 relative z-[200] overflow-visible">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="bg-beviamo-primary text-white text-[10px] font-medium px-2 py-1 rounded">FASE 1</span>
              <h2 className="text-lg font-semibold text-beviamo-dark uppercase tracking-tight">Punto Acqua</h2>
            </div>
            {intervention.casettaId && (
              <button onClick={() => setShowHistoryPanel(true)} className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-beviamo-light border border-beviamo-primary/20 text-beviamo-primary font-medium text-[10px] tracking-widest hover:bg-beviamo-primary hover:text-white transition-all uppercase shadow-sm">
                <RefreshIcon size={14} /> Storico
              </button>
            )}
          </div>
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-beviamo-primary/40 pointer-events-none z-[201]"><SearchIcon size={22} /></div>
            <input type="text" className="w-full pl-14 pr-6 py-5 rounded-3xl beviamo-input text-lg font-medium outline-none shadow-inner" placeholder="Cerca Punto Acqua..." value={searchTerm || (intervention.casettaId ? intervention.casettaLabel : '')} onChange={(e) => { setSearchTerm(e.target.value); setShowSearchDropdown(true); if (intervention.casettaId) updateIntervention({ casettaId: '', casettaLabel: '' }); }} onFocus={() => setShowSearchDropdown(true)} />
            {showSearchDropdown && searchTerm && (
              <div className="absolute top-[calc(100%+12px)] left-0 w-full bg-white border border-beviamo-primary/10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,58,117,0.3)] z-[999] max-h-[350px] overflow-y-auto animate-in fade-in slide-in-from-top-4">
                {filteredCasette.map(c => (
                  <button key={c.id} className="w-full text-left px-6 py-5 border-b border-slate-50 last:border-0 hover:bg-beviamo-light transition-colors group flex items-center justify-between" onClick={() => handleCasettaSelect(c)}>
                    <div>
                      <span className="block font-medium text-beviamo-dark group-hover:text-beviamo-primary">{c.nome}</span>
                      <span className="text-xs font-medium text-slate-400">{c.comune} • {c.id}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-slate-100 flex items-center justify-center text-beviamo-primary opacity-0 group-hover:opacity-100 transition-all"><CheckIcon size={16}/></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="beviamo-card rounded-4xl p-6 md:p-8 relative z-30">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-beviamo-primary text-white text-[10px] font-medium px-2 py-1 rounded">FASE 2</span>
            <h2 className="text-lg font-semibold text-beviamo-dark uppercase tracking-tight">Tipo Intervento</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[InterventionType.MANUTENZIONE_ORDINARIA, InterventionType.GUASTO, InterventionType.ALTRO].map((type) => (
              <button key={type} onClick={() => updateIntervention({ tipoIntervento: type })} className={`py-5 px-4 rounded-3xl border-2 font-medium text-[10px] tracking-widest transition-all active:scale-95 shadow-sm ${intervention.tipoIntervento === type ? 'border-beviamo-primary bg-beviamo-primary text-white shadow-beviamo-primary/20' : 'border-slate-50 bg-slate-50/50 text-slate-400 hover:border-beviamo-primary/20'}`}>
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {(intervention.tipoIntervento === InterventionType.GUASTO || intervention.tipoIntervento === InterventionType.ALTRO) && (
          <div className="beviamo-card rounded-4xl p-8 animate-in fade-in slide-in-from-top-6 duration-500 border-2 border-beviamo-primary/20">
            <div className="flex items-center gap-3 mb-6">
              <span className={`text-white text-[10px] font-bold px-2 py-1 rounded ${intervention.tipoIntervento === InterventionType.GUASTO ? 'bg-red-500 shadow-lg shadow-red-200' : 'bg-beviamo-primary shadow-lg shadow-blue-200'}`}>
                {intervention.tipoIntervento === InterventionType.GUASTO ? 'INTERVENTO URGENTE' : 'DETTAGLI INTERVENTO'}
              </span>
              <h2 className="text-lg font-semibold text-beviamo-dark uppercase tracking-tight">{intervention.tipoIntervento === InterventionType.GUASTO ? 'Rapporto Guasto' : 'Note Speciali'}</h2>
            </div>
            <textarea className="w-full bg-slate-50 p-6 rounded-3xl border-2 border-transparent focus:bg-white focus:border-beviamo-primary text-base font-medium text-beviamo-dark placeholder:text-slate-300 transition-all resize-none outline-none shadow-inner min-h-[400px]" placeholder={intervention.tipoIntervento === InterventionType.GUASTO ? "Descrivi il guasto, i componenti sostituiti e i test effettuati..." : "Specifica l'intervento effettuato..."} value={intervention.note} onChange={(e) => updateIntervention({ note: e.target.value })} />
          </div>
        )}

        {intervention.tipoIntervento === InterventionType.MANUTENZIONE_ORDINARIA && (
          <div className="beviamo-card rounded-4xl overflow-hidden animate-in fade-in zoom-in-[0.98] duration-500">
            <div className="beviamo-gradient px-8 py-6 flex justify-between items-center text-white"><h3 className="font-semibold text-xl uppercase tracking-tight">Protocollo Manutenzione</h3><CheckIcon size={24}/></div>
            <div className="p-4 md:p-8 space-y-12 bg-white">
              {checklistSections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-6">
                  <h4 className="text-beviamo-dark font-semibold text-[11px] uppercase tracking-widest border-l-4 border-beviamo-primary pl-4">{section.title}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 rounded-3xl overflow-hidden border">
                    {section.items.map((itemId, iIdx) => (
                      <button key={itemId} onClick={() => handleChecklistCheck(itemId)} className={`flex items-center justify-between p-5 bg-white hover:bg-beviamo-light/20 transition-all ${intervention.checklist?.checks[itemId] ? 'bg-beviamo-light/10' : ''}`}>
                        <span className={`text-[11px] font-medium uppercase ${intervention.checklist?.checks[itemId] ? 'text-beviamo-primary' : 'text-slate-500'}`}>{section.labels[iIdx]}</span>
                        <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${intervention.checklist?.checks[itemId] ? 'bg-beviamo-primary border-beviamo-primary text-white scale-110' : 'border-slate-200 bg-slate-50'}`}>{intervention.checklist?.checks[itemId] && <CheckIcon size={14}/>}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="beviamo-card rounded-4xl p-8 space-y-6">
            <h3 className="text-beviamo-dark font-semibold text-[11px] uppercase tracking-widest">Foto Intervento</h3>
            <div className="grid grid-cols-3 gap-3">
              <label className="aspect-square rounded-3xl border-2 border-dashed border-beviamo-primary/20 bg-beviamo-light/30 flex flex-col items-center justify-center text-beviamo-primary cursor-pointer hover:bg-beviamo-light/50 transition-all"><CameraIcon size={32}/><input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} /></label>
              {intervention.fotos.map(f => (
                <div key={f.id} className="relative aspect-square rounded-3xl overflow-hidden border border-slate-100 group"><img src={f.dataUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" onClick={() => setFullScreenImage(f.dataUrl)}/><button onClick={() => removePhoto(f.id)} className="absolute inset-0 bg-red-600/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon size={20}/></button></div>
              ))}
            </div>
          </div>
          <div className="beviamo-card rounded-4xl p-8 flex flex-col gap-6">
             <h3 className="text-beviamo-dark font-semibold text-[11px] uppercase tracking-widest">Note Operative</h3>
             <textarea className="flex-grow w-full bg-slate-50 p-6 rounded-3xl border-2 border-transparent focus:bg-white focus:border-beviamo-primary text-[13px] font-medium text-beviamo-dark placeholder:text-slate-300 outline-none shadow-inner resize-none" placeholder="Commenti finali..." value={intervention.note} onChange={(e) => updateIntervention({ note: e.target.value })} />
          </div>
        </div>
      </main>

      <footer className="fixed bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-4xl z-[150]">
        <div className="bg-beviamo-dark/90 backdrop-blur-2xl rounded-[2.5rem] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/10 shadow-2xl">
          <div className="hidden sm:flex flex-col ml-4"><span className="text-white/40 text-[9px] font-medium uppercase tracking-widest">Cloud Sync</span><span className="text-beviamo-accent text-[11px] font-semibold mt-1">Aggiornato: {lastAutoSaveString || '...'}</span></div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={handleNewIntervention} className="px-8 py-4 rounded-3xl bg-white/5 border border-white/10 text-white font-semibold text-[10px] tracking-widest uppercase hover:bg-white/10 transition-all">Nuovo</button>
            <button onClick={handleSync} disabled={isSyncing} className={`flex-grow sm:flex-grow-0 px-10 py-5 rounded-3xl font-bold text-[11px] tracking-[0.2em] uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${isSyncing ? 'bg-slate-700 text-white/50' : 'bg-beviamo-primary text-white shadow-beviamo-primary/30'}`}>{isSyncing ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin"></div> : <span>Invia Report</span>}</button>
          </div>
        </div>
      </footer>

      {showHistoryPanel && (
        <div className="fixed inset-0 z-[500] flex justify-end">
          <div className="absolute inset-0 bg-beviamo-dark/40 backdrop-blur-sm" onClick={() => setShowHistoryPanel(false)} />
          <aside className="relative w-full max-w-lg bg-white h-full shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
            <div className="beviamo-gradient px-8 py-10 text-white">
              <h2 className="text-2xl font-semibold uppercase">Storico Punto Acqua</h2>
              <p className="text-white/60 font-medium text-[10px] tracking-widest uppercase mt-1">{intervention.casettaLabel}</p>
            </div>
            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              {filteredHistory.length > 0 ? filteredHistory.map((h) => (
                <button key={h.id} onClick={() => setSelectedHistoryItem(h)} className="w-full text-left p-6 rounded-3xl border border-slate-100 bg-slate-50 hover:bg-beviamo-light/30 transition-all">
                  <div className="flex justify-between items-start mb-3"><span className="text-[10px] font-medium text-slate-400">{new Date(h.createdAt).toLocaleDateString('it-IT')}</span><span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${h.tipoIntervento === InterventionType.GUASTO ? 'bg-red-50 text-red-600' : 'bg-beviamo-light text-beviamo-primary'}`}>{h.tipoIntervento}</span></div>
                  <p className="text-[13px] font-medium text-slate-700 italic line-clamp-2">"{h.note}"</p>
                </button>
              )) : <div className="text-center py-20 opacity-30 text-xs font-semibold uppercase">Nessun dato storico</div>}
            </div>
          </aside>
        </div>
      )}

      {selectedHistoryItem && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-beviamo-dark/80 backdrop-blur-md" onClick={() => setSelectedHistoryItem(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-4xl shadow-2xl overflow-hidden p-8">
            <h3 className="text-xl font-bold uppercase mb-4">Dettaglio Report Storico</h3>
            <p className="text-sm text-slate-600 mb-6 italic leading-relaxed">"{selectedHistoryItem.note}"</p>
            <button onClick={() => setSelectedHistoryItem(null)} className="w-full py-4 rounded-2xl bg-slate-100 font-bold text-[10px] tracking-widest uppercase text-slate-500">Chiudi</button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[700] px-8 py-4 rounded-3xl shadow-2xl border-2 flex items-center gap-4 text-white font-bold text-[10px] uppercase tracking-widest ${toast.type === 'success' ? 'bg-beviamo-primary/95 border-beviamo-accent' : 'bg-red-600/95 border-red-400'}`}>
          <CheckIcon size={14}/> {toast.message}
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 bg-beviamo-dark/95 z-[800] flex items-center justify-center p-6" onClick={() => setFullScreenImage(null)}><img src={fullScreenImage} className="max-w-full max-h-full rounded-3xl object-contain" /></div>
      )}
    </div>
  );
};

export default App;
