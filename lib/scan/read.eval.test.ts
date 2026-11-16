// Accuracy check against real photos. Calls the Claude API, so it only runs when asked:
//
//   SCAN_EVAL=1 npx vitest run lib/scan/read.eval.test.ts
//
// Put photos in scan-samples/ (git-ignored) with the correct grid next to each one in a .txt file
// of the same name: 81 characters, digits and '.', line breaks ignored.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { readSudoku, type MediaType } from "./read";

const DIR = "scan-samples";
const TYPES: Record<string, MediaType> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const samples = existsSync(DIR) ? readdirSync(DIR).filter((f) => TYPES[extname(f).toLowerCase()]) : [];

describe.runIf(process.env.SCAN_EVAL)("scan accuracy", () => {
  const client = new Anthropic();
  it.each(samples)("%s", async (file) => {
    const expected = readFileSync(join(DIR, file.replace(/\.[^.]+$/, ".txt")), "utf8").replace(/\s/g, "").replace(/[0]/g, ".");
    const image = readFileSync(join(DIR, file)).toString("base64");
    const result = await readSudoku(client, image, TYPES[extname(file).toLowerCase()]);
    if (!result.ok) throw new Error(result.error);
    const wrong = [...expected].flatMap((ch, i) => (result.grid[i] === ch ? [] : [`R${Math.floor(i / 9) + 1}C${(i % 9) + 1} ${ch}→${result.grid[i]}`]));
    console.info(`${file}: ${81 - wrong.length}/81 correct in ${result.passes} pass(es)${wrong.length ? `: ${wrong.join(", ")}` : ""}`);
    expect(wrong).toEqual([]);
  }, 180_000);
});
