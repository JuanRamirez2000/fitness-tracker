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

/** Not a real activity_types row — schema.sql deliberately keeps steps a numeric daily_metrics
 * value, never a loggable activity (see its own comment). This is a synthetic badge so hitting
 * the day's steps goal shows up on this card the same way a logged session would, without ever
 * writing to public.activities. Always the theme's accent, matching every other "steps goal
 * met" cell in the app (Steps mode's own "goal+" swatch, Logged mode's "weight + steps"). */
function stepsGoalItem(accent: string): ActivityTooltipItem {
  return { label: "Steps", color: accent, notes: "goal met" };
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
      if (stepsHit) items.push(stepsGoalItem(ctx.palette.accent));

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
    return [
      ...data.activityTypes.map((t) => ({ label: t.label, swatch: t.color })),
      { label: "Steps", swatch: ctx.palette.accent },
      {
        label: "multiple",
        swatch: `linear-gradient(135deg, ${ctx.palette.accent} 0 50%, ${ctx.palette.good} 50% 100%)`,
      },
      { label: "none", swatch: CELL_NO_DATA },
    ];
  },
  Tooltip: ActivityTooltip,
};
