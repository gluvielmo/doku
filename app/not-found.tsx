import Link from "next/link";

export default function NotFound() {
  return (
    <main className="screen center">
      <h1>Page not found</h1>
      <p className="muted">That link doesn&apos;t lead to a puzzle. It may be mistyped, or the puzzle was deleted.</p>
      <Link href="/" className="button">
        Back to puzzles
      </Link>
    </main>
  );
}
