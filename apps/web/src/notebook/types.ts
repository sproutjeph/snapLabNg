export interface Reading {
  id: string;
  rOhm: number;
  lCm: number;
}

export interface NotebookProps {
  /** What the bench shows now; null while the jockey is up or the key is open. */
  current: { rOhm: number; lCm: number } | null;
  readings: Reading[];
  onRecord(reading: { rOhm: number; lCm: number }): void;
  onDelete(id: string): void;
}
