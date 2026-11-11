import { scaleBand, scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildWeeklyVolume } from "@/lib/charts/all-sports";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { SPORT_STYLE } from "@/lib/sport";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Plot, Stat, StatRow, Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP =
  "Hours of training per day or week, stacked by sport, with the line showing the week's total Garmin training load. Time is the one measure every sport shares (a ride mile, a run mile and a swim length aren't the same work). Steady bars with a load line that rises slowly is what building fitness looks like; a spike in the line is a week to recover from.";

const WIDTH = 520;
const HEIGHT = 140;
const Y_LABEL_W = 30;

/** Hours per day or week stacked by sport (in sport order, bottom up), with total load as a line. */
export function WeeklyVolumeChart({ data }: { data: DashboardData }) {
  const chart = buildWeeklyVolume(data);
  const title = "Training volume by sport";
  if (!chart) {
    return (
      <ChartCard help={HELP} title={title} subtitle="Hours per week, stacked by sport">
        <ChartEmpty>no workouts in range</ChartEmpty>
      </ChartCard>
    );
  }
  const unit = chart.weekly ? "week" : "day";
  const x = scaleBand<string>({ domain: chart.bars.map((b) => b.label), range: [Y_LABEL_W, WIDTH], padding: 0.25 });
  const maxH = Math.max(1, ...chart.bars.map((b) => b.total));
  const y = scaleLinear<number>({ domain: [0, maxH], range: [HEIGHT, 6] }).nice();
  const maxLoad = Math.max(1, ...chart.bars.map((b) => b.load));
  const yLoad = scaleLinear<number>({ domain: [0, maxLoad * 1.1], range: [HEIGHT, 6] });
  const center = (label: string) => (x(label) ?? 0) + x.bandwidth() / 2;

  const points: HoverPoint[] = chart.bars.map((b) => ({
    at: center(b.label) / WIDTH,
    title: fmtPointTitle(b.label, chart.weekly),
    rows: [
      ...[...chart.sports].reverse().flatMap((s) =>
        b.hours[s] > 0 ? [{ label: SPORT_STYLE[s].label, value: `${b.hours[s].toFixed(1)} h`, swatch: { shape: "square" as const, className: SPORT_STYLE[s].bg } }] : [],
      ),
      { label: "Total", value: `${b.total.toFixed(1)} h` },
      { label: "Load", value: String(Math.round(b.load)), swatch: { shape: "line" as const, className: "bg-ink" }, muted: true },
    ],
    marks: b.load > 0 ? [{ y: yLoad(b.load) / HEIGHT, className: "bg-ink" }] : [],
  }));

  return (
    <ChartCard
      help={HELP}
      title={title}
      subtitle={`Hours per ${unit}, stacked by sport, with Garmin's training load as the line`}
      legend={[
        ...chart.sports.map((s) => ({ label: SPORT_STYLE[s].label.toLowerCase(), swatch: Swatch.square(SPORT_STYLE[s].bg) })),
        { label: "load", swatch: Swatch.line("bg-ink") },
      ]}
    >
      <StatRow>
        <Stat label="Total" value={chart.totalHours.toFixed(1)} unit="h" note={chart.weekly ? `${chart.hoursPerWeek.toFixed(1)} h a week` : undefined} />
        {chart.sports.map((s) => (
          <Stat key={s} label={SPORT_STYLE[s].label} value={chart.hoursBySport[s].toFixed(1)} unit="h" note={`${Math.round((chart.hoursBySport[s] / chart.totalHours) * 100)}% of time`} />
        ))}
      </StatRow>
      <ChartHover points={points} label={chart.weekly ? "weeks" : "days"} band={x.bandwidth() / WIDTH}>
        <Plot width={WIDTH} height={HEIGHT} label={`Training volume: ${chart.totalHours.toFixed(1)} hours in the range, ${chart.sports.map((s) => `${chart.hoursBySport[s].toFixed(1)} ${SPORT_STYLE[s].verb}`).join(", ")}`}>
          {y.ticks(3).map((t) => (
            <g key={t}>
              <line x1={Y_LABEL_W} x2={WIDTH} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={0} y={y(t) + 3} className="fill-muted-2 font-mono text-[9px]">
                {t}h
              </text>
            </g>
          ))}
          {chart.bars.map((b) => {
            let top = HEIGHT;
            return (
              <g key={b.label}>
                {chart.sports.map((s) => {
                  const h = HEIGHT - y(b.hours[s]);
                  if (h <= 0.2) return null;
                  top -= h;
                  return <rect key={s} x={x(b.label)} y={top} width={x.bandwidth()} height={Math.max(h - 1, 0.5)} className={SPORT_STYLE[s].fill} />;
                })}
              </g>
            );
          })}
          <LinePath
            data={chart.bars.filter((b) => b.load > 0)}
            x={(b) => center(b.label)}
            y={(b) => yLoad(b.load)}
            className="fill-none stroke-ink"
            strokeWidth={1.5}
            strokeOpacity={0.75}
            vectorEffect="non-scaling-stroke"
          />
        </Plot>
      </ChartHover>
      <AxisRow start={fmtDate(chart.bars[0].label)} end={fmtDate(chart.bars.at(-1)!.label)} />
    </ChartCard>
  );
}
