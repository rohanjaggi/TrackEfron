"use client";

import * as React from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

/** Shared look for every text-entry control. */
export const controlClass = [
  "w-full border border-input bg-background px-3 text-[13px] text-foreground",
  "placeholder:text-dim",
  "transition-[border-color,box-shadow] duration-cut ease-mech",
  "hover:border-foreground/50",
  "focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--mode-accent)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-danger",
].join(" ");

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(controlClass, "h-10", className)} ref={ref} {...props} />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(controlClass, "min-h-[120px] resize-y py-2.5 leading-relaxed", className)}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

/** Native select with the theme's edge and chevron instead of OS chrome. */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select"> & { wrapperClassName?: string }
>(({ className, wrapperClassName, children, ...props }, ref) => (
  <div className={cn("relative", wrapperClassName)}>
    <select
      className={cn(controlClass, "h-10 cursor-pointer appearance-none pr-9", className)}
      ref={ref}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
    />
  </div>
));
Select.displayName = "Select";

/**
 * Secret entry (passwords, API keys) with a show/hide toggle inside the field.
 * `noun` names the secret for the toggle's accessible label.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type"> & { noun?: string; wrapperClassName?: string }
>(({ className, wrapperClassName, noun = "password", ...props }, ref) => {
  const [shown, setShown] = React.useState(false);
  return (
    <div className={cn("relative", wrapperClassName)}>
      <input
        type={shown ? "text" : "password"}
        className={cn(controlClass, "h-10 pr-11", className)}
        ref={ref}
        {...props}
      />
      <button
        type="button"
        aria-label={shown ? `Hide ${noun}` : `Show ${noun}`}
        onClick={() => setShown((v) => !v)}
        className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors duration-cut ease-mech hover:text-foreground"
      >
        {shown ? (
          <EyeOff className="size-3.5" aria-hidden="true" />
        ) : (
          <Eye className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { Input, Textarea, Select, PasswordInput };
