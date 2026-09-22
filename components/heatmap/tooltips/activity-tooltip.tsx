import { TooltipEmpty, TooltipShell } from "@/components/heatmap/tooltip-shell";
import type { HeatmapCell } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import type { ActivityTooltipData } from "@/lib/heatmap/modes/activity";

export function ActivityTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as ActivityTooltipData | null;
  if (!data || data.items.length === 0) {
    return <TooltipEmpty date={fmtDate(cell.date)} text="No activity" />;
  }

  return (
    <TooltipShell
      date={fmtDate(cell.date)}
      rows={data.items.map((item, i) => ({
        id: `${item.label}-${i}`,
        key: item.label,
        value: item.notes ?? "logged",
        dot: item.color,
      }))}
    />
  );
}
