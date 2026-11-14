import type { Metadata } from "next";
import { Schibsted_Grotesk, Sofia_Sans_Extra_Condensed, Young_Serif } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/ui/toast";
import { MODE_BOOT_SCRIPT } from "@/lib/mode-boot";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "TrackEfron — Track, Review & Discover",
  description: "Log and review the films, TV shows, and music you love. Get personalised recommendations.",
};

// Film titles and the wordmark: a soft 1970s poster serif. One weight only.
const youngSerif = Young_Serif({
  weight: "400",
  variable: "--font-film",
  display: "swap",
  subsets: ["latin", "latin-ext"],
});

// Music titles: an extra-condensed sleeve gothic.
const sofiaExtraCondensed = Sofia_Sans_Extra_Condensed({
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-music",
  display: "swap",
  subsets: ["latin", "latin-ext"],
});

// Everything you read and press, in both modes.
const schibsted = Schibsted_Grotesk({
  style: ["normal", "italic"],
  variable: "--font-ui",
  display: "swap",
  subsets: ["latin", "latin-ext"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Font variables sit on <html> because the per-mode type variables that use them are resolved there.
      className={`${youngSerif.variable} ${sofiaExtraCondensed.variable} ${schibsted.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ToastProvider>{children}</ToastProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
