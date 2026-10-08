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

async function authorize(request: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null; // local-only mode: no auth configured
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return "Sign in to scan puzzles.";
  const { data, error } = await createClient(url, anonKey).auth.getUser(token);
  if (error || !data.user) return "Your session expired. Sign in again.";
  const allowed = process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allowed?.length && !allowed.includes(data.user.email?.toLowerCase() ?? "")) return "This account can't scan puzzles.";
  return null;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Scanning isn't configured (missing ANTHROPIC_API_KEY)." }, { status: 503 });
  }
  const denied = await authorize(request);
  if (denied) return Response.json({ error: denied }, { status: 401 });

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
