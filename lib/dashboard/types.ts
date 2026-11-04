import type { FC } from "react";
import type { Activity } from "@/lib/data/activities";
import type { DailyRecovery, SleepNight } from "@/lib/data/recovery";
import type { DailyTraining } from "@/lib/data/training";
import type { Profile } from "@/lib/data/profiles";
import type { DailySteps } from "@/lib/data/steps";
import type { BodyCompositionDay, WeighIn } from "@/lib/data/weigh-ins";
import type { Injection } from "@/lib/data/injections";
import type { DailyWeight, WeightTrendRow } from "@/lib/data/weight-trend";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import type { Palette } from "@/lib/theme/palette";

export const RANGE_KEYS = ["week", "month", "6m", "year", "all", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

/** The dashboard's tabs, in display order (`?tab=`). The first is the default. */
export const TAB_KEYS = ["today", "weight", "training"] as const;
export type TabKey = (typeof TAB_KEYS)[number];
export const DEFAULT_TAB: TabKey = "today";
export const TAB_LABELS: Record<TabKey, string> = {
  today: "Daily feel",
  weight: "Weight",
  training: "Training",
};

/** The window that drives the charts and the table. Both ends are inclusive local dates. */
export interface DateRange extends DayWindow {
  key: RangeKey;
}

/**
 * Everything a tab renders. Only the active tab's data is fetched (lib/dashboard/load.ts,
 * tabNeeds): on a tab that doesn't render them, `activities`, `steps`, `heatmap.steps`,
 * `weighIns`, `recovery`, `sleep`, `bodyComposition` and `training` are empty arrays, not real "no data" — read them only
 * from that tab's views.
 */
export interface DashboardData {
  tab: TabKey;
  profile: Profile;
  today: LocalDate;
  programStart: LocalDate;
  /** The account's very first recorded day, before any profiles.start_weight_lb override. */
  firstWeighIn: DailyWeight | null;
  /**
   * Every weight_trend row up to today, unbounded rather than windowed: the heatmap's and
   * the KPIs' first in-window day still needs the PREVIOUS row to show "vs Sep 14" or to
   * seed the logging streak and weekly rate. Weigh-in counts are small at this app's scale.
   */
  weightTrend: WeightTrendRow[];
  /** Every shot, unbounded for the same reason: matchShots needs to see shots outside a
   * window to place a late or early star correctly at its edge. */
  injections: Injection[];
  /** Every Garmin activity, oldest first, unbounded like weightTrend: the running KPIs compare
   * the latest weeks against earlier ones, whatever range is selected. */
  activities: Activity[];
  /** The heatmaps' fixed 53-week window (lib/heatmap/window.ts), independent of dateRange,
   * and every day's steps inside it (the steps heatmap and the Steps card). */
  heatmap: { window: DayWindow; steps: DailySteps[] };
  /** Each day's step count inside dateRange, oldest first, for the steps chart and table. */
  steps: DailySteps[];
  /** Raw weigh-in rows inside dateRange, newest first, for the table. */
  weighIns: WeighIn[];
  /** Daily recovery rows from dateRange.from through max(dateRange.to, today), oldest first
   * (Daily feel tab). Today is always included: the hero is about today. */
  recovery: DailyRecovery[];
  /** Nights (by wake-up day) over the same span as `recovery`, oldest first. */
  sleep: SleepNight[];
  /** Every day's body composition, unbounded, oldest first (Weight tab). */
  bodyComposition: BodyCompositionDay[];
  /** Every daily training snapshot up to max(dateRange.to, today), oldest first (Training tab):
   * unbounded at the start, for VO2 max's history. */
  training: DailyTraining[];
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
  swatch: string;
}

export interface ModeContext {
  range: DateRange;
  palette: Palette;
  /** Which series colors the cells (default "avg7"). */
  weightSubMode: WeightMode;
}

export const HEATMAP_MODE_IDS = ["weight", "steps", "running"] as const;
export type HeatmapModeId = (typeof HEATMAP_MODE_IDS)[number];

export interface HeatmapMode {
  id: HeatmapModeId;
  label: string;
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[];
  /** A function, not a static array: legend colors depend on the active palette. */
  legend(ctx: ModeContext): LegendItem[];
  Tooltip: FC<{ cell: HeatmapCell }>;
}

export type KpiTone = "good" | "bad" | "warn" | "neutral";

/**
 * What a KpiDefinition.compute() returns: the semantic value plus everything the card needs
 * besides the two strings format() produces. The brief's format() signature only asks for
 * `{ primary, delta?, tone? }` (text for the two numeric slots); `sub`, `series` and
 * `progress` are already display-ready here because they are not really "numbers to format"
 * — a caption, a list of points, a fraction.
 */
export interface KpiValue {
  /** The number format() renders as the primary text. */
  value: number | null;
  unit: string;
  delta?: number;
  deltaUnit?: string;
  /** Replaces a numeric delta chip with fixed text ("on track" / "behind pace"). */
  deltaText?: string;
  tone: KpiTone;
  /** Caption under the value, e.g. "Logged Sep 20 · tap to edit". */
  sub: string;
  /** Recent values, oldest first, for the sparkline. */
  series?: number[];
  /** 0..1, for a progress bar. */
  progress?: number;
}

export interface KpiDefinition {
  id: string;
  label: string;
  visual?: "sparkline" | "progress" | "none";
  /** PURE, unit-tested. null = the empty state ("Set a goal", no shot ever logged, etc). */
  compute(data: DashboardData): KpiValue | null;
  format(value: KpiValue): { primary: string; delta?: string; tone?: KpiTone };
  /**
   * Shown, with the card's own label still visible, when compute() returns null (e.g.
   * "Set a goal"). Distinct from the grid's own empty-slot padding for a position with no
   * KpiDefinition at all, which is generic and unlabeled — see KpiGrid.
   */
  emptyMessage?: string;
}

