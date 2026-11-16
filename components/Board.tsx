"use client";

import { useMemo, useRef } from "react";
import { BOXES, PEERS, digitsOf, findConflicts } from "@/lib/sudoku/core";
import type { CellState, Settings } from "@/lib/game/types";
import { CORNER_ORDER } from "@/lib/screenshot";

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
  /** Test mode: the cells as they were before testing; digits entered since are marked. */
  testBase?: CellState[] | null;
  /** Pointer selection: "replace" a fresh tap, "toggle" with modifier/multi mode, "add" while dragging. */
  onSelect?: (cells: number[], mode: "replace" | "add" | "toggle") => void;
  onDoubleTap?: (cell: number) => void;
  multi?: boolean;
}

function colorBackground(mask: number): string | undefined {
  const colors = digitsOf(mask);
  if (!colors.length) return undefined;
  // The colours are translucent: --cell underneath keeps the grid lines from showing through.
  if (colors.length === 1) return `linear-gradient(var(--c${colors[0]}), var(--c${colors[0]})), var(--cell)`;
  const step = 100 / colors.length;
  const stops = colors.map((c, i) => `var(--c${c}) ${i * step}% ${(i + 1) * step}%`).join(", ");
  return `conic-gradient(from 45deg, ${stops}), var(--cell)`;
}

function Marks({ cell, layout, hl }: { cell: CellState; layout: Settings["cornerLayout"]; hl: number | null }) {
  const corner = digitsOf(cell.c);
  const center = digitsOf(cell.m);
  // With both kinds of notes, corner marks keep to the top and bottom rows and centre marks
  // get the middle row to themselves, so the two never overlap.
  if (corner.length && center.length) {
    const half = Math.ceil(corner.length / 2);
    const row = (ds: number[]) => (
      <div>
        {ds.map((d) => (
          <span key={d} className={d === hl ? "hl" : undefined}>
            {d}
          </span>
        ))}
      </div>
    );
    return (
      <>
        <div className="marks-corner split" aria-hidden>
          {row(corner.slice(0, half))}
          {row(corner.slice(half))}
        </div>
        <div className={`marks-center squeeze${center.length > 4 ? " dense" : ""}`} aria-hidden>
          {center.map((d) => (
            <span key={d} className={d === hl ? "hl" : undefined}>
              {d}
            </span>
          ))}
        </div>
      </>
    );
  }
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
  const { givens, cells, solution, selection, settings, highlightDigit, flagged, hintFocus, hintTargets, paused, testBase } = props;
  const ref = useRef<HTMLDivElement>(null);
  // deselect: the press started on the only selected cell; it deselects on release unless it became a drag.
  const drag = useRef<{ active: boolean; last: number; deselect: boolean }>({ active: false, last: -1, deselect: false });
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
    // Double-tap only means something on a filled cell; on an empty one it's just another tap.
    if (values[cell] && lastTap.current.cell === cell && now - lastTap.current.at < 350) {
      props.onDoubleTap?.(cell);
      lastTap.current = { cell: -1, at: 0 };
      return;
    }
    lastTap.current = { cell, at: now };
    const multi = props.multi || e.ctrlKey || e.metaKey || e.shiftKey;
    const deselect = !multi && selection.length === 1 && selection[0] === cell;
    if (!deselect) props.onSelect([cell], multi ? (selected.has(cell) && !e.shiftKey ? "toggle" : "add") : "replace");
    drag.current = { active: true, last: cell, deselect };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active || !props.onSelect) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell < 0 || cell === drag.current.last) return;
    drag.current.last = cell;
    drag.current.deselect = false;
    props.onSelect([cell], "add");
  };

  const endDrag = (e: React.PointerEvent) => {
    if (e.type === "pointerup" && drag.current.active && drag.current.deselect) props.onSelect?.([], "replace");
    drag.current = { active: false, last: -1, deselect: false };
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
              testBase && v && !given && testBase[i].v !== v && "tested",
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
