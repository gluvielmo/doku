"use client";

import { useState, type CSSProperties } from "react";
import type { Layer } from "@/lib/game/types";
import { UndoIcon } from "@/components/icons/undo";
import { RedoIcon } from "@/components/icons/redo";
import { DeleteIcon } from "@/components/icons/delete";
import { LayoutGridIcon } from "@/components/icons/layout-grid";
import { MenuIcon } from "@/components/icons/menu";

const LAYERS: { id: Layer; label: string; key: string }[] = [
  { id: "normal", label: "Normal", key: "Z" },
  { id: "corner", label: "Corner", key: "X" },
  { id: "center", label: "Centre", key: "C" },
];

const CORNER_POS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

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
        <span
          className="layers-indicator"
          style={{ "--i": LAYERS.findIndex((l) => l.id === p.layer) } as CSSProperties}
          aria-hidden
        />
        {LAYERS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={p.layer === l.id}
            className={p.layer === l.id ? "active" : undefined}
            onClick={() => p.onLayer(l.id)}
            title={`${l.label} (${l.key})`}
          >
            <span className="layer-label">{l.label}</span>
            <kbd>{l.key}</kbd>
          </button>
        ))}
      </div>

      <div className={`pad mode-${p.layer}`}>
        {Array.from({ length: 9 }, (_, k) => {
          const d = k + 1;
          const done = p.remaining[d] <= 0;
          return (
            <button key={d} className={done && p.layer === "normal" ? "beveled done" : "beveled"} onClick={() => p.onDigit(d)} aria-label={`${p.layer} ${d}`}>
              {p.layer === "color" ? (
                <span className="swatch" style={{ background: `var(--c${d})` }} />
              ) : p.layer === "corner" ? (
                <span className={`pad-corner ${CORNER_POS[k]}`}>{d}</span>
              ) : p.layer === "center" ? (
                <span className="pad-center">{d}</span>
              ) : (
                <>
                  <span className="pad-digit">{d}</span>
                  <span key={p.remaining[d]} className="pad-count flip">
                    {done ? "✓" : p.remaining[d]}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="tools">
        <button onClick={p.onUndo} disabled={!p.canUndo} title="Undo (Ctrl+Z)">
          <UndoIcon size={20} />
          <span>Undo</span>
        </button>
        <button onClick={p.onRedo} disabled={!p.canRedo} title="Redo (Ctrl+Y)">
          <RedoIcon size={20} />
          <span>Redo</span>
        </button>
        <button onClick={p.onErase} title="Erase (Backspace)">
          <DeleteIcon size={20} />
          <span>Erase</span>
        </button>
        <button onClick={p.onToggleMulti} className={p.multi ? "active" : undefined} aria-pressed={p.multi} title="Multi-select (or Ctrl/Shift-click)">
          <LayoutGridIcon size={20} />
          <span>Multi</span>
        </button>
        <div className="menu-wrap">
          <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} title="More">
            <MenuIcon size={20} />
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
