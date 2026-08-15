import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Code2, Globe, Rocket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About",
  description:
    "orbitWx was built by Team Coders for the NASA Space Apps Challenge 2025 challenge 'Will It Rain On My Parade?'.",
};

const STACK: [string, string][] = [
  ["Frontend", "Next.js 15 · TypeScript · Tailwind · TanStack Query · Recharts · Leaflet"],
  ["Backend", "FastAPI · httpx · numpy · Pydantic v2"],
  ["Data", "NASA POWER Daily Point API (MERRA-2)"],
  ["Hosting", "Vercel (web) · Render (API)"],
];

const LINKS: [string, string, typeof Globe][] = [
  ["buildbyhet.me", "https://buildbyhet.me", Globe],
  ["github.com/Het161", "https://github.com/Het161", Code2],
  [
    "The challenge brief",
    "https://www.spaceappschallenge.org/2025/challenges/will-it-rain-on-my-parade/",
    Rocket,
  ],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Badge tone="accent">About</Badge>
      <h1 className="font-display mt-4 text-4xl font-bold tracking-tight">
        Built for a very specific question
      </h1>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink-muted">
        <p>
          The NASA Space Apps Challenge 2025 brief{" "}
          <a
            href="https://www.spaceappschallenge.org/2025/challenges/will-it-rain-on-my-parade/"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            &ldquo;Will It Rain On My Parade?&rdquo;
          </a>{" "}
          asks for something weather apps genuinely cannot do. A forecast covers
          the next ten days. But people book weddings, plan hikes, schedule
          festivals and pick race dates{" "}
          <strong className="text-ink">months or years</strong> ahead — long past
          the horizon where any forecast exists.
        </p>
        <p>
          orbitWx answers the question that <em>is</em> answerable at that range:{" "}
          <strong className="text-ink">
            historically, what are the odds of adverse conditions at this place on
            this calendar date?
          </strong>{" "}
          Thirty years of NASA Earth observation data can say that with real
          confidence, and it says it in probabilities rather than a single
          misleading number.
        </p>
        <p>
          That distinction drove every design decision here — the copy, the
          percentile context on each card, the climate-trend panel, and the
          export button that hands you the raw rows so you can check the working.
        </p>
      </div>

      <Card className="mt-10 p-6">
        <h2 className="font-display text-lg font-semibold">Team Coders</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Designed and built by <strong className="text-ink">Het Patel</strong> —
          full-stack engineering, statistics, and the mission-control visual
          language.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {LINKS.map(([label, href, Icon]) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="glass glass-hover inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-muted hover:text-ink"
            >
              <Icon className="size-3.5 text-accent" />
              {label}
              <ArrowUpRight className="size-3 text-ink-faint" />
            </a>
          ))}
        </div>
      </Card>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Under the hood</h2>
        <dl className="mt-4 space-y-3">
          {STACK.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-1 border-b border-hairline pb-3 sm:flex-row sm:gap-6"
            >
              <dt className="w-24 shrink-0 text-xs font-medium uppercase tracking-wider text-ink-faint">
                {label}
              </dt>
              <dd className="text-sm text-ink-muted">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Data attribution</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Data obtained from the NASA Langley Research Center (LaRC){" "}
          <a
            href="https://power.larc.nasa.gov/"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            POWER Project
          </a>{" "}
          funded through the NASA Earth Science/Applied Science Program. orbitWx
          is an independent project and is not endorsed by NASA.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-4 text-sm">
        <Link href="/" className="text-accent hover:underline">
          Run an analysis →
        </Link>
        <Link href="/methodology" className="text-ink-muted hover:text-accent">
          Read the methodology →
        </Link>
      </div>
    </div>
  );
}
