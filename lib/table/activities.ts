import type { DashboardData } from "@/lib/dashboard/types";
import { fmtDuration, fmtPace, isEasyRun, paceSecPerMile, runMiles, runSpeedMps, runsIn } from "@/lib/running/runs";
import { activitiesFor, isRun, mph, type SportFilter } from "@/lib/sport";

const FEET_PER_METER = 3.28084;

/** One row of the Activities table: already display-ready, newest first. */
export interface ActivityRow {
  id: string;
  local_date: string;
  name: string;
  sport: "ride" | "run";
  /** Easy or workout, by Garmin's training-effect label (rides too: an easy spin is "Easy"). */
  kind: "easy" | "workout" | null;
  miles: string;
  time: string;
  /** "12:00/mi" for a run, "17.2 mph" for a ride; null without a speed. */
  speed: string | null;
  avgHr: number | null;
  /** A ride's normalized power when Garmin has it, else average power; null without a power
   * meter, and for runs: running power reads several times a ride's and doesn't compare. */
  power: number | null;
  /** Steps a minute for a run, rpm for a ride. */
  cadence: number | null;
  elevFt: number | null;
  /** Garmin's aerobic training effect and the word Garmin uses for that score, e.g. "2.4 Maintaining". */
  effect: string | null;
  /** Garmin's primary-benefit label, e.g. "tempo" (the row's tooltip). */
  benefit: string | null;
}

export type ActivityColumn = "date" | "sport" | "type" | "mi" | "time" | "speed" | "hr" | "power" | "cad" | "elev" | "effect";

/** The table's columns under each sport filter, in order: runs keep their running columns. */
export function activityColumns(sport: SportFilter): ActivityColumn[] {
  if (sport === "run") return ["date", "type", "mi", "time", "speed", "hr", "cad", "effect"];
  if (sport === "ride") return ["date", "type", "mi", "time", "speed", "hr", "power", "cad", "elev", "effect"];
  return ["date", "sport", "type", "mi", "time", "speed", "hr", "power", "effect"];
}

export const COLUMN_LABELS: Record<ActivityColumn, (sport: SportFilter) => string> = {
  date: () => "Date",
  sport: () => "Sport",
  type: () => "Type",
  mi: () => "Mi",
  time: () => "Time",
  speed: (s) => (s === "run" ? "Pace" : s === "ride" ? "Mph" : "Speed"),
  hr: () => "HR",
  power: () => "Watts",
  cad: (s) => (s === "ride" ? "Rpm" : "Cad"),
  elev: () => "Ft",
  effect: () => "Effect",
};

/** Garmin's words for an aerobic training effect score (0-5). */
export function trainingEffectWord(score: number): string {
  if (score >= 5) return "Overreaching";
  if (score >= 4) return "Highly improving";
  if (score >= 3) return "Improving";
  if (score >= 2) return "Maintaining";
  if (score >= 1) return "Minor";
  return "None";
}

export function buildActivityRows(data: DashboardData): ActivityRow[] {
  return runsIn(activitiesFor(data), data.dateRange)
    .map((a): ActivityRow => {
      const run = isRun(a);
      const speed = run ? runSpeedMps(a) : a.avg_speed_mps;
      const label = a.training_effect_label?.toLowerCase().replaceAll("_", " ");
      const cadence = run ? a.avg_cadence_spm : a.avg_cadence_rpm;
      return {
        id: a.id,
        local_date: a.local_date,
        name: a.name ?? (run ? "Run" : "Ride"),
        sport: run ? "run" : "ride",
        kind: a.training_effect_label === null ? null : isEasyRun(a) ? "easy" : "workout",
        miles: runMiles(a).toFixed(run ? 2 : 1),
        time: fmtDuration(a.moving_duration_s ?? a.duration_s),
        speed: speed ? (run ? `${fmtPace(paceSecPerMile(speed))}/mi` : `${mph(speed).toFixed(1)} mph`) : null,
        avgHr: a.avg_hr,
        power: run ? null : (a.norm_power_w ?? a.avg_power_w),
        cadence: cadence === null ? null : Math.round(cadence),
        elevFt: a.elevation_gain_m ? Math.round(a.elevation_gain_m * FEET_PER_METER) : null,
        effect:
          a.aerobic_training_effect === null
            ? null
            : `${a.aerobic_training_effect.toFixed(1)} ${trainingEffectWord(a.aerobic_training_effect)}`,
        benefit: label ?? null,
      };
    })
    .reverse();
}
