import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="starfield noise relative overflow-hidden border-b border-hairline">
      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
        <Badge tone="accent">
          <Radar className="size-3" />
          NASA Space Apps Challenge 2025 · Will It Rain On My Parade?
        </Badge>

        <h1 className="font-display mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Will it rain on
          <br />
          <span className="text-accent">your parade?</span>
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
          Pick a place and a calendar date. orbitWx reads{" "}
          <span className="text-ink">30 years</span> of NASA Earth observation
          data and tells you the historical odds of very hot, very cold, very
          windy, very wet or very uncomfortable conditions — months or years
          before any forecast exists.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-faint">
          <span className="tabular">30 years · 1996–2025</span>
          <span className="tabular">up to 450 samples per query</span>
          <span>NASA POWER / MERRA-2</span>
          <Link
            href="/methodology"
            className="group inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-accent"
          >
            How the math works
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
