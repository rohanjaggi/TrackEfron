"use client";

import { useId } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

/** The one chip pattern on this page: square toggle buttons, one active at a time, press again to clear. */
export function ToggleGroup({
  label,
  options,
  activeKey,
  onToggle,
}: {
  label: string;
  options: { key: string; label: string }[];
  activeKey: string | null;
  onToggle: (key: string) => void;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
      <span id={labelId} className="t-label mr-1">
        {label}
      </span>
      {options.map((opt) => {
        const active = opt.key === activeKey;
        return (
          <Button
            key={opt.key}
            variant="outline"
            size="default"
            aria-pressed={active}
            className={active ? "border-primary bg-primary/10 text-primary" : "text-foreground"}
            onClick={() => onToggle(opt.key)}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

export function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label={label}>
      <X aria-hidden="true" /> Clear
    </Button>
  );
}
