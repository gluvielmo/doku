import { bit, computeCandidates } from "@/lib/sudoku/core";
import { findStep, type Step } from "@/lib/sudoku/logic";
import { boardValues, isGiven, type GameRecord } from "./types";

export type Hint =
  | { kind: "mistake"; cells: number[] }
  | { kind: "step"; step: Step; cands: number[] }
  | { kind: "none" };

export function computeHint(rec: GameRecord): Hint {
  const values = boardValues(rec);
  const wrong = values
    .map((v, i) => (v && !isGiven(rec, i) && String(v) !== rec.solution[i] ? i : -1))
    .filter((i) => i >= 0);
  if (wrong.length) return { kind: "mistake", cells: wrong };

  // Start from what the placed digits allow, then respect the player's own
  // eliminations wherever their marks still contain the true digit.
  const cands = computeCandidates(values);
  rec.cells.forEach((cell, i) => {
    if (values[i]) return;
    const marks = cell.c || cell.m;
    const truth = bit(Number(rec.solution[i]));
    if (marks && marks & truth) cands[i] &= marks;
  });

  const step = findStep(values, cands);
  return step ? { kind: "step", step, cands } : { kind: "none" };
}
