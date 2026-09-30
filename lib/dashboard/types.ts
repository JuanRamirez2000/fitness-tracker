import type { FC } from "react";
import type { Profile } from "@/lib/data/profiles";
import type { WeighIn } from "@/lib/data/weigh-ins";
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

export interface DashboardData {
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
  /** The heatmap's fixed 53-week window (lib/heatmap/window.ts), independent of dateRange. */
  heatmap: { window: DayWindow };
  /** Raw weigh-in rows inside dateRange, newest first, for the table. */
  weighIns: WeighIn[];
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

export const HEATMAP_MODE_IDS = ["weight"] as const;
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

