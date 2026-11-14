"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

function StarGlyph({ fill, size }: { fill: 0 | 0.5 | 1; size: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <Star
        aria-hidden="true"
        className="absolute inset-0 text-border-strong"
        style={{ width: size, height: size }}
        strokeWidth={1.5}
      />
      {fill > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: fill === 1 ? size : size / 2 }}
        >
          <Star
            aria-hidden="true"
            className="fill-primary text-primary"
            style={{ width: size, height: size }}
            strokeWidth={1.5}
          />
        </span>
      )}
    </span>
  );
}

const fillFor = (value: number, index: number): 0 | 0.5 | 1 =>
  value >= index + 1 ? 1 : value >= index + 0.5 ? 0.5 : 0;

/** Read-only rating. Always the same drawn star, in the mode accent. */
export function Stars({
  value,
  size = 13,
  showValue = false,
  className,
}: {
  value: number | null | undefined;
  size?: number;
  /** Also print the number, e.g. "4.5". */
  showValue?: boolean;
  className?: string;
}) {
  if (value == null) return null;
  const v = Math.max(0, Math.min(5, Math.round(value * 2) / 2));
  return (
    <span
      role="img"
      aria-label={`${v} out of 5`}
      className={cn("inline-flex items-center gap-[2px] align-middle", className)}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <StarGlyph key={i} fill={fillFor(v, i)} size={size} />
      ))}
      {showValue && (
        <span aria-hidden="true" className="ml-1.5 text-[12px] text-muted-foreground">
          {v.toFixed(1)}
        </span>
      )}
    </span>
  );
}

/**
 * Rating input, 0 to 5. One tab stop; arrow keys change the value,
 * Home/End jump to the ends. Pointer users click the left or right half of a star.
 */
export function StarInput({
  value,
  onChange,
  label,
  step = 0.5,
  size = 26,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Names the control, e.g. "Overall rating". */
  label: string;
  step?: 0.5 | 1;
  size?: number;
  className?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;
  const clamp = (n: number) => Math.max(0, Math.min(5, n));

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
      aria-valuetext={value > 0 ? `${value} out of 5` : "Not rated"}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(clamp(value + step));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(clamp(value - step));
        } else if (e.key === "Home") {
          e.preventDefault();
          onChange(0);
        } else if (e.key === "End") {
          e.preventDefault();
          onChange(5);
        }
      }}
      onMouseLeave={() => setHover(null)}
      className={cn("inline-flex cursor-pointer items-center gap-1", className)}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = fillFor(shown, i);
        return (
          <span
            key={`${i}-${fillFor(value, i)}`}
            className={cn("relative inline-block", fillFor(value, i) > 0 && hover === null && "tick-in")}
            style={{ width: size, height: size }}
          >
            <StarGlyph fill={fill} size={size} />
            {step === 0.5 ? (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1/2"
                  onMouseEnter={() => setHover(i + 0.5)}
                  onClick={() => onChange(value === i + 0.5 ? 0 : i + 0.5)}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 w-1/2"
                  onMouseEnter={() => setHover(i + 1)}
                  onClick={() => onChange(value === i + 1 ? 0 : i + 1)}
                />
              </>
            ) : (
              <span
                aria-hidden="true"
                className="absolute inset-0"
                onMouseEnter={() => setHover(i + 1)}
                onClick={() => onChange(value === i + 1 ? 0 : i + 1)}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
