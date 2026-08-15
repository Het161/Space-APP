"use client";

import { Download, FileJson, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportUrl } from "@/lib/api";
import type { AnalysisRequest } from "@/lib/types";

export function ExportButtons({ request }: { request: AnalysisRequest }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 flex items-center gap-1.5 text-xs text-ink-faint">
        <Download className="size-3.5" />
        Raw samples
      </span>
      <Button asChild variant="secondary" size="sm">
        <a href={exportUrl(request, "csv")} download>
          <FileSpreadsheet />
          Download CSV
        </a>
      </Button>
      <Button asChild variant="secondary" size="sm">
        <a href={exportUrl(request, "json")} download>
          <FileJson />
          Download JSON
        </a>
      </Button>
    </div>
  );
}
