"use client";

import { Satellite } from "lucide-react";

import { ExportButtons } from "@/components/export-buttons";
import { Card } from "@/components/ui/card";
import type { AnalysisRequest, Metadata } from "@/lib/types";

/** Data provenance travels with the answer — a challenge requirement. */
export function Provenance({
  metadata,
  request,
}: {
  metadata: Metadata;
  request: AnalysisRequest;
}) {
  const rows: [string, string][] = [
    ["Source", metadata.source],
    [
      "Grid cell",
      `${metadata.grid_cell.lat}, ${metadata.grid_cell.lon} (${metadata.grid_cell.resolution})`,
    ],
    [
      "Requested point",
      `${metadata.grid_cell.requested_lat}, ${metadata.grid_cell.requested_lon}`,
    ],
    ["Years covered", `${metadata.start_year}–${metadata.end_year}`],
    [
      "Sample",
      `${metadata.sample_size} days (±${metadata.window_days} around the date)`,
    ],
    ["Missing days", String(metadata.missing_days)],
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Satellite className="size-4 text-cyan" />
        <h3 className="font-display text-base font-semibold tracking-tight">
          Data provenance
        </h3>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 text-xs">
            <dt className="shrink-0 text-ink-faint">{label}</dt>
            <dd className="tabular truncate text-right text-ink-muted">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-faint">
        {metadata.source_project}.{" "}
        <a
          href={metadata.power_url_pattern}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          View the exact POWER request
        </a>
        .
      </p>

      <div className="mt-4">
        <ExportButtons request={request} />
      </div>
    </Card>
  );
}
