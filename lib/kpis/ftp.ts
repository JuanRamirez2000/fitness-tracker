import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { isRide } from "@/lib/sport";

/** How far back the best 20 minutes is looked for when estimating FTP. */
const ESTIMATE_DAYS = 90;
/** The usual rule of thumb: FTP is about 95% of the best 20-minute power. */
const TWENTY_MIN_FACTOR = 0.95;
/** Garmin's FTP this far above the estimate is probably a default nobody set. */
const IMPLAUSIBLE_RATIO = 1.3;
const LB_PER_KG = 2.20462;
const SPARKLINE_DAYS = 365;

export interface FtpReading {
  watts: number;
  date: string;
  /** garmin: the unofficial import's FTP; ride: worked back from a ride's NP / IF, which Garmin
   * computes against its FTP setting; estimate: 95% of the best 20 minutes. */
  source: "garmin" | "ride" | "estimate";
}

/** The best 20-minute power in the last ESTIMATE_DAYS, from either Garmin field that carries it. */
export function best20Min(data: Pick<DashboardData, "activities" | "today">): { watts: number; date: string } | null {
  const from = addDays(data.today, -ESTIMATE_DAYS);
  let best: { watts: number; date: string } | null = null;
  for (const a of data.activities) {
    if (!isRide(a) || a.local_date < from || a.local_date > data.today) continue;
    const w = a.max_20min_power_w ?? a.power_curve?.["1200"] ?? null;
    if (w && (!best || w > best.watts)) best = { watts: w, date: a.local_date };
  }
  return best;
}

/** The athlete's current cycling FTP, from the best source there is. */
export function currentFtp(data: Pick<DashboardData, "activities" | "training" | "today">): FtpReading | null {
  const set = [...data.training].reverse().find((t) => t.ftp_w !== null && t.local_date <= data.today);
  if (set) return { watts: set.ftp_w!, date: set.local_date, source: "garmin" };
  const ride = [...data.activities]
    .reverse()
    .find((a) => isRide(a) && a.local_date <= data.today && a.norm_power_w && a.intensity_factor);
  if (ride) return { watts: Math.round(ride.norm_power_w! / ride.intensity_factor!), date: ride.local_date, source: "ride" };
  const best = best20Min(data);
  return best ? { watts: Math.round(best.watts * TWENTY_MIN_FACTOR), date: best.date, source: "estimate" } : null;
}

/** The FTP to do math with: Garmin's, unless it's far above what the rides show (an FTP nobody
 * set or tested), in which case the 95%-of-20-minutes estimate. */
export function workingFtp(data: Pick<DashboardData, "activities" | "training" | "today">): FtpReading | null {
  const reading = currentFtp(data);
  const best = best20Min(data);
  if (reading && best && reading.source !== "estimate" && reading.watts > best.watts * TWENTY_MIN_FACTOR * IMPLAUSIBLE_RATIO) {
    return { watts: Math.round(best.watts * TWENTY_MIN_FACTOR), date: best.date, source: "estimate" };
  }
  return reading;
}

/** The latest weigh-in's 7-day average, in kg, for watts per kilo. */
function weightKg(data: Pick<DashboardData, "weightTrend" | "today">): number | null {
  const row = [...data.weightTrend].reverse().find((r) => r.local_date <= data.today);
  return row ? (row.avg7_lb ?? row.weight_lb) / LB_PER_KG : null;
}

/** Cycling FTP in watts, with watts per kilo; flags a Garmin FTP far above what the rides show. */
export const ftp: KpiDefinition = {
  id: "ftp",
  label: "FTP",
  visual: "sparkline",
  emptyMessage: "No rides with power yet",
  compute(data: DashboardData): KpiValue | null {
    const reading = currentFtp(data);
    if (!reading) return null;
    const kg = weightKg(data);
    const perKg = kg ? ` · ${(reading.watts / kg).toFixed(1)} W/kg` : "";
    const best = best20Min(data);
    const estimate = best ? Math.round(best.watts * TWENTY_MIN_FACTOR) : null;
    const implausible = reading.source !== "estimate" && estimate !== null && reading.watts > estimate * IMPLAUSIBLE_RATIO;

    const sub =
      reading.source === "estimate"
        ? `Estimated: 95% of your best 20 min${perKg}`
        : implausible
          ? `Garmin's setting · your rides suggest ~${estimate} W`
          : `${reading.source === "garmin" ? "Set in Garmin" : "Garmin's setting"} · as of ${fmtDate(reading.date)}${perKg}`;

    const from = addDays(data.today, -SPARKLINE_DAYS);
    const history = data.training.filter((t) => t.ftp_w !== null && t.local_date >= from && t.local_date <= data.today);
    return {
      value: reading.watts,
      unit: "W",
      tone: implausible ? "warn" : "neutral",
      sub,
      points: history.length > 1 ? history.map((t) => ({ date: t.local_date, value: t.ftp_w!, text: `${t.ftp_w} W` })) : undefined,
    };
  },
  format(v) {
    return { primary: String(v.value), tone: v.tone };
  },
};
