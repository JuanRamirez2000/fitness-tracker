import type { KpiTone } from "@/lib/dashboard/types";

/**
 * A CSS variable reference, not a resolved hex — re-themes for free via the cascade (see
 * app/globals.css's `[data-theme]` blocks) with no theme state needed here. Used for inline
 * `style` colors (KpiCard's delta chip), which accept a var() string exactly like a literal
 * color; never for color math (mix(), contrastRatio()), which needs a real hex and should
 * reach for lib/theme/palette.ts's paletteFor() instead.
 */
export function toneColor(tone: KpiTone): string {
  switch (tone) {
    case "good":
      return "var(--good)";
    case "bad":
      return "var(--bad)";
    case "warn":
      return "var(--warn)";
    case "neutral":
      return "var(--muted-2)";
  }
}
