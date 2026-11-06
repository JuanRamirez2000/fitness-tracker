import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { fmtBedtime, fmtHours } from "@/lib/charts/sleep";
import { buildSleepTiming } from "@/lib/charts/sleep-timing";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { AxisRow, Plot, Stat, StatRow, Swatch } from "./parts";

const WIDTH = 520;
const HEIGHT = 150;
const DEBT_HEIGHT = 64;
const Y_LABEL_W = 34;
const DAY_MS = 86_400_000;

/**
 * Each night from bedtime to wake time (evening at the top), against the range's typical times:
 * how regular the nights are. Under it, the running 7-night sleep debt against Garmin's need.
 * Weekly means past 35 days, like the sleep chart.
 */
export function SleepTimingChart({ data }: { data: DashboardData }) {
  const t = buildSleepTiming(data);
  const title = "Sleep timing";
  const subtitle = "When you slept each night, and the debt it built up";
  if (!t) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <ChartEmpty>{data.sleep.length ? "no data in range" : "no sleep data yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const from = t.dataFrom > data.dateRange.from ? t.dataFrom : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + DAY_MS);
  const x = scaleLinear<number>({ domain: [fromMs - DAY_MS / 2, toMs + DAY_MS / 2], range: [Y_LABEL_W, WIDTH] });
  const center = (label: string) => x(dayStartUtcMs(label) + (t.weekly ? 3 * DAY_MS : 0));
  const barW = Math.max(1.5, ((WIDTH - Y_LABEL_W) / ((toMs - fromMs) / DAY_MS + 1)) * (t.weekly ? 7 : 1) * 0.62);

  const lo = Math.min(...t.bars.map((b) => b.bed)) - 30;
  const hi = Math.max(...t.bars.map((b) => b.wake)) + 30;
  const y = scaleLinear<number>({ domain: [lo, hi], range: [4, HEIGHT - 4] });
  const ticks: number[] = [];
  for (let m = Math.ceil(lo / 120) * 120; m <= hi; m += 120) ticks.push(m);

  const debtValues = t.debt.map((d) => d.hours).concat(0);
  const yDebt = scaleLinear<number>({ domain: [Math.min(...debtValues) - 0.5, Math.max(...debtValues) + 0.5], range: [DEBT_HEIGHT - 3, 3] });
  const debtBy = new Map(t.debt.map((d) => [d.date, d.hours]));
  const latestDebt = t.debt.at(-1)!;

  const barPoints: HoverPoint[] = t.bars.map((b) => ({
    at: center(b.label) / WIDTH,
    title: fmtPointTitle(b.label, t.weekly),
    rows: [
      { label: t.weekly ? "Bedtime (mean)" : "Bedtime", value: fmtBedtime(b.bed), swatch: { shape: "band", className: "bg-sleep-light" } },
      { label: t.weekly ? "Woke (mean)" : "Woke", value: fmtBedtime(b.wake) },
      { label: "Asleep", value: `${fmtHours(b.hours)} h` },
      ...(b.needHours !== null ? [{ label: "Need", value: `${fmtHours(b.needHours)} h`, muted: true }] : []),
      ...(!t.weekly && debtBy.has(b.label) ? [{ label: "7-night debt", value: `${fmtHours(Math.abs(debtBy.get(b.label)!))} h ${debtBy.get(b.label)! >= 0 ? "short" : "ahead"}`, muted: true }] : []),
    ],
  }));
  const debtPoints: HoverPoint[] = t.debt.map((d) => ({
    at: x(dayStartUtcMs(d.date)) / WIDTH,
    title: `7 nights to ${fmtDate(d.date)}`,
    rows: [{ label: d.hours >= 0 ? "Short of need" : "Ahead of need", value: `${fmtHours(Math.abs(d.hours))} h`, swatch: { shape: "line", className: "bg-bad" } }],
    marks: [{ y: yDebt(d.hours) / DEBT_HEIGHT, className: "bg-bad" }],
  }));

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      note={from !== data.dateRange.from ? `sleep data starts ${fmtDate(from)}` : undefined}
      legend={[
        { label: t.weekly ? "asleep, weekly mean" : "asleep", swatch: Swatch.band("bg-sleep-light") },
        { label: "typical bedtime and wake", swatch: Swatch.dashed("border-muted-1") },
        { label: "7-night debt", swatch: Swatch.line("bg-bad") },
      ]}
    >
      <StatRow>
        <Stat label="Typical bedtime" value={fmtBedtime(t.medianBed)} note={`varies ±${Math.round(t.bedSpread)} min`} />
        <Stat label="Typical wake" value={fmtBedtime(t.medianWake)} />
        <Stat
          label="7-night debt"
          value={fmtHours(Math.max(0, latestDebt.hours))}
          unit="h"
          note={latestDebt.hours <= 0 ? "caught up" : `to ${fmtDate(latestDebt.date)}`}
        />
      </StatRow>
      <ChartHover points={barPoints} label={t.weekly ? "weeks" : "nights"} band={barW / WIDTH}>
        <Plot width={WIDTH} height={HEIGHT} label={`Sleep timing: typically ${fmtBedtime(t.medianBed)} to ${fmtBedtime(t.medianWake)}, bedtime varying by about ${Math.round(t.bedSpread)} minutes`}>
          {ticks.map((m) => (
            <g key={m}>
              <line x1={Y_LABEL_W} x2={WIDTH} y1={y(m)} y2={y(m)} className="stroke-divider" vectorEffect="non-scaling-stroke" />
              <text x={0} y={y(m) + 3} className="fill-muted-2 font-mono text-[9px]">
                {fmtBedtime(m)}
              </text>
            </g>
          ))}
          {t.bars.map((b) => (
            <rect key={b.label} x={center(b.label) - barW / 2} y={y(b.bed)} width={barW} height={Math.max(y(b.wake) - y(b.bed), 1)} rx={1.5} className="fill-sleep-light" />
          ))}
          {[t.medianBed, t.medianWake].map((m, i) => (
            <line key={i} x1={Y_LABEL_W} x2={WIDTH} y1={y(m)} y2={y(m)} className="stroke-muted-1" strokeWidth={1.2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          ))}
        </Plot>
      </ChartHover>
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">7-night sleep debt · hours short of need</span>
        <ChartHover points={debtPoints} label="nights">
          <Plot width={WIDTH} height={DEBT_HEIGHT} label={`Seven-night sleep debt, latest ${fmtHours(latestDebt.hours)} hours`}>
            <line x1={Y_LABEL_W} x2={WIDTH} y1={yDebt(0)} y2={yDebt(0)} className="stroke-muted-3" vectorEffect="non-scaling-stroke" />
            <text x={0} y={yDebt(0) + 3} className="fill-muted-2 font-mono text-[9px]">
              0 h
            </text>
            <LinePath data={t.debt} x={(d) => x(dayStartUtcMs(d.date))} y={(d) => yDebt(d.hours)} className="fill-none stroke-bad" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          </Plot>
        </ChartHover>
      </div>
      <AxisRow start={fmtDate(from)} end={fmtDate(data.dateRange.to)} />
    </ChartCard>
  );
}
