import type { Config } from "tailwindcss";

/** A colour that follows the live mode accent and still supports `/opacity` modifiers. */
const accent = "color-mix(in srgb, var(--mode-accent) calc(<alpha-value> * 100%), transparent)";
const raw = (name: string) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Sharp edges are the brand: every radius key resolves to zero, so no
    // `rounded-*` class can leak a curve into the interface.
    borderRadius: {
      none: "0",
      sm: "0",
      DEFAULT: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "0",
    },
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: accent,
          foreground: "hsl(var(--background) / <alpha-value>)",
        },
        muted: {
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        surface: {
          2: raw("--surface-2"),
          3: raw("--surface-3"),
        },
        "border-strong": raw("--border-strong"),
        dim: raw("--text-dim"),
        success: raw("--success"),
        warning: raw("--warning"),
        danger: raw("--danger"),
        film: raw("--film"),
        music: raw("--music"),
      },
      fontFamily: {
        // The interface face. There is no monospace in the product.
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        // Title face of the current mode (Young Serif in film, Sofia Sans Extra Condensed in music).
        display: ["var(--display-face)"],
        // The wordmark's face, fixed across modes.
        brand: ["var(--font-film)", "Georgia", "serif"],
      },
      transitionDuration: {
        tick: "80ms",
        cut: "140ms",
      },
      transitionTimingFunction: {
        mech: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
} satisfies Config;
