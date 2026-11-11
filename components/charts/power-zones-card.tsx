import type { DashboardData } from "@/lib/dashboard/types";
import { buildPowerZones } from "@/lib/charts/all-sports";
import { ChartCard, ChartEmpty } from "./chart-card";
import { Stat, StatRow } from "./parts";

/** The card's "?" explanation. */
const HELP =
  "Time in each power zone across your rides in the range, as Garmin works them out from the FTP set in Garmin Connect. If that FTP is set too high, everything slides into the low zones; a ramp test on the trainer fixes it. Zones 1-2 build endurance, 3 is tempo, 4 is threshold, and 5-7 are the short, hard efforts.";

/** Zone colors: the HR zone scale for Z1-Z5, fading Z5 for the two sprint zones above it. */
const ZONE_BG = ["bg-z1", "bg-z2", "bg-z3", "bg-z4", "bg-z5", "bg-z5/70", "bg-z5/45"];

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Minutes in each of Garmin's seven power zones over the range's rides, as one bar per zone. */
export function PowerZonesCard({ data }: { data: DashboardData }) {
  const chart = buildPowerZones(data);
  const title = "Time in power zones";
  const subtitle = "Rides, minutes per zone against your Garmin FTP";
  if (!chart) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>no rides with power zones in range</ChartEmpty>
      </ChartCard>
    );
  }
  const easy = chart.zones[0].share + chart.zones[1].share;
  const hard = chart.zones.slice(3).reduce((s, z) => s + z.share, 0);
  const top = Math.max(...chart.zones.map((z) => z.minutes));
  return (
    <ChartCard help={HELP} title={title} subtitle={subtitle}>
      <StatRow>
        <Stat label="Endurance (Z1–2)" value={pct(easy)} />
        <Stat label="Threshold+ (Z4–7)" value={pct(hard)} />
        <Stat label="Time" value={Math.round(chart.totalMinutes)} unit="min" note={`${chart.rides} ${chart.rides === 1 ? "ride" : "rides"}`} />
      </StatRow>
      <ul className="flex flex-col gap-1.5" aria-label="Minutes in each power zone">
        {chart.zones.map((z, i) => (
          <li key={z.label} className="grid grid-cols-[88px_1fr_64px] items-center gap-2.5 font-mono text-[10.5px]">
            <span className="text-muted-1">
              {z.label} <span className="text-muted-2">{z.name}</span>
            </span>
            <span className="h-2.5 rounded-[2px] bg-inset">
              <span className={`block h-full rounded-[2px] ${ZONE_BG[i]}`} style={{ width: `${top > 0 ? (z.minutes / top) * 100 : 0}%` }} />
            </span>
            <span className="text-right text-muted-2">
              {Math.round(z.minutes)}m · {pct(z.share)}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
