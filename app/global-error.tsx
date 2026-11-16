"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report";

// Replaces the root layout when it fails, so it can't rely on globals.css.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => reportError(error, { source: "global-error" }), [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4ebe0", color: "#3a2a1c" }}>
        <title>Something went wrong · Doku</title>
        <main style={{ minHeight: "100dvh", display: "grid", placeContent: "center", gap: 16, padding: 16, textAlign: "center" }}>
          <h1 style={{ margin: 0 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#8a7260" }}>Your progress is saved on this device.</p>
          <button
            onClick={() => retry()}
            style={{ justifySelf: "center", minHeight: 44, padding: "0 18px", border: 0, borderRadius: 10, background: "#8a5a2b", color: "#fff8ef", font: "inherit", fontWeight: 600 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
