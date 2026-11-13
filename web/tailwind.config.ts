import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/** A colour that follows the live mode accent and still supports `/opacity` modifiers. */
const accent = "color-mix(in srgb, var(--mode-accent) calc(<alpha-value> * 100%), transparent)";
const raw = (name: string) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  darkMode: ["class"],
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
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: accent,
          foreground: "hsl(var(--background) / <alpha-value>)",
        },
        accent: {
          DEFAULT: accent,
          foreground: "hsl(var(--background) / <alpha-value>)",
        },
        ring: accent,
        // `secondary` is a surface, never an ink. Do not use `text-secondary`.
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        surface: {
          DEFAULT: raw("--surface"),
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
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "Courier New", "monospace"],
      },
      transitionDuration: {
        tick: "80ms",
        cut: "140ms",
        move: "240ms",
        reel: "420ms",
      },
      transitionTimingFunction: {
        mech: "cubic-bezier(0.16, 1, 0.3, 1)",
        reel: "cubic-bezier(0.7, 0, 0.2, 1)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
