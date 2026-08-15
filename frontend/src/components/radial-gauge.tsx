"use client";

import { motion, useReducedMotion } from "framer-motion";

import { RISK_PALETTE } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";

const SIZE = 92;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface RadialGaugeProps {
  /** 0–1. */
  value: number;
  risk: RiskLevel;
  label?: string;
}

export function RadialGauge({ value, risk, label }: RadialGaugeProps) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const color = RISK_PALETTE[risk].hex;

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`${Math.round(clamped * 100)} percent${label ? ` — ${label}` : ""}`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - clamped) }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 1, ease: [0.16, 1, 0.3, 1] }
          }
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-display text-xl font-bold leading-none">
          {Math.round(clamped * 100)}
          <span className="text-xs font-medium text-ink-muted">%</span>
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-wider text-ink-faint">
          chance
        </span>
      </div>
    </div>
  );
}
