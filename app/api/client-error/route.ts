// Receives error reports from browsers and logs them, so they show up in Vercel's runtime logs.

export const runtime = "nodejs";

const MAX_BODY = 8_000;

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let report: Record<string, unknown>;
  try {
    report = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  console.error(
    "client-error",
    JSON.stringify({
      message: str(report.message, 500),
      url: str(report.url, 300),
      source: str(report.source, 50),
      digest: str(report.digest, 50),
      ua: request.headers.get("user-agent")?.slice(0, 200),
      stack: str(report.stack, 2000),
    }),
  );
  return new Response(null, { status: 204 });
}
