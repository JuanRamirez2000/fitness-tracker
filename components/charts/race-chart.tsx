import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildRacePredictions, fmtRaceChange, fmtRaceTime, racePaceSec, type RacePrediction } from "@/lib/charts/fitness";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { fmtPace } from "@/lib/running/runs";
import { ChartCard, ChartEmpty } from "./chart-card";
import { ChartHover, type HoverPoint, type HoverRow } from "./chart-hover";
import { AxisRow, Marker, Plot } from "./parts";

const WIDTH = 320;
const HEIGHT = 84;

/**
 * Garmin's predicted 5K, 10K and half marathon over the range: one small chart each (side by side
 * on a wide screen, stacked on a phone), every one on its own scale with faster at the top, so
 * a half marathon's minutes don't flatten the 5K's seconds. Hovering any of them shows all three.
 */
export function RaceChart({ data }: { data: DashboardData }) {
  const races = buildRacePredictions(data);
  const title = "Race predictions";
  const subtitle = "Garmin's predicted finish times, faster is up";
  if (races.length === 0) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <ChartEmpty>{data.training.length ? "no data in range" : "no predictions yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const first = races.map((r) => r.points[0].date).sort()[0];
  const from = first > data.dateRange.from ? first : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [3, WIDTH - 3] });

  // Every panel's tooltip lists all three distances as of that day.
  const asOf = (r: RacePrediction, date: string) => [...r.points].reverse().find((p) => p.date <= date) ?? null;
  const rows = (date: string): HoverRow[] =>
    races.flatMap((r) => {
      const p = asOf(r, date);
      return p ? [{ label: r.label, value: `${fmtRaceTime(p.value)} · ${fmtPace(racePaceSec(p.value, r.miles))}/mi` }] : [];
    });

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      note={from !== data.dateRange.from ? `predictions start ${fmtDate(from)}` : undefined}
    >
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
        {races.map((r) => (
          <RacePanel key={r.label} race={r} x={(date) => x(dayStartUtcMs(date))} rows={rows} />
        ))}
      </div>
      <AxisRow start={fmtDate(from)} end={fmtDate(data.dateRange.to)} />
    </ChartCard>
  );
}

function RacePanel({ race, x, rows }: { race: RacePrediction; x: (date: string) => number; rows: (date: string) => HoverRow[] }) {
  const values = race.points.map((p) => p.value);
  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 5);
  // Faster (fewer seconds) at the top.
  const y = scaleLinear<number>({ domain: [Math.min(...values) - pad, Math.max(...values) + pad], range: [5, HEIGHT - 5] });
  const faster = race.change !== null && race.change < 0;
  const points: HoverPoint[] = race.points.map((p) => ({
    at: x(p.date) / WIDTH,
    title: fmtPointTitle(p.date),
    rows: rows(p.date),
    marks: [{ y: y(p.value) / HEIGHT, className: "bg-accent" }],
  }));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{race.label}</span>
        <span className="font-mono text-[10px] text-muted-2">{fmtPace(racePaceSec(race.latest, race.miles))}/mi</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[22px] leading-none text-ink">{fmtRaceTime(race.latest)}</span>
        <span className={`font-mono text-[10.5px] ${faster ? "text-good" : "text-muted-2"}`}>
          {race.change === null ? "one prediction" : fmtRaceChange(race.change)}
        </span>
      </div>
      <ChartHover points={points} label={`${race.label} predictions`}>
        <Plot
          width={WIDTH}
          height={HEIGHT}
          label={`${race.label} predicted ${fmtRaceTime(race.latest)}${race.change !== null ? `, ${fmtRaceChange(race.change).slice(2)} over the range` : ""}`}
          markers={
            race.points.length === 1 ? (
              <Marker x={x(race.points[0].date)} y={y(race.points[0].value)} width={WIDTH} height={HEIGHT} shape="dot" className="bg-accent" />
            ) : undefined
          }
        >
          <line x1={0} x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} className="stroke-divider" vectorEffect="non-scaling-stroke" />
          <LinePath
            data={race.points}
            x={(p) => x(p.date)}
            y={(p) => y(p.value)}
            className="fill-none stroke-accent"
            strokeWidth={1.8}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </Plot>
      </ChartHover>
    </div>
  );
}
