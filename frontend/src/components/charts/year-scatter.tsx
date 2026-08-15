"use client";

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import {
  ACCENT,
  AXIS_STROKE,
  AXIS_TICK,
  GRID_STROKE,
  TOOLTIP_STYLE,
} from "@/components/charts/chart-theme";
import { RISK_PALETTE } from "@/lib/format";
import type { ConditionResult } from "@/lib/types";

export interface YearScatterProps {
  condition: ConditionResult;
}

/**
 * One point per year: the share of that year's window days that breached the
 * threshold, plotted against the threshold line for context.
 */
export function YearScatter({ condition }: YearScatterProps) {
  const points = condition.trend.yearly;
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-ink-faint">
        No yearly samples available.
      </p>
    );
  }

  const exceedColor = RISK_PALETTE[condition.risk_level].hex;
  const data = points.map((point) => ({
    year: point.year,
    days: Math.round(point.value * point.samples),
    samples: point.samples,
  }));
  const average = data.reduce((sum, d) => sum + d.days, 0) / data.length;

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis
            type="number"
            dataKey="year"
            stroke={AXIS_STROKE}
            tick={AXIS_TICK}
            tickLine={false}
            domain={["dataMin - 1", "dataMax + 1"]}
            allowDecimals={false}
          />
          <YAxis
            type="number"
            dataKey="days"
            stroke={AXIS_STROKE}
            tick={AXIS_TICK}
            tickLine={false}
            allowDecimals={false}
          />
          <ZAxis range={[46, 46]} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => {
              const days = Number(value);
              return name === "days"
                ? [`${days} day${days === 1 ? "" : "s"}`, "Breached threshold"]
                : [String(value), String(name)];
            }}
            labelFormatter={() => ""}
          />
          <ReferenceLine
            y={average}
            stroke={ACCENT}
            strokeDasharray="4 3"
            label={{
              value: `avg ${average.toFixed(1)}`,
              fill: ACCENT,
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
          <Scatter data={data} dataKey="days">
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.days > average ? exceedColor : "rgba(255,255,255,0.35)"}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-[10px] text-ink-faint">
        Days per year (out of {data[0]?.samples ?? 0} in the window) that breached{" "}
        {condition.threshold} {condition.unit}.
      </p>
    </div>
  );
}
