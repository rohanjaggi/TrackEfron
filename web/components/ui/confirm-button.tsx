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
  confirmAriaLabel,
  tone = "danger",
  onArtwork = false,
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
  /** Fuller accessible name for the armed state when `confirmLabel` is short. */
  confirmAriaLabel?: string;
  /** `neutral` for reversible actions (cancel a request, disconnect) so they do not read as deletes. */
  tone?: "danger" | "neutral";
  /** Solid backing so the button stays legible over a poster or cover. */
  onArtwork?: boolean;
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
      variant={armed ? (tone === "danger" ? "destructive" : "outline") : "ghost"}
      disabled={disabled || busy}
      aria-label={armed ? (confirmAriaLabel ?? confirmLabel) : label}
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
      className={cn(
        armed && (tone === "danger" ? "border-danger" : "border-primary text-primary"),
        onArtwork && "bg-background/90 hover:bg-background",
        onArtwork && !armed && "border-border-strong text-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" />
      {(armed || !iconOnly) && <span>{armed ? confirmLabel : label}</span>}
    </Button>
  );
}
