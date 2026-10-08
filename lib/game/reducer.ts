// Pure board logic: selection, input layers, undo/redo, notes, hints.

import { PEERS, bit, colOf, computeCandidates, rowOf } from "@/lib/sudoku/core";
import type { Step } from "@/lib/sudoku/logic";
import { boardValues, isGiven, type CellState, type GameRecord, type Layer, type Settings } from "./types";

const HISTORY_LIMIT = 500;

export interface BoardState {
  rec: GameRecord;
  settings: Settings;
  selection: number[];
  cursor: number; // last selected cell, anchor for keyboard movement
  layer: Layer;
  focusDigit: number | null;
  past: CellState[][];
  future: CellState[][];
  flagged: number[]; // cells marked wrong by "check"
}

export type Action =
  | { type: "select"; cells: number[]; mode: "replace" | "add" | "toggle" }
  | { type: "selectAll" }
  | { type: "deselect" }
  | { type: "move"; dr: number; dc: number; extend: boolean }
  | { type: "setLayer"; layer: Layer }
  | { type: "cycleLayer" }
  | { type: "input"; digit: number; layer?: Layer }
  | { type: "erase" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "fillNotes" }
  | { type: "clearNotes" }
  | { type: "applyHint"; step: Step; cands: number[] }
  | { type: "check" }
  | { type: "restart" }
  | { type: "selectDigit"; digit: number }
  | { type: "tick"; ms: number }
  | { type: "replace"; rec: GameRecord }
  | { type: "settings"; settings: Settings };

// Cycle order for the "cycleLayer" action (Space bar). "color" has no tab in
// the UI, so it's left out here to avoid landing on an unreachable mode.
const LAYERS: Layer[] = ["normal", "corner", "center"];

export function initBoard(rec: GameRecord, settings: Settings): BoardState {
  return { rec, settings, selection: [], cursor: 40, layer: "normal", focusDigit: null, past: [], future: [], flagged: [] };
}

const cloneCells = (cells: CellState[]) => cells.map((c) => ({ ...c }));

/** Commit a new cells array: push undo history, update status and timestamp. */
function commit(s: BoardState, cells: CellState[], extra: Partial<GameRecord> = {}): BoardState {
  const rec: GameRecord = { ...s.rec, ...extra, cells, updatedAt: Date.now() };
  const values = boardValues(rec);
  if (values.every((v, i) => String(v) === rec.solution[i])) rec.status = "solved";
  return {
    ...s,
    rec,
    past: [...s.past, s.rec.cells].slice(-HISTORY_LIMIT),
    future: [],
    flagged: s.flagged.filter((i) => cells[i].v && cells[i].v === s.rec.cells[i].v),
  };
}

function toggleMask(cells: CellState[], targets: number[], key: "c" | "m" | "k", b: number) {
  const allHave = targets.every((i) => cells[i][key] & b);
  for (const i of targets) cells[i][key] = allHave ? cells[i][key] & ~b : cells[i][key] | b;
}

function input(s: BoardState, digit: number, layer: Layer): BoardState {
  if (s.rec.status === "solved") return s;
  if (!s.selection.length) return { ...s, focusDigit: s.focusDigit === digit ? null : digit };

  const cells = cloneCells(s.rec.cells);
  const b = bit(digit);
  const editable = s.selection.filter((i) => !isGiven(s.rec, i));

  if (layer === "color") {
    toggleMask(cells, s.selection, "k", b);
    return commit(s, cells);
  }
  if (layer === "normal") {
    if (!editable.length) return s;
    const clear = editable.every((i) => cells[i].v === digit);
    for (const i of editable) cells[i].v = clear ? 0 : digit;
    if (!clear && s.settings.autoRemoveNotes) {
      for (const i of editable)
        for (const p of PEERS[i]) {
          cells[p].c &= ~b;
          cells[p].m &= ~b;
        }
    }
    return { ...commit(s, cells), focusDigit: clear ? s.focusDigit : digit };
  }
  const targets = editable.filter((i) => !cells[i].v);
  if (!targets.length) return s;
  toggleMask(cells, targets, layer === "corner" ? "c" : "m", b);
  return commit(s, cells);
}

function erase(s: BoardState): BoardState {
  if (s.rec.status === "solved" || !s.selection.length) return s;
  const cells = cloneCells(s.rec.cells);
  const editable = s.selection.filter((i) => !isGiven(s.rec, i));
  const withValue = editable.filter((i) => cells[i].v);
  if (withValue.length && s.layer !== "color") {
    for (const i of withValue) cells[i].v = 0;
  } else if (s.layer === "color") {
    for (const i of s.selection) cells[i].k = 0;
  } else if (editable.some((i) => cells[i].c || cells[i].m)) {
    for (const i of editable) cells[i].c = cells[i].m = 0;
  } else if (s.selection.some((i) => cells[i].k)) {
    for (const i of s.selection) cells[i].k = 0;
  } else return s;
  return commit(s, cells);
}

function select(s: BoardState, list: number[], mode: "replace" | "add" | "toggle"): BoardState {
  let selection: number[];
  if (mode === "replace") selection = [...new Set(list)];
  else if (mode === "add") selection = [...new Set([...s.selection, ...list])];
  else {
    const set = new Set(s.selection);
    for (const i of list) set.has(i) ? set.delete(i) : set.add(i);
    selection = [...set];
  }
  return { ...s, selection, cursor: list.length ? list[list.length - 1] : s.cursor, focusDigit: null };
}

export function reducer(s: BoardState, a: Action): BoardState {
  switch (a.type) {
    case "select":
      return select(s, a.cells, a.mode);
    case "selectAll":
      return { ...s, selection: Array.from({ length: 81 }, (_, i) => i) };
    case "deselect":
      return { ...s, selection: [], focusDigit: null };
    case "move": {
      const r = (rowOf(s.cursor) + a.dr + 9) % 9;
      const c = (colOf(s.cursor) + a.dc + 9) % 9;
      return select(s, [r * 9 + c], a.extend ? "add" : "replace");
    }
    case "setLayer":
      return { ...s, layer: a.layer };
    case "cycleLayer":
      return { ...s, layer: LAYERS[(LAYERS.indexOf(s.layer) + 1) % LAYERS.length] };
    case "input":
      return input(s, a.digit, a.layer ?? s.layer);
    case "erase":
      return erase(s);
    case "undo": {
      if (!s.past.length || s.rec.status === "solved") return s;
      const prev = s.past[s.past.length - 1];
      return {
        ...s,
        rec: { ...s.rec, cells: prev, updatedAt: Date.now() },
        past: s.past.slice(0, -1),
        future: [s.rec.cells, ...s.future],
      };
    }
    case "redo": {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { ...commit(s, next), future: rest };
    }
    case "fillNotes": {
      const cells = cloneCells(s.rec.cells);
      const cands = computeCandidates(boardValues(s.rec));
      cells.forEach((cell, i) => {
        if (!cell.v && !isGiven(s.rec, i)) cell.c = cands[i];
      });
      return commit(s, cells);
    }
    case "clearNotes": {
      const cells = cloneCells(s.rec.cells);
      for (const cell of cells) cell.c = cell.m = 0;
      return commit(s, cells);
    }
    case "applyHint": {
      const cells = cloneCells(s.rec.cells);
      for (const { cell, digit } of a.step.placements) {
        cells[cell].v = digit;
        if (s.settings.autoRemoveNotes)
          for (const p of PEERS[cell]) {
            cells[p].c &= ~bit(digit);
            cells[p].m &= ~bit(digit);
          }
      }
      for (const { cell, digit } of a.step.eliminations) {
        const target = cells[cell];
        // A cell without notes gets its candidates filled in so the elimination is visible.
        if (!target.c && !target.m) target.c = a.cands[cell];
        target.c &= ~bit(digit);
        target.m &= ~bit(digit);
      }
      return commit(s, cells, { hintsUsed: s.rec.hintsUsed + 1 });
    }
    case "check": {
      const values = boardValues(s.rec);
      const flagged = values
        .map((v, i) => (v && !isGiven(s.rec, i) && String(v) !== s.rec.solution[i] ? i : -1))
        .filter((i) => i >= 0);
      return { ...s, flagged };
    }
    case "restart": {
      const cells = s.rec.cells.map(() => ({ v: 0, c: 0, m: 0, k: 0 }));
      return { ...commit(s, cells, { status: "playing", elapsedMs: 0, hintsUsed: 0 }), selection: [], flagged: [] };
    }
    case "selectDigit": {
      const values = boardValues(s.rec);
      const cells = values.map((v, i) => (v === a.digit ? i : -1)).filter((i) => i >= 0);
      return { ...select(s, cells, "replace"), focusDigit: a.digit };
    }
    case "tick":
      if (s.rec.status === "solved") return s;
      return { ...s, rec: { ...s.rec, elapsedMs: s.rec.elapsedMs + a.ms } };
    case "replace":
      return { ...s, rec: a.rec, past: [], future: [], flagged: [] };
    case "settings":
      return { ...s, settings: a.settings };
  }
}
