"use client";

import { createUISFX, type CueName, type UISFXPlayer } from "uisfx";
import { PEERS } from "@/lib/sudoku/core";
import type { Action, BoardState } from "@/lib/game/reducer";
import { boardValues } from "@/lib/game/types";

let ui: UISFXPlayer | null = null;

function play(cue: CueName) {
  if (typeof window === "undefined") return;
  ui ??= createUISFX({ pack: "mechanical", volume: 0.5 });
  const player = ui;
  // unlock() must start inside the user gesture; it resolves immediately once the context is running.
  void player.unlock().then((ok) => ok && player.play(cue));
}

const count = (values: number[], d: number) => values.reduce((n, v) => n + (v === d ? 1 : 0), 0);

/** Picks a cue from what an action actually changed, so no-ops (e.g. typing on a given) stay silent. */
export function playMoveSound(prev: BoardState, next: BoardState, a: Action) {
  if (!next.settings.sound || next.rec.cells === prev.rec.cells) return;
  if (prev.rec.status !== "solved" && next.rec.status === "solved") return play("achievement");

  switch (a.type) {
    case "undo":
      return play("undo");
    case "redo":
      return play("redo");
    case "erase":
    case "clearNotes":
      return play("delete");
    case "input": {
      if ((a.layer ?? prev.layer) !== "normal") return play("typing");
      const placed = next.selection.filter((i) => next.rec.cells[i].v === a.digit && prev.rec.cells[i].v !== a.digit);
      if (!placed.length) return play("release");
      const values = boardValues(next.rec);
      // Only signal an error the board itself is showing, so the sound never gives away more.
      const wrong = placed.some((i) => String(a.digit) !== next.rec.solution[i]);
      const clash = placed.some((i) => PEERS[i].some((p) => values[p] === a.digit));
      if (next.settings.showMistakes ? wrong : next.settings.showConflicts && clash) return play("error");
      if (count(values, a.digit) === 9) return play("check");
      return play("press");
    }
  }
}
