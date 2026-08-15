/**
 * Place search via the Open-Meteo Geocoding API.
 *
 * Free, keyless and CORS-enabled, so it is called straight from the browser —
 * no proxy route needed.
 */

import type { PlaceResult } from "@/lib/types";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

interface OpenMeteoPlace {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

interface OpenMeteoResponse {
  results?: OpenMeteoPlace[];
}

export function placeLabel(place: {
  name: string;
  admin1: string | null;
  country: string | null;
}): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    name: trimmed,
    count: "5",
    language: "en",
    format: "json",
  });

  const response = await fetch(`${GEOCODING_URL}?${params.toString()}`, {
    signal,
  });
  if (!response.ok) return [];

  const body = (await response.json()) as OpenMeteoResponse;
  return (body.results ?? []).map((result) => {
    const base = {
      id: result.id,
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      country: result.country ?? null,
      admin1: result.admin1 ?? null,
    };
    return { ...base, label: placeLabel(base) };
  });
}

/** Fallback label for a pin dropped on the map, which has no place name. */
export function coordinateLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}° ${ns}, ${Math.abs(lon).toFixed(3)}° ${ew}`;
}
