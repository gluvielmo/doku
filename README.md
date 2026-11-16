# Doku

A web sudoku app for phone and desktop:

- **Daily puzzles**: easy, medium and hard, generated from the date so every device gets the same puzzle.
- **Scan puzzles**: photograph a sudoku from a newspaper or book; Claude reads the grid, you confirm it, and it joins your list.
- **A full marking board**: normal digits, corner and centre marks, colour mode with 9 colours, multi-select, undo/redo, auto-notes, explained hints and mistake checking.
- **Test mode**: try out digits on a branch of the puzzle, then keep them or revert to where you were in one tap.
- **Swap notes**: turn the corner marks in the selected cells into centre marks and back.
- **Copy screenshot**: copy a PNG of the board in the current theme to share.
- **Cross-device progress**: sign in with Google or an email code and pick up where you left off on any device.

### Keyboard shortcuts

| Keys | Action |
|---|---|
| `1`–`9` | Place a digit |
| `Shift` / `Ctrl` / `Alt` + digit | Corner mark / centre mark / colour |
| `V` · `Space` · `X` · `Z` | Normal · corner · centre · colour mode |
| `C` | Swap corner and centre notes |
| `T` | Start or revert test mode |
| Arrows (+`Shift` to extend) | Move the selection |
| `Backspace` | Erase |
| `Ctrl`+`Z` / `Ctrl`+`Y` | Undo / redo |
| `Ctrl`+`A` · `Enter` | Select all · deselect |
| Double-click | Select every cell with that digit |

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in what you need (see below)
npm run dev
```

With no env vars, everything except scanning and sync works, and progress is saved in the browser.

```bash
npm test          # engine and board logic tests
npm run build     # production build with type-checking
```

## Setup

### Sync (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL editor**, run [`supabase/schema.sql`](supabase/schema.sql). It is safe to run again; do so after pulling changes to it. It creates the games table, the daily scan quota and the `delete_my_account` function behind **Delete account**.
3. In **Authentication → Email templates → Magic link**, add `{{ .Token }}` so the email includes a 6-digit code. Typing the code works better than links on phones and in an installed PWA.
4. In **Authentication → URL configuration**, set the site URL to your deployed URL, and under **Redirect URLs** add `<origin>/**` for every origin you open the app from (e.g. `http://localhost:3000/**`, your LAN address for phone testing, your deployed URL).
5. Copy the project URL and anon key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Google sign-in (optional):
   - In [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**, create an **OAuth client ID** of type *Web application*. Under **Authorized redirect URIs**, add `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase shows the exact URL on the Google provider page).
   - In Supabase **Authentication → Sign In / Providers → Google**, enable it and paste the client ID and secret.
   - To let anyone sign in, open **Google Auth Platform → Audience** and click **Publish app** (in "Testing" only listed test users can sign in). Under **Branding**, set the app name, support email, homepage (`https://<your-domain>/`), privacy policy (`https://<your-domain>/privacy`) and add your domain under **Authorized domains**. With only the basic email and profile scopes, publishing needs no Google review, unless you upload a logo.
7. For more than a handful of sign-ins an hour, connect your own email provider under **Authentication → Emails → SMTP settings**: Supabase's built-in sender is heavily rate-limited.

   Sign-in runs entirely in the browser (PKCE): Google redirects back to the page you started from, and supabase-js exchanges the code on load. On iOS, an installed home-screen app opens Google in a separate browser and the session lands there instead, so use the email code inside the installed app.

### Scanning (Claude)

Set `ANTHROPIC_API_KEY`. When Supabase is configured, `/api/scan` only accepts signed-in users, and each gets `SCAN_DAILY_LIMIT` successful scans a day (default 5, reset at midnight UTC). Emails in `UNLIMITED_EMAILS` have no limit. If the quota table is missing, scanning is refused rather than left unmetered. Also set a monthly spend limit in the Anthropic console as a backstop.

### Public site

- `NEXT_PUBLIC_CONTACT_EMAIL`: shown on the privacy page and used for the **Send feedback** link and error page. Leave it empty to hide them.
- **Analytics**: enable **Web Analytics** in the Vercel project. The `<Analytics />` component is already in the layout; it sets no cookies.
- **Errors**: server errors and browser errors (sent to `/api/client-error`) appear in the Vercel project's **Logs**. Filter for `client-error`.

### Deploy

Push to GitHub, import the repo in Vercel, and add the same env vars. On a phone, use **Add to Home Screen** to install it as an app.

## How it works

| Area | Files |
|---|---|
| Sudoku engine: solver, logic grader/hints, seeded generator | `lib/sudoku/` |
| Board state: input layers, selection, undo, hints | `lib/game/` |
| Local storage (one key per game) | `lib/store.ts` |
| Sync: pull on open/focus/online, debounced push, realtime | `lib/sync/` |
| Photo → grid with Claude vision, daily quota | `app/api/scan/route.ts` |
| Privacy page, 404, error pages, link preview image | `app/privacy/`, `app/not-found.tsx`, `app/error.tsx`, `app/opengraph-image.tsx` |
| Browser error reporting | `instrumentation-client.ts`, `lib/report.ts`, `app/api/client-error/` |
| UI | `components/`, `app/` |

**Sync model.** The app is local-first: every move is saved on the device, then pushed to Supabase. Each game is one row; conflicts resolve per game by last update, and the `upsert_game` function rejects writes older than what's stored. A newly opened daily puzzle starts with timestamp 0, so progress made on another device always wins over a blank copy.

**Difficulty.** Puzzles are graded by the hardest technique a human needs: singles (easy); locked candidates and pairs (medium); triples, X-Wing, XY-Wing, Swordfish and quads (hard). Anything harder is rated "expert".

**Daily seeds** are `doku-daily-v1:<date>:<difficulty>`. If the generator changes, bump `v1` in `lib/sudoku/generator.ts` so all devices agree.
