import { describe, expect, it } from "vitest";
import { findProblems, parseRows } from "./read";

// A valid puzzle with a unique solution.
const PUZZLE = "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const rows = (s: string) => Array.from({ length: 9 }, (_, r) => s.slice(r * 9, r * 9 + 9).replace(/(...)(...)(...)/, "$1|$2|$3"));

describe("parseRows", () => {
  it("reads number lists", () => {
    const lists = Array.from({ length: 9 }, (_, r) => [...PUZZLE.slice(r * 9, r * 9 + 9)].map((ch) => (ch === "." ? 0 : Number(ch))));
    expect(parseRows(lists)).toEqual({ grid: PUZZLE, badRows: [] });
  });
  it("reads box-grouped strings", () => {
    expect(parseRows(rows(PUZZLE))).toEqual({ grid: PUZZLE, badRows: [] });
  });
  it("pads a short row and reports it instead of failing", () => {
    const short = [...rows(PUZZLE).slice(0, 8), "...|.8.|.7"];
    const parsed = parseRows(short);
    expect(parsed?.badRows).toEqual([8]);
    expect(parsed?.grid).toHaveLength(81);
    expect(findProblems(parsed!.grid, parsed!.badRows)[0]).toMatch(/Row 9 didn't have exactly 9 cells/);
  });
  it("gives up on something that isn't a grid", () => {
    expect(parseRows(["123"])).toBeNull();
    expect(parseRows("nope")).toBeNull();
  });
});

describe("findProblems", () => {
  it("accepts a valid puzzle", () => {
    expect(findProblems(PUZZLE)).toEqual([]);
  });
  it("names a repeated digit", () => {
    const bad = "55" + PUZZLE.slice(2); // R1C2 misread as 5
    expect(findProblems(bad).join(" ")).toMatch(/digit 5 appears 2 times in row 1 \(R1C1, R1C2\)/);
  });
  it("flags a dropped given", () => {
    const missing = "." + PUZZLE.slice(1).replace(/[1-9]/, "."); // two givens read as blanks
    expect(findProblems(missing).join(" ")).toMatch(/more than one solution|no solution|at least 17/);
  });
});
