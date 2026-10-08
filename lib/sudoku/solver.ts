// Backtracking solver with bitmasks and minimum-remaining-values ordering.
// Used for uniqueness checks, filling full grids, and solving scanned puzzles.

import { ALL, PEERS, bit, popcount, type Grid } from "./core";
import { shuffle, type Rng } from "./rng";

export interface SolveResult {
  count: number; // number of solutions found, capped at `limit`
  solution: Grid | null; // first solution found
}

export function solve(input: Grid, opts: { limit?: number; rng?: Rng } = {}): SolveResult {
  const limit = opts.limit ?? 2;
  const g = input.slice();
  const masks = new Array<number>(81).fill(0);

  // Reject givens that already break the rules.
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (!v) continue;
    for (const p of PEERS[i]) if (g[p] === v) return { count: 0, solution: null };
  }
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    let m = ALL;
    for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
    if (!m) return { count: 0, solution: null };
    masks[i] = m;
  }

  let count = 0;
  let solution: Grid | null = null;

  const search = (): boolean => {
    // Pick the empty cell with the fewest candidates.
    let best = -1;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const c = popcount(masks[i]);
      if (c < bestCount) {
        bestCount = c;
        best = i;
        if (c <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = g.slice();
      return count >= limit;
    }
    if (bestCount === 0) return false;

    let digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (masks[best] & bit(d)) digits.push(d);
    if (opts.rng) digits = shuffle(digits, opts.rng);

    for (const d of digits) {
      const b = bit(d);
      const changed: number[] = [];
      let dead = false;
      g[best] = d;
      for (const p of PEERS[best]) {
        if (!g[p] && masks[p] & b) {
          masks[p] &= ~b;
          changed.push(p);
          if (!masks[p]) dead = true;
        }
      }
      if (!dead && search()) return true;
      for (const p of changed) masks[p] |= b;
      g[best] = 0;
    }
    return false;
  };

  search();
  return { count, solution };
}

export function hasUniqueSolution(g: Grid): boolean {
  return solve(g, { limit: 2 }).count === 1;
}

export function randomFullGrid(rng: Rng): Grid {
  const res = solve(new Array(81).fill(0), { limit: 1, rng });
  if (!res.solution) throw new Error("unreachable: empty grid has solutions");
  return res.solution;
}
