import { TooltipEmpty, TooltipShell, type TooltipRow } from "@/components/heatmap/tooltip-shell";
import { readinessWord } from "@/lib/activity/view";
import type { HeatmapCell } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import type { RecoveryTooltipData } from "@/lib/heatmap/modes/recovery";

export function RecoveryTooltip({ cell }: { cell: HeatmapCell }) {
  const data = cell.tooltip as RecoveryTooltipData | null;
  if (!data) return <TooltipEmpty date={fmtDate(cell.date)} text="No watch data" />;
  const rows: TooltipRow[] = [
    ...(data.readiness !== null ? [{ key: "Ready", value: `${data.readiness} · ${readinessWord(data.readiness)}` }] : []),
    ...(data.sleepScore !== null ? [{ key: "Sleep", value: `${data.sleepScore}${data.sleepHours !== null ? ` · ${data.sleepHours.toFixed(1)} h` : ""}` }] : []),
    ...(data.hrv !== null ? [{ key: "HRV", value: `${Math.round(data.hrv)} ms` }] : []),
  ];
  if (cell.fill && rows[0]) rows[0] = { ...rows[0], dot: cell.fill };
  return <TooltipShell date={fmtDate(cell.date)} rows={rows} />;
}
