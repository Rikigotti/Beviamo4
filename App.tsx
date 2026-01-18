
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
  getWorkspaceId,
  syncWithCloud,
  pushToCloud,
  exportDatabase,
  importDatabase
} from './dbService';
import { 
  CheckIcon, 
  CameraIcon, 
  RefreshIcon, 
  TrashIcon, 
  SearchIcon,
  AlertIcon
} from './Icons';

const App: React.FC = () => {
  // --- Auth & Cloud State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('beviamo_auth_v1') === 'true');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  
  // --- App State ---
  const [intervention, setIntervention] = useState<Intervention>(loadCurrentDraft());
  const [history, setHistory] = useState<Intervention[]>(loadHistory());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyTab, setHistoryTab] = useState<'global' | 'specific'>('global');
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
    
    if (isAuthenticated && navigator.onLine) {
      handleCloudSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) saveCurrentDraft(intervention);
  }, [intervention, isAuthenticated]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Cloud Handlers ---
  const handleCloudSync = async () => {
    setIsSyncing(true);
    const result = await syncWithCloud();
    setIsSyncing(false);
    if (result.success) {
      setHistory(loadHistory());
      setLastSyncTime(Date.now());
      if (result.added > 0) {
        setToast({ message: `Aggiornato! ${result.added} nuovi interventi dal cloud.`, type: 'success' });
      }
    }
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
      setToast({ message: 'Seleziona un Punto Acqua.', type: 'error' });
      return;
    }
    setIsSyncing(true);
    const syncedIntervention = { ...intervention, syncStatus: SyncStatus.SYNCED };
    const success = await pushToCloud(syncedIntervention);
    setIsSyncing(false);
    if (success) {
      setHistory(loadHistory());
      handleNewIntervention();
      setToast({ message: 'Intervento salvato e sincronizzato!', type: 'success' });
    } else {
      setToast({ message: 'Errore sincronizzazione cloud.', type: 'error' });
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
      setToast({ message: "PIN errato", type: "error" });
    }
  };

  const filteredCasette = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return CASETTE_MOCK.filter(c => c.nome.toLowerCase().includes(lower) || c.comune.toLowerCase().includes(lower) || c.id.toLowerCase().includes(lower));
  }, [searchTerm]);

  const specificHistory = useMemo(() => {
    return history.filter(h => h.casettaId === intervention.casettaId);
  }, [history, intervention.casettaId]);

  const lastSyncString = useMemo(() => {
    if (!lastSyncTime) return 'Mai';
    return new Date(lastSyncTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }, [lastSyncTime]);

  const checklistSections = [
    { title: 'Sicurezza e Pre-Intervento', items: ['sec1_dpi', 'sec1_area', 'sec1_ele', 'sec1_press'], labels: ['DPI', 'Area Sicura', 'Elettricità', 'Pressione'] },
    { title: 'Involucro e Pulizia', items: ['sec2_clean', 'sec2_seal', 'sec2_cond'], labels: ['Pulizia', 'Guarnizioni', 'Condensa'] },
    { title: 'Impianto Idraulico', items: ['sec3_pipe', 'sec3_valve', 'sec3_reg'], labels: ['Tubi', 'Valvole', 'Riduttore'] }
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-beviamo-dark">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-white/10 backdrop-blur-xl p-10 rounded-4xl border border-white/10 text-center">
          <h1 className="text-3xl font-bold text-white mb-8">BEVIAMO<span className="text-beviamo-accent">.TECH</span></h1>
          <div className="space-y-4">
            <input name="techId" className="w-full bg-white/5 border border-white/20 rounded-2xl px-6 py-4 text-white outline-none focus:border-beviamo-accent" placeholder="ID UTENTE (TECH01)" />
            <input name="pin" type="password" className="w-full bg-white/5 border border-white/20 rounded-2xl px-6 py-4 text-white outline-none focus:border-beviamo-accent" placeholder="PIN (2025)" />
            <button type="submit" className="w-full py-5 rounded-2xl beviamo-gradient text-white font-bold uppercase tracking-widest shadow-xl">Accedi al Sistema</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-44">
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-[100] border-b border-beviamo-primary/10 px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 beviamo-gradient rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24"><path d="M12 21.5c-4.4 0-8-3.6-8-8 0-4.1 4.3-9.5 7.1-12.2.5-.5 1.3-.5 1.8 0 2.8 2.7 7.1 8.1 7.1 12.2 0 4.4-3.6 8-8 8z"/></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-beviamo-dark leading-none">BEVIAMO<span className="text-beviamo-primary">.NET</span></h1>
              <p className="text-[9px] font-bold text-beviamo-primary/60 uppercase tracking-widest mt-1">Connesso al Cloud</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <button 
                onClick={() => { setHistoryTab('global'); setShowHistoryPanel(true); }} 
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-beviamo-dark text-white font-bold text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
             >
                <RefreshIcon size={14} /> <span>Storico Team</span>
                <span className="bg-beviamo-accent text-beviamo-dark px-1.5 py-0.5 rounded-md text-[9px]">{history.length}</span>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8 relative z-10">
        
        {/* 1. SELEZIONE PUNTO ACQUA */}
        <div className="beviamo-card rounded-4xl p-6 md:p-10 relative z-[200]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-beviamo-dark uppercase tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-beviamo-primary/10 text-beviamo-primary flex items-center justify-center text-sm">01</span> 
              Scegli Impianto
            </h2>
          </div>
          <div className="relative">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-beviamo-primary/40"><SearchIcon size={28} /></div>
            <input 
              type="text" 
              className="w-full pl-16 pr-6 py-6 rounded-3xl beviamo-input text-xl font-bold outline-none shadow-sm" 
              placeholder="Cerca sede..." 
              value={searchTerm || (intervention.casettaId ? intervention.casettaLabel : '')} 
              onChange={(e) => { setSearchTerm(e.target.value); setShowSearchDropdown(true); if (intervention.casettaId) updateIntervention({ casettaId: '', casettaLabel: '' }); }} 
              onFocus={() => setShowSearchDropdown(true)} 
            />
            {showSearchDropdown && searchTerm && (
              <div className="absolute top-[calc(100%+12px)] left-0 w-full bg-white border border-beviamo-primary/10 rounded-3xl shadow-[0_25px_70px_rgba(0,58,117,0.25)] z-[999] max-h-[350px] overflow-y-auto p-2">
                {filteredCasette.map(c => (
                  <button key={c.id} className="w-full text-left px-6 py-5 rounded-2xl border-b border-slate-50 last:border-0 hover:bg-beviamo-light transition-all group flex justify-between items-center" onClick={() => handleCasettaSelect(c)}>
                    <div>
                      <span className="block font-bold text-beviamo-dark text-lg group-hover:text-beviamo-primary transition-colors">{c.nome}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{c.comune}</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-beviamo-primary"><CheckIcon size={24}/></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {intervention.casettaId && (
            <div className="mt-8 pt-8 border-t border-slate-100 animate-in slide-in-from-top-4">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Ultimi interventi sede</h3>
                  <button 
                    onClick={() => { setHistoryTab('specific'); setShowHistoryPanel(true); }} 
                    className="text-beviamo-primary font-black text-[10px] uppercase tracking-widest hover:underline"
                  >
                    Vedi Tutto →
                  </button>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {specificHistory.length > 0 ? specificHistory.slice(0, 2).map(h => (
                    <div key={h.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-start gap-3">
                       <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${h.tipoIntervento === InterventionType.GUASTO ? 'bg-red-500' : 'bg-beviamo-primary'}`}></div>
                       <div>
                          <p className="text-[12px] font-bold text-beviamo-dark leading-tight line-clamp-2">"{h.note}"</p>
                          <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 block">{new Date(h.createdAt).toLocaleDateString()}</span>
                       </div>
                    </div>
                  )) : (
                    <div className="col-span-2 py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nessun intervento registrato</p>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>

        {/* 2. TIPO INTERVENTO */}
        <div className="beviamo-card rounded-4xl p-8 md:p-10">
          <h2 className="text-xl font-bold text-beviamo-dark uppercase tracking-tight mb-8 flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-beviamo-primary/10 text-beviamo-primary flex items-center justify-center text-sm">02</span> 
            Tipo Intervento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[InterventionType.MANUTENZIONE_ORDINARIA, InterventionType.GUASTO, InterventionType.ALTRO].map((type) => (
              <button key={type} onClick={() => updateIntervention({ tipoIntervento: type })} className={`py-8 px-4 rounded-[2rem] border-2 font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 flex flex-col items-center gap-3 ${intervention.tipoIntervento === type ? 'border-beviamo-primary bg-beviamo-primary text-white shadow-2xl shadow-beviamo-primary/30' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-beviamo-primary/20 hover:bg-white'}`}>
                {type === InterventionType.GUASTO && <AlertIcon size={24}/>}
                {type === InterventionType.MANUTENZIONE_ORDINARIA && <CheckIcon size={24}/>}
                {type === InterventionType.ALTRO && <SearchIcon size={24}/>}
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* 3. DETTAGLI */}
        {(intervention.tipoIntervento === InterventionType.GUASTO || intervention.tipoIntervento === InterventionType.ALTRO) && (
          <div className={`beviamo-card rounded-4xl p-8 md:p-10 border-2 animate-in duration-300 ${intervention.tipoIntervento === InterventionType.GUASTO ? 'border-red-200' : 'border-beviamo-primary/10'}`}>
            <h2 className={`${intervention.tipoIntervento === InterventionType.GUASTO ? 'text-red-600' : 'text-beviamo-dark'} font-black text-[11px] uppercase tracking-[0.3em] mb-6`}>
               Descrizione Dettagliata
            </h2>
            <textarea 
              className="w-full bg-slate-50/50 p-8 rounded-3xl border-2 border-transparent focus:bg-white focus:border-beviamo-primary text-xl font-bold min-h-[300px] outline-none shadow-inner resize-none transition-all placeholder:text-slate-300" 
              placeholder="Inserisci dettagli tecnici dell'operazione..." 
              value={intervention.note} 
              onChange={(e) => updateIntervention({ note: e.target.value })} 
            />
          </div>
        )}

        {/* 4. PROTOCOLLO */}
        {intervention.tipoIntervento === InterventionType.MANUTENZIONE_ORDINARIA && (
          <div className="beviamo-card rounded-4xl overflow-hidden shadow-2xl animate-in fade-in duration-500 border border-beviamo-primary/5">
            <div className="beviamo-gradient px-10 py-8 text-white font-black uppercase tracking-[0.2em] flex justify-between items-center">
               <div className="flex flex-col">
                  <span className="text-xl">Protocollo Manutenzione</span>
                  <span className="text-[10px] text-white/60 font-medium">Versione 2025.01</span>
               </div>
               <CheckIcon size={32}/>
            </div>
            <div className="p-8 md:p-12 space-y-12 bg-white">
              {checklistSections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-6">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                     <span className="w-1.5 h-6 bg-beviamo-primary rounded-full"></span>
                     {section.title}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.items.map((itemId, iIdx) => (
                      <button key={itemId} onClick={() => handleChecklistCheck(itemId)} className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all active:scale-95 ${intervention.checklist?.checks[itemId] ? 'border-beviamo-primary bg-beviamo-light/30 text-beviamo-primary' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-beviamo-primary/10 hover:bg-white'}`}>
                        <span className="text-[11px] font-black uppercase tracking-wider">{section.labels[iIdx]}</span>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${intervention.checklist?.checks[itemId] ? 'bg-beviamo-primary text-white scale-110 shadow-lg' : 'bg-slate-200 text-transparent'}`}><CheckIcon size={18} /></div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. MEDIA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          <div className="beviamo-card rounded-4xl p-8 md:p-10 space-y-8">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Foto Intervento</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <label className="aspect-square rounded-[2rem] border-2 border-dashed border-beviamo-primary/20 bg-beviamo-light/20 flex flex-col items-center justify-center text-beviamo-primary cursor-pointer hover:bg-beviamo-light/40 transition-all active:scale-95">
                <CameraIcon size={48}/>
                <span className="text-[9px] font-bold uppercase mt-2">Scatta</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
              {intervention.fotos.map(f => (
                <div key={f.id} className="relative aspect-square rounded-[2rem] overflow-hidden group border border-slate-100 shadow-sm">
                  <img src={f.dataUrl} className="w-full h-full object-cover" onClick={() => setFullScreenImage(f.dataUrl)}/>
                  <button onClick={() => updateIntervention({ fotos: intervention.fotos.filter(p => p.id !== f.id) })} className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-xl"><TrashIcon size={18}/></button>
                </div>
              ))}
            </div>
          </div>
          <div className="beviamo-card rounded-4xl p-8 md:p-10 flex flex-col gap-6">
             <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Note Finali</h2>
             <textarea 
               className="flex-grow w-full bg-slate-50/50 p-8 rounded-3xl border-2 border-transparent focus:bg-white focus:border-beviamo-primary text-lg font-bold text-beviamo-dark placeholder:text-slate-300 outline-none shadow-inner resize-none transition-all" 
               placeholder="Eventuali commenti aggiuntivi..." 
               value={intervention.note} 
               onChange={(e) => updateIntervention({ note: e.target.value })} 
             />
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-4xl z-[150]">
        <div className="bg-beviamo-dark/95 backdrop-blur-3xl rounded-[2.5rem] p-5 flex flex-col sm:flex-row items-center justify-between gap-5 border border-white/10 shadow-2xl">
          <div className="hidden sm:flex flex-col ml-6 text-white">
            <span className="text-[10px] font-black text-beviamo-accent uppercase tracking-[0.4em]">Sincronizzato</span>
            <span className="text-[12px] font-bold opacity-60 mt-1">{lastSyncString}</span>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button onClick={handleNewIntervention} className="flex-1 sm:flex-none px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-[11px] uppercase tracking-widest active:scale-95">Reset</button>
            <button 
              onClick={handleSync} 
              disabled={isSyncing} 
              className={`flex-[2] sm:flex-none px-16 py-6 rounded-3xl font-black text-[13px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 ${isSyncing ? 'bg-slate-700 text-white' : 'bg-beviamo-primary text-white shadow-2xl active:scale-95'}`}
            >
              {isSyncing ? <div className="w-6 h-6 border-4 border-t-white border-white/20 rounded-full animate-spin"></div> : <span>Invia Report</span>}
            </button>
          </div>
        </div>
      </footer>

      {/* STORICO */}
      {showHistoryPanel && (
        <div className="fixed inset-0 z-[500] flex justify-end">
          <div className="absolute inset-0 bg-beviamo-dark/60 backdrop-blur-sm" onClick={() => setShowHistoryPanel(false)} />
          <aside className="relative w-full max-w-xl bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="beviamo-gradient px-10 py-10 text-white shadow-xl">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Archivio Interventi</h2>
              <p className="text-white/70 text-[11px] font-bold uppercase tracking-[0.4em] mt-1">Dati Globali Team</p>
            </div>

            <div className="bg-slate-50 border-b border-slate-200 p-6">
              <div className="flex bg-slate-200/50 p-1.5 rounded-2xl">
                 <button 
                    onClick={() => setHistoryTab('global')}
                    className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${historyTab === 'global' ? 'bg-white text-beviamo-dark shadow-md' : 'text-slate-500'}`}
                 >
                    Tutto il Team
                 </button>
                 <button 
                    disabled={!intervention.casettaId}
                    onClick={() => setHistoryTab('specific')}
                    className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${!intervention.casettaId ? 'opacity-30' : ''} ${historyTab === 'specific' ? 'bg-white text-beviamo-dark shadow-md' : 'text-slate-500'}`}
                 >
                    Sede Selezionata
                 </button>
              </div>
            </div>
            
            <div className="flex-grow overflow-y-auto p-8 space-y-10">
              <section className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                   <h3 className="text-[11px] font-black text-beviamo-dark uppercase tracking-[0.3em]">
                      {historyTab === 'global' ? 'Attività Recente' : `Cronologia sede`}
                   </h3>
                   <span className="text-[9px] font-black text-beviamo-primary uppercase bg-beviamo-light px-3 py-1.5 rounded-xl">
                      {historyTab === 'global' ? history.length : specificHistory.length} Record
                   </span>
                </div>

                <div className="space-y-4">
                  {(historyTab === 'global' ? history : specificHistory).length > 0 ? (historyTab === 'global' ? history : specificHistory).map((h) => (
                    <div key={h.id} onClick={() => setSelectedHistoryItem(h)} className="p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-beviamo-primary cursor-pointer transition-all hover:shadow-xl active:scale-95">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(h.createdAt).toLocaleDateString()}</span>
                        <span className={`text-[9px] font-black px-3 py-1 rounded-xl uppercase ${h.tipoIntervento === InterventionType.GUASTO ? 'bg-red-50 text-red-600' : 'bg-beviamo-light text-beviamo-primary'}`}>{h.tipoIntervento}</span>
                      </div>
                      <p className="text-[10px] font-black text-beviamo-primary uppercase mb-2 tracking-widest">{h.casettaId}</p>
                      <p className="text-[14px] font-bold text-slate-700 line-clamp-2 italic leading-relaxed">"{h.note || 'Senza note'}"</p>
                    </div>
                  )) : (
                    <div className="text-center py-20 bg-slate-50 rounded-4xl border-2 border-dashed border-slate-200">
                       <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Nessun dato presente</p>
                    </div>
                  )}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { const url = exportDatabase(); const a = document.createElement('a'); a.href = url; a.download = 'backup.json'; a.click(); }} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl text-[10px] font-black text-slate-500 uppercase flex flex-col items-center gap-3 hover:text-beviamo-primary transition-all"><TrashIcon size={20}/> Backup</button>
                <button onClick={() => fileInputRef.current?.click()} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl text-[10px] font-black text-slate-500 uppercase flex flex-col items-center gap-3 hover:text-beviamo-primary transition-all"><RefreshIcon size={20}/> Importa</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => { const reader = new FileReader(); reader.onload = (ev) => { const res = importDatabase(ev.target?.result as string); if(res.success) setHistory(loadHistory()); }; reader.readAsText(e.target.files![0]); }} />
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* DETTAGLIO */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-beviamo-dark/95 backdrop-blur-xl" onClick={() => setSelectedHistoryItem(null)}>
          <div className="w-full max-w-2xl bg-white rounded-[3rem] p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-black text-beviamo-dark uppercase">Scheda Report</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Ref: {selectedHistoryItem.id.slice(0,8)}</p>
              </div>
              <span className={`px-5 py-2.5 rounded-2xl font-black text-[11px] uppercase ${selectedHistoryItem.tipoIntervento === InterventionType.GUASTO ? 'bg-red-50 text-red-600' : 'bg-beviamo-light text-beviamo-primary'}`}>{selectedHistoryItem.tipoIntervento}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
               <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100"><span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Data</span><span className="font-bold text-beviamo-dark">{new Date(selectedHistoryItem.createdAt).toLocaleDateString()}</span></div>
               <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100"><span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sede</span><span className="font-bold text-beviamo-dark">{selectedHistoryItem.casettaId}</span></div>
            </div>

            <div className="p-8 bg-beviamo-light/20 rounded-[2rem] mb-10 border border-beviamo-primary/5">
              <span className="block text-[9px] font-black text-beviamo-primary uppercase mb-4">Dettagli Tecnici</span>
              <p className="text-xl font-bold text-slate-700 italic leading-relaxed">"{selectedHistoryItem.note || 'Dettaglio non inserito'}"</p>
            </div>

            <button onClick={() => setSelectedHistoryItem(null)} className="w-full py-6 bg-beviamo-dark text-white rounded-3xl font-black uppercase text-[12px] shadow-xl active:scale-95 transition-all">Chiudi Report</button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[1000] px-10 py-5 rounded-3xl shadow-2xl text-white font-black text-[11px] uppercase tracking-[0.2em] border-2 ${toast.type === 'success' ? 'bg-beviamo-primary border-beviamo-accent' : toast.type === 'error' ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400'}`}>
          {toast.message}
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 bg-black/98 z-[1100] flex items-center justify-center p-10" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="max-w-full max-h-full rounded-[2.5rem] object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );
};

export default App;
