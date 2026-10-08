"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { capitalize } from "@/lib/format";
import { newGame } from "@/lib/game/types";
import { DAILY_DIFFICULTIES, generatePuzzle, type DailyDifficulty } from "@/lib/sudoku/generator";
import { saveGame } from "@/lib/store";

export function GenerateSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<DailyDifficulty | null>(null);

  const generate = (difficulty: DailyDifficulty) => {
    setBusy(difficulty);
    // Let the busy state paint before the (synchronous) generation work runs.
    setTimeout(() => {
      const p = generatePuzzle(`doku-generated:${crypto.randomUUID()}`, difficulty);
      const rec = newGame({
        id: `generated-${crypto.randomUUID()}`,
        source: "manual",
        title: `${capitalize(difficulty)} · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        difficulty,
        givens: p.puzzle,
        solution: p.solution,
      });
      saveGame(rec);
      router.push(`/play/${rec.id}`);
    }, 0);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Generate a puzzle" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Generate a puzzle</h2>
          <button className="ghost" onClick={onClose}>
            Done
          </button>
        </div>
        <p className="muted">Pick a difficulty for a fresh, randomly generated puzzle.</p>
        <div className="row">
          {DAILY_DIFFICULTIES.map((d) => (
            <button key={d} className="button" disabled={busy !== null} onClick={() => generate(d)}>
              {busy === d ? "Generating…" : capitalize(d)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
