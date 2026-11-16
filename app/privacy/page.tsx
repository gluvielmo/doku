import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy · Doku",
  description: "What Doku stores, who processes it, and how to delete it.",
};

const UPDATED = "16 November 2026";

export default function PrivacyPage() {
  return (
    <main className="screen prose">
      <Link href="/" className="ghost back-link">
        ← Doku
      </Link>
      <h1>Privacy</h1>
      <p className="muted">Last updated {UPDATED}</p>

      <p>
        Doku is a sudoku app. You can play without an account; your progress is then saved only in this browser. This page explains what changes when you
        sign in or scan a puzzle.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>Your account</strong>: your email address, and if you use Google sign-in, the name and profile picture Google shares. It is used only to sign
          you in.
        </li>
        <li>
          <strong>Your puzzles and progress</strong>: the grids, your entries and marks, timers and settings for each game, so they sync between your devices.
          For scanned puzzles this includes a small thumbnail of your photo.
        </li>
        <li>
          <strong>Scan count</strong>: how many puzzles you scanned each day, to apply the daily limit.
        </li>
      </ul>

      <h2>Scanning photos</h2>
      <p>
        When you scan a puzzle, the photo is sent to Anthropic&apos;s Claude API to read the digits. Doku doesn&apos;t keep the full photo. Anthropic processes it
        under its commercial terms, which don&apos;t allow it to be used to train models. Avoid photographing anything other than the puzzle.
      </p>

      <h2>Usage and errors</h2>
      <p>
        Doku uses Vercel Web Analytics to count page views. It sets no cookies and doesn&apos;t identify you. When something breaks, the app sends an error report
        with the error message, the page address and your browser type, so it can be fixed.
      </p>

      <h2>Who processes your data</h2>
      <ul>
        <li>
          <strong>Supabase</strong>: accounts and synced puzzles.
        </li>
        <li>
          <strong>Vercel</strong>: hosting, analytics and error logs.
        </li>
        <li>
          <strong>Anthropic</strong>: reading scanned photos.
        </li>
        <li>
          <strong>Google</strong>: only if you choose Google sign-in.
        </li>
      </ul>
      <p>Doku doesn&apos;t sell your data, show ads, or share it with anyone else.</p>

      <h2>Deleting your data</h2>
      <p>
        Open <strong>Sync</strong> on the home screen and choose <strong>Delete account</strong>. This permanently removes your account, synced puzzles and scan
        history. Progress saved in this browser stays until you clear the site&apos;s data.
      </p>

      {CONTACT_EMAIL && (
        <>
          <h2>Contact</h2>
          <p>
            Questions or requests about your data: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </>
      )}
    </main>
  );
}
