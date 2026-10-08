"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { Controls } from "@/components/Controls";
import { SettingsSheet } from "@/components/SettingsSheet";
import { ensureDailyGame, parseDailyId } from "@/lib/daily";
import { capitalize, formatTime } from "@/lib/format";
import { initBoard, reducer, type Action } from "@/lib/game/reducer";
import { boardValues, type GameRecord, type Layer, type Settings } from "@/lib/game/types";
import { getGame, loadSettings, saveGame, saveSettings, useGame } from "@/lib/store";

const KEY_LAYERS: Record<string, Layer> = { KeyZ: "normal", KeyX: "corner", KeyC: "center" };
const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

export function PlayScreen({ id }: { id: string }) {
  const [initial, setInitial] = useState<GameRecord | null | undefined>(undefined);

  useEffect(() => {
    let rec = getGame(id);
    const daily = parseDailyId(id);
    if (!rec && daily) rec = ensureDailyGame(daily.date, daily.difficulty);
    setInitial(rec ?? null);
  }, [id]);

  if (initial === undefined) return <div className="screen center muted">Loading…</div>;
  if (initial === null)
    return (
      <div className="screen center">
        <p>This puzzle isn&apos;t on this device yet.</p>
        <Link className="button" href="/">
          Back home
        </Link>
      </div>
    );
  return <Game initial={initial} />;
}

function Game({ initial }: { initial: GameRecord }) {
  const [s, dispatch] = useReducer(reducer, undefined, () => initBoard(initial, loadSettings()));
  const [multi, setMulti] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSolved, setShowSolved] = useState(false);
  const lastSaved = useRef(initial.updatedAt);
  const stateRef = useRef(s);
  stateRef.current = s;

  // Persist every board change.
  useEffect(() => {
    if (s.rec.updatedAt > lastSaved.current) {
      lastSaved.current = s.rec.updatedAt;
      saveGame(s.rec);
    }
  }, [s.rec]);

  // Accept newer progress arriving from another device.
  const stored = useGame(initial.id);
  useEffect(() => {
    if (stored && stored.updatedAt > lastSaved.current) {
      lastSaved.current = stored.updatedAt;
      dispatch({ type: "replace", rec: stored });
    }
  }, [stored]);

  // Timer: runs only while visible, unpaused and unsolved.
  const solved = s.rec.status === "solved";
  useEffect(() => {
    if (paused || solved) return;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible") dispatch({ type: "tick", ms: now - last });
      last = now;
    }, 1000);
    return () => clearInterval(t);
  }, [paused, solved]);

  // Save elapsed time periodically and when leaving, so other devices see it.
  useEffect(() => {
    const flush = () => {
      const rec = stateRef.current.rec;
      if (getGame(rec.id)?.elapsedMs === rec.elapsedMs) return;
      const now = Date.now();
      lastSaved.current = now;
      saveGame({ ...rec, updatedAt: now });
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    const t = setInterval(flush, 15000);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  useEffect(() => {
    if (solved) setShowSolved(true);
  }, [solved]);

  const values = useMemo(() => boardValues(s.rec), [s.rec]);
  const remaining = useMemo(() => {
    const r = Array(10).fill(9);
    for (const v of values) if (v) r[v]--;
    return r;
  }, [values]);
  const highlightDigit = s.focusDigit ?? (s.selection.length === 1 ? values[s.selection[0]] || null : null);
  // Every cell filled but not solved: otherwise this state gives no feedback at all.
  const filledButWrong = !solved && values.every(Boolean);

  const act = (a: Action) => {
    if (!paused) dispatch(a);
  };

  const changeSettings = (next: Settings) => {
    saveSettings(next);
    dispatch({ type: "settings", settings: next });
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen || paused) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea")) return;
      const mod = e.ctrlKey || e.metaKey;
      const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);

      if (digit) {
        e.preventDefault();
        const d = Number(digit[1]);
        if (d === 0) return dispatch({ type: "erase" });
        const layer: Layer | undefined = e.shiftKey ? "corner" : mod ? "center" : undefined;
        return dispatch({ type: "input", digit: d, layer });
      }
      if (mod && e.code === "KeyZ") {
        e.preventDefault();
        return dispatch({ type: e.shiftKey ? "redo" : "undo" });
      }
      if (mod && e.code === "KeyY") {
        e.preventDefault();
        return dispatch({ type: "redo" });
      }
      if (mod && e.code === "KeyA") {
        e.preventDefault();
        return dispatch({ type: "selectAll" });
      }
      if (!mod && KEY_LAYERS[e.code]) return dispatch({ type: "setLayer", layer: KEY_LAYERS[e.code] });
      if (e.code === "Space") {
        e.preventDefault();
        return dispatch({ type: "cycleLayer" });
      }
      if (ARROWS[e.code]) {
        e.preventDefault();
        const [dr, dc] = ARROWS[e.code];
        return dispatch({ type: "move", dr, dc, extend: e.shiftKey || mod });
      }
      if (e.code === "Backspace" || e.code === "Delete") {
        e.preventDefault();
        return dispatch({ type: "erase" });
      }
      if (e.code === "Escape") return dispatch({ type: "deselect" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, paused]);

  return (
    <div className="screen play">
      <header className="play-head">
        <Link href="/" className="icon-button" aria-label="Back">
          ←
        </Link>
        <div className="play-title">
          <strong>{s.rec.title}</strong>
          {s.rec.difficulty && <span className={`badge ${s.rec.difficulty}`}>{capitalize(s.rec.difficulty)}</span>}
        </div>
        {s.settings.showTimer && <span className="timer">{formatTime(s.rec.elapsedMs)}</span>}
        {!solved && (
          <button className="icon-button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume" : "Pause"}>
            {paused ? "▶" : "❚❚"}
          </button>
        )}
      </header>

      <div className="play-body">
        <div className="board-wrap">
          <Board
            givens={s.rec.givens}
            cells={s.rec.cells}
            solution={s.rec.solution}
            selection={s.selection}
            settings={s.settings}
            highlightDigit={highlightDigit}
            paused={paused}
            multi={multi}
            onSelect={(cells, mode) => act({ type: "select", cells, mode })}
            onDoubleTap={(cell) => values[cell] && act({ type: "selectDigit", digit: values[cell] })}
          />
          {paused && (
            <button className="pause-overlay" onClick={() => setPaused(false)}>
              Paused · tap to resume
            </button>
          )}
        </div>

        <div className="side">
          {filledButWrong && (
            <div className="board-message" role="status">
              <p>
                <strong>All filled in, but something&apos;s off.</strong> At least one digit doesn&apos;t match the solution.
              </p>
              {!s.settings.showMistakes && <small>Turn on “Show mistakes instantly” in Settings to see which.</small>}
            </div>
          )}
          <Controls
            layer={s.layer}
            remaining={remaining}
            multi={multi}
            canUndo={s.past.length > 0 && !solved}
            canRedo={s.future.length > 0}
            onLayer={(layer) => dispatch({ type: "setLayer", layer })}
            onDigit={(digit) => act({ type: "input", digit })}
            onErase={() => act({ type: "erase" })}
            onUndo={() => act({ type: "undo" })}
            onRedo={() => act({ type: "redo" })}
            onToggleMulti={() => setMulti((m) => !m)}
            onClearNotes={() => act({ type: "clearNotes" })}
            onRestart={() => confirm("Restart this puzzle? All progress will be cleared.") && act({ type: "restart" })}
            onSettings={() => setSettingsOpen(true)}
          />
        </div>
      </div>

      {showSolved && (
        <div className="sheet-backdrop" onClick={() => setShowSolved(false)}>
          <div className="sheet solved" onClick={(e) => e.stopPropagation()}>
            <h2>Solved!</h2>
            <p>
              {formatTime(s.rec.elapsedMs)}
              {s.rec.hintsUsed ? ` · ${s.rec.hintsUsed} hint${s.rec.hintsUsed > 1 ? "s" : ""}` : " · no hints"}
            </p>
            <div className="row">
              <Link className="button" href="/">
                Home
              </Link>
              <button className="ghost" onClick={() => setShowSolved(false)}>
                Admire the board
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && <SettingsSheet settings={s.settings} onChange={changeSettings} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
