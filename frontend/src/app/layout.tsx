import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

import "./globals.css";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const SITE_URL = "https://orbitwx.vercel.app";
const DESCRIPTION =
  "orbitWx turns 30 years of NASA Earth observation data into the odds of very hot, cold, windy, wet or uncomfortable weather at any location on any calendar date. Climatology, not a forecast.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "orbitWx — Will It Rain On My Parade? | NASA-data weather probabilities",
    template: "%s | orbitWx",
  },
  description: DESCRIPTION,
  keywords: [
    "NASA POWER",
    "weather probability",
    "climatology",
    "NASA Space Apps 2025",
    "Will It Rain On My Parade",
    "event planning weather",
    "MERRA-2",
  ],
  authors: [{ name: "Het Patel", url: "https://buildbyhet.me" }],
  creator: "Team Coders",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "orbitWx",
    title: "orbitWx — Will It Rain On My Parade?",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "orbitWx — Will It Rain On My Parade?",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
