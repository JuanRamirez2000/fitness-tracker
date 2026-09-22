import { TooltipEmpty, TooltipShell } from "@/components/heatmap/tooltip-shell";
import type { HeatmapCell } from "@/lib/dashboard/types";
import type { CaloriesTooltipData } from "@/lib/heatmap/modes/calories";
import { fmtDate } from "@/lib/heatmap/format-date";

const STATUS_LABEL = { accurate: "Accurate", uncertain: "May be off", missed: "Missed" } as const;

export function CaloriesTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as CaloriesTooltipData | null;
  if (!data) return <TooltipEmpty date={fmtDate(cell.date)} text="Nothing logged" />;

  return (
    <TooltipShell
      date={fmtDate(cell.date)}
      rows={[
        { key: "Status", value: STATUS_LABEL[data.status], dot: cell.fill ?? undefined },
        { key: "kcal", value: data.caloriesKcal !== null ? String(data.caloriesKcal) : "—" },
        ...(data.notes ? [{ key: "Notes", value: data.notes }] : []),
      ]}
    />
  );
}
