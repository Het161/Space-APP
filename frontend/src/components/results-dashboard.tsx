"use client";

import { ClimatologyNote } from "@/components/climatology-note";
import { ConditionCard } from "@/components/condition-card";
import { Provenance } from "@/components/provenance";
import { SmartDateFinder } from "@/components/smart-date-finder";
import { VariableDetail } from "@/components/variable-detail";
import { Verdict } from "@/components/verdict";
import { CONDITION_ORDER } from "@/lib/format";
import type { AnalysisRequest, ProbabilityResponse } from "@/lib/types";

export interface ResultsDashboardProps {
  data: ProbabilityResponse;
  request: AnalysisRequest;
  placeLabel: string;
  onSelectDay: (day: number) => void;
}

export function ResultsDashboard({
  data,
  request,
  placeLabel,
  onSelectDay,
}: ResultsDashboardProps) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-faint">
        Showing results for{" "}
        <span className="font-medium text-ink-muted">{placeLabel}</span>
      </p>

      <Verdict data={data} />

      <section>
        <h3 className="font-display mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Adverse conditions
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CONDITION_ORDER.map((key, index) => (
            <ConditionCard
              key={key}
              condition={data.conditions[key]}
              index={index}
            />
          ))}
        </div>
      </section>

      <VariableDetail data={data} />

      <SmartDateFinder request={request} onSelectDay={onSelectDay} />

      <Provenance metadata={data.metadata} request={request} />

      <ClimatologyNote />
    </div>
  );
}
