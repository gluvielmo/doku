// Sends client-side errors to /api/client-error, which writes them to the Vercel function logs.

let sent = 0;

export function reportError(error: unknown, extra?: Record<string, string>) {
  if (typeof window === "undefined" || sent >= 10) return; // cap per page load so a render loop can't flood the logs
  sent++;
  const err = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({
    message: err.message.slice(0, 500),
    stack: err.stack?.slice(0, 2000),
    digest: (err as { digest?: string }).digest,
    url: location.pathname,
    ...extra,
  });
  try {
    if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    }
  } catch {
    // Reporting must never throw.
  }
}
