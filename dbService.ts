
import { Intervention, SyncStatus, InterventionType } from './types';
import { STORAGE_KEY_CURRENT, STORAGE_KEY_QUEUE, STORAGE_KEY_HISTORY, INITIAL_HISTORY_MOCK } from './constants';

// --- CLOUD CONFIG ---
const CLOUD_STORAGE_KEY = 'beviamo_cloud_workspace_id';
// Utilizziamo un servizio pubblico di JSON Bin per la dimostrazione. 
// In produzione, qui andrebbe l'URL del tuo database (Supabase/Firebase).
const MOCK_CLOUD_API = 'https://api.jsonbin.io/v3/b'; 
// Nota: Per un uso reale senza limiti serve una API Key, qui simuliamo il comportamento.

export const getWorkspaceId = () => localStorage.getItem(CLOUD_STORAGE_KEY) || '';
export const setWorkspaceId = (id: string) => localStorage.setItem(CLOUD_STORAGE_KEY, id);

export const createNewIntervention = (): Intervention => ({
  id: crypto.randomUUID(),
  casettaId: '',
  casettaLabel: '',
  tipoIntervento: InterventionType.MANUTENZIONE_ORDINARIA,
  note: '',
  fotos: [],
  checklist: {
    checks: {},
    notes: {}
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  syncStatus: SyncStatus.DRAFT,
});

export const loadCurrentDraft = (): Intervention => {
  const saved = localStorage.getItem(STORAGE_KEY_CURRENT);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.checklist) parsed.checklist = { checks: {}, notes: {} };
      return parsed;
    } catch (e) { console.error(e); }
  }
  return createNewIntervention();
};

export const saveCurrentDraft = (intervention: Intervention) => {
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(intervention));
};

export const loadHistory = (): Intervention[] => {
  const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { console.error(e); }
  }
  return INITIAL_HISTORY_MOCK;
};

/**
 * Funzione di Sincronizzazione Cloud (Smart Merge)
 */
export const syncWithCloud = async (): Promise<{ success: boolean; added: number }> => {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) return { success: false, added: 0 };

  try {
    // In un'app reale, useresti: fetch(`${API_URL}/${workspaceId}`)
    // Qui simuliamo il caricamento cloud recuperando dati che potrebbero essere stati salvati da altri.
    // Per questa demo, usiamo il localStorage come "ponte" ma predisponiamo la logica fetch.
    
    // Simulo un ritardo di rete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const localHistory = loadHistory();
    // Qui andrebbe la logica di ricezione dal server:
    // const cloudHistory = await response.json();
    
    // Per ora torniamo successo per validare la UI
    return { success: true, added: 0 };
  } catch (e) {
    return { success: false, added: 0 };
  }
};

/**
 * Invia un intervento al Cloud
 */
export const pushToCloud = async (intervention: Intervention): Promise<boolean> => {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) return false;

  try {
    // Simulazione invio: fetch(`${API_URL}`, { method: 'POST', body: ... })
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Salvataggio locale immediato per persistenza offline
    const history = loadHistory();
    const updated = [intervention, ...history];
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
    
    return true;
  } catch (e) {
    return false;
  }
};

export const exportDatabase = () => {
  const data = { history: loadHistory(), exportDate: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  return URL.createObjectURL(blob);
};

export const importDatabase = (jsonContent: string): { success: boolean; added: number } => {
  try {
    const imported = JSON.parse(jsonContent);
    const currentHistory = loadHistory();
    const currentIds = new Set(currentHistory.map(h => h.id));
    const newItems = imported.history.filter((h: any) => !currentIds.has(h.id));
    
    if (newItems.length > 0) {
      const merged = [...newItems, ...currentHistory].sort((a, b) => b.createdAt - a.createdAt);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
    }
    return { success: true, added: newItems.length };
  } catch (e) { return { success: false, added: 0 }; }
};

export const clearCurrentDraft = () => localStorage.removeItem(STORAGE_KEY_CURRENT);
