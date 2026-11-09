import type { Activity } from "@/lib/data/activities";
import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { runMiles, runsIn } from "@/lib/running/runs";
import { inSport, isRide, type SportFilter } from "@/lib/sport";
import { signed } from "./format";

const SPARKLINE_WEEKS = 8;
const FEET_PER_METER = 3.28084;

/** Trailing 7 days ending `end`, inclusive. */
const week = (end: string) => ({ from: addDays(end, -6), to: end });
const hoursOf = (as: Activity[]) => as.reduce((sum, a) => sum + (a.moving_duration_s ?? a.duration_s), 0) / 3600;
const milesOf = (as: Activity[]) => as.reduce((sum, a) => sum + runMiles(a), 0);
const feetOf = (as: Activity[]) => Math.round(as.reduce((sum, a) => sum + (a.elevation_gain_m ?? 0), 0) * FEET_PER_METER);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A "last 7 days against the 7 before" volume card with an 8-week sparkline: the shape of the
 * running miles card (weekly-miles.ts), for any sport and measure.
 */
function weeklyVolume(spec: {
  id: string;
  label: string;
  sport: Exclude<SportFilter, "run">;
  unit: string;
  measure: (as: Activity[]) => number;
  sub: (thisWeek: Activity[]) => string;
  emptyMessage: string;
}): KpiDefinition {
  return {
    id: spec.id,
    label: spec.label,
    visual: "sparkline",
    emptyMessage: spec.emptyMessage,
    compute(data: DashboardData): KpiValue | null {
      const all = data.activities.filter((a) => inSport(a, spec.sport));
      if (all.length === 0) return null;
      const thisWeek = runsIn(all, week(data.today));
      const value = spec.measure(thisWeek);
      const previous = spec.measure(runsIn(all, week(addDays(data.today, -7))));
      const points = Array.from({ length: SPARKLINE_WEEKS }, (_, i) => {
        const end = addDays(data.today, -7 * (SPARKLINE_WEEKS - 1 - i));
        const v = spec.measure(runsIn(all, week(end)));
        return { date: end, value: v, text: `${v.toFixed(1)} ${spec.unit}`, title: `7 days to ${fmtDate(end)}` };
      });
      return {
        value,
        unit: spec.unit,
        delta: value - previous,
        tone: value >= previous ? "good" : "neutral",
        sub: spec.sub(thisWeek),
        points,
      };
    },
    format(v) {
      return { primary: v.value!.toFixed(1), delta: `${signed(v.delta!)} ${v.unit}`, tone: v.tone };
    },
  };
}

/** Miles ridden in the last 7 days, with the rides and climbing in its caption. */
export const rideMiles = weeklyVolume({
  id: "ride-miles",
  label: "Ride miles",
  sport: "ride",
  unit: "mi",
  measure: milesOf,
  emptyMessage: "No rides synced yet",
  sub: (rides) =>
    rides.length === 0 ? "No rides in the last 7 days" : `Last 7 days · ${plural(rides.length, "ride")} · ${feetOf(rides).toLocaleString("en-US")} ft climbed`,
});

/** Hours ridden in the last 7 days: the fairer measure when some rides are indoors. */
export const rideHours = weeklyVolume({
  id: "ride-hours",
  label: "Ride time",
  sport: "ride",
  unit: "h",
  measure: hoursOf,
  emptyMessage: "No rides synced yet",
  sub: (rides) => {
    const indoor = rides.filter((r) => r.activity_type === "indoor_cycling" || r.activity_type === "virtual_ride").length;
    return rides.length === 0 ? "No rides in the last 7 days" : `Last 7 days${indoor ? ` · ${indoor} indoor` : ""}`;
  },
});

/** Hours of riding and running together in the last 7 days (the All filter). */
export const trainingHours = weeklyVolume({
  id: "training-hours",
  label: "Training time",
  sport: "all",
  unit: "h",
  measure: hoursOf,
  emptyMessage: "No rides or runs synced yet",
  sub: (as) => {
    const rides = as.filter(isRide).length;
    return as.length === 0 ? "No rides or runs in the last 7 days" : `Last 7 days · ${plural(rides, "ride")} · ${plural(as.length - rides, "run")}`;
  },
});
