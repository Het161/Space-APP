"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarSearch, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/tooltip";
import { bestDaysQueryKey, fetchBestDays } from "@/lib/api";
import { MONTH_NAMES, RISK_PALETTE } from "@/lib/format";
import type { AnalysisRequest, BestDay } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Hue comes from the absolute risk level (the same thresholds every other card
 * uses), so a uniformly safe month never renders as a wall of red. Opacity
 * carries the within-month ranking, which is what makes the strip readable.
 */
function cellOpacity(score: number, min: number, max: number): number {
  if (max <= min) return 0.45;
  return 0.2 + ((score - min) / (max - min)) * 0.6;
}

function DayCell({
  day,
  min,
  max,
  selected,
  onSelect,
}: {
  day: BestDay;
  min: number;
  max: number;
  selected: boolean;
  onSelect: (day: number) => void;
}) {
  const color = RISK_PALETTE[day.risk_level].hex;
  const intensity = cellOpacity(day.risk_score, min, max);

  return (
    <InfoTooltip
      label={
        <span className="tabular">
          <span className="font-medium text-ink">{day.date_label}</span>
          <br />
          Combined risk {(day.risk_score * 100).toFixed(1)}% · rank #{day.rank}
          <br />
          Any rain {(day.any_rain_probability * 100).toFixed(0)}%
        </span>
      }
    >
      <button
        type="button"
        onClick={() => onSelect(day.day)}
        aria-label={`${day.date_label}, rank ${day.rank}`}
        className={cn(
          "tabular relative aspect-square rounded-md text-[10px] font-medium transition-transform hover:scale-110",
          selected && "ring-2 ring-accent",
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${color} ${intensity * 100}%, transparent)`,
          color: day.rank <= 3 ? color : "#9AA6BD",
        }}
      >
        {day.day}
        {day.rank <= 3 ? (
          <span
            className="absolute right-0.5 top-0.5 size-1 rounded-full"
            style={{ backgroundColor: color }}
          />
        ) : null}
      </button>
    </InfoTooltip>
  );
}

export interface SmartDateFinderProps {
  request: AnalysisRequest;
  onSelectDay: (day: number) => void;
}

export function SmartDateFinder({ request, onSelectDay }: SmartDateFinderProps) {
  const reduceMotion = useReducedMotion();
  const { day: _day, ...monthRequest } = request;
  void _day;

  const { data, isPending, isError } = useQuery({
    queryKey: bestDaysQueryKey(monthRequest),
    queryFn: () => fetchBestDays(monthRequest),
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarSearch className="size-4 text-cyan" />
        <h3 className="font-display text-base font-semibold tracking-tight">
          Smart Date Finder
        </h3>
        <Badge tone="cyan">{MONTH_NAMES[request.month - 1]}</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Every day of the month scored by a weighted blend of the five risks — wet
        0.35, hot 0.20, uncomfortable 0.20, windy 0.15, cold 0.10. Lower is
        better.
      </p>

      {isPending ? (
        <div className="mt-5 grid grid-cols-10 gap-1.5 sm:grid-cols-16">
          {Array.from({ length: 31 }, (_, index) => (
            <Skeleton key={index} className="aspect-square" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="mt-5 text-xs text-ink-faint">
          Could not score this month. The probability results above are
          unaffected.
        </p>
      ) : (
        <>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-5 grid grid-cols-10 gap-1.5 sm:grid-cols-16"
          >
            {data.days.map((day) => (
              <DayCell
                key={day.day}
                day={day}
                min={Math.min(...data.days.map((d) => d.risk_score))}
                max={Math.max(...data.days.map((d) => d.risk_score))}
                selected={day.day === request.day}
                onSelect={onSelectDay}
              />
            ))}
          </motion.div>

          <div className="mt-5 border-t border-hairline pt-4">
            <div className="flex items-center gap-2">
              <Trophy className="size-3.5 text-accent" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                Best three dates
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {data.best_three.map((day) => (
                <button
                  key={day.day}
                  type="button"
                  onClick={() => onSelectDay(day.day)}
                  className="rounded-xl border border-hairline bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-accent/40"
                >
                  <p className="font-display text-sm font-semibold">
                    {day.date_label}
                  </p>
                  <p className="tabular mt-1 text-[11px] text-ink-faint">
                    risk {(day.risk_score * 100).toFixed(1)}% · rain{" "}
                    {(day.any_rain_probability * 100).toFixed(0)}%
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
