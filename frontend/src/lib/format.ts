/** Shared display helpers: risk colours, date labels, number formatting. */

import type { ConditionKey, RiskLevel } from "@/lib/types";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** 2024 is a leap year, so February correctly offers 29 selectable days. */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(month: number): number {
  return DAYS_IN_MONTH[month - 1] ?? 31;
}

export function formatDate(month: number, day: number): string {
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

interface RiskPalette {
  text: string;
  bg: string;
  border: string;
  ring: string;
  /** Raw hex, for SVG strokes and Recharts. */
  hex: string;
  label: string;
  /** One word, for badges in tight card headers. */
  short: string;
}

export const RISK_PALETTE: Record<RiskLevel, RiskPalette> = {
  low: {
    text: "text-risk-low",
    bg: "bg-risk-low/10",
    border: "border-risk-low/30",
    ring: "ring-risk-low/40",
    hex: "#34D399",
    label: "Low risk",
    short: "Low",
  },
  moderate: {
    text: "text-risk-mid",
    bg: "bg-risk-mid/10",
    border: "border-risk-mid/30",
    ring: "ring-risk-mid/40",
    hex: "#FBBF24",
    label: "Moderate risk",
    short: "Moderate",
  },
  high: {
    text: "text-risk-high",
    bg: "bg-risk-high/10",
    border: "border-risk-high/30",
    ring: "ring-risk-high/40",
    hex: "#F87171",
    label: "High risk",
    short: "High",
  },
};

export const CONDITION_ORDER: ConditionKey[] = [
  "very_wet",
  "very_hot",
  "very_uncomfortable",
  "very_windy",
  "very_cold",
];

/** Compact number for stat tiles: one decimal, no trailing ".0". */
export function formatNumber(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits).replace(/\.0+$/, "");
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Human sentence for a slope expressed per decade of exceedance fraction. */
export function formatSlope(slopePerDecade: number | null): string {
  if (slopePerDecade === null) return "—";
  const points = slopePerDecade * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(1)} pts / decade`;
}
