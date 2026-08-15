"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MONTH_NAMES, MONTH_SHORT, daysInMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  month: number;
  day: number;
  onChange: (month: number, day: number) => void;
}

/**
 * A year-agnostic calendar: orbitWx asks about a *calendar date*, so the year
 * is deliberately absent from the UI.
 */
export function DatePicker({ month, day, onChange }: DatePickerProps) {
  const total = daysInMonth(month);

  function setMonth(next: number) {
    const wrapped = ((next - 1 + 12) % 12) + 1;
    onChange(wrapped, Math.min(day, daysInMonth(wrapped)));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonth(month - 1)}
          aria-label="Previous month"
          className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="font-display text-sm font-semibold">
          {MONTH_NAMES[month - 1]}
        </p>
        <button
          type="button"
          onClick={() => setMonth(month + 1)}
          aria-label="Next month"
          className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {MONTH_SHORT.map((name, index) => (
          <button
            key={name}
            type="button"
            onClick={() => setMonth(index + 1)}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-[11px] transition-colors",
              index + 1 === month
                ? "bg-accent/15 text-accent"
                : "text-ink-faint hover:bg-white/[0.06] hover:text-ink-muted",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div
        role="grid"
        aria-label={`Day of ${MONTH_NAMES[month - 1]}`}
        className="mt-3 grid grid-cols-7 gap-1"
      >
        {Array.from({ length: total }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            role="gridcell"
            aria-selected={value === day}
            onClick={() => onChange(month, value)}
            className={cn(
              "tabular aspect-square rounded-lg text-xs transition-colors",
              value === day
                ? "bg-accent font-semibold text-void"
                : "text-ink-muted hover:bg-white/[0.06] hover:text-ink",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {month === 2 && day === 29 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          Leap day: non-leap years are sampled around Feb 28 so you still get the
          full 30-year record.
        </p>
      ) : null}
    </div>
  );
}
