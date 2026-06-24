import type { Metadata } from "next";
import { Inter, Allura } from "next/font/google";
import "./globals.css";
import { GlobalHeader } from "@/components/GlobalHeader";
import { GlobalFooter } from "@/components/GlobalFooter";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const allura = Allura({ variable: "--font-allura", subsets: ["latin"], weight: "400", display: "swap" });

const SITE_URL = "https://almitoefl.almiworld.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AlmiTOEFL — TOEFL preparation for the new 1–6 format (2026)",
    template: "%s · AlmiTOEFL",
  },
  description:
    "Honest TOEFL guidance for the new 1.0–6.0 format (effective 21 Jan 2026) — the score you need by country, and which routes accept TOEFL. Part of the AlmiWorld family.",
  applicationName: "AlmiTOEFL",
  authors: [{ name: "AlmiWorld" }],
  keywords: ["TOEFL", "TOEFL 2026", "new TOEFL", "TOEFL 1-6", "TOEFL score", "TOEFL requirement", "AlmiTOEFL", "AlmiWorld"],
  openGraph: {
    title: "AlmiTOEFL — TOEFL preparation for the new 1–6 format (2026)",
    description: "The TOEFL score you need by country, on the new 1–6 scale — honest, sourced.",
    url: SITE_URL,
    siteName: "AlmiTOEFL",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "AlmiTOEFL — new TOEFL 1–6 format", description: "The TOEFL score you need by country, honest and sourced." },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${allura.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <GlobalHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <GlobalFooter />
      </body>
    </html>
  );
}
