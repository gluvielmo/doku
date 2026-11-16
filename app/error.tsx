"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/report";
import { feedbackHref } from "@/lib/site";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => reportError(error, { source: "error-boundary" }), [error]);
  const feedback = feedbackHref("Doku: something went wrong");
  return (
    <main className="screen center">
      <h1>Something went wrong</h1>
      <p className="muted">Your progress is saved on this device. Try again, or go back to your puzzles.</p>
      <div className="row">
        <button className="button" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className="button ghost">
          Back to puzzles
        </Link>
      </div>
      {feedback && (
        <a className="muted" href={feedback}>
          Tell me what happened
        </a>
      )}
    </main>
  );
}
