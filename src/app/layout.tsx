import type { Metadata } from "next";
import { Inter, Allura } from "next/font/google";
import "./globals.css";
import { GlobalHeader } from "@/components/GlobalHeader";
import { GlobalFooter } from "@/components/GlobalFooter";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const allura = Allura({ variable: "--font-allura", subsets: ["latin"], weight: "400", display: "swap" });

const SITE_URL = "https://almidet.almiworld.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AlmiDET — Duolingo English Test practice with honest AI feedback",
    template: "%s · AlmiDET",
  },
  description:
    "Practise the Duolingo English Test on the real 10–160 scale, with honest AI feedback and subscore estimates shown as ranges, not inflated numbers. Original material, never copied from Duolingo. Part of the AlmiWorld family.",
  applicationName: "AlmiDET",
  authors: [{ name: "AlmiWorld" }],
  keywords: ["Duolingo English Test", "DET", "DET practice", "DET preparation", "Duolingo test score", "DET writing", "DET speaking", "AlmiDET", "AlmiWorld"],
  openGraph: {
    title: "AlmiDET — honest Duolingo English Test practice",
    description: "Original practice tasks on the real 10–160 scale, with honest AI feedback and subscore ranges, not inflated numbers.",
    url: SITE_URL,
    siteName: "AlmiDET",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "AlmiDET — Duolingo English Test practice", description: "Honest DET practice on the 10–160 scale — ranges, not inflated numbers." },
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
