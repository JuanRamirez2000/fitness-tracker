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

const WALK_KEY = "walk";

/** User's own rule: hitting the day's steps goal counts as a walk, always — alongside
 * whatever else was logged that day, not just when nothing else was. Not a real
 * activities row (schema.sql deliberately keeps steps a numeric daily_metrics value, never
 * a loggable activity — see its own comment); this is computed here so it shows up
 * wherever activity is displayed without ever writing to public.activities. Uses the real
 * "walk" activity_type's own label/color so it reads as an actual walk, not a separate
 * synthetic category. */
function stepsGoalItem(walkType: ActivityType | undefined): ActivityTooltipItem {
  return { label: walkType?.label ?? "Walk", color: walkType?.color ?? CELL_NO_DATA, notes: "steps goal met" };
}

export const ACTIVITY_MODE: HeatmapMode = {
  id: "activity",
  label: "Activity",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    const types = new Map(data.activityTypes.map((t) => [t.key, t] as const));
    const byDate = groupByDate(data.heatmap.activities);
    const stepsByDate = new Map(data.heatmap.steps.map((row) => [row.local_date, row] as const));
    const goal = data.profile.steps_goal;

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }

      const dayActivities = byDate.get(date) ?? [];
      const items: ActivityTooltipItem[] = dayActivities.map((a) => {
        const type: ActivityType | undefined = types.get(a.activity_type);
        return { label: type?.label ?? a.activity_type, color: type?.color ?? CELL_NO_DATA, notes: a.notes };
      });
      const stepsHit = (stepsByDate.get(date)?.value ?? 0) >= goal;
      if (stepsHit) items.push(stepsGoalItem(types.get(WALK_KEY)));

      const paint = activityPaint(items.map((item) => item.color));

      return {
        date,
        fill: paint?.fill ?? CELL_NO_DATA,
        secondFill: paint?.secondFill,
        notch: paint?.notch,
        state: items.length ? "data" : "none",
        inRange,
        tooltip: items.length ? { items } : null,
      };
    });
  },
  legend(ctx: ModeContext, data: DashboardData): LegendItem[] {
    // No separate "Steps" entry: a steps-goal day now shows as the real "Walk" swatch
    // (already listed via activityTypes below), not a distinct synthetic category.
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
