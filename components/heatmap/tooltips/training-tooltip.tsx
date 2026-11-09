import { TooltipEmpty, TooltipShell } from "@/components/heatmap/tooltip-shell";
import type { HeatmapCell } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import type { TrainingTooltipData } from "@/lib/heatmap/modes/training";
import { fmtDuration } from "@/lib/running/runs";

export function TrainingTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as TrainingTooltipData | null;
  if (!data || data.items.length === 0) return <TooltipEmpty date={fmtDate(cell.date)} text="Rest day" />;

  return (
    <TooltipShell
      date={fmtDate(cell.date)}
      rows={data.items.flatMap((item, i) => [
        {
          id: `${i}-dist`,
          key: item.sport === "run" ? "Run" : "Ride",
          value: item.miles > 0 ? `${item.miles.toFixed(item.sport === "run" ? 2 : 1)} mi · ${fmtDuration(item.minutes * 60)}` : fmtDuration(item.minutes * 60),
          dot: cell.fill ?? undefined,
        },
        {
          id: `${i}-speed`,
          key: item.sport === "run" ? "Pace" : "Speed",
          value: [item.speed, item.avgHr && `${item.avgHr} bpm`].filter(Boolean).join(" · ") || "—",
        },
      ])}
    />
  );
}
