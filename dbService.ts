
import { Intervention, SyncStatus, InterventionType } from './types';
import { STORAGE_KEY_CURRENT, STORAGE_KEY_HISTORY, INITIAL_HISTORY_MOCK } from './constants';

// --- CONFIGURAZIONE CLOUD FISSA ---
const PANTRY_ID = '72c36691-6674-4b47-9f44-8456f947a164'; 
const BASE_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket`;
const DEFAULT_WORKSPACE = 'beviamo_main_workspace'; 

export const getWorkspaceId = () => DEFAULT_WORKSPACE;

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

export const loadHistory = (): Intervention[] => {
  const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { console.error(e); }
  }
  return INITIAL_HISTORY_MOCK;
};

export const syncWithCloud = async (): Promise<{ success: boolean; added: number }> => {
  const workspaceId = getWorkspaceId();

  try {
    const response = await fetch(`${BASE_URL}/${workspaceId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        await pushFullHistoryToCloud();
        return { success: true, added: 0 };
      }
      throw new Error('Errore rete');
    }

    const cloudData = await response.json();
    const cloudHistory: Intervention[] = cloudData.history || [];
    
    const localHistory = loadHistory();
    const localIds = new Set(localHistory.map(h => h.id));
    
    const newFromCloud = cloudHistory.filter(h => !localIds.has(h.id));
    
    // Unione dati: preferenza cloud per duplicati, mantenimento locali nuovi
    if (newFromCloud.length > 0) {
      const merged = [...newFromCloud, ...localHistory].sort((a, b) => b.createdAt - a.createdAt);
      // Rimuovi eventuali duplicati residui per sicurezza
      const uniqueMerged = Array.from(new Map(merged.map(item => [item.id, item])).values());
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(uniqueMerged));
    }

    // Se abbiamo dati locali che il cloud non ha, forziamo un push di aggiornamento
    const cloudIds = new Set(cloudHistory.map(h => h.id));
    const onlyLocal = localHistory.filter(h => !cloudIds.has(h.id));
    if (onlyLocal.length > 0) {
      await pushFullHistoryToCloud();
    }

    return { success: true, added: newFromCloud.length };
  } catch (e) {
    console.error('Sync Error:', e);
    return { success: false, added: 0 };
  }
};

export const pushFullHistoryToCloud = async (): Promise<boolean> => {
  const workspaceId = getWorkspaceId();
  try {
    const history = loadHistory();
    await fetch(`${BASE_URL}/${workspaceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history,
        lastUpdate: Date.now(),
        updatedBy: localStorage.getItem('beviamo_tech_name') || 'Unknown'
      })
    });
    return true;
  } catch (e) {
    console.error('Push Error:', e);
    return false;
  }
};

export const pushToCloud = async (intervention: Intervention): Promise<boolean> => {
  // Prima di inviare, proviamo a sincronizzare per non perdere dati altrui
  await syncWithCloud();
  
  const history = loadHistory();
  const updated = [intervention, ...history];
  const uniqueUpdated = Array.from(new Map(updated.map(item => [item.id, item])).values());
  
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(uniqueUpdated));
  return await pushFullHistoryToCloud();
};

export const clearCurrentDraft = () => localStorage.removeItem(STORAGE_KEY_CURRENT);

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

// Fix: Explicitly use window.Blob to ensure the native constructor is utilized
export const exportDatabase = () => {
  const data = { history: loadHistory(), exportDate: Date.now() };
  const blob = new window.Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
