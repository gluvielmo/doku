import type { GameRecord } from "@/lib/game/types";

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Title with the day it was added, like the daily titles carry. Older titles that already end in a date keep it. */
export function puzzleTitle(game: GameRecord): string {
  if (game.source === "daily" || !game.createdAt) return game.title;
  const added = new Date(game.createdAt);
  if (game.title.endsWith(added.toLocaleDateString(undefined, { month: "short", day: "numeric" }))) return game.title;
  return `${game.title} · ${added.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
}
