/** Shared Recharts styling so every chart reads as one instrument panel. */

export const GRID_STROKE = "rgba(255,255,255,0.06)";
export const AXIS_STROKE = "rgba(255,255,255,0.14)";
export const ACCENT = "#FF7A1A";
export const CYAN = "#22D3EE";
export const INK_FAINT = "#63708A";

export const AXIS_TICK = {
  fill: INK_FAINT,
  fontSize: 10,
  fontVariantNumeric: "tabular-nums" as const,
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#121826",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0.6rem",
    fontSize: "11px",
    padding: "8px 10px",
  },
  labelStyle: { color: "#9AA6BD", marginBottom: 4 },
  itemStyle: { color: "#F2F5FA" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
} as const;
