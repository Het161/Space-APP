"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Telescope } from "lucide-react";

import { ClimatologyNote } from "@/components/climatology-note";
import { Hero } from "@/components/hero";
import { QueryPanel } from "@/components/query-panel";
import { ResultsDashboard } from "@/components/results-dashboard";
import { ResultsSkeleton } from "@/components/results-skeleton";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WINDOW,
} from "@/components/advanced-panel";
import { ApiError, analysisQueryKey, fetchProbability } from "@/lib/api";
import { coordinateLabel } from "@/lib/geocoding";
import { daysInMonth } from "@/lib/format";
import type { AnalysisRequest, PlaceResult, Thresholds } from "@/lib/types";

/** Default view: Ahmedabad, the team's home city. Any global point works. */
const DEFAULT_LOCATION = {
  lat: 23.0225,
  lon: 72.5714,
  label: "Ahmedabad, Gujarat, India",
};

/**
 * Preselect a date roughly two months out — the planning horizon this serves.
 * Computed after mount: this page is prerendered, so reading the clock during
 * render would bake a build-time date into the HTML and mismatch on hydration.
 */
function twoMonthsOut(): { month: number; day: number } {
  const target = new Date();
  target.setMonth(target.getMonth() + 2);
  return { month: target.getMonth() + 1, day: target.getDate() };
}

/** Deterministic seed used for the server-rendered HTML. */
const SEED_DATE = { month: 6, day: 15 } as const;

/** Delay after which we assume the free-tier backend is cold-starting. */
const COLD_START_MS = 8000;

export default function DashboardPage() {
  const { notify } = useToast();

  const [lat, setLat] = React.useState(DEFAULT_LOCATION.lat);
  const [lon, setLon] = React.useState(DEFAULT_LOCATION.lon);
  const [placeLabel, setPlaceLabel] = React.useState(DEFAULT_LOCATION.label);
  const [month, setMonth] = React.useState<number>(SEED_DATE.month);
  const [day, setDay] = React.useState<number>(SEED_DATE.day);
  const [windowDays, setWindowDays] = React.useState(DEFAULT_WINDOW);
  const [thresholds, setThresholds] =
    React.useState<Thresholds>(DEFAULT_THRESHOLDS);

  const [submitted, setSubmitted] = React.useState<AnalysisRequest | null>(null);
  const [coldStart, setColdStart] = React.useState(false);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const target = twoMonthsOut();
    setMonth(target.month);
    setDay(target.day);
  }, []);

  const query = useQuery({
    queryKey: submitted ? analysisQueryKey(submitted) : ["probability", "idle"],
    queryFn: () => fetchProbability(submitted as AnalysisRequest),
    enabled: submitted !== null,
  });

  const { isFetching, error } = query;

  // Surface the cold-start message only once a request is genuinely slow.
  React.useEffect(() => {
    if (!isFetching) {
      setColdStart(false);
      return;
    }
    const timer = window.setTimeout(() => setColdStart(true), COLD_START_MS);
    return () => window.clearTimeout(timer);
  }, [isFetching]);

  React.useEffect(() => {
    if (!error) return;
    const apiError = error instanceof ApiError ? error : null;
    notify(
      apiError?.status === 503
        ? "NASA POWER is unreachable"
        : "Could not run that analysis",
      apiError?.message ?? "Something went wrong. Please try again.",
    );
  }, [error, notify]);

  function analyze(overrides?: Partial<AnalysisRequest>) {
    setSubmitted({
      lat,
      lon,
      month,
      day,
      window: windowDays,
      thresholds,
      ...overrides,
    });
    window.setTimeout(
      () => resultsRef.current?.scrollIntoView({ block: "start" }),
      80,
    );
  }

  function handlePlace(place: PlaceResult) {
    setLat(place.latitude);
    setLon(place.longitude);
    setPlaceLabel(place.label);
  }

  function handleCoordinates(nextLat: number, nextLon: number) {
    setLat(nextLat);
    setLon(nextLon);
    setPlaceLabel(coordinateLabel(nextLat, nextLon));
  }

  function handleDate(nextMonth: number, nextDay: number) {
    setMonth(nextMonth);
    setDay(Math.min(nextDay, daysInMonth(nextMonth)));
  }

  /** Clicking a day in the Smart Date Finder re-runs the analysis instantly. */
  function handleSelectDay(nextDay: number) {
    setDay(nextDay);
    analyze({ day: nextDay });
  }

  return (
    <>
      <Hero />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr] xl:grid-cols-[24rem_1fr]">
          <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <QueryPanel
              lat={lat}
              lon={lon}
              placeLabel={placeLabel}
              month={month}
              day={day}
              window={windowDays}
              thresholds={thresholds}
              isLoading={isFetching}
              onPlaceChange={handlePlace}
              onCoordinateChange={handleCoordinates}
              onDateChange={handleDate}
              onWindowChange={setWindowDays}
              onThresholdsChange={setThresholds}
              onAnalyze={() => analyze()}
            />
            <ClimatologyNote className="mt-4" />
          </div>

          <div ref={resultsRef} className="min-w-0 scroll-mt-20">
            {submitted === null ? (
              <EmptyState />
            ) : isFetching && !query.data ? (
              <ResultsSkeleton coldStart={coldStart} />
            ) : query.data ? (
              <ResultsDashboard
                data={query.data}
                request={submitted}
                placeLabel={placeLabel}
                onSelectDay={handleSelectDay}
              />
            ) : (
              <ErrorState message={
                error instanceof ApiError
                  ? error.message
                  : "Something went wrong. Please try again."
              } />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <Card className="flex min-h-80 flex-col items-center justify-center p-10 text-center">
      <Telescope className="size-8 text-ink-faint" />
      <h2 className="font-display mt-4 text-lg font-semibold">
        Point it at a date
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
        Choose a location and a calendar date, then hit Analyze. orbitWx samples
        every matching day across 30 years of NASA satellite-derived
        observations and reports the odds.
      </p>
    </Card>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card className="flex min-h-80 flex-col items-center justify-center border-risk-high/25 p-10 text-center">
      <h2 className="font-display text-lg font-semibold text-risk-high">
        That request did not come back
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
        {message}
      </p>
    </Card>
  );
}
