
export enum InterventionType {
  MANUTENZIONE_ORDINARIA = 'Manutenzione Ordinaria',
  GUASTO = 'Guasto',
  ALTRO = 'Altro'
}

export enum SyncStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  SYNCED = 'synced',
  ERROR = 'error'
}

export interface PhotoData {
  id: string;
  dataUrl: string; // Base64 or local blob URL
  timestamp: number;
}

export interface Casetta {
  id: string;
  nome: string;
  comune: string;
  indirizzo: string;
}

export interface ChecklistData {
  checks: Record<string, boolean>;
  notes: Record<string, string>;
}

export interface Intervention {
  id: string;
  casettaId: string;
  casettaLabel: string;
  tipoIntervento: InterventionType;
  altroSpecifica?: string;
  note: string;
  fotos: PhotoData[];
  checklist?: ChecklistData;
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  syncErrorMessage?: string;
}

export interface AppState {
  currentIntervention: Intervention;
  syncQueue: Intervention[];
  isOnline: boolean;
  isSyncing: boolean;
  lastAutoSave: number | null;
}
