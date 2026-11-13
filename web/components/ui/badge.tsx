import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Small tracked-caps tag. Outline by default; `solid` only for the one thing that must shout. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-[3px] font-mono text-[10px] font-medium uppercase leading-none tracking-[0.1em]",
  {
    variants: {
      variant: {
        default: "border-primary/50 bg-primary/10 text-primary",
        solid: "border-primary bg-primary text-primary-foreground",
        outline: "border-border-strong text-muted-foreground",
        secondary: "border-border bg-surface-2 text-foreground",
        success: "border-success/50 bg-success/10 text-success",
        warning: "border-warning/50 bg-warning/10 text-warning",
        destructive: "border-danger/50 bg-danger/10 text-danger",
        film: "border-film/50 bg-film/10 text-film",
        music: "border-music/50 bg-music/10 text-music",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
