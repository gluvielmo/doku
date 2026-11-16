// Reads the printed givens of a photographed sudoku with Claude vision.
//
// Pass 1 transcribes the grid. If the result breaks the rules (a digit repeats in a row, column
// or box) or has no unique solution, pass 2 shows Claude the photo again with its first reading and
// the exact problems, and asks it to re-check those cells. Misreads almost always show up this way:
// a dropped or shifted digit, or a 1/7, 3/8, 5/6 mix-up, usually creates a duplicate.

import Anthropic from "@anthropic-ai/sdk";
import { BOXES, COLS, ROWS, type Grid } from "@/lib/sudoku/core";
import { solve } from "@/lib/sudoku/solver";

export const SCAN_MODEL = "claude-sonnet-5-5";

export type MediaType = "image/jpeg" | "image/png" | "image/webp";

export type ReadResult =
  | { ok: true; grid: string; notes: string; passes: number; problems: string[] }
  | { ok: false; status: number; error: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_sudoku", "rows", "unsure_cells"],
  properties: {
    is_sudoku: { type: "boolean", description: "False if the image does not contain a 9x9 sudoku grid." },
    rows: {
      type: "array",
      description: "The 9 rows, top to bottom. Each row is a list of exactly 9 numbers, left to right: 1-9 for a printed given, 0 for an empty cell.",
      items: { type: "array", items: { type: "integer" } },
    },
    unsure_cells: {
      type: "string",
      description: "Cells you were unsure about, as R<row>C<col> separated by spaces (1-based), or an empty string.",
    },
  },
};

const INSTRUCTIONS = `Transcribe the printed givens of the 9x9 sudoku in this photo (newspaper, book, screen, etc.).

How to read it:
- Find the grid's outer border and the thicker lines that split it into nine 3x3 boxes. If the photo is rotated or skewed, read the grid in its natural upright orientation.
- Work one row at a time, box by box, and write exactly 9 numbers per row: the printed digit, or 0 for an empty cell. Write a 0 for every blank; most errors come from losing track of a blank and shifting the following digits into the wrong cells.
- Only printed givens count. Ignore handwritten digits, pencil marks, small candidate notes, shading, and anything outside the grid.
- Look closely at digits that are easy to confuse in print: 1/7, 3/8, 5/6, 6/8, 8/9, 4/9.
- Before answering, check each row, column and 3x3 box: a valid puzzle never repeats a digit in any of them. If one does, look at those cells again.`;

/**
 * Turns the model's rows into an 81-char string ('.' for empty). Accepts number lists (the schema)
 * and strings like '5.3|.7.|..1'. Rows of the wrong length are padded or cut to 9 and reported,
 * so a single miscounted row leads to a re-read instead of a failed scan.
 */
export function parseRows(rows: unknown): { grid: string; badRows: number[] } | null {
  if (!Array.isArray(rows) || rows.length < 8 || rows.length > 10) return null;
  const badRows: number[] = [];
  const cells = Array.from({ length: 9 }, (_, r) => {
    const row = rows[r];
    const list = Array.isArray(row)
      ? row.map((v) => (typeof v === "number" && v >= 1 && v <= 9 ? String(v) : "."))
      : typeof row === "string"
        ? [...row.replace(/[|,\s]/g, "")].map((ch) => (ch >= "1" && ch <= "9" ? ch : "."))
        : [];
    if (list.length !== 9) badRows.push(r);
    return [...list, ".........".slice(0, Math.max(0, 9 - list.length))].join("").slice(0, 9);
  });
  if (rows.length !== 9) for (let r = 0; r < 9; r++) if (!badRows.includes(r)) badRows.push(r);
  return { grid: cells.join(""), badRows: badRows.sort((a, b) => a - b) };
}

function toGrid(s: string): Grid {
  return [...s].map((ch) => (ch >= "1" && ch <= "9" ? Number(ch) : 0));
}

function formatRows(s: string): string {
  return Array.from({ length: 9 }, (_, r) => `Row ${r + 1}: [${[...s.slice(r * 9, r * 9 + 9)].map((ch) => (ch === "." ? 0 : ch)).join(", ")}]`).join("\n");
}

const cellName = (i: number) => `R${Math.floor(i / 9) + 1}C${(i % 9) + 1}`;

/** Human-readable rule problems with a reading, for the re-check prompt. Empty when it's a valid puzzle. */
export function findProblems(s: string, badRows: number[] = []): string[] {
  const g = toGrid(s);
  const problems: string[] = badRows.map((r) => `Row ${r + 1} didn't have exactly 9 cells, so its digits may be in the wrong columns.`);
  const units: [string, number[][]][] = [
    ["row", ROWS],
    ["column", COLS],
    ["box", BOXES],
  ];
  for (const [kind, list] of units) {
    list.forEach((cells, n) => {
      const seen = new Map<number, number[]>();
      for (const i of cells) if (g[i]) seen.set(g[i], [...(seen.get(g[i]) ?? []), i]);
      for (const [d, at] of seen) {
        if (at.length > 1) problems.push(`The digit ${d} appears ${at.length} times in ${kind} ${n + 1} (${at.map(cellName).join(", ")}).`);
      }
    });
  }
  if (problems.length) return problems;
  const givens = g.filter(Boolean).length;
  if (givens < 17) return [`Only ${givens} digits were read; a valid sudoku has at least 17. Some givens were probably missed.`];
  const { count } = solve(g, { limit: 2 });
  if (count === 0) return ["No digit repeats, but the grid has no solution, so at least one digit is misread or in the wrong cell."];
  if (count > 1) return ["The grid has more than one solution, so a given was probably missed (read as empty)."];
  return [];
}

type Answer = { is_sudoku: boolean; rows: unknown; unsure_cells: string };

async function ask(client: Anthropic, content: Anthropic.Beta.BetaContentBlockParam[], effort: "medium" | "high"): Promise<Answer | "refused" | "empty"> {
  const response = await client.beta.messages.create({
    model: SCAN_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content }],
  });
  console.info(
    `scan: model=${response.model} effort=${effort} input_tokens=${response.usage.input_tokens} output_tokens=${response.usage.output_tokens}`,
  );
  if (response.stop_reason === "refusal") return "refused";
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return "empty";
  return JSON.parse(text) as Answer;
}

export async function readSudoku(client: Anthropic, image: string, mediaType: MediaType): Promise<ReadResult> {
  const imageBlock: Anthropic.Beta.BetaImageBlockParam = { type: "image", source: { type: "base64", media_type: mediaType, data: image } };

  const first = await ask(client, [imageBlock, { type: "text", text: INSTRUCTIONS }], "medium");
  if (first === "refused") return { ok: false, status: 422, error: "The image couldn't be processed. Try another photo." };
  if (first === "empty") return { ok: false, status: 502, error: "No answer from the model." };
  if (!first.is_sudoku) return { ok: false, status: 422, error: "No sudoku grid found in that photo." };
  const read1 = parseRows(first.rows);
  if (!read1) {
    console.info(`scan: unparseable rows ${JSON.stringify(first.rows).slice(0, 300)}`);
    return { ok: false, status: 422, error: "Couldn't read a full 9×9 grid. Try a straighter, closer photo." };
  }
  const grid = read1.grid;
  const problems = findProblems(grid, read1.badRows);
  if (!problems.length) return { ok: true, grid, notes: first.unsure_cells, passes: 1, problems };

  // Pass 2: same photo, the first reading, and what's wrong with it.
  const recheck = `${INSTRUCTIONS}

A first reading of this photo gave:
${formatRows(grid)}

It can't be right:
${problems.map((p) => `- ${p}`).join("\n")}

Look at the photo again, paying most attention to the rows, columns and boxes named above, and to whether any blank was skipped or any digit shifted into a neighbouring cell. Return the corrected full grid.`;
  const second = await ask(client, [imageBlock, { type: "text", text: recheck }], "high");
  if (typeof second === "object" && second.is_sudoku) {
    const read2 = parseRows(second.rows);
    const problems2 = read2 ? findProblems(read2.grid, read2.badRows) : null;
    // Keep whichever reading has fewer problems; the user reviews and fixes the grid either way.
    if (read2 && problems2 && problems2.length <= problems.length) {
      return { ok: true, grid: read2.grid, notes: second.unsure_cells, passes: 2, problems: problems2 };
    }
  }
  return { ok: true, grid, notes: first.unsure_cells, passes: 2, problems };
}
