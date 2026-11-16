"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteAccount, sendLoginCode, signInWithGoogle, signOut, syncAll, useSyncState, verifyLoginCode } from "@/lib/sync/engine";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const sync = useSyncState();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Sync" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Sync</h2>
          <button className="ghost" onClick={onClose}>
            Done
          </button>
        </div>

        {sync.status === "local" && (
          <p className="muted">Progress is saved on this device only. Cloud sync isn&apos;t configured for this deployment (see the README).</p>
        )}

        {sync.status === "signedOut" && !sent && (
          <div className="stack">
            <p className="muted">Sign in to continue your puzzles on any device.</p>
            {/* Not wrapped in run(): on success the page navigates to Google, so busy should stay on. */}
            <button
              className="google"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                signInWithGoogle().catch((e) => {
                  setError(e instanceof Error ? e.message : String(e));
                  setBusy(false);
                });
              }}
            >
              <GoogleLogo />
              Continue with Google
            </button>
            <div className="or">or use your email</div>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await sendLoginCode(email.trim());
                  setSent(true);
                });
              }}
            >
              <input className="text" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="ghost" disabled={busy}>
                Email me a code
              </button>
            </form>
            <p className="muted fine">
              Signing in stores your email and puzzle progress. See the <Link href="/privacy">privacy page</Link>.
            </p>
          </div>
        )}

        {sync.status === "signedOut" && sent && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => verifyLoginCode(email.trim(), code.trim()));
            }}
          >
            <p className="muted">Enter the code sent to {email}. Opening the link in the email also works on this device.</p>
            <input className="text" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="button" disabled={busy}>
              Sign in
            </button>
            <button type="button" className="ghost" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </form>
        )}

        {sync.email && (
          <div className="stack">
            <p>
              Signed in as <strong>{sync.email}</strong>
            </p>
            <p className="muted">
              {sync.status === "syncing" && "Syncing…"}
              {sync.status === "synced" && sync.lastSyncedAt && `Up to date · ${new Date(sync.lastSyncedAt).toLocaleTimeString()}`}
              {sync.status === "offline" && "Offline. Changes will sync when you reconnect."}
              {sync.status === "error" && `Sync error: ${sync.error}`}
            </p>
            <div className="row">
              <button className="button" disabled={busy} onClick={() => run(syncAll)}>
                Sync now
              </button>
              <button className="ghost" disabled={busy} onClick={() => run(signOut)}>
                Sign out
              </button>
            </div>
            <button
              className="link danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Delete the account ${sync.email}?\n\nThis permanently removes your synced puzzles and can't be undone. Progress saved on this device stays.`,
                  )
                ) {
                  void run(deleteAccount);
                }
              }}
            >
              Delete account
            </button>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

const LABELS: Record<string, string> = {
  local: "On this device",
  signedOut: "Sign in to sync",
  syncing: "Syncing…",
  synced: "Synced",
  offline: "Offline",
  error: "Sync error",
};

export function SyncPill({ onClick }: { onClick: () => void }) {
  const { status } = useSyncState();
  return (
    <button className={`pill sync-${status}`} onClick={onClick}>
      <span className="dot" />
      {LABELS[status]}
    </button>
  );
}
