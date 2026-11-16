import { ImageResponse } from "next/og";

export const alt = "Doku: daily sudoku, scanned puzzles and a board with every marking tool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The app icon's key pad: a 3×3 of bevelled keys with the centre one lit.
const KEYS: { digit?: string; color?: string; weight?: number; marks?: string; center?: string; hot?: boolean }[] = [
  { marks: "1 3" },
  {},
  { digit: "4", color: "#3a2a1c", weight: 700 },
  {},
  { digit: "9", color: "#fffaf3", weight: 800, hot: true },
  {},
  { digit: "7", color: "#8a5a2b", weight: 500 },
  { center: "25" },
  {},
];

export default function OpengraphImage() {
  const key = 112;
  const gap = 18;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 80,
          padding: "0 110px",
          background: "linear-gradient(180deg, #4f3a28 0%, #24180f 100%)",
          color: "#fffaf3",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", width: key * 3 + gap * 2, gap }}>
          {KEYS.map((k, i) => (
            <div
              key={i}
              style={{
                width: key,
                height: key,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                borderRadius: 28,
                background: k.hot ? "linear-gradient(180deg, #f0b468, #c47f34)" : "linear-gradient(180deg, #fffaf3, #efe1cd)",
                boxShadow: k.hot ? "0 6px 0 #8a5a2b" : "0 10px 0 #b89b78",
                marginTop: k.hot ? 8 : 0,
                fontSize: 76,
                fontWeight: k.weight ?? 600,
                color: k.color,
              }}
            >
              {k.digit}
              {k.marks && <div style={{ position: "absolute", top: 12, left: 18, fontSize: 30, color: "#8a7260", display: "flex" }}>{k.marks}</div>}
              {k.center && <div style={{ fontSize: 34, color: "#3f6c9e", display: "flex" }}>{k.center}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>Doku</div>
          <div style={{ fontSize: 40, lineHeight: 1.3, color: "#efe1cd" }}>Daily sudoku, scanned puzzles and a board with every marking tool.</div>
        </div>
      </div>
    ),
    size,
  );
}
