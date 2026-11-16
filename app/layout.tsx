import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SyncStarter } from "@/components/SyncStarter";
import "./globals.css";

// Self-hosted by Next.js at build time: no runtime request to Google, no layout shift.
// Exposed as --font-outfit so globals.css can reference it with a system-font fallback.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

// Absolute base for the Open Graph image URL. Vercel sets the production host; fall back for local dev.
const siteHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteHost ? `https://${siteHost}` : "http://localhost:3000"),
  title: "Doku",
  description: "Daily sudoku, scanned puzzles and a board with every marking tool.",
  openGraph: { title: "Doku", description: "Daily sudoku, scanned puzzles and a board with every marking tool.", siteName: "Doku", type: "website" },
  appleWebApp: { capable: true, title: "Doku", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#16171b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <SyncStarter />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
