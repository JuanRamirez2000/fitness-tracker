import { scaleBand, scaleLinear } from "@visx/scale";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildWeeklyLoss, type WeekLoss } from "@/lib/charts/weight-plan";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { AxisRow, Plot, Stat, StatRow, Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP = "How much the 7-day average dropped each week (up is lost, down is gained), against your planned pounds per week (dashed). Weeks at or above the line kept to plan. The outlined bar is the week still under way.";

const WIDTH = 520;
const HEIGHT = 150;
const Y_LABEL_W = 30;

const signedLb = (v: number) => `${v > 0 ? "−" : v < 0 ? "+" : "±"}${Math.abs(v).toFixed(1)} lb`;

/**
 * Each week's drop in the 7-day average as a bar (a week that gained hangs below the line),
 * against the plan's lb a week. Bars on or over the plan are the good color; short of it, the
 * accent; gains, the bad color: and the zero and plan lines say the same without the color.
 */
export function WeeklyLossChart({ data }: { data: DashboardData }) {
  const w = buildWeeklyLoss(data);
  const title = "Weekly loss vs plan";
  const subtitle = "Change in the 7-day average each week; up is lost";
  if (!w) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>not enough weigh-ins yet</ChartEmpty>
      </ChartCard>
    );
  }

  const x = scaleBand<string>({ domain: w.weeks.map((wk) => wk.label), range: [Y_LABEL_W, WIDTH], padding: 0.28 });
  const values = w.weeks.map((wk) => wk.lost).concat(w.pace ?? 0, 0);
  const y = scaleLinear<number>({ domain: [Math.min(...values) - 0.3, Math.max(...values) + 0.3], range: [HEIGHT - 2, 4] }).nice();
  const fill = (wk: WeekLoss) => (wk.lost < 0 ? "fill-bad" : w.pace !== null && wk.lost >= w.pace ? "fill-good" : "fill-accent/70");
  const bg = (wk: WeekLoss) => (wk.lost < 0 ? "bg-bad" : w.pace !== null && wk.lost >= w.pace ? "bg-good" : "bg-accent/70");
  const current = w.weeks.find((wk) => wk.partial);

  const points: HoverPoint[] = w.weeks.map((wk) => ({
    at: ((x(wk.label) ?? 0) + x.bandwidth() / 2) / WIDTH,
    title: `${wk.partial ? "This week so far" : `Week of ${fmtDate(wk.label)}`}`,
    rows: [
      { label: wk.lost >= 0 ? "Lost" : "Gained", value: `${Math.abs(wk.lost).toFixed(1)} lb`, swatch: { shape: "square", className: bg(wk) } },
      ...(w.pace !== null
        ? [
            { label: "Plan", value: `${w.pace.toFixed(1)} lb`, swatch: { shape: "dashed" as const, className: "border-muted-1" }, muted: true },
            ...(!wk.partial ? [{ label: wk.lost >= w.pace ? "On plan" : "Short by", value: wk.lost >= w.pace ? "yes" : `${(w.pace - wk.lost).toFixed(1)} lb` }] : []),
          ]
        : []),
      { label: "Measured to", value: fmtDate(wk.end), muted: true },
    ],
  }));

  const ticks = y.ticks(3);
  return (
    <ChartCard help={HELP}
      title={title}
      subtitle={subtitle}
      legend={[
        ...(w.pace !== null ? [{ label: "on plan", swatch: Swatch.square("bg-good") }, { label: "short of plan", swatch: Swatch.square("bg-accent/70") }] : [{ label: "lost", swatch: Swatch.square("bg-accent/70") }]),
        { label: "gained", swatch: Swatch.square("bg-bad") },
        ...(w.pace !== null ? [{ label: `plan ${w.pace} lb/wk`, swatch: Swatch.dashed("border-muted-1") }] : []),
        ...(current ? [{ label: "week so far", swatch: <span className="inline-block h-2 w-2 rounded-[1px] border border-dashed border-muted-1" /> }] : []),
      ]}
    >
      <StatRow>
        <Stat label="Average" value={w.avgLost !== null ? signedLb(w.avgLost).replace(" lb", "") : "–"} unit="lb/wk" note={`over ${w.complete} full week${w.complete === 1 ? "" : "s"}`} />
        {w.pace !== null && <Stat label="On plan" value={w.onPlan} unit={`of ${w.complete} weeks`} />}
        {current && <Stat label="This week so far" value={signedLb(current.lost).replace(" lb", "")} unit="lb" />}
      </StatRow>
      <ChartHover points={points} label="weeks" band={x.bandwidth() / WIDTH}>
        <Plot width={WIDTH} height={HEIGHT} label={`Weekly change in the 7-day average: ${w.onPlan} of ${w.complete} full weeks on plan`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={Y_LABEL_W} x2={WIDTH} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-muted-3" : "stroke-divider"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={0} y={y(t) + 3} className="fill-muted-2 font-mono text-[9px]">
                {t > 0 ? `−${t}` : t < 0 ? `+${-t}` : "0"}
              </text>
            </g>
          ))}
          {w.weeks.map((wk) => {
            const y0 = y(0);
            const y1 = y(wk.lost);
            return (
              <rect
                key={wk.label}
                x={x(wk.label)}
                y={Math.min(y0, y1)}
                width={x.bandwidth()}
                height={Math.max(Math.abs(y1 - y0), 1)}
                rx={1.5}
                className={wk.partial ? `${fill(wk)} stroke-muted-1` : fill(wk)}
                fillOpacity={wk.partial ? 0.35 : 1}
                strokeDasharray={wk.partial ? "3 2" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {w.pace !== null && (
            <line x1={Y_LABEL_W} x2={WIDTH} y1={y(w.pace)} y2={y(w.pace)} className="stroke-muted-1" strokeWidth={1.2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          )}
        </Plot>
      </ChartHover>
      <AxisRow start={fmtDate(w.weeks[0].label)} middle="lb per week, down is lost" end={fmtDate(w.weeks.at(-1)!.label)} />
    </ChartCard>
  );
}
