"use client";

import { DAILY_DIFFICULTIES, generateDaily, type DailyDifficulty } from "@/lib/sudoku/generator";
import { dailyId, newGame, type GameRecord } from "@/lib/game/types";
import { getGame, saveGame } from "@/lib/store";

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function parseDailyId(id: string): { date: string; difficulty: DailyDifficulty } | null {
  const match = /^daily-(\d{4}-\d{2}-\d{2})-(easy|medium|hard)$/.exec(id);
  return match ? { date: match[1], difficulty: match[2] as DailyDifficulty } : null;
}

/** Load a daily game, generating it on first open. */
export function ensureDailyGame(date: string, difficulty: DailyDifficulty): GameRecord {
  const id = dailyId(date, difficulty);
  const existing = getGame(id);
  if (existing) return existing;
  const p = generateDaily(date, difficulty);
  const label = difficulty[0].toUpperCase() + difficulty.slice(1);
  const rec: GameRecord = {
    ...newGame({ id, source: "daily", title: `${label} · ${formatDate(date)}`, difficulty, date, givens: p.puzzle, solution: p.solution }),
    // Timestamp 0 so progress from another device always wins over this blank copy.
    createdAt: 0,
    updatedAt: 0,
  };
  saveGame(rec);
  return rec;
}

export { DAILY_DIFFICULTIES };
