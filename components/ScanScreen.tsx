"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { capitalize } from "@/lib/format";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { DEFAULT_SETTINGS, emptyCells, newGame } from "@/lib/game/types";
import { colOf, findConflicts, gridToString, rowOf } from "@/lib/sudoku/core";
import { grade } from "@/lib/sudoku/logic";
import { solve } from "@/lib/sudoku/solver";
import { saveGame } from "@/lib/store";
import { getAccessToken } from "@/lib/sync/engine";

type Phase = "pick" | "reading" | "review";

const EDITOR_SETTINGS = { ...DEFAULT_SETTINGS, highlightPeers: true, highlightSameDigit: false, showConflicts: true };
const BLANK_CELLS = emptyCells();

function parseUnsure(notes: string): number[] {
  return [...notes.matchAll(/R([1-9])\s*C([1-9])/gi)].map((m) => (Number(m[1]) - 1) * 9 + Number(m[2]) - 1);
}

export function ScanScreen({ manual = false }: { manual?: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>(manual ? "review" : "pick");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [grid, setGrid] = useState<number[]>(() => Array(81).fill(0));
  const [cursor, setCursor] = useState(0);
  const [unsure, setUnsure] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPhase("reading");
    try {
      const prepared = await prepareImage(file);
      setImage(prepared);
      const token = await getAccessToken();
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ image: prepared.base64, mediaType: prepared.mediaType }),
      });
      const data = (await res.json()) as { grid?: string; notes?: string; error?: string };
      if (!res.ok || !data.grid) throw new Error(data.error ?? "Scan failed.");
      setGrid([...data.grid].map((ch) => (ch >= "1" && ch <= "9" ? Number(ch) : 0)));
      setUnsure(parseUnsure(data.notes ?? ""));
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("pick");
    }
  };

  const check = useMemo(() => {
    const givens = grid.filter(Boolean).length;
    const conflicts = findConflicts(grid);
    if (conflicts.size) return { ok: false, msg: "Some digits repeat in a row, column or box (shown in red)." } as const;
    if (givens < 17) return { ok: false, msg: `${givens} digits entered. A valid sudoku needs at least 17.` } as const;
    const res = solve(grid, { limit: 2 });
    if (res.count === 0) return { ok: false, msg: "This grid has no solution. A digit was probably misread." } as const;
    if (res.count > 1) return { ok: false, msg: "This grid has more than one solution. A digit is probably missing." } as const;
    return { ok: true, solution: res.solution!, difficulty: grade(grid).difficulty, givens } as const;
  }, [grid]);

  const setCell = (digit: number) =>
    setGrid((g) => {
      const next = g.slice();
      next[cursor] = next[cursor] === digit ? 0 : digit;
      return next;
    });

  useEffect(() => {
    if (phase !== "review") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input")) return;
      const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
      if (digit) {
        e.preventDefault();
        setCell(Number(digit[1]));
        if (Number(digit[1])) setCursor((c) => Math.min(80, c + 1));
        return;
      }
      if (e.code === "Backspace" || e.code === "Delete") {
        e.preventDefault();
        setGrid((g) => g.map((v, i) => (i === cursor ? 0 : v)));
        return;
      }
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[e.code]) {
        e.preventDefault();
        const [dr, dc] = moves[e.code];
        setCursor((c) => ((rowOf(c) + dr + 9) % 9) * 9 + ((colOf(c) + dc + 9) % 9));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const save = () => {
    if (!check.ok) return;
    const source = image ? "scan" : "manual";
    const fallbackTitle = `${image ? "Scanned" : "Puzzle"} · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    const rec = newGame({
      id: `${source}-${crypto.randomUUID()}`,
      source,
      title: title.trim() || fallbackTitle,
      difficulty: check.difficulty,
      givens: gridToString(grid),
      solution: check.solution.join(""),
      thumbnail: image?.thumbnail,
    });
    saveGame(rec);
    router.push(`/play/${rec.id}`);
  };

  return (
    <div className="screen scan">
      <header className="play-head">
        <Link href="/" className="icon-button" aria-label="Back">
          ←
        </Link>
        <div className="play-title">
          <strong>{manual ? "Enter a puzzle" : "Scan a puzzle"}</strong>
        </div>
      </header>

      {phase === "pick" && (
        <div className="scan-pick">
          <p className="muted">Take a photo of a sudoku from a newspaper, book or screen. Fill the frame with the grid and keep it as flat as you can.</p>
          <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="button big" onClick={() => fileInput.current?.click()}>
            Take or choose photo
          </button>
          {error && (
            <div className="error">
              <p>{error}</p>
              <button className="ghost" onClick={() => setPhase("review")}>
                Type it in instead
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "reading" && (
        <div className="scan-pick">
          {image && <img className="scan-preview" src={image.previewUrl} alt="Your photo" />}
          <p className="muted pulse">Reading the grid…</p>
        </div>
      )}

      {phase === "review" && (
        <div className="play-body">
          <div className="board-wrap">
            <Board
              givens={gridToString(grid)}
              cells={BLANK_CELLS}
              selection={[cursor]}
              settings={EDITOR_SETTINGS}
              highlightDigit={null}
              hintTargets={unsure}
              onSelect={(cells) => setCursor(cells[0])}
            />
          </div>
          <div className="side">
            {image && (
              <details className="photo-ref" open>
                <summary>Your photo</summary>
                <img src={image.previewUrl} alt="Scanned puzzle" />
              </details>
            )}
            <p className="muted">
              {image ? "Check the grid against your photo. Tap a cell and type to fix it." : "Tap a cell and type the givens."}
              {unsure.length > 0 && " Outlined cells were hard to read."}
            </p>
            <div className="pad pad-normal">
              {Array.from({ length: 9 }, (_, k) => (
                <button key={k} onClick={() => setCell(k + 1)}>
                  <span className="pad-digit">{k + 1}</span>
                </button>
              ))}
            </div>
            <div className="row">
              <button className="ghost" onClick={() => setGrid((g) => g.map((v, i) => (i === cursor ? 0 : v)))}>
                Clear cell
              </button>
              <button className="ghost" onClick={() => confirm("Clear the whole grid?") && setGrid(Array(81).fill(0))}>
                Clear all
              </button>
            </div>
            <div className={`validation ${check.ok ? "ok" : "bad"}`}>
              {check.ok ? (
                <p>
                  ✓ Unique solution · {check.givens} givens · <strong>{capitalize(check.difficulty)}</strong>
                </p>
              ) : (
                <p>{check.msg}</p>
              )}
            </div>
            <input className="text" placeholder="Name (optional), e.g. Sunday paper" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="button big" disabled={!check.ok} onClick={save}>
              Save &amp; play
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
