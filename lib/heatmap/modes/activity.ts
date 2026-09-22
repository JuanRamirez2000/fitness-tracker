import { ActivityTooltip } from "@/components/heatmap/tooltips/activity-tooltip";
import type { Activity } from "@/lib/data/activities";
import type { ActivityType } from "@/lib/data/activity-types";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_NO_DATA } from "@/lib/heatmap/colors";
import { activityPaint } from "@/lib/heatmap/paints";

export interface ActivityTooltipItem {
  label: string;
  color: string;
  notes: string | null;
}

export interface ActivityTooltipData {
  items: ActivityTooltipItem[];
}

function groupByDate(activities: readonly Activity[]): Map<string, Activity[]> {
  const byDate = new Map<string, Activity[]>();
  for (const activity of activities) {
    const forDate = byDate.get(activity.local_date);
    if (forDate) forDate.push(activity);
    else byDate.set(activity.local_date, [activity]);
  }
  return byDate;
}

export const ACTIVITY_MODE: HeatmapMode = {
  id: "activity",
  label: "Activity",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    const types = new Map(data.activityTypes.map((t) => [t.key, t] as const));
    const byDate = groupByDate(data.heatmap.activities);

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }

      const dayActivities = byDate.get(date) ?? [];
      const resolved: ActivityType[] = dayActivities.map(
        (a) => types.get(a.activity_type) ?? { key: a.activity_type, label: a.activity_type, color: CELL_NO_DATA, sort_order: 0 },
      );
      const paint = activityPaint(resolved.map((t) => t.color));
      const tooltip: ActivityTooltipData | null = dayActivities.length
        ? { items: dayActivities.map((a, i) => ({ label: resolved[i].label, color: resolved[i].color, notes: a.notes })) }
        : null;

      return {
        date,
        fill: paint?.fill ?? CELL_NO_DATA,
        secondFill: paint?.secondFill,
        notch: paint?.notch,
        state: dayActivities.length ? "data" : "none",
        inRange,
        tooltip,
      };
    });
  },
  legend(ctx: ModeContext, data: DashboardData): LegendItem[] {
    return [
      ...data.activityTypes.map((t) => ({ label: t.label, swatch: t.color })),
      {
        label: "multiple",
        swatch: `linear-gradient(135deg, ${ctx.palette.accent} 0 50%, ${ctx.palette.good} 50% 100%)`,
      },
      { label: "none", swatch: CELL_NO_DATA },
    ];
  },
  Tooltip: ActivityTooltip,
};
