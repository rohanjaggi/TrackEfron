import type { ElementType, ReactNode } from "react";

/** Centered stat tile: icon above a large value and a small label. */
export function StatTile({
  icon: Icon,
  iconClassName,
  value,
  label,
}: {
  icon: ElementType;
  /** Colour (and fill) classes for the icon, e.g. "text-primary". */
  iconClassName: string;
  value: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="border-2 border-border p-5 text-center">
      <Icon className={`w-5 h-5 ${iconClassName} mx-auto mb-2`} />
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
