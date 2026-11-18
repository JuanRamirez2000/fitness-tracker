import { scaleBand, scaleLinear } from "@visx/scale";
import { ChartHover, type HoverPoint } from "@/components/charts/chart-hover";
import { ChartCard, ChartEmpty } from "@/components/charts/chart-card";
import { AxisRow, Plot, Stat, StatRow, Swatch } from "@/components/charts/parts";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import type { HoursBySport } from "@/lib/progress/build";
import { SPORT_STYLE } from "@/lib/sport";

const HELP =
  "Hours trained each Monday-to-Sunday week, stacked by sport, for the 12 weeks up to the one you picked (highlighted). The shaded band is the 4 to 7 hours a week the sprint triathlon plan is built on (the top is the weekly limit in the workout planner's settings). Weeks inside the band, week after week, are what gets you to April ready; a week well over it is one to recover from.";

const WIDTH = 520;
const HEIGHT = 140;
const Y_LABEL_W = 30;

/** Hours per week by sport over 12 weeks, the chosen week highlighted, against the 4–7 h band. */
export function HoursChart({ hours }: { hours: HoursBySport | null }) {
  const title = "Hours by sport";
  const subtitle = "12 weeks, against the 4–7 hours a week the plan is built on";
  if (!hours) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>no workouts yet</ChartEmpty>
      </ChartCard>
    );
  }
  const { weeks, sports, band, selected } = hours;
  const x = scaleBand<string>({ domain: weeks.map((w) => w.monday), range: [Y_LABEL_W, WIDTH], padding: 0.25 });
  const y = scaleLinear<number>({ domain: [0, Math.max(band.max + 1, ...weeks.map((w) => w.total))], range: [HEIGHT, 6] }).nice();
  const center = (m: string) => (x(m) ?? 0) + x.bandwidth() / 2;
  const points: HoverPoint[] = weeks.map((w) => ({
    at: center(w.monday) / WIDTH,
    title: `${fmtPointTitle(w.monday, true)}${w.partial ? " (so far)" : ""}`,
    rows: [
      ...[...sports].reverse().flatMap((s) =>
        w.hours[s] > 0 ? [{ label: SPORT_STYLE[s].label, value: `${w.hours[s].toFixed(1)} h`, swatch: { shape: "square" as const, className: SPORT_STYLE[s].bg } }] : [],
      ),
      { label: "Total", value: `${w.total.toFixed(1)} h` },
    ],
  }));

  return (
    <ChartCard
      help={HELP}
      title={title}
      subtitle={subtitle}
      legend={[
        ...sports.map((s) => ({ label: SPORT_STYLE[s].label.toLowerCase(), swatch: Swatch.square(SPORT_STYLE[s].bg) })),
        { label: `${band.min}–${band.max} h band`, swatch: Swatch.band("bg-accent/20") },
      ]}
    >
      <StatRow>
        <Stat
          label={selected.partial ? "This week so far" : `Week of ${fmtDate(selected.monday)}`}
          value={selected.total.toFixed(1)}
          unit="h"
          note={sports.filter((s) => selected.hours[s] > 0).map((s) => `${selected.hours[s].toFixed(1)} ${SPORT_STYLE[s].label.toLowerCase()}`).join(" · ") || undefined}
        />
        {hours.avg !== null && <Stat label={`${hours.complete}-week avg`} value={hours.avg.toFixed(1)} unit="h" />}
        {hours.complete > 0 && <Stat label="In the band" value={hours.inBand} unit={`of ${hours.complete} weeks`} />}
      </StatRow>
      <ChartHover points={points} label="weeks" band={x.bandwidth() / WIDTH}>
        <Plot width={WIDTH} height={HEIGHT} label={`Hours by sport, ${weeks.length} weeks: ${selected.total.toFixed(1)} hours the chosen week, band ${band.min} to ${band.max}`}>
          <rect x={Y_LABEL_W} width={WIDTH - Y_LABEL_W} y={y(band.max)} height={y(band.min) - y(band.max)} className="fill-accent/12" />
          {y.ticks(3).map((t) => (
            <g key={t}>
              <line x1={Y_LABEL_W} x2={WIDTH} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={0} y={y(t) + 3} className="fill-muted-2 font-mono text-[9px]">
                {t}h
              </text>
            </g>
          ))}
          {weeks.map((w) => {
            let top = HEIGHT;
            return (
              <g key={w.monday} opacity={w.selected ? 1 : 0.5}>
                {sports.map((s) => {
                  const h = HEIGHT - y(w.hours[s]);
                  if (h <= 0.2) return null;
                  top -= h;
                  return <rect key={s} x={x(w.monday)} y={top} width={x.bandwidth()} height={Math.max(h - 1, 0.5)} className={SPORT_STYLE[s].fill} />;
                })}
              </g>
            );
          })}
        </Plot>
      </ChartHover>
      <AxisRow start={fmtDate(weeks[0].monday)} end={fmtDate(weeks.at(-1)!.monday)} />
    </ChartCard>
  );
}
