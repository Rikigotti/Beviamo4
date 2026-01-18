
import { Intervention, SyncStatus, InterventionType } from './types';
import { STORAGE_KEY_CURRENT, STORAGE_KEY_QUEUE, STORAGE_KEY_HISTORY, INITIAL_HISTORY_MOCK } from './constants';

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

export const saveCurrentDraft = (intervention: Intervention) => {
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(intervention));
};

export const loadCurrentDraft = (): Intervention => {
  const saved = localStorage.getItem(STORAGE_KEY_CURRENT);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.checklist) {
        parsed.checklist = { checks: {}, notes: {} };
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse draft', e);
    }
  }
  return createNewIntervention();
};

export const saveSyncQueue = (queue: Intervention[]) => {
  localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
};

export const loadSyncQueue = (): Intervention[] => {
  const saved = localStorage.getItem(STORAGE_KEY_QUEUE);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse queue', e);
    }
  }
  return [];
};

export const loadHistory = (): Intervention[] => {
  const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse history', e);
    }
  }
  return INITIAL_HISTORY_MOCK;
};

export const addToHistory = (intervention: Intervention) => {
  const history = loadHistory();
  const updatedHistory = [intervention, ...history];
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedHistory));
};

export const clearCurrentDraft = () => {
  localStorage.removeItem(STORAGE_KEY_CURRENT);
};
