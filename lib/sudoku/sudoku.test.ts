import { describe, expect, it } from "vitest";
import { findConflicts, parseGrid } from "./core";
import { DAILY_DIFFICULTIES, generateDaily, generatePuzzle } from "./generator";
import { grade } from "./logic";
import { hasUniqueSolution, solve } from "./solver";

const EASY = "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const EASY_SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("solver", () => {
  it("solves a known puzzle", () => {
    const res = solve(parseGrid(EASY));
    expect(res.count).toBe(1);
    expect(res.solution!.join("")).toBe(EASY_SOLUTION);
  });

  it("detects multiple solutions", () => {
    const g = parseGrid(EASY);
    g[0] = 0;
    g[1] = 0;
    g[4] = 0;
    g[9] = 0;
    expect(hasUniqueSolution(g)).toBe(false);
  });

  it("rejects contradictory givens", () => {
    const g = parseGrid(EASY);
    g[2] = 5; // duplicate 5 in row 1
    expect(solve(g).count).toBe(0);
  });
});

describe("logic grader", () => {
  it("solves an easy puzzle with singles", () => {
    const g = grade(parseGrid(EASY));
    expect(g.solvedByLogic).toBe(true);
    expect(g.difficulty).toBe("easy");
  });

  it("finds conflicts", () => {
    const g = parseGrid(EASY);
    g[2] = 5;
    expect([...findConflicts(g)].sort((a, b) => a - b)).toEqual([0, 2]);
  });
});

describe("generator", () => {
  it("is deterministic for the same seed", () => {
    expect(generatePuzzle("same-seed", "medium")).toEqual(generatePuzzle("same-seed", "medium"));
  });

  it.each(DAILY_DIFFICULTIES)("generates a unique %s puzzle with the right grade", (difficulty) => {
    for (const date of ["2026-10-07", "2026-10-08", "2026-10-09"]) {
      const started = performance.now();
      const p = generateDaily(date, difficulty);
      const ms = performance.now() - started;
      const grid = parseGrid(p.puzzle);
      expect(hasUniqueSolution(grid)).toBe(true);
      expect(solve(grid).solution!.join("")).toBe(p.solution);
      expect(grade(grid).difficulty).toBe(difficulty);
      console.log(`${date} ${difficulty}: ${p.givens} givens in ${ms.toFixed(0)}ms`);
    }
  });
});
