/**
 * TypeScript mirrors of the backend Pydantic schemas.
 *
 * Keep in sync with `backend/app/models/schemas.py` — these two files are the
 * API contract.
 */

export type RiskLevel = "low" | "moderate" | "high";
export type TrendDirection =
  | "increasing"
  | "decreasing"
  | "stable"
  | "insufficient_data";
export type ConditionKey =
  | "very_hot"
  | "very_cold"
  | "very_windy"
  | "very_wet"
  | "very_uncomfortable";

export interface Percentiles {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}

export interface VariableStats {
  unit: string;
  valid_count: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  min_year: number | null;
  max: number | null;
  max_year: number | null;
  percentiles: Percentiles;
}

export interface Histogram {
  bin_edges: number[];
  counts: number[];
}

export interface TrendPoint {
  year: number;
  /** Exceedance fraction (0–1) for that year's window. */
  value: number;
  samples: number;
}

export interface Trend {
  slope_per_decade: number | null;
  direction: TrendDirection;
  first_decade: number | null;
  last_decade: number | null;
  first_decade_label: string | null;
  last_decade_label: string | null;
  delta: number | null;
  summary: string;
  yearly: TrendPoint[];
}

export interface ConditionResult {
  key: ConditionKey;
  label: string;
  variable: string;
  description: string;
  direction: "above" | "below";
  threshold: number;
  unit: string;
  probability: number;
  percent: number;
  risk_level: RiskLevel;
  exceeding_samples: number;
  valid_samples: number;
  threshold_percentile: number | null;
  threshold_context: string;
  stats: VariableStats;
  histogram: Histogram;
  trend: Trend;
}

export interface RainTier {
  key: "any_rain" | "moderate_rain" | "heavy_rain";
  label: string;
  threshold_mm: number;
  probability: number;
  percent: number;
  exceeding_samples: number;
  valid_samples: number;
  risk_level: RiskLevel;
}

export interface Summary {
  headline: string;
  detail: string;
  any_rain_percent: number;
  heavy_rain_percent: number;
  overall_risk_score: number;
  overall_risk_level: RiskLevel;
  dominant_risk: ConditionKey;
  dominant_risk_label: string;
  dominant_risk_percent: number;
}

export interface GridCell {
  lat: number;
  lon: number;
  requested_lat: number;
  requested_lon: number;
  resolution: string;
}

export interface Metadata {
  source: string;
  source_project: string;
  grid_cell: GridCell;
  start_year: number;
  end_year: number;
  years_covered: number;
  target_month: number;
  target_day: number;
  window_days: number;
  sample_size: number;
  expected_sample_size: number;
  missing_days: number;
  fill_value_days: Record<string, number>;
  units: Record<string, string>;
  cache_hit: boolean;
  power_url_pattern: string;
  generated_note: string;
}

export interface ProbabilityResponse {
  summary: Summary;
  conditions: Record<ConditionKey, ConditionResult>;
  rain_tiers: RainTier[];
  thresholds: Record<ConditionKey, number>;
  metadata: Metadata;
}

export interface BestDay {
  day: number;
  date_label: string;
  risk_score: number;
  risk_level: RiskLevel;
  rank: number;
  probabilities: Record<ConditionKey, number>;
  any_rain_probability: number;
}

export interface BestDaysResponse {
  month: number;
  month_name: string;
  days: BestDay[];
  ranked: BestDay[];
  best_three: BestDay[];
  thresholds: Record<ConditionKey, number>;
  metadata: Metadata;
}

/** Everything the user chooses before hitting Analyze. */
export interface Thresholds {
  hot: number;
  cold: number;
  wind: number;
  wet: number;
  comfort: number;
}

export interface AnalysisRequest {
  lat: number;
  lon: number;
  month: number;
  day: number;
  window: number;
  thresholds: Thresholds;
}

export interface PlaceResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  admin1: string | null;
  label: string;
}
