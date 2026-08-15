"use client";

import * as React from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { DistributionChart } from "@/components/charts/distribution-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { YearScatter } from "@/components/charts/year-scatter";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONDITION_ORDER, formatNumber, formatSlope } from "@/lib/format";
import type { ConditionResult, ProbabilityResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="tabular mt-0.5 text-sm font-medium text-ink">{value}</p>
      {sub ? <p className="tabular text-[10px] text-ink-faint">{sub}</p> : null}
    </div>
  );
}

function ClimateShift({ condition }: { condition: ConditionResult }) {
  const { trend } = condition;
  const Icon =
    trend.direction === "increasing"
      ? TrendingUp
      : trend.direction === "decreasing"
        ? TrendingDown
        : Minus;
  const tone =
    trend.direction === "increasing"
      ? "text-risk-high"
      : trend.direction === "decreasing"
        ? "text-risk-low"
        : "text-ink-muted";

  return (
    <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4", tone)} />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          Climate shift
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink">{trend.summary}</p>
      <p className="tabular mt-2 text-[11px] text-ink-faint">
        Linear trend: {formatSlope(trend.slope_per_decade)} · {trend.yearly.length}{" "}
        years regressed
      </p>
    </div>
  );
}

function DetailPanel({ condition }: { condition: ConditionResult }) {
  const { stats } = condition;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="Mean"
          value={`${formatNumber(stats.mean)} ${stats.unit}`}
          sub={`± ${formatNumber(stats.std)} std`}
        />
        <StatTile label="Median" value={`${formatNumber(stats.percentiles.p50)} ${stats.unit}`} />
        <StatTile
          label="Record low"
          value={`${formatNumber(stats.min)} ${stats.unit}`}
          sub={stats.min_year ? `in ${stats.min_year}` : undefined}
        />
        <StatTile
          label="Record high"
          value={`${formatNumber(stats.max)} ${stats.unit}`}
          sub={stats.max_year ? `in ${stats.max_year}` : undefined}
        />
      </div>

      <Tabs defaultValue="distribution">
        <TabsList>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="by-year">By year</TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
        </TabsList>
        <TabsContent value="distribution">
          <DistributionChart condition={condition} />
        </TabsContent>
        <TabsContent value="by-year">
          <YearScatter condition={condition} />
        </TabsContent>
        <TabsContent value="trend">
          <TrendChart trend={condition.trend} />
        </TabsContent>
      </Tabs>

      <ClimateShift condition={condition} />

      <p className="tabular text-[10px] text-ink-faint">
        Percentiles — p10 {formatNumber(stats.percentiles.p10)} · p25{" "}
        {formatNumber(stats.percentiles.p25)} · p50{" "}
        {formatNumber(stats.percentiles.p50)} · p75{" "}
        {formatNumber(stats.percentiles.p75)} · p90{" "}
        {formatNumber(stats.percentiles.p90)} {stats.unit}
      </p>
    </div>
  );
}

export function VariableDetail({ data }: { data: ProbabilityResponse }) {
  const [selected, setSelected] = React.useState<string>(CONDITION_ORDER[0]);

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold tracking-tight">
        Per-variable detail
      </h3>
      <p className="mt-1 text-xs text-ink-muted">
        Distributions, year-by-year counts and the fitted climate trend for each
        condition.
      </p>

      <Tabs
        value={selected}
        onValueChange={setSelected}
        className="mt-4"
      >
        <TabsList>
          {CONDITION_ORDER.map((key) => (
            <TabsTrigger key={key} value={key}>
              {data.conditions[key].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CONDITION_ORDER.map((key) => (
          <TabsContent key={key} value={key}>
            <DetailPanel condition={data.conditions[key]} />
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
