import { describe, expect, it } from "vitest";
import { bit } from "@/lib/sudoku/core";
import { computeHint } from "./hint";
import { initBoard, reducer, type Action, type BoardState } from "./reducer";
import { DEFAULT_SETTINGS, boardValues, newGame } from "./types";

const GIVENS = "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

const fresh = () =>
  initBoard(newGame({ id: "t", source: "manual", title: "t", difficulty: "easy", givens: GIVENS, solution: SOLUTION }), DEFAULT_SETTINGS);
const run = (s: BoardState, ...actions: Action[]) => actions.reduce(reducer, s);

describe("board reducer", () => {
  it("places and toggles a digit", () => {
    let s = run(fresh(), { type: "select", cells: [2], mode: "replace" }, { type: "input", digit: 4 });
    expect(s.rec.cells[2].v).toBe(4);
    s = reducer(s, { type: "input", digit: 4 });
    expect(s.rec.cells[2].v).toBe(0);
  });

  it("does not edit givens", () => {
    const s = run(fresh(), { type: "select", cells: [0], mode: "replace" }, { type: "input", digit: 9 });
    expect(s.rec.cells[0].v).toBe(0);
  });

  it("removes notes from peers when placing a digit", () => {
    const s = run(
      fresh(),
      { type: "select", cells: [3, 11], mode: "replace" },
      { type: "input", digit: 4, layer: "corner" },
      { type: "select", cells: [2], mode: "replace" },
      { type: "input", digit: 4 },
    );
    expect(s.rec.cells[3].c & bit(4)).toBe(0); // same row
    expect(s.rec.cells[11].c & bit(4)).toBe(0); // same box
  });

  it("toggles marks across a multi-selection", () => {
    let s = run(fresh(), { type: "select", cells: [2, 3], mode: "replace" }, { type: "input", digit: 1, layer: "center" });
    expect(s.rec.cells[2].m).toBe(bit(1));
    expect(s.rec.cells[3].m).toBe(bit(1));
    s = reducer(s, { type: "input", digit: 1, layer: "center" });
    expect(s.rec.cells[2].m).toBe(0);
  });

  it("colours givens too", () => {
    const s = run(fresh(), { type: "select", cells: [0], mode: "replace" }, { type: "input", digit: 3, layer: "color" });
    expect(s.rec.cells[0].k).toBe(bit(3));
  });

  it("swaps corner and centre notes back and forth", () => {
    let s = run(fresh(), { type: "select", cells: [2], mode: "replace" }, { type: "input", digit: 1, layer: "corner" }, { type: "input", digit: 2, layer: "center" });
    s = reducer(s, { type: "swapNotes" });
    expect(s.rec.cells[2]).toMatchObject({ c: bit(2), m: bit(1) });
    s = reducer(s, { type: "swapNotes" });
    expect(s.rec.cells[2]).toMatchObject({ c: bit(1), m: bit(2) });
  });

  it("reverts everything entered in test mode", () => {
    let s = run(fresh(), { type: "select", cells: [2], mode: "replace" }, { type: "input", digit: 4 }, { type: "startTest" });
    s = run(s, { type: "select", cells: [3], mode: "replace" }, { type: "input", digit: 6 }, { type: "input", digit: 1, layer: "corner" });
    s = reducer(s, { type: "revertTest" });
    expect(s.testBase).toBeNull();
    expect(s.rec.cells[2].v).toBe(4);
    expect(s.rec.cells[3].v).toBe(0);
    s = reducer(s, { type: "undo" });
    expect(s.rec.cells[3].v).toBe(6);
  });

  it("erases only the colours in colour mode", () => {
    let s = run(fresh(), { type: "select", cells: [2], mode: "replace" }, { type: "input", digit: 4 }, { type: "input", digit: 3, layer: "color" });
    s = run(s, { type: "setLayer", layer: "color" }, { type: "erase" });
    expect(s.rec.cells[2]).toMatchObject({ v: 4, k: 0 });
  });

  it("undoes and redoes", () => {
    let s = run(fresh(), { type: "select", cells: [2], mode: "replace" }, { type: "input", digit: 4 }, { type: "input", digit: 7 });
    s = reducer(s, { type: "undo" });
    expect(s.rec.cells[2].v).toBe(4);
    s = reducer(s, { type: "undo" });
    expect(s.rec.cells[2].v).toBe(0);
    s = run(s, { type: "redo" }, { type: "redo" });
    expect(s.rec.cells[2].v).toBe(7);
  });

  it("hints point out mistakes first, then a logical step", () => {
    let s = run(fresh(), { type: "select", cells: [2], mode: "replace" }, { type: "input", digit: 1 });
    expect(computeHint(s.rec)).toEqual({ kind: "mistake", cells: [2] });
    s = reducer(s, { type: "erase" });
    const hint = computeHint(s.rec);
    expect(hint.kind).toBe("step");
    if (hint.kind === "step") {
      s = reducer(s, { type: "applyHint", step: hint.step, cands: hint.cands });
      const { cell, digit } = hint.step.placements[0];
      expect(String(s.rec.cells[cell].v)).toBe(SOLUTION[cell]);
      expect(digit).toBe(Number(SOLUTION[cell]));
    }
  });

  it("marks the game solved when complete", () => {
    let s = fresh();
    for (let i = 0; i < 81; i++) {
      if (GIVENS[i] !== ".") continue;
      s = run(s, { type: "select", cells: [i], mode: "replace" }, { type: "input", digit: Number(SOLUTION[i]) });
    }
    expect(s.rec.status).toBe("solved");
  });

  it("leaves a full but incorrect board unsolved", () => {
    // The state the "all filled in, but something's off" message reports.
    let s = fresh();
    const wrongAt = GIVENS.indexOf(".");
    for (let i = 0; i < 81; i++) {
      if (GIVENS[i] !== ".") continue;
      const correct = Number(SOLUTION[i]);
      const digit = i === wrongAt ? (correct % 9) + 1 : correct;
      s = run(s, { type: "select", cells: [i], mode: "replace" }, { type: "input", digit });
    }
    expect(boardValues(s.rec).every(Boolean)).toBe(true);
    expect(s.rec.status).toBe("playing");
  });
});
