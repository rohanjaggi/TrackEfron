export const CHART = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
export const GRID_STROKE = "var(--border-raw)";
const AXIS_TICK = { fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-ui)" };
export const AXIS_PROPS = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: { stroke: "var(--border-strong)" },
};
export const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: "var(--surface-3)",
    border: "1px solid var(--border-strong)",
    borderRadius: 0,
    color: "var(--text)",
    fontFamily: "var(--font-ui)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--text)", fontWeight: 600 },
  itemStyle: { color: "var(--text)" },
};
export const BAR_CURSOR = { fill: "var(--surface-2)" };
export const AXIS_LABEL = {
  fill: "var(--text-muted)",
  fontSize: 11,
  fontFamily: "var(--font-ui)",
  textAnchor: "middle" as const,
};
