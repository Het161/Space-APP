"use client";

import { Loader2, Satellite } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Render's free tier sleeps after 15 minutes, so the first request of the day
 * can take 30–50 s. We say so rather than looking broken.
 */
export function ColdStartNote() {
  return (
    <Card className="flex items-start gap-3 border-accent/25 bg-accent/[0.05] p-4">
      <Satellite className="mt-0.5 size-4 shrink-0 animate-pulse text-accent" />
      <div>
        <p className="text-sm font-medium text-ink">
          Waking the satellite uplink…
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          The API sleeps on its free tier — the first request can take ~30–50 s.
          Every request after this one is fast, and repeat searches in the same
          area are cached.
        </p>
      </div>
    </Card>
  );
}

export function ResultsSkeleton({ coldStart }: { coldStart: boolean }) {
  return (
    <div className="space-y-6">
      {coldStart ? <ColdStartNote /> : null}

      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <Loader2 className="size-3.5 animate-spin" />
          Reading 30 years of NASA POWER records…
        </div>
        <Skeleton className="mt-4 h-10 w-3/4" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-44" />
        ))}
      </div>

      <Skeleton className="h-80" />
    </div>
  );
}
