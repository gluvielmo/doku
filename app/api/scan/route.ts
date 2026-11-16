// Reads a photographed sudoku with Claude vision and returns the givens.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BASE64_LENGTH = 7_000_000; // ~5 MB image
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_sudoku", "rows", "confidence_notes"],
  properties: {
    is_sudoku: { type: "boolean", description: "False if the image does not contain a 9x9 sudoku grid." },
    rows: {
      type: "array",
      description: "Exactly 9 strings of exactly 9 characters, top row first. Digits 1-9 for printed givens, '.' for empty cells.",
      items: { type: "string" },
    },
    confidence_notes: {
      type: "string",
      description: "Cells you were unsure about, as R<row>C<col>, or an empty string.",
    },
  },
};

const PROMPT = `This photo should contain a 9x9 sudoku puzzle (newspaper, book, screen, etc.).
Transcribe only the printed/given digits. Ignore handwritten pencil marks, small candidate notes and
anything outside the grid. If the photo is rotated or skewed, read it in its natural upright orientation.
Return each of the 9 rows as a 9-character string using '.' for empty cells. Double-check every row
and column count before answering.`;

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
    const response = await client.beta.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Transcribing printed digits needs little reasoning; low effort keeps scans cheap.
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as MediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    console.info(`scan: model=${response.model} input_tokens=${response.usage.input_tokens} output_tokens=${response.usage.output_tokens}`);

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "The image couldn't be processed. Try another photo." }, { status: 422 });
    }
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return Response.json({ error: "No answer from the model." }, { status: 502 });

    const parsed = JSON.parse(text) as { is_sudoku: boolean; rows: string[]; confidence_notes: string };
    if (!parsed.is_sudoku) return Response.json({ error: "No sudoku grid found in that photo." }, { status: 422 });
    const rows = parsed.rows.map((r) => r.replace(/[^1-9.]/g, "."));
    if (rows.length !== 9 || rows.some((r) => r.length !== 9)) {
      return Response.json({ error: "Couldn't read a full 9×9 grid. Try a straighter, closer photo." }, { status: 422 });
    }
    await access.record();
    return Response.json({ grid: rows.join(""), notes: parsed.confidence_notes });
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
