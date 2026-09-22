import { TooltipEmpty, TooltipShell } from "@/components/heatmap/tooltip-shell";
import type { HeatmapCell } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/heatmap/format-date";
import type { WeightTooltipData } from "@/lib/heatmap/modes/weight";

const signed = (n: number) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1);

export function WeightTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as WeightTooltipData | null;
  if (!data) return <TooltipEmpty date={fmtDate(cell.date)} text="No weigh-in" />;

  const avg7 = data.avg7Lb !== null ? `${data.rawLb.toFixed(1)} lb · 7d ${data.avg7Lb.toFixed(1)}` : `${data.rawLb.toFixed(1)} lb`;
  const change = data.raw.deltaLb !== null
    ? `${signed(data.raw.deltaLb)} lb${data.raw.vsDate ? ` vs ${fmtDate(data.raw.vsDate)}` : ""}`
    : "First recorded day";

  return (
    <TooltipShell
      date={fmtDate(cell.date)}
      rows={[
        { key: "Weight", value: avg7, dot: cell.fill ?? undefined },
        { key: "Change", value: change },
      ]}
    />
  );
}
