
import { Casetta, Intervention, InterventionType, SyncStatus } from './types';

export const CASETTE_MOCK: Casetta[] = [
  { id: 'CS-01', nome: 'Punto Acqua Sandigliano', comune: 'Sandigliano', indirizzo: 'Centro' },
  { id: 'CS-02', nome: 'Punto Acqua Ponderano', comune: 'Ponderano', indirizzo: 'Centro' },
  { id: 'CS-03', nome: 'Punto Acqua Chiavazza', comune: 'Biella (Chiavazza)', indirizzo: 'Piazza XXV Aprile' },
];

export const STORAGE_KEY_CURRENT = 'interventi_casetta_current_v1';
export const STORAGE_KEY_QUEUE = 'interventi_casetta_queue_v1';
export const STORAGE_KEY_HISTORY = 'interventi_casetta_history_v1';

// Storico iniziale vuoto come richiesto
export const INITIAL_HISTORY_MOCK: Intervention[] = [];
