"use client";

import { useState, type CSSProperties } from "react";
import type { Layer } from "@/lib/game/types";
import { UndoIcon } from "@/components/icons/undo";
import { RedoIcon } from "@/components/icons/redo";
import { DeleteIcon } from "@/components/icons/delete";
import { LayoutGridIcon } from "@/components/icons/layout-grid";
import { MenuIcon } from "@/components/icons/menu";
import { ArrowLeftRightIcon } from "@/components/icons/arrow-left-right";
import { FlaskIcon } from "@/components/icons/flask";

const LAYERS: { id: Layer; label: string; key: string; cap?: string }[] = [
  { id: "normal", label: "Normal", key: "V" },
  { id: "corner", label: "Corner", key: "Space", cap: "␣" },
  { id: "center", label: "Centre", key: "X" },
  { id: "color", label: "Colour", key: "Z" },
];

const CORNER_POS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

export interface ControlsProps {
  layer: Layer;
  remaining: number[]; // index 1..9
  multi: boolean;
  testing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onLayer: (l: Layer) => void;
  onDigit: (d: number) => void;
  onErase: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleMulti: () => void;
  onSwapNotes: () => void;
  onStartTest: () => void;
  onKeepTest: () => void;
  onRevertTest: () => void;
  onClearNotes: () => void;
  onScreenshot: () => void;
  onRestart: () => void;
  onSettings: () => void;
}

export function Controls(p: ControlsProps) {
  // "closing" keeps the menu mounted while its exit animation plays.
  const [menu, setMenu] = useState<"open" | "closing" | null>(null);
  const closeMenu = () => {
    // With reduced motion there's no animation, so nothing would fire animationend.
    setMenu(matchMedia("(prefers-reduced-motion: reduce)").matches ? null : "closing");
  };
  return (
    <div className="controls">
      {p.testing && (
        <div className="test-bar" role="status">
          <span>
            <strong>Test mode</strong> · new entries are highlighted
          </span>
          <button className="ghost" onClick={p.onKeepTest} title="Keep what you entered">
            Keep
          </button>
          <button className="button" onClick={p.onRevertTest} title="Go back to the board before testing (T)">
            Revert
          </button>
        </div>
      )}
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
            <kbd>{l.cap ?? l.key}</kbd>
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
                <span className="swatch" style={{ background: `linear-gradient(var(--c${d}), var(--c${d})), var(--cell)` }} />
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
        <button onClick={p.onSwapNotes} title="Swap corner and centre notes in the selected cells (C)">
          <ArrowLeftRightIcon size={20} />
          <span>Swap</span>
        </button>
        <button
          onClick={p.testing ? p.onRevertTest : p.onStartTest}
          className={p.testing ? "active" : undefined}
          aria-pressed={p.testing}
          title={p.testing ? "Revert test (T)" : "Test mode: try digits, then revert in one tap (T)"}
        >
          <FlaskIcon size={20} />
          <span>Test</span>
        </button>
        <div className="menu-wrap">
          <button onClick={() => (menu === "open" ? closeMenu() : setMenu("open"))} aria-expanded={menu === "open"} title="More">
            <MenuIcon size={20} />
            <span>More</span>
          </button>
          {menu && (
            <div
              className={menu === "closing" ? "menu closing" : "menu"}
              onClick={closeMenu}
              onAnimationEnd={(e) => e.target === e.currentTarget && menu === "closing" && setMenu(null)}
            >
              <button onClick={p.onClearNotes}>Clear all notes</button>
              <button onClick={p.onScreenshot}>Copy screenshot</button>
              <button onClick={p.onRestart}>Restart puzzle</button>
              <button onClick={p.onSettings}>Settings</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
