import type { DashboardData } from "@/lib/dashboard/types";
import { fmtDuration, fmtPace, isEasyRun, paceSecPerMile, runMiles, runSpeedMps, runsIn, runsOf } from "@/lib/running/runs";

/** One row of the Runs table: already display-ready, newest first. */
export interface RunRow {
  id: string;
  local_date: string;
  name: string;
  kind: "easy" | "workout" | null;
  miles: string;
  time: string;
  pace: string | null;
  avgHr: number | null;
  cadence: number | null;
  /** Garmin's aerobic training effect and the word Garmin uses for that score, e.g. "2.4 Maintaining". */
  effect: string | null;
  /** Garmin's primary-benefit label, e.g. "tempo" (the row's tooltip). */
  benefit: string | null;
  fastestMile: string | null;
}

/** Garmin's words for an aerobic training effect score (0-5). */
export function trainingEffectWord(score: number): string {
  if (score >= 5) return "Overreaching";
  if (score >= 4) return "Highly improving";
  if (score >= 3) return "Improving";
  if (score >= 2) return "Maintaining";
  if (score >= 1) return "Minor";
  return "None";
}

export function buildRunRows(data: DashboardData): RunRow[] {
  return runsIn(runsOf(data.activities), data.dateRange)
    .map((r) => {
      const speed = runSpeedMps(r);
      const label = r.training_effect_label?.toLowerCase().replaceAll("_", " ");
      return {
        id: r.id,
        local_date: r.local_date,
        name: r.name ?? "Run",
        kind: r.training_effect_label === null ? null : isEasyRun(r) ? ("easy" as const) : ("workout" as const),
        miles: runMiles(r).toFixed(2),
        time: fmtDuration(r.moving_duration_s ?? r.duration_s),
        pace: speed ? fmtPace(paceSecPerMile(speed)) : null,
        avgHr: r.avg_hr,
        cadence: r.avg_cadence_spm === null ? null : Math.round(r.avg_cadence_spm),
        effect:
          r.aerobic_training_effect === null
            ? null
            : `${r.aerobic_training_effect.toFixed(1)} ${trainingEffectWord(r.aerobic_training_effect)}`,
        benefit: label ?? null,
        fastestMile: r.fastest_mile_s === null ? null : fmtPace(r.fastest_mile_s),
      };
    })
    .reverse();
}
