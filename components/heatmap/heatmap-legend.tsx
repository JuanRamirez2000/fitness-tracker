import type { LegendItem } from "@/lib/dashboard/types";
import { STAR_GLYPH, STAR_OPACITY } from "./heatmap-cell";

const STAR_LEGEND = [
  { state: "taken", label: "shot taken" },
  { state: "scheduled", label: "scheduled" },
  { state: "missed", label: "missed" },
] as const;

export function HeatmapLegend({ title, items, accent, showShots = false }: { title: string; items: LegendItem[]; accent: string; showShots?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2 border-t border-divider pt-3.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted-2">{title}</span>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block size-[11px] shrink-0 rounded-[3px] box-border"
            style={item.swatch === "transparent" ? { border: "1px dashed var(--border-strong)" } : { background: item.swatch }}
          />
          <span className="text-[11px] text-muted-2">{item.label}</span>
        </div>
      ))}
      {showShots && (
        <div className="flex items-center gap-3.5 md:ml-auto">
          {STAR_LEGEND.map((s) => (
            <div key={s.state} className="flex items-center gap-1">
              <span style={{ color: accent, fontSize: 12, opacity: STAR_OPACITY[s.state] }}>{STAR_GLYPH[s.state]}</span>
              <span className="text-[11px] text-muted-2">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
