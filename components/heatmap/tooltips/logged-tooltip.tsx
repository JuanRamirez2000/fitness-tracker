import { TooltipShell } from "@/components/heatmap/tooltip-shell";
import type { HeatmapCell } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import type { LoggedTooltipData } from "@/lib/heatmap/modes/logged";

export function LoggedTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as LoggedTooltipData;
  const steps =
    data.steps !== null
      ? `${data.steps.toLocaleString()}${data.stepsHit ? ` — hit ${data.goal.toLocaleString()}` : ""}`
      : "Not logged";

  return (
    <TooltipShell
      date={fmtDate(cell.date)}
      rows={[
        { key: "Weight", value: data.weightLogged ? "Logged" : "Not logged", dot: cell.fill ?? undefined },
        { key: "Steps", value: steps },
      ]}
    />
  );
}
