import type { LegendItem } from "@/lib/dashboard/types";

export function HeatmapLegend({ title, items }: { title: string; items: LegendItem[] }) {
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
    </div>
  );
}
