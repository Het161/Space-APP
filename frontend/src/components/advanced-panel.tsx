"use client";

import * as React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import type { Thresholds } from "@/lib/types";
import { cn } from "@/lib/utils";

export const DEFAULT_THRESHOLDS: Thresholds = {
  hot: 35,
  cold: 5,
  wind: 10,
  wet: 10,
  comfort: 40,
};

export const DEFAULT_WINDOW = 7;

interface Control {
  key: keyof Thresholds;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}

const CONTROLS: Control[] = [
  {
    key: "wet",
    label: "Very Wet",
    unit: "mm/day",
    min: 1,
    max: 50,
    step: 1,
    hint: "Rainfall above this counts as a wet day.",
  },
  {
    key: "hot",
    label: "Very Hot",
    unit: "°C",
    min: 20,
    max: 50,
    step: 0.5,
    hint: "Daily maximum temperature above this.",
  },
  {
    key: "comfort",
    label: "Very Uncomfortable",
    unit: "°C HI",
    min: 27,
    max: 55,
    step: 0.5,
    hint: "NOAA heat index above this.",
  },
  {
    key: "wind",
    label: "Very Windy",
    unit: "m/s",
    min: 3,
    max: 25,
    step: 0.5,
    hint: "10 m wind speed above this.",
  },
  {
    key: "cold",
    label: "Very Cold",
    unit: "°C",
    min: -30,
    max: 20,
    step: 0.5,
    hint: "Daily minimum temperature below this.",
  },
];

export interface AdvancedPanelProps {
  thresholds: Thresholds;
  window: number;
  onThresholdsChange: (next: Thresholds) => void;
  onWindowChange: (next: number) => void;
}

export function AdvancedPanel({
  thresholds,
  window: windowDays,
  onThresholdsChange,
  onWindowChange,
}: AdvancedPanelProps) {
  const [open, setOpen] = React.useState(false);
  const modified =
    windowDays !== DEFAULT_WINDOW ||
    (Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[]).some(
      (key) => thresholds[key] !== DEFAULT_THRESHOLDS[key],
    );

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg py-2 text-xs text-ink-muted transition-colors hover:text-ink"
        >
          <SlidersHorizontal className="size-3.5" />
          <span>Advanced thresholds</span>
          {modified ? (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
              custom
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "ml-auto size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="overflow-hidden">
        <div className="space-y-4 border-t border-hairline pt-4">
          {CONTROLS.map((control) => (
            <div key={control.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-xs text-ink-muted">{control.label}</label>
                <span className="tabular text-xs font-medium text-accent">
                  {thresholds[control.key]} {control.unit}
                </span>
              </div>
              <Slider
                className="mt-2"
                aria-label={`${control.label} threshold in ${control.unit}`}
                min={control.min}
                max={control.max}
                step={control.step}
                value={[thresholds[control.key]]}
                onValueChange={([value]) =>
                  onThresholdsChange({ ...thresholds, [control.key]: value })
                }
              />
              <p className="mt-1 text-[10px] text-ink-faint">{control.hint}</p>
            </div>
          ))}

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-xs text-ink-muted">Sampling window</label>
              <span className="tabular text-xs font-medium text-cyan">
                ±{windowDays} days
              </span>
            </div>
            <Slider
              className="mt-2"
              aria-label="Day-of-year sampling window in days"
              min={1}
              max={15}
              step={1}
              value={[windowDays]}
              onValueChange={([value]) => onWindowChange(value)}
            />
            <p className="mt-1 text-[10px] text-ink-faint">
              Days either side of your date. Wider = more samples, but blurrier
              seasonality. {2 * windowDays + 1} days × 30 years ={" "}
              {(2 * windowDays + 1) * 30} observations.
            </p>
          </div>

          {modified ? (
            <button
              type="button"
              onClick={() => {
                onThresholdsChange(DEFAULT_THRESHOLDS);
                onWindowChange(DEFAULT_WINDOW);
              }}
              className="flex items-center gap-1.5 text-[11px] text-ink-faint transition-colors hover:text-accent"
            >
              <RotateCcw className="size-3" />
              Reset to defaults
            </button>
          ) : null}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
