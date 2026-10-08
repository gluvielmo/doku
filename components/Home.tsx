"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountSheet, SyncPill } from "@/components/AccountSheet";
import { GenerateSheet } from "@/components/GenerateSheet";
import { DAILY_DIFFICULTIES, formatDate, localDate, shiftDate } from "@/lib/daily";
import { capitalize, formatTime } from "@/lib/format";
import { dailyId, progressOf, type GameRecord } from "@/lib/game/types";
import { deleteGame, useGames } from "@/lib/store";

function Status({ game }: { game?: GameRecord }) {
  if (!game || game.updatedAt === 0) return <span className="muted">New</span>;
  if (game.status === "solved") return <span className="solved-text">✓ {formatTime(game.elapsedMs)}</span>;
  return (
    <span className="muted">
      {Math.round(progressOf(game) * 100)}% · {formatTime(game.elapsedMs)}
    </span>
  );
}

function Progress({ game }: { game: GameRecord }) {
  return (
    <div className="progress" aria-hidden>
      <div style={{ width: `${(game.status === "solved" ? 1 : progressOf(game)) * 100}%` }} />
    </div>
  );
}

export function Home() {
  const games = useGames();
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [account, setAccount] = useState(false);
  const [generate, setGenerate] = useState(false);

  // Dates depend on the device's timezone, so compute them on the client.
  useEffect(() => {
    const t = localDate();
    setToday(t);
    setDate(t);
  }, []);

  const byId = new Map(games.map((g) => [g.id, g]));
  const current = games.find((g) => g.status === "playing" && g.updatedAt > 0);
  const mine = games.filter((g) => g.source !== "daily");

  return (
    <div className="screen home">
      <header className="home-head">
        <h1>Doku</h1>
        <SyncPill onClick={() => setAccount(true)} />
      </header>

      {current && (
        <Link href={`/play/${current.id}`} className="card continue">
          <div>
            <small className="eyebrow">Continue</small>
            <strong>{current.title}</strong>
            <Status game={current} />
          </div>
          <Progress game={current} />
        </Link>
      )}

      <section>
        <div className="section-head">
          <h2>Daily</h2>
          {date && today && (
            <div className="date-nav">
              <button className="icon-button" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
                ‹
              </button>
              <span>{date === today ? "Today" : formatDate(date)}</span>
              <button className="icon-button" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today} aria-label="Next day">
                ›
              </button>
            </div>
          )}
        </div>
        <div className="daily-grid">
          {date &&
            DAILY_DIFFICULTIES.map((d) => {
              const game = byId.get(dailyId(date, d));
              return (
                <Link key={d} href={`/play/${dailyId(date, d)}`} className={`card daily ${d}`}>
                  <span className={`badge ${d}`}>{capitalize(d)}</span>
                  <Status game={game} />
                  {game && game.updatedAt > 0 && <Progress game={game} />}
                </Link>
              );
            })}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>My puzzles</h2>
        </div>
        <div className="row">
          <Link href="/scan" className="button">
            Scan a puzzle
          </Link>
          <Link href="/scan/manual" className="button ghost">
            Type one in
          </Link>
          <button className="button ghost" onClick={() => setGenerate(true)}>
            Generate new puzzle
          </button>
        </div>
        {mine.length === 0 ? (
          <p className="muted">Puzzles you scan from newspapers or books show up here.</p>
        ) : (
          <ul className="puzzle-list">
            {mine.map((g) => (
              <li key={g.id}>
                <Link href={`/play/${g.id}`} className="card puzzle">
                  {g.thumbnail ? <img src={g.thumbnail} alt="" /> : <div className="thumb-placeholder">#</div>}
                  <div className="puzzle-info">
                    <strong>{g.title}</strong>
                    <span>
                      {g.difficulty && <span className={`badge ${g.difficulty}`}>{capitalize(g.difficulty)}</span>} <Status game={g} />
                    </span>
                    <Progress game={g} />
                  </div>
                </Link>
                <button
                  className="icon-button delete"
                  aria-label={`Delete ${g.title}`}
                  onClick={() => confirm(`Delete "${g.title}"?`) && deleteGame(g.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {account && <AccountSheet onClose={() => setAccount(false)} />}
      {generate && <GenerateSheet onClose={() => setGenerate(false)} />}
    </div>
  );
}
