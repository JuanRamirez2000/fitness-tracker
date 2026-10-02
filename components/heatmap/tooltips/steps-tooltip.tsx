import { TooltipEmpty, TooltipShell } from "@/components/heatmap/tooltip-shell";
import type { HeatmapCell } from "@/lib/dashboard/types";
import { STEPS_GOAL } from "@/lib/data/steps";
import { fmtDate } from "@/lib/dates/format";
import type { StepsTooltipData } from "@/lib/heatmap/modes/steps";

export function StepsTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as StepsTooltipData | null;
  if (!data) return <TooltipEmpty date={fmtDate(cell.date)} text="No steps synced" />;

  return (
    <TooltipShell
      date={fmtDate(cell.date)}
      rows={[
        { key: "Steps", value: data.steps.toLocaleString("en-US"), dot: cell.fill ?? undefined },
        { key: "Goal", value: `${STEPS_GOAL.toLocaleString("en-US")}${data.hit ? " — hit" : ""}` },
      ]}
    />
  );
}
