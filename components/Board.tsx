"use client";

import { useMemo, useRef } from "react";
import { BOXES, PEERS, digitsOf, findConflicts } from "@/lib/sudoku/core";
import type { CellState, Settings } from "@/lib/game/types";

export interface BoardProps {
  givens: string;
  cells: CellState[];
  solution?: string;
  selection: number[];
  settings: Settings;
  highlightDigit: number | null;
  flagged?: number[];
  hintFocus?: number[];
  hintTargets?: number[];
  paused?: boolean;
  /** Pointer selection: "replace" a fresh tap, "toggle" with modifier/multi mode, "add" while dragging. */
  onSelect?: (cells: number[], mode: "replace" | "add" | "toggle") => void;
  onDoubleTap?: (cell: number) => void;
  multi?: boolean;
}

// SudokuPad-style corner positions, filled in order: corners, then edges, then centre.
const CORNER_ORDER = [0, 2, 6, 8, 1, 7, 3, 5, 4];

function colorBackground(mask: number): string | undefined {
  const colors = digitsOf(mask);
  if (!colors.length) return undefined;
  if (colors.length === 1) return `var(--c${colors[0]})`;
  const step = 100 / colors.length;
  const stops = colors.map((c, i) => `var(--c${c}) ${i * step}% ${(i + 1) * step}%`).join(", ");
  return `conic-gradient(from 45deg, ${stops})`;
}

function Marks({ cell, layout, hl }: { cell: CellState; layout: Settings["cornerLayout"]; hl: number | null }) {
  const corner = digitsOf(cell.c);
  const center = digitsOf(cell.m);
  const slots: (number | null)[] = Array(9).fill(null);
  if (layout === "grid") corner.forEach((d) => (slots[d - 1] = d));
  else corner.forEach((d, i) => (slots[CORNER_ORDER[i]] = d));
  return (
    <>
      {corner.length > 0 && (
        <div className="marks-corner" aria-hidden>
          {slots.map((d, i) => (
            <span key={i} className={d && d === hl ? "hl" : undefined}>
              {d ?? ""}
            </span>
          ))}
        </div>
      )}
      {center.length > 0 && (
        <div className={`marks-center${center.length > 4 ? " dense" : ""}`} aria-hidden>
          {center.map((d) => (
            <span key={d} className={d === hl ? "hl" : undefined}>
              {d}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function Board(props: BoardProps) {
  const { givens, cells, solution, selection, settings, highlightDigit, flagged, hintFocus, hintTargets, paused } = props;
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ active: boolean; last: number }>({ active: false, last: -1 });
  const lastTap = useRef<{ cell: number; at: number }>({ cell: -1, at: 0 });

  const values = useMemo(
    () => cells.map((c, i) => (givens[i] >= "1" && givens[i] <= "9" ? Number(givens[i]) : c.v)),
    [cells, givens],
  );
  const conflicts = useMemo(() => (settings.showConflicts ? findConflicts(values) : new Set<number>()), [values, settings.showConflicts]);
  const selected = useMemo(() => new Set(selection), [selection]);
  const peers = useMemo(() => {
    if (!settings.highlightPeers || selection.length !== 1) return new Set<number>();
    return new Set(PEERS[selection[0]]);
  }, [selection, settings.highlightPeers]);
  const flaggedSet = useMemo(() => new Set(flagged), [flagged]);
  const focusSet = useMemo(() => new Set(hintFocus), [hintFocus]);
  const targetSet = useMemo(() => new Set(hintTargets), [hintTargets]);

  const cellAt = (x: number, y: number): number => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return -1;
    const col = Math.floor(((x - r.left) / r.width) * 9);
    const row = Math.floor(((y - r.top) / r.height) * 9);
    return row >= 0 && row < 9 && col >= 0 && col < 9 ? row * 9 + col : -1;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!props.onSelect || paused) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell < 0) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    const now = performance.now();
    if (lastTap.current.cell === cell && now - lastTap.current.at < 350) {
      props.onDoubleTap?.(cell);
      lastTap.current = { cell: -1, at: 0 };
      return;
    }
    lastTap.current = { cell, at: now };
    const multi = props.multi || e.ctrlKey || e.metaKey || e.shiftKey;
    props.onSelect([cell], multi ? (selected.has(cell) && !e.shiftKey ? "toggle" : "add") : "replace");
    drag.current = { active: true, last: cell };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active || !props.onSelect) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell < 0 || cell === drag.current.last) return;
    drag.current.last = cell;
    props.onSelect([cell], "add");
  };

  const endDrag = () => {
    drag.current.active = false;
  };

  return (
    <div
      ref={ref}
      className={`board${paused ? " paused" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="grid"
      aria-label="Sudoku board"
    >
      {BOXES.map((box, b) => (
        <div className="box" key={b}>
          {box.map((i) => {
            const cell = cells[i];
            const v = values[i];
            const given = givens[i] >= "1" && givens[i] <= "9";
            const wrong =
              !given && v && solution && (flaggedSet.has(i) || settings.showMistakes) && String(v) !== solution[i];
            const same = settings.highlightSameDigit && highlightDigit !== null && v === highlightDigit;
            const cls = [
              "cell",
              given && "given",
              selected.has(i) && "selected",
              peers.has(i) && "peer",
              same && "same",
              conflicts.has(i) && "conflict",
              wrong && "wrong",
              focusSet.has(i) && "hint-focus",
              targetSet.has(i) && "hint-target",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={i} className={cls} style={{ background: colorBackground(cell.k) }} role="gridcell" aria-label={v ? String(v) : "empty"}>
                <div className="cell-overlay" />
                {paused ? null : v ? (
                  <span className="digit">{v}</span>
                ) : (
                  <Marks cell={cell} layout={settings.cornerLayout} hl={settings.highlightSameDigit ? highlightDigit : null} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
