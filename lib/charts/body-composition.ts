import type { DashboardData } from "@/lib/dashboard/types";
import type { BodyCompositionDay } from "@/lib/data/weigh-ins";
import type { LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";

/** Fat mass = weight x body fat %. Garmin gives the percent, not the mass. */
export function fatMassLb(day: Pick<BodyCompositionDay, "weight_lb" | "body_fat_pct">): number {
  return (day.weight_lb * day.body_fat_pct) / 100;
}

/** Lean mass, as the design defines it: everything that isn't fat (weight - fat mass). */
export function leanMassLb(day: Pick<BodyCompositionDay, "weight_lb" | "body_fat_pct">): number {
  return day.weight_lb - fatMassLb(day);
}

export interface MassPoint {
  date: LocalDate;
  fat: number;
  lean: number;
}

export interface BodyMassData {
  points: MassPoint[];
  /** Change from the range's first reading to its last. */
  fatDelta: number | null;
  leanDelta: number | null;
  /** Since the very first scale reading, whatever the range. */
  since: {
    date: LocalDate;
    fat: number;
    lean: number;
    weight: number;
    /** Share of the weight lost that was fat (0..1+), when weight went down. */
    fatShareOfLoss: number | null;
  } | null;
  /** The first reading in the range: the axis starts here when it's after the range start. */
  dataFrom: LocalDate;
}

/** Fat and lean mass over the range, plus the change since the first scale reading. */
export function buildBodyMass(data: Pick<DashboardData, "bodyComposition" | "dateRange" | "today">): BodyMassData | null {
  const all = data.bodyComposition.filter((d) => d.local_date <= data.today);
  const days = all.filter((d) => isInRange(d.local_date, data.dateRange));
  if (days.length === 0) return null;

  const points = days.map((d) => ({ date: d.local_date, fat: fatMassLb(d), lean: leanMassLb(d) }));
  const first = all[0];
  const latest = all[all.length - 1];
  const weightChange = latest.weight_lb - first.weight_lb;
  const fatChange = fatMassLb(latest) - fatMassLb(first);

  return {
    points,
    fatDelta: points.length >= 2 ? points[points.length - 1].fat - points[0].fat : null,
    leanDelta: points.length >= 2 ? points[points.length - 1].lean - points[0].lean : null,
    since:
      all.length >= 2
        ? {
            date: first.local_date,
            fat: fatChange,
            lean: leanMassLb(latest) - leanMassLb(first),
            weight: weightChange,
            fatShareOfLoss: weightChange < 0 ? fatChange / weightChange : null,
          }
        : null,
    dataFrom: days[0].local_date,
  };
}

export type CompositionPart = "fat" | "muscle" | "bone" | "other";

export interface CompositionSegment {
  part: CompositionPart;
  label: string;
  lb: number;
  /** Share of body weight, 0..100. */
  pct: number;
}

export interface CompositionToday {
  date: LocalDate;
  weight: number;
  bodyFatPct: number;
  segments: CompositionSegment[];
  /** Body water sits inside the other masses, so it's a separate bar, not a segment. */
  waterPct: number | null;
}

const LABELS: Record<CompositionPart, string> = { fat: "Fat", muscle: "Muscle", bone: "Bone", other: "Other" };

/**
 * The latest scale reading split into fat, muscle, bone and the rest (organs, water outside
 * muscle, and so on: weight minus the other three). A part Garmin didn't report is left out
 * and folds into "other".
 */
export function buildComposition(data: Pick<DashboardData, "bodyComposition" | "today">): CompositionToday | null {
  const day = data.bodyComposition.filter((d) => d.local_date <= data.today).at(-1);
  if (!day) return null;

  const fat = fatMassLb(day);
  const muscle = day.muscle_mass_lb;
  const bone = day.bone_mass_lb;
  const other = Math.max(day.weight_lb - fat - (muscle ?? 0) - (bone ?? 0), 0);
  const parts: [CompositionPart, number | null][] = [
    ["fat", fat],
    ["muscle", muscle],
    ["bone", bone],
    ["other", other],
  ];

  return {
    date: day.local_date,
    weight: day.weight_lb,
    bodyFatPct: day.body_fat_pct,
    segments: parts.flatMap(([part, lb]) =>
      lb === null ? [] : [{ part, label: LABELS[part], lb, pct: (lb / day.weight_lb) * 100 }],
    ),
    waterPct: day.body_water_pct,
  };
}
