import type { FC } from "react";
import type { Activity } from "@/lib/data/activities";
import type { ActivityType } from "@/lib/data/activity-types";
import type { DailyMetric } from "@/lib/data/daily-metrics";
import type { Injection } from "@/lib/data/injections";
import type { NutritionDay } from "@/lib/data/nutrition-days";
import type { Profile } from "@/lib/data/profiles";
import type { DailyWeight, WeightTrendRow } from "@/lib/data/weight-trend";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import type { Palette } from "@/lib/theme/palette";

export const RANGE_KEYS = ["week", "month", "6m", "year", "all", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

/** The window that drives the charts and the table. Both ends are inclusive local dates. */
export interface DateRange extends DayWindow {
  key: RangeKey;
}

/** Series that only need to be fetched once per window (heatmap or the selected range). */
export interface WindowedData {
  window: DayWindow;
  nutritionDays: NutritionDay[];
  activities: Activity[];
  steps: DailyMetric[];
}

export interface DashboardData {
  profile: Profile;
  activityTypes: ActivityType[];
  today: LocalDate;
  programStart: LocalDate;
  /** The account's very first recorded day, before any profiles.start_weight_lb override. */
  firstWeighIn: DailyWeight | null;
  /**
   * Every weight_trend row up to today, unbounded rather than windowed. weight_trend's
   * raw/avg7 deltas are computed by the view over the user's whole history before any date
   * filter is applied (see schema.sql), so a windowed fetch would still color cells
   * correctly — but the window's own edge cells would be missing the PREVIOUS row needed to
   * show "vs Sep 14" in the tooltip, or to seed the logging streak and weekly-rate KPIs.
   * Weigh-in counts are small enough at this app's scale that fetching all of them is cheap.
   */
  weightTrend: WeightTrendRow[];
  /** Every injection (about one row a week), unbounded for the same reason: matchShots
   * needs to see shots outside a window to place a late or early star correctly at its edge. */
  injections: Injection[];
  /** The heatmap's fixed 53-week window (lib/heatmap/window.ts), independent of dateRange. */
  heatmap: WindowedData;
  /** Scoped to dateRange; drives the charts and defaults the table. */
  range: WindowedData;
  dateRange: DateRange;
}

export type HeatmapCellState = "data" | "none" | "future" | "pre_program" | "warming_up";

export interface HeatmapCell {
  date: LocalDate;
  /** Resolved fill for a solid cell. null for a state HeatmapGrid renders without one:
   * pre_program (faint, borderless) and future (dashed outline) — see components/heatmap. */
  fill: string | null;
  state: HeatmapCellState;
  /** false = outside the selected dateRange, dimmed by HeatmapGrid. */
  inRange: boolean;
  /** Mode-specific payload for this mode's own Tooltip component to interpret. */
  tooltip: unknown;
}

export interface LegendItem {
  label: string;
  /** A resolved color, or CSS for a split "multiple" swatch (see activityPaint). */
  swatch: string;
}

export interface ModeContext {
  range: DateRange;
  palette: Palette;
  /** The weight mode's own raw/7-day-average toggle (default "avg7"); unused by every
   * other mode. Lives here, not in a second registry entry, so weight stays one mode. */
  weightSubMode: WeightMode;
}

export const HEATMAP_MODE_IDS = ["weight", "calories", "activity", "steps", "logged"] as const;
export type HeatmapModeId = (typeof HEATMAP_MODE_IDS)[number];

export interface HeatmapMode {
  id: HeatmapModeId;
  label: string;
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[];
  /** A function, not a static array: legend colors depend on the active palette (the
   * color-blind toggle), which the brief's literal type does not have room for. */
  legend(ctx: ModeContext): LegendItem[];
  Tooltip: FC<{ cell: HeatmapCell }>;
}
