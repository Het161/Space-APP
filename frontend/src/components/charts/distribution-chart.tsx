"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

/**
 * Distribution of the sampled window, binned server-side. Bars past the user's
 * threshold are painted in the risk colour so the exceedance region is obvious.
 */
export function DistributionChart({ condition }: { condition: ConditionResult }) {
  const { bin_edges: edges, counts } = condition.histogram;
  if (edges.length < 2) {
    return (
      <p className="py-8 text-center text-xs text-ink-faint">
        No distribution available for this variable.
      </p>
    );
  }

  const exceedColor = RISK_PALETTE[condition.risk_level].hex;
  const data = counts.map((count, index) => {
    const start = edges[index];
    const end = edges[index + 1];
    const centre = (start + end) / 2;
    const exceeds =
      condition.direction === "above"
        ? centre > condition.threshold
        : centre < condition.threshold;
    return {
      centre,
      count,
      exceeds,
      range: `${start.toFixed(1)} – ${end.toFixed(1)}`,
    };
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="centre"
            stroke={AXIS_STROKE}
            tick={AXIS_TICK}
            tickFormatter={(value: number) => value.toFixed(0)}
            tickLine={false}
          />
          <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} tickLine={false} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: unknown) => [`${Number(value)} days`, "Count"]}
            labelFormatter={(_, payload) =>
              payload?.[0]
                ? `${payload[0].payload.range} ${condition.unit}`
                : ""
            }
          />
          <ReferenceLine
            x={condition.threshold}
            stroke={ACCENT}
            strokeDasharray="4 3"
            label={{
              value: `${condition.threshold} ${condition.unit}`,
              fill: ACCENT,
              fontSize: 10,
              position: "top",
            }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.exceeds ? exceedColor : "rgba(255,255,255,0.18)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-[10px] text-ink-faint">
        {condition.stats.valid_count} observations · {condition.unit} · coloured
        bars breach your threshold
      </p>
    </div>
  );
}
