import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { APP_NAME } from "@/lib/app";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme/theme-context";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-newsreader",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Weight and logging tracker.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${newsreader.variable} ${plexMono.variable} h-full antialiased`}
      // The blocking script below sets data-theme on this exact element before React
      // hydrates, so a returning light-theme visitor's HTML legitimately differs from what
      // the server rendered (which has no way to know their localStorage) — the standard,
      // documented escape hatch for this exact pattern, not a bug being papered over.
      suppressHydrationWarning
    >
      {/* Runs before first paint, so a returning visitor's light-theme choice never flashes
       * dark first — React itself can't run this early. See theme-context.tsx. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
