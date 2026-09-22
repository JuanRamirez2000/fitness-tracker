import { TooltipEmpty, TooltipShell } from "@/components/heatmap/tooltip-shell";
import type { HeatmapCell } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import type { StepsTooltipData } from "@/lib/heatmap/modes/steps";

export function StepsTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as StepsTooltipData | null;
  if (!data) return <TooltipEmpty date={fmtDate(cell.date)} text="No steps logged" />;

  return (
    <TooltipShell
      date={fmtDate(cell.date)}
      rows={[
        { key: "Steps", value: data.steps.toLocaleString(), dot: cell.fill ?? undefined },
        { key: "Goal", value: `${data.goal.toLocaleString()}${data.hit ? " — hit" : ""}` },
      ]}
    />
  );
}
