"use client";

// Local-first game store. Every game lives in its own localStorage key so a save
// only rewrites one record. Components subscribe via useGames()/useGame().

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, type GameRecord, type Settings } from "@/lib/game/types";

const GAME_PREFIX = "doku:game:";
const SETTINGS_KEY = "doku:settings";

let games: Map<string, GameRecord> | null = null;
let version = 0;
const listeners = new Set<() => void>();
let onLocalChange: ((rec: GameRecord) => void) | null = null;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function load(): Map<string, GameRecord> {
  if (games) return games;
  games = new Map();
  const ls = storage();
  if (ls) {
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key?.startsWith(GAME_PREFIX)) continue;
      try {
        const rec = JSON.parse(ls.getItem(key)!) as GameRecord;
        games.set(rec.id, rec);
      } catch {
        // ignore corrupt entries
      }
    }
  }
  return games;
}

function write(rec: GameRecord) {
  load().set(rec.id, rec);
  try {
    storage()?.setItem(GAME_PREFIX + rec.id, JSON.stringify(rec));
  } catch (e) {
    console.warn("Could not persist game", e);
  }
  version++;
  listeners.forEach((l) => l());
}

/** Register the sync engine's upload hook. */
export function setLocalChangeHandler(fn: ((rec: GameRecord) => void) | null) {
  onLocalChange = fn;
}

export function getGame(id: string): GameRecord | undefined {
  const rec = load().get(id);
  return rec && !rec.deleted ? rec : undefined;
}

/** All records including deletion tombstones (for sync). */
export function getAllRecords(): GameRecord[] {
  return [...load().values()];
}

export function saveGame(rec: GameRecord) {
  write(rec);
  onLocalChange?.(rec);
}

export function deleteGame(id: string) {
  const rec = load().get(id);
  if (rec) saveGame({ ...rec, deleted: true, thumbnail: undefined, updatedAt: Date.now() });
}

/** Accept a record from another device if it is newer. Returns true if applied. */
export function applyRemote(rec: GameRecord): boolean {
  const local = load().get(rec.id);
  if (local && local.updatedAt >= rec.updatedAt) return false;
  write(rec);
  return true;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let cachedList: { version: number; list: GameRecord[] } = { version: -1, list: [] };
const EMPTY: GameRecord[] = [];

function snapshot(): GameRecord[] {
  if (cachedList.version !== version) {
    cachedList = {
      version,
      list: [...load().values()].filter((g) => !g.deleted).sort((a, b) => b.updatedAt - a.updatedAt),
    };
  }
  return cachedList.list;
}

export function useGames(): GameRecord[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function useGame(id: string): GameRecord | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getGame(id),
    () => undefined,
  );
}

export function loadSettings(): Settings {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // settings are a convenience; ignore
  }
}
