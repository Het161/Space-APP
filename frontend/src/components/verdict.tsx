"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CloudRain } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { RISK_PALETTE } from "@/lib/format";
import type { ProbabilityResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Verdict({ data }: { data: ProbabilityResponse }) {
  const reduceMotion = useReducedMotion();
  const { summary, rain_tiers: tiers, metadata } = data;
  const palette = RISK_PALETTE[summary.overall_risk_level];

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="glass noise relative overflow-hidden rounded-card p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">
          <CloudRain className="size-3" />
          Verdict
        </Badge>
        <Badge tone={summary.overall_risk_level}>
          Overall {palette.label.toLowerCase()}
        </Badge>
        <Badge tone="neutral" className="tabular">
          {metadata.years_covered} years · {metadata.sample_size} samples
        </Badge>
      </div>

      <h2 className="font-display mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        <span className={cn("tabular", palette.text)}>
          {summary.any_rain_percent}%
        </span>{" "}
        chance of rain on your parade
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
        {summary.detail}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.key}
            className="rounded-xl border border-hairline bg-white/[0.03] px-4 py-3"
          >
            <p className="text-[11px] text-ink-faint">{tier.label}</p>
            <p
              className={cn(
                "tabular font-display mt-1 text-2xl font-bold",
                RISK_PALETTE[tier.risk_level].text,
              )}
            >
              {tier.percent}%
            </p>
            <p className="tabular mt-0.5 text-[10px] text-ink-faint">
              {tier.exceeding_samples}/{tier.valid_samples} days
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-ink-faint">
        Biggest risk driver:{" "}
        <span className="font-medium text-ink-muted">
          {summary.dominant_risk_label}
        </span>{" "}
        at <span className="tabular">{summary.dominant_risk_percent}%</span>.
      </p>
    </motion.section>
  );
}
