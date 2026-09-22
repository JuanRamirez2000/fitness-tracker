import type { LegendItem } from "@/lib/dashboard/types";

const STAR_LEGEND = [
  { glyph: "★", label: "shot taken", opacity: 1 },
  { glyph: "☆", label: "scheduled", opacity: 0.85 },
  { glyph: "☆", label: "missed", opacity: 0.55 },
];

export function HeatmapLegend({ title, items, accent }: { title: string; items: LegendItem[]; accent: string }) {
  return (
    <div className="flex flex-wrap items-center gap-[22px] border-t border-divider pt-3.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted-2">{title}</span>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block size-[11px] shrink-0 rounded-[3px] box-border"
            style={
              item.swatch === "transparent"
                ? { border: "1px dashed #2a313b" }
                : { background: item.swatch }
            }
          />
          <span className="text-[11px] text-muted-2">{item.label}</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-3.5">
        {STAR_LEGEND.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <span style={{ color: accent, fontSize: 12, opacity: s.opacity }}>{s.glyph}</span>
            <span className="text-[11px] text-muted-2">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
