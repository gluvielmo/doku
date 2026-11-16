"use client";

// Background sync: pull everything on start/focus/online, push local changes
// debounced, and listen for realtime changes from other devices.
// Conflicts resolve per game by updatedAt (the upsert_game RPC refuses older writes).

import { useSyncExternalStore } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import type { GameRecord } from "@/lib/game/types";
import { applyRemote, clearGames, getAllRecords, getOwner, setLocalChangeHandler, setOwner } from "@/lib/store";
import { getSupabase } from "./client";

export type SyncStatus = "local" | "signedOut" | "syncing" | "synced" | "offline" | "error";

interface SyncState {
  status: SyncStatus;
  email: string | null;
  lastSyncedAt: number | null;
  error: string | null;
}

let state: SyncState = { status: "local", email: null, lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let channel: RealtimeChannel | null = null;
let userId: string | null = null;
let started = false;

interface Row {
  id: string;
  data: GameRecord;
  updated_at: number;
}

async function pushNow() {
  const sb = getSupabase();
  if (!sb || !userId || !pending.size) return;
  if (!navigator.onLine) return set({ status: "offline" });
  const ids = [...pending];
  pending.clear();
  const byId = new Map(getAllRecords().map((r) => [r.id, r]));
  set({ status: "syncing" });
  try {
    for (const id of ids) {
      const rec = byId.get(id);
      if (!rec) continue;
      const { error } = await sb.rpc("upsert_game", { p_id: rec.id, p_data: rec, p_updated_at: rec.updatedAt });
      if (error) throw error;
    }
    set({ status: "synced", lastSyncedAt: Date.now(), error: null });
  } catch (e) {
    ids.forEach((id) => pending.add(id));
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
  }
}

function schedulePush(id: string) {
  pending.add(id);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(pushNow, 1200);
}

export async function syncAll() {
  const sb = getSupabase();
  if (!sb || !userId) return;
  if (!navigator.onLine) return set({ status: "offline" });
  set({ status: "syncing" });
  const { data, error } = await sb.from("games").select("id, data, updated_at");
  if (error) return set({ status: "error", error: error.message });
  const remote = new Map((data as Row[]).map((r) => [r.id, r]));
  for (const row of remote.values()) applyRemote(row.data);
  for (const rec of getAllRecords()) {
    const r = remote.get(rec.id);
    if (!r || r.updated_at < rec.updatedAt) pending.add(rec.id);
  }
  if (pending.size) await pushNow();
  else set({ status: "synced", lastSyncedAt: Date.now(), error: null });
}

function subscribeRealtime() {
  const sb = getSupabase();
  if (!sb || !userId) return;
  channel?.unsubscribe();
  channel = sb
    .channel(`games:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `user_id=eq.${userId}` }, (payload) => {
      const row = payload.new as Partial<Row>;
      if (row?.data) applyRemote(row.data);
    })
    .subscribe();
}

async function onSession(session: Session | null) {
  const nextUser = session?.user.id ?? null;
  if (nextUser === userId) return;
  userId = nextUser;
  if (!userId) {
    channel?.unsubscribe();
    channel = null;
    return set({ status: "signedOut", email: null });
  }
  // Games on this device that belong to a different account must not be uploaded into this one.
  // They're safe in that account's cloud copy. Games played signed out (no owner) are kept and
  // join this account, so progress made before the first sign-in isn't lost.
  const owner = getOwner();
  if (owner && owner !== userId) {
    pending.clear();
    clearGames();
  }
  setOwner(userId);
  set({ email: session!.user.email ?? null });
  subscribeRealtime();
  await syncAll();
}

/** Idempotent: wires the store to Supabase. Call once from the app shell. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  const sb = getSupabase();
  if (!sb) return set({ status: "local" });
  set({ status: "signedOut" });
  setLocalChangeHandler((rec) => schedulePush(rec.id));
  sb.auth.getSession().then(({ data }) => onSession(data.session));
  sb.auth.onAuthStateChange((_event, session) => {
    void onSession(session);
  });
  const resync = () => {
    if (document.visibilityState === "visible") void syncAll();
  };
  window.addEventListener("focus", resync);
  document.addEventListener("visibilitychange", resync);
  window.addEventListener("online", () => void syncAll());
  window.addEventListener("offline", () => set({ status: "offline" }));
  window.addEventListener("pagehide", () => void pushNow());
}

export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) throw new Error("Sync is not configured");
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    // Always show Google's account picker, so a second account can be chosen.
    options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}

export async function sendLoginCode(email: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Sync is not configured");
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function verifyLoginCode(email: string, token: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Sync is not configured");
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

/**
 * Signs out and removes this account's games from the device; they stay in the cloud and come back
 * on the next sign-in. If unsynced changes can't be uploaded (offline), the games are kept, still
 * tied to this account, so nothing is lost and nothing leaks into another account.
 */
export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  if (flushTimer) clearTimeout(flushTimer);
  await pushNow();
  await sb.auth.signOut();
  if (!pending.size) {
    clearGames();
    setOwner(null);
  }
}

/** Permanently deletes the signed-in account and its synced games, then signs out. Local progress stays. */
export async function deleteAccount() {
  const sb = getSupabase();
  if (!sb) throw new Error("Sync is not configured");
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw new Error(`Couldn't delete the account: ${error.message}`);
  // Local progress stays on the device, no longer tied to any account.
  pending.clear();
  setOwner(null);
  await sb.auth.signOut({ scope: "local" });
}

export async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => state,
  );
}
