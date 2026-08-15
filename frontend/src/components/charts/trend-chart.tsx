"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ACCENT,
  AXIS_STROKE,
  AXIS_TICK,
  CYAN,
  GRID_STROKE,
  TOOLTIP_STYLE,
} from "@/components/charts/chart-theme";
import type { Trend } from "@/lib/types";

/** Least-squares fit over the yearly exceedance fractions. */
function fitLine(points: { year: number; value: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((sum, p) => sum + p.year, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.year - meanX) * (point.value - meanY);
    denominator += (point.year - meanX) ** 2;
  }
  if (denominator === 0) return null;
  const slope = numerator / denominator;
  return (year: number) => meanY + slope * (year - meanX);
}

export function TrendChart({ trend }: { trend: Trend }) {
  if (trend.yearly.length < 2) {
    return (
      <p className="py-8 text-center text-xs text-ink-faint">
        Not enough yearly samples to plot a trend.
      </p>
    );
  }

  const fit = fitLine(trend.yearly);
  const data = trend.yearly.map((point) => ({
    year: point.year,
    percent: point.value * 100,
    fit: fit ? Math.max(0, fit(point.year)) * 100 : null,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="year"
            stroke={AXIS_STROKE}
            tick={AXIS_TICK}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            stroke={AXIS_STROKE}
            tick={AXIS_TICK}
            tickLine={false}
            unit="%"
            domain={[0, "auto"]}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [
              `${Number(value).toFixed(1)}%`,
              name === "percent" ? "That year" : "Fitted trend",
            ]}
          />
          <Scatter dataKey="percent" fill={CYAN} shape="circle" />
          <Line
            type="linear"
            dataKey="fit"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-[10px] text-ink-faint">
        Each dot is one year&apos;s share of window days breaching the threshold;
        the orange line is the least-squares fit.
      </p>
    </div>
  );
}
