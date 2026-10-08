"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Null when Supabase isn't configured: the app then runs local-only. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  // PKCE: the OAuth redirect returns ?code=, which supabase-js exchanges and strips on load.
  client ??= createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  return client;
}

export const syncConfigured = Boolean(url && anonKey);
