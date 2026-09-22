import type { KpiTone } from "@/lib/dashboard/types";
import type { Palette } from "@/lib/theme/palette";
import { MUTED_2 } from "@/lib/theme/surfaces";

export function toneColor(tone: KpiTone, palette: Palette): string {
  switch (tone) {
    case "good":
      return palette.good;
    case "bad":
      return palette.bad;
    case "warn":
      return palette.warn;
    case "neutral":
      return MUTED_2;
  }
}
