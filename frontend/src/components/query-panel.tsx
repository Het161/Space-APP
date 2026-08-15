"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Crosshair, Loader2, MapPin, Sparkles } from "lucide-react";

import { AdvancedPanel } from "@/components/advanced-panel";
import { DatePicker } from "@/components/date-picker";
import { LocationSearch } from "@/components/location-search";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { PlaceResult, Thresholds } from "@/lib/types";

// Leaflet touches `window` at import time, so it must stay off the server.
const MapPicker = dynamic(() => import("@/components/map-picker"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full sm:h-72" />,
});

export interface QueryPanelProps {
  lat: number;
  lon: number;
  placeLabel: string;
  month: number;
  day: number;
  window: number;
  thresholds: Thresholds;
  isLoading: boolean;
  onPlaceChange: (place: PlaceResult) => void;
  onCoordinateChange: (lat: number, lon: number) => void;
  onDateChange: (month: number, day: number) => void;
  onWindowChange: (value: number) => void;
  onThresholdsChange: (value: Thresholds) => void;
  onAnalyze: () => void;
}

export function QueryPanel(props: QueryPanelProps) {
  const {
    lat,
    lon,
    placeLabel,
    month,
    day,
    window: windowDays,
    thresholds,
    isLoading,
  } = props;

  const [locating, setLocating] = React.useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        props.onCoordinateChange(
          position.coords.latitude,
          position.coords.longitude,
        );
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  return (
    <Card className="p-5">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              Location
            </label>
            <button
              type="button"
              onClick={useMyLocation}
              className="flex items-center gap-1 text-[11px] text-ink-faint transition-colors hover:text-accent"
            >
              {locating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Crosshair className="size-3" />
              )}
              Use my location
            </button>
          </div>

          <LocationSearch onSelect={props.onPlaceChange} />

          <div className="mt-3 overflow-hidden rounded-xl border border-hairline">
            <MapPicker lat={lat} lon={lon} onPick={props.onCoordinateChange} />
          </div>

          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
            <MapPin className="size-3 shrink-0 text-accent" />
            <span className="truncate">{placeLabel}</span>
            <span className="tabular ml-auto shrink-0">
              {lat.toFixed(3)}, {lon.toFixed(3)}
            </span>
          </p>
        </div>

        <div className="border-t border-hairline pt-5">
          <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-ink-faint">
            Date
          </label>
          <DatePicker month={month} day={day} onChange={props.onDateChange} />
        </div>

        <div className="border-t border-hairline pt-1">
          <AdvancedPanel
            thresholds={thresholds}
            window={windowDays}
            onThresholdsChange={props.onThresholdsChange}
            onWindowChange={props.onWindowChange}
          />
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={props.onAnalyze}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles />
              Analyze {formatDate(month, day)}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
