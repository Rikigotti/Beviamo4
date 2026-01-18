
import { Casetta, Intervention, InterventionType, SyncStatus } from './types';

export const CASETTE_MOCK: Casetta[] = [
  { id: 'CA-001', nome: 'Piazza Martiri', comune: 'Biella', indirizzo: 'Piazza Martiri della Libertà' },
  { id: 'CA-002', nome: 'Via Roma', comune: 'Vercelli', indirizzo: 'Via Roma, 42' },
  { id: 'CA-003', nome: 'Parco Europa', comune: 'Novara', indirizzo: 'Viale Kennedy' },
  { id: 'CA-004', nome: 'Fontana Blu', comune: 'Aosta', indirizzo: 'Piazza Chanoux' },
  { id: 'CA-005', nome: 'Eco Water 1', comune: 'Torino', indirizzo: 'Corso Francia, 120' },
  { id: 'CA-006', nome: 'Fonte Chiara', comune: 'Ivrea', indirizzo: 'Via Arduino' },
  { id: 'CA-007', nome: 'Acqua Nuova', comune: 'Milano', indirizzo: 'Via Dante' },
  { id: 'CA-008', nome: 'Sorgente Viva', comune: 'Como', indirizzo: 'Lungolago Mafalda di Savoia' },
];

export const STORAGE_KEY_CURRENT = 'interventi_casetta_current_v1';
export const STORAGE_KEY_QUEUE = 'interventi_casetta_queue_v1';
export const STORAGE_KEY_HISTORY = 'interventi_casetta_history_v1';

// Initial Mock History for demonstration
export const INITIAL_HISTORY_MOCK: Intervention[] = [
  {
    id: 'h1',
    casettaId: 'CA-001',
    casettaLabel: 'CA-001 • Piazza Martiri (Biella)',
    tipoIntervento: InterventionType.MANUTENZIONE_ORDINARIA,
    note: 'Sostituzione filtri carbone e sanificazione completa. Portata ripristinata a 2.5L/min.',
    fotos: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
    syncStatus: SyncStatus.SYNCED
  },
  {
    id: 'h2',
    casettaId: 'CA-001',
    casettaLabel: 'CA-001 • Piazza Martiri (Biella)',
    tipoIntervento: InterventionType.GUASTO,
    note: 'Riparazione perdita raccordi ingresso riduttore CO2. Sostituita guarnizione.',
    fotos: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15, // 15 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
    syncStatus: SyncStatus.SYNCED
  },
  {
    id: 'h3',
    casettaId: 'CA-002',
    casettaLabel: 'CA-002 • Via Roma (Vercelli)',
    tipoIntervento: InterventionType.MANUTENZIONE_ORDINARIA,
    note: 'Manutenzione programmata. Pulizia ugelli e test refrigerazione OK.',
    fotos: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 45, // 45 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 45,
    syncStatus: SyncStatus.SYNCED
  }
];
