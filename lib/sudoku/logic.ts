// Human-style solver: applies named techniques one step at a time.
// Used to grade puzzle difficulty and to produce explainable hints.

import {
  BOXES,
  COLS,
  PEERS,
  ROWS,
  UNITS,
  bit,
  boxOf,
  cellName,
  colOf,
  computeCandidates,
  digitsOf,
  popcount,
  rowOf,
  type Grid,
  type Unit,
} from "./core";

export type Technique =
  | "nakedSingle"
  | "hiddenSingle"
  | "lockedCandidates"
  | "nakedPair"
  | "hiddenPair"
  | "nakedTriple"
  | "hiddenTriple"
  | "xWing"
  | "xyWing"
  | "swordfish"
  | "nakedQuad"
  | "hiddenQuad";

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export const TECHNIQUES: Record<Technique, { name: string; level: 1 | 2 | 3 }> = {
  nakedSingle: { name: "Naked single", level: 1 },
  hiddenSingle: { name: "Hidden single", level: 1 },
  lockedCandidates: { name: "Locked candidates", level: 2 },
  nakedPair: { name: "Naked pair", level: 2 },
  hiddenPair: { name: "Hidden pair", level: 2 },
  nakedTriple: { name: "Naked triple", level: 3 },
  hiddenTriple: { name: "Hidden triple", level: 3 },
  xWing: { name: "X-Wing", level: 3 },
  xyWing: { name: "XY-Wing", level: 3 },
  swordfish: { name: "Swordfish", level: 3 },
  nakedQuad: { name: "Naked quad", level: 3 },
  hiddenQuad: { name: "Hidden quad", level: 3 },
};

const LEVEL_NAMES: Difficulty[] = ["easy", "easy", "medium", "hard"];

export interface Placement {
  cell: number;
  digit: number;
}

export interface Step {
  technique: Technique;
  placements: Placement[];
  eliminations: Placement[];
  /** Cells that form the pattern, for highlighting. */
  focus: number[];
  description: string;
}

const unitName = (u: Unit) => `${u.kind} ${u.index + 1}`;

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

function nakedSingle(values: Grid, cands: number[]): Step | null {
  for (let i = 0; i < 81; i++) {
    if (values[i] || popcount(cands[i]) !== 1) continue;
    const d = digitsOf(cands[i])[0];
    return {
      technique: "nakedSingle",
      placements: [{ cell: i, digit: d }],
      eliminations: [],
      focus: [i],
      description: `${cellName(i)} has only one candidate left: ${d}.`,
    };
  }
  return null;
}

function hiddenSingle(values: Grid, cands: number[]): Step | null {
  // Boxes first: that is how most people scan.
  const order = [...UNITS.slice(18), ...UNITS.slice(0, 18)];
  for (const u of order) {
    for (let d = 1; d <= 9; d++) {
      const spots = u.cells.filter((i) => !values[i] && cands[i] & bit(d));
      if (spots.length !== 1) continue;
      return {
        technique: "hiddenSingle",
        placements: [{ cell: spots[0], digit: d }],
        eliminations: [],
        focus: u.cells,
        description: `In ${unitName(u)}, ${d} can only go in ${cellName(spots[0])}.`,
      };
    }
  }
  return null;
}

function lockedCandidates(values: Grid, cands: number[]): Step | null {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    // Pointing: within a box, the digit is confined to one row/column.
    for (let bx = 0; bx < 9; bx++) {
      const spots = BOXES[bx].filter((i) => !values[i] && cands[i] & b);
      if (spots.length < 2) continue;
      for (const [line, key, kind] of [
        [ROWS, rowOf, "row"],
        [COLS, colOf, "column"],
      ] as const) {
        const k = key(spots[0]);
        if (!spots.every((i) => key(i) === k)) continue;
        const elim = line[k].filter((i) => boxOf(i) !== bx && !values[i] && cands[i] & b);
        if (elim.length)
          return {
            technique: "lockedCandidates",
            placements: [],
            eliminations: elim.map((cell) => ({ cell, digit: d })),
            focus: spots,
            description: `In box ${bx + 1}, ${d} is confined to ${kind} ${k + 1}, so it can be removed from the rest of that ${kind}.`,
          };
      }
    }
    // Claiming: within a row/column, the digit is confined to one box.
    for (const [line, kind] of [
      [ROWS, "row"],
      [COLS, "column"],
    ] as const) {
      for (let li = 0; li < 9; li++) {
        const spots = line[li].filter((i) => !values[i] && cands[i] & b);
        if (spots.length < 2) continue;
        const bx = boxOf(spots[0]);
        if (!spots.every((i) => boxOf(i) === bx)) continue;
        const elim = BOXES[bx].filter((i) => !spots.includes(i) && !values[i] && cands[i] & b);
        if (elim.length)
          return {
            technique: "lockedCandidates",
            placements: [],
            eliminations: elim.map((cell) => ({ cell, digit: d })),
            focus: spots,
            description: `In ${kind} ${li + 1}, ${d} is confined to box ${bx + 1}, so it can be removed from the rest of that box.`,
          };
      }
    }
  }
  return null;
}

const SUBSET_NAMES = { 2: "pair", 3: "triple", 4: "quad" } as const;

function nakedSubset(n: 2 | 3 | 4, technique: Technique) {
  return (values: Grid, cands: number[]): Step | null => {
    for (const u of UNITS) {
      const empty = u.cells.filter((i) => !values[i]);
      if (empty.length <= n) continue;
      const pool = empty.filter((i) => cands[i] && popcount(cands[i]) <= n);
      for (const combo of combinations(pool, n)) {
        const union = combo.reduce((m, i) => m | cands[i], 0);
        if (popcount(union) !== n) continue;
        const elim: Placement[] = [];
        for (const i of empty) {
          if (combo.includes(i)) continue;
          for (const d of digitsOf(cands[i] & union)) elim.push({ cell: i, digit: d });
        }
        if (elim.length)
          return {
            technique,
            placements: [],
            eliminations: elim,
            focus: combo,
            description: `Naked ${SUBSET_NAMES[n]} {${digitsOf(union).join(",")}} in ${combo
              .map(cellName)
              .join(", ")}: those digits can be removed from the rest of ${unitName(u)}.`,
          };
      }
    }
    return null;
  };
}

function hiddenSubset(n: 2 | 3 | 4, technique: Technique) {
  return (values: Grid, cands: number[]): Step | null => {
    for (const u of UNITS) {
      const empty = u.cells.filter((i) => !values[i]);
      if (empty.length <= n) continue;
      const where = new Map<number, number[]>();
      for (let d = 1; d <= 9; d++) {
        const spots = empty.filter((i) => cands[i] & bit(d));
        if (spots.length >= 1 && spots.length <= n) where.set(d, spots);
      }
      for (const digits of combinations([...where.keys()], n)) {
        const cells = [...new Set(digits.flatMap((d) => where.get(d)!))];
        if (cells.length !== n) continue;
        const keep = digits.reduce((m, d) => m | bit(d), 0);
        const elim: Placement[] = [];
        for (const i of cells) for (const d of digitsOf(cands[i] & ~keep)) elim.push({ cell: i, digit: d });
        if (elim.length)
          return {
            technique,
            placements: [],
            eliminations: elim,
            focus: cells,
            description: `Hidden ${SUBSET_NAMES[n]} {${digits.join(",")}} in ${unitName(u)}: ${cells
              .map(cellName)
              .join(", ")} can only hold those digits.`,
          };
      }
    }
    return null;
  };
}

function fish(n: 2 | 3, technique: Technique) {
  return (values: Grid, cands: number[]): Step | null => {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (const [base, cover, baseKind, coverKey] of [
        [ROWS, COLS, "rows", colOf],
        [COLS, ROWS, "columns", rowOf],
      ] as const) {
        const lines: { idx: number; pos: number[] }[] = [];
        for (let li = 0; li < 9; li++) {
          const pos = base[li].filter((i) => !values[i] && cands[i] & b).map(coverKey);
          if (pos.length >= 2 && pos.length <= n) lines.push({ idx: li, pos });
        }
        for (const combo of combinations(lines, n)) {
          const coverSet = [...new Set(combo.flatMap((l) => l.pos))];
          if (coverSet.length !== n) continue;
          const baseIdx = new Set(combo.map((l) => l.idx));
          const elim: Placement[] = [];
          for (const ci of coverSet)
            for (const i of cover[ci]) {
              const li = baseKind === "rows" ? rowOf(i) : colOf(i);
              if (!baseIdx.has(li) && !values[i] && cands[i] & b) elim.push({ cell: i, digit: d });
            }
          if (elim.length) {
            const focus = combo.flatMap((l) => base[l.idx].filter((i) => !values[i] && cands[i] & b));
            return {
              technique,
              placements: [],
              eliminations: elim,
              focus,
              description: `${TECHNIQUES[technique].name} on ${d} in ${baseKind} ${combo
                .map((l) => l.idx + 1)
                .join(", ")}: ${d} can be removed from the crossing lines.`,
            };
          }
        }
      }
    }
    return null;
  };
}

function xyWing(values: Grid, cands: number[]): Step | null {
  const bivalue = [];
  for (let i = 0; i < 81; i++) if (!values[i] && popcount(cands[i]) === 2) bivalue.push(i);
  for (const pivot of bivalue) {
    const [a, b] = digitsOf(cands[pivot]);
    const wings = PEERS[pivot].filter((p) => !values[p] && popcount(cands[p]) === 2);
    for (const w1 of wings) {
      if (!(cands[w1] & bit(a)) || cands[w1] & bit(b)) continue;
      const c = digitsOf(cands[w1] & ~bit(a))[0];
      for (const w2 of wings) {
        if (w2 === w1) continue;
        if (cands[w2] !== (bit(b) | bit(c))) continue;
        const elim = PEERS[w1]
          .filter((i) => i !== pivot && i !== w2 && PEERS[w2].includes(i))
          .filter((i) => !values[i] && cands[i] & bit(c))
          .map((cell) => ({ cell, digit: c }));
        if (elim.length)
          return {
            technique: "xyWing",
            placements: [],
            eliminations: elim,
            focus: [pivot, w1, w2],
            description: `XY-Wing with pivot ${cellName(pivot)} {${a},${b}} and wings ${cellName(w1)}, ${cellName(
              w2,
            )}: ${c} can be removed from cells seeing both wings.`,
          };
      }
    }
  }
  return null;
}

const STRATEGIES: ((values: Grid, cands: number[]) => Step | null)[] = [
  hiddenSingle,
  nakedSingle,
  lockedCandidates,
  nakedSubset(2, "nakedPair"),
  hiddenSubset(2, "hiddenPair"),
  nakedSubset(3, "nakedTriple"),
  hiddenSubset(3, "hiddenTriple"),
  fish(2, "xWing"),
  xyWing,
  fish(3, "swordfish"),
  nakedSubset(4, "nakedQuad"),
  hiddenSubset(4, "hiddenQuad"),
];

/** Find the easiest next logical step, or null if none of our techniques apply. */
export function findStep(values: Grid, cands: number[]): Step | null {
  for (const s of STRATEGIES) {
    const step = s(values, cands);
    if (step) return step;
  }
  return null;
}

/** Apply a step in place. */
export function applyStep(values: Grid, cands: number[], step: Step): void {
  for (const { cell, digit } of step.placements) {
    values[cell] = digit;
    cands[cell] = 0;
    for (const p of PEERS[cell]) cands[p] &= ~bit(digit);
  }
  for (const { cell, digit } of step.eliminations) cands[cell] &= ~bit(digit);
}

export interface GradeResult {
  difficulty: Difficulty;
  solvedByLogic: boolean;
  hardest: Technique | null;
  steps: number;
}

export function grade(puzzle: Grid): GradeResult {
  const values = puzzle.slice();
  const cands = computeCandidates(values);
  let level = 1;
  let hardest: Technique | null = null;
  let steps = 0;
  while (values.some((v) => !v)) {
    const step = findStep(values, cands);
    if (!step) return { difficulty: "expert", solvedByLogic: false, hardest, steps };
    const l = TECHNIQUES[step.technique].level;
    if (l >= level) {
      level = l;
      hardest = step.technique;
    }
    applyStep(values, cands, step);
    steps++;
  }
  return { difficulty: LEVEL_NAMES[level], solvedByLogic: true, hardest, steps };
}
