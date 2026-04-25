interface StarDisplayProps {
  rating: number;
  accent?: string;
  size?: "sm" | "md";
}

export function StarDisplay({ rating, accent = "var(--mode-accent)", size = "sm" }: StarDisplayProps) {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  const fontSize = size === "md" ? "13px" : "11px";

  return (
    <span style={{ letterSpacing: "2px", fontSize, display: "inline-flex", alignItems: "center" }}>
      <span style={{ color: accent }}>{"★".repeat(full)}</span>
      {hasHalf && <span style={{ color: accent, opacity: 0.55 }}>★</span>}
      <span style={{ color: accent, opacity: 0.2 }}>{"★".repeat(empty)}</span>
    </span>
  );
}
