"use client";

import { useState } from "react";
import type { Layer } from "@/lib/game/types";

const LAYERS: { id: Layer; label: string; key: string }[] = [
  { id: "normal", label: "Normal", key: "Z" },
  { id: "corner", label: "Corner", key: "X" },
  { id: "center", label: "Centre", key: "C" },
];

const CORNER_POS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const ICONS = {
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  erase: "M20 20H8l-5-5 10-10 8 8-6 7M7 9l8 8",
  multi: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

export interface ControlsProps {
  layer: Layer;
  remaining: number[]; // index 1..9
  multi: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onLayer: (l: Layer) => void;
  onDigit: (d: number) => void;
  onErase: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleMulti: () => void;
  onClearNotes: () => void;
  onRestart: () => void;
  onSettings: () => void;
}

export function Controls(p: ControlsProps) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="controls">
      <div className="layers" role="radiogroup" aria-label="Input mode">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={p.layer === l.id}
            className={p.layer === l.id ? "active" : undefined}
            onClick={() => p.onLayer(l.id)}
            title={`${l.label} (${l.key})`}
          >
            {l.label}
            <kbd>{l.key}</kbd>
          </button>
        ))}
      </div>

      <div className={`pad mode-${p.layer}`}>
        {Array.from({ length: 9 }, (_, k) => {
          const d = k + 1;
          const done = p.remaining[d] <= 0;
          return (
            <button key={d} className={done && p.layer === "normal" ? "done" : undefined} onClick={() => p.onDigit(d)} aria-label={`${p.layer} ${d}`}>
              {p.layer === "color" ? (
                <span className="swatch" style={{ background: `var(--c${d})` }} />
              ) : p.layer === "corner" ? (
                <span className={`pad-corner ${CORNER_POS[k]}`}>{d}</span>
              ) : p.layer === "center" ? (
                <span className="pad-center">{d}</span>
              ) : (
                <>
                  <span className="pad-digit">{d}</span>
                  <span className="pad-count">{done ? "✓" : p.remaining[d]}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="tools">
        <button onClick={p.onUndo} disabled={!p.canUndo} title="Undo (Ctrl+Z)">
          <Icon d={ICONS.undo} />
          <span>Undo</span>
        </button>
        <button onClick={p.onRedo} disabled={!p.canRedo} title="Redo (Ctrl+Y)">
          <Icon d={ICONS.redo} />
          <span>Redo</span>
        </button>
        <button onClick={p.onErase} title="Erase (Backspace)">
          <Icon d={ICONS.erase} />
          <span>Erase</span>
        </button>
        <button onClick={p.onToggleMulti} className={p.multi ? "active" : undefined} aria-pressed={p.multi} title="Multi-select (or Ctrl/Shift-click)">
          <Icon d={ICONS.multi} />
          <span>Multi</span>
        </button>
        <div className="menu-wrap">
          <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} title="More">
            <Icon d={ICONS.more} />
            <span>More</span>
          </button>
          {menu && (
            <div className="menu" onClick={() => setMenu(false)}>
              <button onClick={p.onClearNotes}>Clear all notes</button>
              <button onClick={p.onRestart}>Restart puzzle</button>
              <button onClick={p.onSettings}>Settings</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
