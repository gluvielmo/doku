import { describe, expect, it } from "vitest";
import { findProblems, parseRows } from "./read";

// A valid puzzle with a unique solution.
const PUZZLE = "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const rows = (s: string) => Array.from({ length: 9 }, (_, r) => s.slice(r * 9, r * 9 + 9).replace(/(...)(...)(...)/, "$1|$2|$3"));

describe("parseRows", () => {
  it("reads box-grouped rows", () => {
    expect(parseRows(rows(PUZZLE))).toBe(PUZZLE);
  });
  it("rejects rows that aren't 9 cells", () => {
    expect(parseRows([...rows(PUZZLE).slice(0, 8), "53.|.7.|.."])).toBeNull();
    expect(parseRows(rows(PUZZLE).slice(0, 8))).toBeNull();
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
