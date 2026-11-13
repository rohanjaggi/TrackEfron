import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The one button. Mono caps, hairline edge, never rounded.
 * Use `default` for the single primary action in a view; `outline` for
 * everything beside it; `ghost` for toolbar and icon actions.
 */
const buttonVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap border",
    "font-mono text-[11px] font-medium uppercase leading-none tracking-[0.1em]",
    "transition-[color,background-color,border-color,transform] duration-cut ease-mech",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:border-foreground hover:bg-foreground",
        outline:
          "border-border-strong bg-transparent text-foreground hover:border-primary hover:text-primary",
        secondary:
          "border-border bg-surface-2 text-foreground shadow-[var(--frame-bevel)] hover:border-border-strong",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        destructive:
          "border-danger/60 bg-transparent text-danger hover:border-danger hover:bg-danger hover:text-background",
        link: "border-transparent normal-case tracking-normal text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[10px]",
        lg: "h-11 px-6 text-[12px]",
        icon: "h-9 w-9 p-0",
      },
    },
    compoundVariants: [{ variant: "link", class: "h-auto px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(asChild ? {} : { type: type ?? "button" })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
