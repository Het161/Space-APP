/**
 * The single typed client for the orbitWx backend.
 *
 * Nothing else in the app builds a backend URL by hand.
 */

import type {
  AnalysisRequest,
  BestDaysResponse,
  ProbabilityResponse,
} from "@/lib/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Thrown for any non-2xx backend response, with the server's message intact. */
export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

interface ErrorBody {
  error?: string;
  detail?: string | { msg?: string }[];
  retry_after?: number;
}

function messageFromBody(
  body: ErrorBody,
  status: number,
  retryAfter?: number,
): string {
  // Checked before body.error: slowapi's raw "Rate limit exceeded: 60 per 1
  // minute" would otherwise win and read like a server fault rather than a
  // "wait a moment" nudge.
  if (status === 429) {
    const wait = retryAfter
      ? `Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`
      : "Try again in a moment.";
    return `Too many requests in a short window. ${wait}`;
  }
  if (body.error) return body.error;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg) {
    return body.detail[0].msg;
  }
  return `Request failed (${status}).`;
}

function searchParams(request: AnalysisRequest): URLSearchParams {
  return new URLSearchParams({
    lat: request.lat.toFixed(4),
    lon: request.lon.toFixed(4),
    month: String(request.month),
    day: String(request.day),
    window: String(request.window),
    hot_threshold: String(request.thresholds.hot),
    cold_threshold: String(request.thresholds.cold),
    wind_threshold: String(request.thresholds.wind),
    wet_threshold: String(request.thresholds.wet),
    comfort_threshold: String(request.thresholds.comfort),
  });
}

async function getJson<T>(path: string, params: URLSearchParams): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError(
      "Could not reach the orbitWx API. Check your connection and try again.",
      0,
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    const header = Number(response.headers.get("retry-after"));
    const retryAfter =
      body.retry_after ?? (Number.isFinite(header) && header > 0 ? header : undefined);
    throw new ApiError(
      messageFromBody(body, response.status, retryAfter),
      response.status,
      retryAfter,
    );
  }
  return (await response.json()) as T;
}

export function fetchProbability(
  request: AnalysisRequest,
): Promise<ProbabilityResponse> {
  return getJson<ProbabilityResponse>("/api/v1/probability", searchParams(request));
}

export function fetchBestDays(
  request: Omit<AnalysisRequest, "day">,
): Promise<BestDaysResponse> {
  const params = searchParams({ ...request, day: 1 });
  params.delete("day");
  return getJson<BestDaysResponse>("/api/v1/best-days", params);
}

/** Direct download URL — used by the CSV/JSON export buttons. */
export function exportUrl(
  request: AnalysisRequest,
  format: "csv" | "json",
): string {
  const params = searchParams(request);
  params.set("format", format);
  return `${API_BASE_URL}/api/v1/export?${params.toString()}`;
}

/** Stable, fully-specified cache key so no two parameter sets collide. */
export function analysisQueryKey(
  request: AnalysisRequest,
): readonly [string, string] {
  return ["probability", searchParams(request).toString()] as const;
}

export function bestDaysQueryKey(
  request: Omit<AnalysisRequest, "day">,
): readonly [string, string] {
  const params = searchParams({ ...request, day: 1 });
  params.delete("day");
  return ["best-days", params.toString()] as const;
}
