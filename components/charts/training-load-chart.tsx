import { scaleLinear } from "@visx/scale";
import { Area, LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { ACWR_RANGE, buildSportLoad, buildTrainingLoad, type LoadPoint, type StatusTone } from "@/lib/charts/training";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { SPORT_NOUN, SPORT_STYLE } from "@/lib/sport";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Plot, Stat, StatRow, Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP = "Acute load is your last week of training strain; chronic load is the last four weeks, roughly your fitness. The shaded band is Garmin's optimal range for chronic load. Acute climbing well above chronic (a ratio over 1.5) raises injury risk; well below it means you're backing off. Garmin only counts every sport together, so a single sport's view is worked out here from each activity's own Garmin load: the 7-day sum against the 4-week weekly average, with no band or status.";

const WIDTH = 520;
const HEIGHT = 140;
const TONE_TEXT: Record<StatusTone, string> = { good: "text-good", neutral: "text-muted-1", bad: "text-bad" };

/** Garmin's acute load (solid) and chronic load (dashed) over the optimal chronic band; for one
 * sport, that sport's share worked out from its activities, in the sport's color. */
export function TrainingLoadChart({ data }: { data: DashboardData }) {
  const sport = data.sport === "all" ? null : data.sport;
  const chart = sport ? buildSportLoad(data, sport) : buildTrainingLoad(data);
  const title = "Training load";
  const subtitle = sport
    ? `Your ${SPORT_NOUN[sport].many}' share: 7-day sum against the 4-week weekly average`
    : "Acute (7-day) against chronic (4-week) load, every sport";
  const acuteStroke = sport ? SPORT_STYLE[sport].stroke : "stroke-accent";
  const acuteBg = sport ? SPORT_STYLE[sport].bg : "bg-accent";
  if (!chart) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>{sport ? `no ${SPORT_NOUN[sport].many} with a training load` : data.training.length ? "no data in range" : "no training load yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const { latest } = chart;
  const from = chart.dataFrom > data.dateRange.from ? chart.dataFrom : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [2, WIDTH - 2] });
  const xOf = (p: LoadPoint) => x(dayStartUtcMs(p.date));
  const values = chart.points.flatMap((p) => [p.acute, p.chronic, p.low ?? p.chronic, p.high ?? p.chronic]);
  const y = scaleLinear<number>({ domain: [0, Math.max(...values) * 1.1], range: [HEIGHT - 2, 4] });
  const banded = chart.points.filter((p): p is LoadPoint & { low: number; high: number } => p.low !== null && p.high !== null);
  const points: HoverPoint[] = chart.points.map((p) => ({
    at: xOf(p) / WIDTH,
    title: fmtPointTitle(p.date),
    rows: [
      { label: "Acute", value: String(Math.round(p.acute)), swatch: { shape: "line", className: acuteBg } },
      { label: "Chronic", value: String(Math.round(p.chronic)), swatch: { shape: "dashed", className: "border-muted-1" } },
      ...(p.chronic > 0 ? [{ label: "Ratio", value: (p.acute / p.chronic).toFixed(2) }] : []),
      ...(p.low !== null && p.high !== null
        ? [{ label: "Optimal band", value: `${Math.round(p.low)}–${Math.round(p.high)}`, swatch: { shape: "band" as const, className: "bg-good/20" }, muted: true }]
        : []),
    ],
    marks: [
      { y: y(p.acute) / HEIGHT, className: acuteBg },
      { y: y(p.chronic) / HEIGHT, className: "bg-muted-1" },
    ],
  }));
  const acwrNote = `healthy ${ACWR_RANGE[0]}–${ACWR_RANGE[1]}${latest.acwrState && latest.acwrState !== "optimal" ? ` · ${latest.acwrState}` : ""}`;

  return (
    <ChartCard help={HELP}
      title={title}
      subtitle={subtitle}
      note={from !== data.dateRange.from ? `load data starts ${fmtDate(from)}` : undefined}
      legend={[
        { label: "acute", swatch: Swatch.line(acuteBg) },
        { label: "chronic", swatch: Swatch.dashed("border-muted-1") },
        ...(banded.length ? [{ label: "optimal chronic band", swatch: Swatch.band("bg-good/20") }] : []),
      ]}
    >
      <StatRow>
        <Stat label="Acute" value={Math.round(latest.acute)} />
        <Stat
          label="Chronic"
          value={Math.round(latest.chronic)}
          note={latest.low !== null && latest.high !== null ? `band ${Math.round(latest.low)}–${Math.round(latest.high)}` : undefined}
        />
        {latest.acwr !== null && <Stat label="ACWR" value={latest.acwr.toFixed(1)} note={acwrNote} />}
        {latest.status && (
          <Stat
            label="Status"
            value={
              <span className="text-[17px]">
                <span className={TONE_TEXT[latest.status.tone]} aria-hidden>
                  {latest.status.glyph}
                </span>{" "}
                {latest.status.label}
              </span>
            }
          />
        )}
      </StatRow>
      <ChartHover points={points} label="days">
        <Plot
          width={WIDTH}
          height={HEIGHT}
          label={`Training load: acute ${Math.round(latest.acute)}, chronic ${Math.round(latest.chronic)}${latest.acwr !== null ? `, ratio ${latest.acwr.toFixed(1)}` : ""}${latest.status ? `, ${latest.status.label}` : ""}`}
        >
          <Area data={banded} x={xOf} y0={(p) => y(p.low)} y1={(p) => y(p.high)} className="fill-good/15" />
          <LinePath data={chart.points} x={xOf} y={(p) => y(p.chronic)} className="fill-none stroke-muted-1" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <LinePath data={chart.points} x={xOf} y={(p) => y(p.acute)} className={`fill-none ${acuteStroke}`} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </Plot>
      </ChartHover>
      <AxisRow start={fmtDate(from)} end={fmtDate(data.dateRange.to)} />
    </ChartCard>
  );
}
