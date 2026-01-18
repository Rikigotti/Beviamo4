
import { Intervention, SyncStatus, InterventionType } from './types';
import { STORAGE_KEY_CURRENT, STORAGE_KEY_HISTORY, INITIAL_HISTORY_MOCK } from './constants';

// --- CONFIGURAZIONE CLOUD PUBBLICA ---
// Utilizziamo Pantry.dev, un servizio gratuito per piccoli database JSON.
// Questo Pantry ID è pubblico per la tua app. I "baskets" saranno le tue Workspace Key.
const PANTRY_ID = '72c36691-6674-4b47-9f44-8456f947a164'; 
const BASE_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket`;

const CLOUD_STORAGE_KEY = 'beviamo_cloud_workspace_id';

export const getWorkspaceId = () => localStorage.getItem(CLOUD_STORAGE_KEY) || '';
export const setWorkspaceId = (id: string) => {
  const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '_'); // Pantry accetta solo certi caratteri
  localStorage.setItem(CLOUD_STORAGE_KEY, sanitizedId);
};

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

/**
 * SINCRONIZZAZIONE REALE CON IL CLOUD
 * Scarica i dati dal "basket" corrispondente alla Workspace Key e li unisce a quelli locali.
 */
export const syncWithCloud = async (): Promise<{ success: boolean; added: number }> => {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) return { success: false, added: 0 };

  try {
    const response = await fetch(`${BASE_URL}/${workspaceId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Il basket non esiste ancora, lo creiamo inviando i dati locali attuali
        await pushFullHistoryToCloud();
        return { success: true, added: 0 };
      }
      throw new Error('Errore rete');
    }

    const cloudData = await response.json();
    const cloudHistory: Intervention[] = cloudData.history || [];
    
    const localHistory = loadHistory();
    const localIds = new Set(localHistory.map(h => h.id));
    
    // Trova gli interventi nel cloud che non abbiamo localmente
    const newFromCloud = cloudHistory.filter(h => !localIds.has(h.id));
    
    if (newFromCloud.length > 0) {
      const merged = [...newFromCloud, ...localHistory].sort((a, b) => b.createdAt - a.createdAt);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
    }

    // Se noi abbiamo dati che il cloud non ha, aggiorniamo il cloud
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

/**
 * Carica l'intera cronologia locale sul Cloud (sovrascrive il basket)
 */
export const pushFullHistoryToCloud = async (): Promise<boolean> => {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) return false;

  try {
    const history = loadHistory();
    await fetch(`${BASE_URL}/${workspaceId}`, {
      method: 'POST', // POST su Pantry crea o aggiorna completamente il basket
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

/**
 * Invia un singolo intervento: prima lo salva localmente, poi aggiorna il cloud
 */
export const pushToCloud = async (intervention: Intervention): Promise<boolean> => {
  // 1. Salvataggio Locale (Offline First)
  const history = loadHistory();
  const updated = [intervention, ...history];
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));

  // 2. Sincronizzazione Cloud
  const workspaceId = getWorkspaceId();
  if (!workspaceId) return true; // Ritorna vero perché localmente è salvato

  return await pushFullHistoryToCloud();
};

export const clearCurrentDraft = () => localStorage.removeItem(STORAGE_KEY_CURRENT);

// Mantengo le altre utility per compatibilità
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
