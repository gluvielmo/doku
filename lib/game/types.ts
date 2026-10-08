import type { Difficulty } from "@/lib/sudoku/logic";

export type Layer = "normal" | "corner" | "center" | "color";

/** One cell of player state. Marks and colours are 9-bit masks (bit 0 = digit/colour 1). */
export interface CellState {
  v: number; // placed value, 0 = empty (givens live in GameRecord.givens)
  c: number; // corner marks
  m: number; // centre marks
  k: number; // colours
}

export type GameSource = "daily" | "scan" | "manual";

/** Everything that is persisted and synced for one puzzle. */
export interface GameRecord {
  id: string;
  source: GameSource;
  title: string;
  difficulty: Difficulty | null;
  date?: string; // daily puzzles: YYYY-MM-DD
  givens: string; // 81 chars, "." for empty
  solution: string; // 81 chars
  cells: CellState[];
  elapsedMs: number;
  status: "playing" | "solved";
  hintsUsed: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  thumbnail?: string; // small JPEG data URL for scanned puzzles
}

export interface Settings {
  highlightPeers: boolean;
  highlightSameDigit: boolean;
  showConflicts: boolean;
  showMistakes: boolean;
  autoRemoveNotes: boolean;
  cornerLayout: "grid" | "corners";
  showTimer: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  highlightPeers: true,
  highlightSameDigit: true,
  showConflicts: true,
  showMistakes: false,
  autoRemoveNotes: true,
  cornerLayout: "grid",
  showTimer: true,
  sound: true,
};

export const emptyCells = (): CellState[] => Array.from({ length: 81 }, () => ({ v: 0, c: 0, m: 0, k: 0 }));

export function newGame(init: Omit<GameRecord, "cells" | "elapsedMs" | "status" | "hintsUsed" | "createdAt" | "updatedAt">): GameRecord {
  const now = Date.now();
  return { ...init, cells: emptyCells(), elapsedMs: 0, status: "playing", hintsUsed: 0, createdAt: now, updatedAt: now };
}

export const dailyId = (date: string, difficulty: string) => `daily-${date}-${difficulty}`;

/** Values on the board: givens plus player entries. */
export function boardValues(rec: Pick<GameRecord, "givens" | "cells">): number[] {
  return rec.cells.map((cell, i) => {
    const g = rec.givens[i];
    return g >= "1" && g <= "9" ? Number(g) : cell.v;
  });
}

export const isGiven = (rec: Pick<GameRecord, "givens">, i: number) => rec.givens[i] >= "1" && rec.givens[i] <= "9";

export function progressOf(rec: GameRecord): number {
  const values = boardValues(rec);
  const givens = [...rec.givens].filter((ch) => ch >= "1" && ch <= "9").length;
  const filled = values.filter(Boolean).length;
  return givens === 81 ? 1 : (filled - givens) / (81 - givens);
}
