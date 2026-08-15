"use client";

import * as React from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import { searchPlaces } from "@/lib/geocoding";
import type { PlaceResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

export interface LocationSearchProps {
  onSelect: (place: PlaceResult) => void;
}

export function LocationSearch({ onSelect }: LocationSearchProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PlaceResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((places) => {
          setResults(places);
          setActive(0);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(place: PlaceResult) {
    onSelect(place);
    setQuery(place.label);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="location-listbox"
          aria-autocomplete="list"
          value={query}
          placeholder="Search a city — Ahmedabad, Lisbon, Nairobi…"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-11 w-full rounded-xl border border-hairline bg-white/[0.03] pl-10 pr-10",
            "text-sm text-ink placeholder:text-ink-faint",
            "focus:border-accent/50 focus:outline-none",
          )}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
        ) : null}
      </div>

      {open && results.length > 0 ? (
        <ul
          id="location-listbox"
          role="listbox"
          className="glass absolute z-40 mt-2 max-h-72 w-full overflow-auto rounded-xl p-1 shadow-2xl"
        >
          {results.map((place, index) => (
            <li key={place.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(place)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  index === active ? "bg-accent/12 text-ink" : "text-ink-muted",
                )}
              >
                <MapPin className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate">{place.label}</span>
                <span className="tabular shrink-0 text-[11px] text-ink-faint">
                  {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
