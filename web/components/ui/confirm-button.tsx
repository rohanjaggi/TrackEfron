"use client";

import * as React from "react";
import { Trash2, type LucideIcon } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one destructive pattern: the first press arms the button and changes
 * its label; a second press within a few seconds commits. Escape, blur or
 * the timeout disarms it. Use for every delete and remove in the product.
 */
export function ConfirmButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Confirm delete",
  icon: Icon = Trash2,
  iconOnly = false,
  size = "sm",
  className,
  disabled,
  ...props
}: {
  onConfirm: () => void | Promise<void>;
  /** Names the action at rest. Also the accessible name when `iconOnly`. */
  label?: string;
  confirmLabel?: string;
  icon?: LucideIcon;
  /** Show only the icon at rest; the armed state always shows its label. */
  iconOnly?: boolean;
} & Omit<ButtonProps, "onClick" | "children" | "variant">) {
  const [armed, setArmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <Button
      {...props}
      size={armed || !iconOnly ? size : "icon"}
      variant={armed ? "destructive" : "ghost"}
      disabled={disabled || busy}
      aria-label={armed ? confirmLabel : label}
      title={armed ? undefined : label}
      onBlur={() => setArmed(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setArmed(false);
      }}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!armed) {
          setArmed(true);
          return;
        }
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
      className={cn(armed && "border-danger", className)}
    >
      <Icon aria-hidden="true" />
      {(armed || !iconOnly) && <span>{armed ? confirmLabel : label}</span>}
    </Button>
  );
}
