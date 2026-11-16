// Reads a photographed sudoku with Claude vision and returns the givens. The reading itself is in lib/scan/read.ts.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readSudoku, type MediaType } from "@/lib/scan/read";

export const runtime = "nodejs";
export const maxDuration = 120; // two vision passes at most

const MAX_BASE64_LENGTH = 7_000_000; // ~5 MB image
const MEDIA_TYPES: MediaType[] = ["image/jpeg", "image/png", "image/webp"];

const DAILY_LIMIT = Number(process.env.SCAN_DAILY_LIMIT) || 5;

type Access =
  | { ok: true; record: () => Promise<void> }
  | { ok: false; status: number; error: string };

/**
 * Signed-in users get DAILY_LIMIT scans a day (UTC); emails in UNLIMITED_EMAILS have no limit.
 * Only successful scans count. Without Supabase (local-only mode) there are no accounts and no limit.
 */
async function checkAccess(request: Request): Promise<Access> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: true, record: async () => {} };
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return { ok: false, status: 401, error: "Sign in to scan puzzles." };
  const sb = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Your session expired. Sign in again." };

  const unlimited = process.env.UNLIMITED_EMAILS?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
  if (unlimited.includes(data.user.email?.toLowerCase() ?? "")) return { ok: true, record: async () => {} };

  const used = await sb.rpc("scans_today");
  if (used.error) {
    // Fail closed: without the quota table every scan would be unmetered.
    console.error("scan quota check failed", used.error.message);
    return { ok: false, status: 503, error: "Scanning is temporarily unavailable. Try again later." };
  }
  if ((used.data as number) >= DAILY_LIMIT) {
    return {
      ok: false,
      status: 429,
      error: `You've used today's ${DAILY_LIMIT} scans. More tomorrow, or type the puzzle in by hand.`,
    };
  }
  return {
    ok: true,
    record: async () => {
      const { error } = await sb.rpc("record_scan");
      if (error) console.error("record_scan failed", error.message);
    },
  };
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Scanning isn't configured (missing ANTHROPIC_API_KEY)." }, { status: 503 });
  }
  const access = await checkAccess(request);
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  let body: { image?: unknown; mediaType?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { image, mediaType } = body;
  if (typeof image !== "string" || !image || image.length > MAX_BASE64_LENGTH) {
    return Response.json({ error: "Missing or oversized image." }, { status: 400 });
  }
  if (!MEDIA_TYPES.includes(mediaType as MediaType)) {
    return Response.json({ error: "Unsupported image type." }, { status: 400 });
  }

  const client = new Anthropic();
  try {
    console.info(`scan: image_kb=${Math.round((image.length * 3) / 4 / 1024)}`);
    const result = await readSudoku(client, image, mediaType as MediaType);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    if (result.problems.length) console.info(`scan: still invalid after ${result.passes} passes: ${result.problems.join(" ")}`);
    await access.record();
    return Response.json({ grid: result.grid, notes: result.notes });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Too many scans right now. Try again in a minute." }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Claude API error", e.status, e.message);
      return Response.json({ error: "The scanning service failed. Try again." }, { status: 502 });
    }
    console.error("Scan failed", e);
    return Response.json({ error: "Scan failed." }, { status: 500 });
  }
}
