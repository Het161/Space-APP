import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The single most important piece of copy in the product: orbitWx is not a
 * forecast. It appears on the dashboard, the methodology page and the export.
 */
export function ClimatologyNote({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-cyan/20 bg-cyan/[0.05] px-3.5 py-3",
        className,
      )}
    >
      <Info className="mt-0.5 size-3.5 shrink-0 text-cyan" />
      <p className="text-[11px] leading-relaxed text-ink-muted">
        <span className="font-medium text-cyan">Climatology, not a forecast.</span>{" "}
        orbitWx shows historical likelihoods from NASA Earth observation data —
        not a prediction for a specific upcoming day. For day-of forecasts, check
        your local weather service.
      </p>
    </aside>
  );
}
