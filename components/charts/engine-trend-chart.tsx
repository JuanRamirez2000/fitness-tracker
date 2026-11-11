import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildEngineTrend, type EngineSeries } from "@/lib/charts/all-sports";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { SPORT_STYLE } from "@/lib/sport";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Plot, Stat, StatRow, Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP =
  "Your aerobic engine across sports. Each line is one sport's easy-session efficiency (the trend line from its own efficiency card: watts per heartbeat on the bike, pace at 130 bpm on foot) as a percent change from where it started in this range. Up is better in every sport: more output for the same heart rate. Lines rising together mean the fitness is carrying over between sports.";

const WIDTH = 520;
const HEIGHT = 140;
const Y_LABEL_W = 34;

const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

/** The latest value of a series on or before a day, or null before its first point. */
function valueAt(series: EngineSeries, dateMs: number): number | null {
  let value: number | null = null;
  for (const p of series.points) {
    if (p.dateMs > dateMs) break;
    value = p.pct;
  }
  return value;
}

/** Each sport's efficiency trend as percent change from its own start, on one axis. */
export function EngineTrendChart({ data }: { data: DashboardData }) {
  const series = buildEngineTrend(data);
  const title = "Engine trend";
  const subtitle = "Easy-session efficiency per sport, percent change since the range began";
  if (series.length === 0) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>needs two easy sessions with heart rate in a sport</ChartEmpty>
      </ChartCard>
    );
  }
  const fromMs = dayStartUtcMs(data.dateRange.from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [Y_LABEL_W + 2, WIDTH - 2] });
  const values = series.flatMap((s) => s.points.map((p) => p.pct));
  const reach = Math.max(2, ...values.map(Math.abs)) * 1.15;
  const y = scaleLinear<number>({ domain: [-reach, reach], range: [HEIGHT - 4, 4] }).nice();

  const days = [...new Set(series.flatMap((s) => s.points.map((p) => p.dateMs)))].sort((a, b) => a - b);
  const points: HoverPoint[] = days.map((ms) => {
    const date = series.flatMap((s) => s.points).find((p) => p.dateMs === ms)!.date;
    const rows = series.flatMap((s) => {
      const v = valueAt(s, ms);
      return v === null ? [] : [{ label: SPORT_STYLE[s.sport].label, value: `${signedPct(v)} ${s.measure}`, swatch: { shape: "line" as const, className: SPORT_STYLE[s.sport].bg } }];
    });
    const marks = series.flatMap((s) => {
      const v = valueAt(s, ms);
      return v === null ? [] : [{ y: y(v) / HEIGHT, className: SPORT_STYLE[s.sport].bg }];
    });
    return { at: x(ms) / WIDTH, title: fmtPointTitle(date), rows, marks };
  });

  return (
    <ChartCard
      help={HELP}
      title={title}
      subtitle={subtitle}
      legend={series.map((s) => ({ label: `${SPORT_STYLE[s.sport].label.toLowerCase()} (${s.measure})`, swatch: Swatch.line(SPORT_STYLE[s.sport].bg) }))}
    >
      <StatRow>
        {series.map((s) => (
          <Stat key={s.sport} label={SPORT_STYLE[s.sport].label} value={signedPct(s.latestPct)} note={s.latestPct >= 0 ? "more for the same effort" : "less for the same effort"} />
        ))}
      </StatRow>
      <ChartHover points={points} label="sessions">
        <Plot width={WIDTH} height={HEIGHT} label={`Engine trend: ${series.map((s) => `${SPORT_STYLE[s.sport].verb} ${signedPct(s.latestPct)}`).join(", ")}`}>
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line
                x1={Y_LABEL_W}
                x2={WIDTH}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? "stroke-muted-2" : "stroke-divider"}
                strokeWidth={1}
                strokeDasharray={t === 0 ? "3 3" : undefined}
                vectorEffect="non-scaling-stroke"
              />
              <text x={0} y={y(t) + 3} className="fill-muted-2 font-mono text-[9px]">
                {t > 0 ? "+" : ""}
                {t}%
              </text>
            </g>
          ))}
          {series.map((s) => (
            <LinePath
              key={s.sport}
              data={s.points}
              x={(p) => x(p.dateMs)}
              y={(p) => y(p.pct)}
              className={`fill-none ${SPORT_STYLE[s.sport].stroke}`}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </Plot>
      </ChartHover>
      <AxisRow start={fmtDate(data.dateRange.from)} end={fmtDate(data.dateRange.to)} />
    </ChartCard>
  );
}
