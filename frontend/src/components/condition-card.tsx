"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Droplets,
  Flame,
  Snowflake,
  ThermometerSun,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { RadialGauge } from "@/components/radial-gauge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RISK_PALETTE } from "@/lib/format";
import type { ConditionKey, ConditionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ConditionKey, LucideIcon> = {
  very_hot: Flame,
  very_cold: Snowflake,
  very_windy: Wind,
  very_wet: Droplets,
  very_uncomfortable: ThermometerSun,
};

export interface ConditionCardProps {
  condition: ConditionResult;
  index: number;
}

export function ConditionCard({ condition, index }: ConditionCardProps) {
  const reduceMotion = useReducedMotion();
  const Icon = ICONS[condition.key];
  const palette = RISK_PALETTE[condition.risk_level];
  const comparator = condition.direction === "above" ? "above" : "below";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.07 }}
    >
      <Card className={cn("flex h-full flex-col border", palette.border)}>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Icon className={cn("size-4 shrink-0", palette.text)} />
              <h3 className="font-display text-sm font-semibold leading-tight tracking-tight">
                {condition.label}
              </h3>
            </div>
            <Badge tone={condition.risk_level} className="shrink-0">
              {palette.short}
            </Badge>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <RadialGauge
              value={condition.probability}
              risk={condition.risk_level}
              label={condition.label}
            />

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-ink-faint">
                Threshold
              </p>
              <p className="tabular font-display whitespace-nowrap text-lg font-semibold text-ink">
                {comparator === "above" ? ">" : "<"} {condition.threshold}
              </p>
              <p className="text-[11px] text-ink-muted">{condition.unit}</p>
              <p className="tabular mt-2 text-[11px] leading-snug text-ink-faint">
                {condition.exceeding_samples}/{condition.valid_samples} days
              </p>
            </div>
          </div>
        </div>

        <p className="border-t border-hairline px-5 py-3 text-[11px] leading-relaxed text-ink-faint">
          {condition.threshold_context}
        </p>
      </Card>
    </motion.div>
  );
}
