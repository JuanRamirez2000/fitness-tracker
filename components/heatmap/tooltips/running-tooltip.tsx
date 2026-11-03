import { TooltipEmpty, TooltipShell } from "@/components/heatmap/tooltip-shell";
import type { HeatmapCell } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import type { RunningTooltipData } from "@/lib/heatmap/modes/running";

export function RunningTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as RunningTooltipData | null;
  if (!data || data.runs.length === 0) return <TooltipEmpty date={fmtDate(cell.date)} text="Rest day" />;

  return (
    <TooltipShell
      date={fmtDate(cell.date)}
      rows={data.runs.flatMap((run, i) => [
        { id: `${i}-dist`, key: "Run", value: `${run.miles.toFixed(2)} mi`, dot: cell.fill ?? undefined },
        {
          id: `${i}-pace`,
          key: "Pace",
          value: [run.pace && `${run.pace}/mi`, run.avgHr && `${run.avgHr} bpm`].filter(Boolean).join(" · ") || "—",
        },
      ])}
    />
  );
}
