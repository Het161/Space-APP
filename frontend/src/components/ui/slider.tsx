"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

export function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-white/10">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-4 w-4 rounded-full border-2 border-accent bg-void transition-shadow hover:shadow-[0_0_0_6px_rgba(255,122,26,0.15)] focus-visible:shadow-[0_0_0_6px_rgba(255,122,26,0.25)] focus-visible:outline-none"
        aria-label={props["aria-label"]}
      />
    </SliderPrimitive.Root>
  );
}
