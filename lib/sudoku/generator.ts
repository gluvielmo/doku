// Seeded puzzle generator. The same seed always yields the same puzzle,
// which is what lets every device agree on the daily puzzles without a server.

import { gridToString, type Grid } from "./core";
import { TECHNIQUES, grade, type Difficulty } from "./logic";
import { seededRng, shuffle } from "./rng";
import { randomFullGrid } from "./solver";

export type DailyDifficulty = Exclude<Difficulty, "expert">;

export const DAILY_DIFFICULTIES: DailyDifficulty[] = ["easy", "medium", "hard"];

const TARGET_LEVEL: Record<DailyDifficulty, number> = { easy: 1, medium: 2, hard: 3 };
const MIN_GIVENS: Record<DailyDifficulty, number> = { easy: 36, medium: 28, hard: 0 };
const MAX_ATTEMPTS = 500;

export interface GeneratedPuzzle {
  puzzle: string;
  solution: string;
  difficulty: DailyDifficulty;
  givens: number;
}

const levelOf = (puzzle: Grid): number => {
  const g = grade(puzzle);
  return g.solvedByLogic && g.hardest ? TECHNIQUES[g.hardest].level : g.solvedByLogic ? 1 : 99;
};

export function generatePuzzle(seed: string, difficulty: DailyDifficulty): GeneratedPuzzle {
  const rng = seededRng(seed);
  const target = TARGET_LEVEL[difficulty];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = randomFullGrid(rng);
    const puzzle = solution.slice();
    let givens = 81;

    // Cells 0..40 paired with their 180° rotation (40 is the centre, paired with itself).
    for (const i of shuffle(Array.from({ length: 41 }, (_, k) => k), rng)) {
      const j = 80 - i;
      const removed = i === j ? 1 : 2;
      if (givens - removed < MIN_GIVENS[difficulty]) continue;
      const a = puzzle[i];
      const b = puzzle[j];
      puzzle[i] = 0;
      puzzle[j] = 0;
      // Solvable by logic implies a unique solution.
      if (levelOf(puzzle) <= target) givens -= removed;
      else {
        puzzle[i] = a;
        puzzle[j] = b;
      }
    }

    if (levelOf(puzzle) === target) {
      return { puzzle: gridToString(puzzle), solution: gridToString(solution), difficulty, givens };
    }
  }
  throw new Error(`Could not generate a ${difficulty} puzzle for seed ${seed}`);
}

export function dailySeed(date: string, difficulty: DailyDifficulty): string {
  return `doku-daily-v1:${date}:${difficulty}`;
}

export function generateDaily(date: string, difficulty: DailyDifficulty): GeneratedPuzzle {
  return generatePuzzle(dailySeed(date, difficulty), difficulty);
}
