import type { Metadata } from "next";
import { Cormorant_Garamond, Azeret_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "TrackEfron — Track, Review & Discover",
  description: "Log and review the films, TV shows, and music you love. Get personalised recommendations.",
};

const cormorant = Cormorant_Garamond({
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
  subsets: ["latin"],
});

const azeretMono = Azeret_Mono({
  weight: ["300", "400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
  subsets: ["latin"],
});

// Applies the stored mode to <html> before first paint so the accent colours do not flash.
// A literal string, nothing interpolated. The server render never reads localStorage.
const MODE_SCRIPT = `try{if(localStorage.getItem("trackefron-mode")==="music")document.documentElement.setAttribute("data-mode","music")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body className={`${cormorant.variable} ${azeretMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
