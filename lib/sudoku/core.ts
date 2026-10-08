// Board geometry and small helpers shared by the solver, grader and UI.
// A grid is a flat array of 81 numbers, row-major, 0 = empty.

export type Grid = number[];

export const ALL = 0x1ff; // bits 0..8 => digits 1..9

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

export const bit = (d: number) => 1 << (d - 1);

export function popcount(m: number): number {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
}

export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}

export const ROWS: number[][] = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c));
export const COLS: number[][] = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c));
export const BOXES: number[][] = Array.from({ length: 9 }, (_, b) =>
  Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)),
);

export type UnitKind = "row" | "column" | "box";
export interface Unit {
  kind: UnitKind;
  index: number;
  cells: number[];
}

export const UNITS: Unit[] = [
  ...ROWS.map((cells, index) => ({ kind: "row" as const, index, cells })),
  ...COLS.map((cells, index) => ({ kind: "column" as const, index, cells })),
  ...BOXES.map((cells, index) => ({ kind: "box" as const, index, cells })),
];

export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const set = new Set<number>([...ROWS[rowOf(i)], ...COLS[colOf(i)], ...BOXES[boxOf(i)]]);
  set.delete(i);
  return [...set];
});

export function parseGrid(s: string): Grid {
  const clean = s.replace(/\s/g, "");
  if (clean.length !== 81) throw new Error(`Expected 81 cells, got ${clean.length}`);
  return [...clean].map((ch) => (ch >= "1" && ch <= "9" ? Number(ch) : 0));
}

export function gridToString(g: Grid): string {
  return g.map((v) => (v ? String(v) : ".")).join("");
}

export function cellName(i: number): string {
  return `R${rowOf(i) + 1}C${colOf(i) + 1}`;
}

/** Cells whose value repeats within a row, column or box. */
export function findConflicts(g: Grid): Set<number> {
  const bad = new Set<number>();
  for (const u of UNITS) {
    const seen = new Map<number, number>();
    for (const i of u.cells) {
      const v = g[i];
      if (!v) continue;
      const prev = seen.get(v);
      if (prev !== undefined) {
        bad.add(prev);
        bad.add(i);
      } else seen.set(v, i);
    }
  }
  return bad;
}

/** Candidate mask for each empty cell based on placed values only. */
export function computeCandidates(g: Grid): number[] {
  const out = new Array<number>(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    let m = ALL;
    for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
    out[i] = m;
  }
  return out;
}
