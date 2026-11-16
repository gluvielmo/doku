"use client";

// Draws the board to a PNG in the current theme, for "Copy screenshot".

import { digitsOf } from "@/lib/sudoku/core";
import { formatTime, puzzleTitle } from "@/lib/format";
import { isGiven, type GameRecord, type Settings } from "@/lib/game/types";

// SudokuPad-style corner positions, filled in order: corners, then edges, then centre.
export const CORNER_ORDER = [0, 2, 6, 8, 1, 7, 3, 5, 4];

const SIZE = 1080;
const PAD = 48;
const FOOTER = 72;
const THICK = 6;
const THIN = 2;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function renderBoard(rec: GameRecord, settings: Settings): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const font = getComputedStyle(document.body).fontFamily;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE + FOOTER;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = v("--bg");
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const board = SIZE - 2 * PAD;
  const cell = (board - 4 * THICK - 6 * THIN) / 9;
  // Offset of row/column n: one thick line per box crossed, thin lines between cells inside a box.
  const at = (n: number) => PAD + THICK + n * cell + Math.floor(n / 3) * THICK + (n - Math.floor(n / 3)) * THIN;

  ctx.save();
  roundRect(ctx, PAD, PAD, board, board, 44);
  ctx.clip();
  ctx.fillStyle = v("--line-thick");
  ctx.fillRect(PAD, PAD, board, board);
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    ctx.fillStyle = v("--line-thin");
    ctx.fillRect(at(c0), at(r0), at(c0 + 2) + cell - at(c0), at(r0 + 2) + cell - at(r0));
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  rec.cells.forEach((state, i) => {
    const x = at(i % 9);
    const y = at(Math.floor(i / 9));
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    ctx.fillStyle = v("--cell");
    ctx.fillRect(x, y, cell, cell);

    // Colours: one fill, or equal wedges like the board's conic gradient.
    const colors = digitsOf(state.k);
    if (colors.length === 1) {
      ctx.fillStyle = v(`--c${colors[0]}`);
      ctx.fillRect(x, y, cell, cell);
    } else if (colors.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cell, cell);
      ctx.clip();
      colors.forEach((c, n) => {
        const start = -Math.PI / 4 + (n / colors.length) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, cell, start, start + (2 * Math.PI) / colors.length);
        ctx.fillStyle = v(`--c${c}`);
        ctx.fill();
      });
      ctx.restore();
    }

    const given = isGiven(rec, i);
    const value = given ? Number(rec.givens[i]) : state.v;
    if (value) {
      ctx.font = `${given ? 620 : 450} ${cell * 0.66}px ${font}`;
      ctx.fillStyle = v(given ? "--given" : "--entry");
      ctx.fillText(String(value), cx, cy + cell * 0.03);
      return;
    }

    const corner = digitsOf(state.c);
    const center = digitsOf(state.m);
    const inset = cell * 0.14;
    const step = (cell - 2 * inset) / 3;
    const slot = (s: number): [number, number] => [x + inset + step * ((s % 3) + 0.5), y + inset + step * (Math.floor(s / 3) + 0.5)];
    ctx.font = `500 ${cell * 0.23}px ${font}`;
    ctx.fillStyle = v("--muted");
    if (corner.length && center.length) {
      // Same split as the board: corner marks on the top and bottom rows, centre marks between.
      const half = Math.ceil(corner.length / 2);
      [corner.slice(0, half), corner.slice(half)].forEach((row, r) => {
        const rowY = r ? y + cell - inset - step / 2 : y + inset + step / 2;
        row.forEach((d, n) => {
          const rowX = row.length === 1 ? x + inset + step / 2 : x + inset + step / 2 + (n * (cell - 2 * inset - step)) / (row.length - 1);
          ctx.fillText(String(d), rowX, rowY);
        });
      });
    } else {
      corner.forEach((d, n) => ctx.fillText(String(d), ...slot(settings.cornerLayout === "grid" ? d - 1 : CORNER_ORDER[n])));
    }
    if (center.length) {
      const scale = corner.length ? (center.length > 4 ? 0.17 : 0.22) : center.length > 4 ? 0.22 : 0.29;
      ctx.font = `500 ${cell * scale}px ${font}`;
      ctx.fillStyle = v("--note");
      ctx.fillText(center.join(""), cx, cy, cell * 0.92);
    }
  });
  ctx.restore();

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `600 32px ${font}`;
  ctx.fillStyle = v("--text");
  ctx.fillText(puzzleTitle(rec), PAD, SIZE + FOOTER / 2 - 18, SIZE - 2 * PAD - 220);
  ctx.textAlign = "right";
  ctx.font = `500 30px ${font}`;
  ctx.fillStyle = v("--muted");
  ctx.fillText(`${rec.status === "solved" ? "✓ " : ""}${formatTime(rec.elapsedMs)} · Doku`, SIZE - PAD, SIZE + FOOTER / 2 - 18);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the board."))), "image/png"));
}

/** Copies the board image to the clipboard; falls back to the share sheet, then a download. */
export async function copyBoardImage(rec: GameRecord, settings: Settings): Promise<"copied" | "shared" | "downloaded"> {
  // The ClipboardItem gets the promise, not the blob: Safari only allows the write if it starts
  // inside the click, before any await.
  const png = renderBoard(rec, settings);
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return "copied";
  } catch {
    const file = new File([await png], "doku.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return "shared";
      } catch {
        // Share sheet dismissed: fall through to the download.
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "downloaded";
  }
}
