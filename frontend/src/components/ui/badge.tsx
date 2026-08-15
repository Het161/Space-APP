import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-hairline bg-white/[0.04] text-ink-muted",
        accent: "border-accent/30 bg-accent/10 text-accent",
        cyan: "border-cyan/30 bg-cyan/10 text-cyan",
        low: "border-risk-low/30 bg-risk-low/10 text-risk-low",
        moderate: "border-risk-mid/30 bg-risk-mid/10 text-risk-mid",
        high: "border-risk-high/30 bg-risk-high/10 text-risk-high",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
