import { scaleBand, scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { SLEEP_STAGES, buildSleepChart, fmtBedtime, fmtHours, type SleepStage } from "@/lib/charts/sleep";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Marker, Plot, Stat, StatRow, Swatch } from "./parts";

const WIDTH = 520;
const BARS_HEIGHT = 150;
const PANEL_HEIGHT = 64;
const Y_LABEL_W = 22;

const STAGE_FILL: Record<SleepStage, string> = {
  deep: "fill-sleep-deep",
  rem: "fill-sleep-rem",
  light: "fill-sleep-light",
  awake: "fill-sleep-awake",
};
const STAGE_LABEL: Record<SleepStage, string> = { deep: "Deep", rem: "REM", light: "Light", awake: "Awake" };

/**
 * Nightly stage bars (deep at the bottom) against Garmin's sleep need, then the sleep score
 * and bedtime (later is lower) panels. Weekly means past 35 days.
 */
export function SleepChart({ data }: { data: DashboardData }) {
  const chart = buildSleepChart(data);
  if (!chart) {
    return (
      <ChartCard title="Sleep" subtitle="Stages per night, against Garmin's sleep need">
        <ChartEmpty>{data.sleep.length ? "no data in range" : "no sleep data yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const plotW = WIDTH - Y_LABEL_W;
  const x = scaleBand<string>({ domain: chart.bars.map((b) => b.label), range: [0, plotW], padding: 0.2 });
  const maxH = Math.max(9, ...chart.bars.map((b) => b.asleep + b.hours.awake), chart.needHours ?? 0);
  const y = scaleLinear<number>({ domain: [0, maxH], range: [BARS_HEIGHT, 0] });
  const center = (label: string) => Y_LABEL_W + (x(label) ?? 0) + x.bandwidth() / 2;
  const unit = chart.weekly ? "weekly mean" : "per night";
  const first = chart.bars[0].label;
  const last = chart.bars.at(-1)!.label;

  // Score panel: 0..100. Bedtime panel: minutes from midnight, later drawn lower.
  const yScore = scaleLinear<number>({ domain: [0, 100], range: [PANEL_HEIGHT - 4, 4] });
  const bed = chart.bedtimes.map((p) => p.value);
  const bedDomain: [number, number] = bed.length ? [Math.min(-60, ...bed) - 15, Math.max(60, ...bed) + 15] : [-60, 60];
  const yBed = scaleLinear<number>({ domain: bedDomain, range: [4, PANEL_HEIGHT - 4] });

  const summary =
    `Sleep ${unit}: last night ${fmtHours(chart.lastNight!.hours)} hours, average ${fmtHours(chart.avgHours)} hours` +
    (chart.needHours !== null ? ` against a ${fmtHours(chart.needHours)} hour need` : "");

  return (
    <ChartCard
      title="Sleep"
      subtitle={`Stages ${unit}, against Garmin's sleep need`}
      note={chart.dataFrom > data.dateRange.from ? `sleep data starts ${fmtDate(chart.dataFrom)}` : undefined}
      legend={[
        ...SLEEP_STAGES.map((s) => ({ label: STAGE_LABEL[s], swatch: Swatch.square(`bg-sleep-${s}`) })),
        { label: "sleep need", swatch: Swatch.dashed("border-muted-1") },
      ]}
    >
      <StatRow>
        <Stat
          label={`Last night · ${fmtDate(chart.lastNight!.date)}`}
          value={fmtHours(chart.lastNight!.hours)}
          unit={`h${chart.lastNight!.score !== null ? ` · ${chart.lastNight!.score}` : ""}`}
        />
        <Stat
          label="Average"
          value={fmtHours(chart.avgHours)}
          unit="h"
          note={chart.needHours !== null ? `need ${fmtHours(chart.needHours)} h` : undefined}
        />
      </StatRow>

      <Plot width={WIDTH} height={BARS_HEIGHT} label={summary}>
        {[0, 4, 8].map((h) => (
          <g key={h}>
            <line x1={Y_LABEL_W} x2={WIDTH} y1={y(h)} y2={y(h)} className="stroke-divider" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={0} y={y(h) + 3} className="fill-muted-2 font-mono text-[9px]">
              {h}h
            </text>
          </g>
        ))}
        {chart.bars.map((b) => {
          let top = BARS_HEIGHT;
          const gap = 1.5;
          return (
            <g key={b.label}>
              {SLEEP_STAGES.map((stage) => {
                const h = BARS_HEIGHT - y(b.hours[stage]);
                if (h <= 0) return null;
                top -= h;
                return (
                  <rect
                    key={stage}
                    x={Y_LABEL_W + (x(b.label) ?? 0)}
                    y={top}
                    width={x.bandwidth()}
                    height={Math.max(h - gap, 0.5)}
                    className={STAGE_FILL[stage]}
                  />
                );
              })}
            </g>
          );
        })}
        {chart.needHours !== null && (
          <line
            x1={Y_LABEL_W}
            x2={WIDTH}
            y1={y(chart.needHours)}
            y2={y(chart.needHours)}
            className="stroke-muted-1"
            strokeWidth={1.2}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </Plot>
      <AxisRow start={fmtDate(first)} middle={`${chart.nights} night${chart.nights === 1 ? "" : "s"}`} end={fmtDate(last)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">
            Sleep score{chart.scores.length ? ` · ${Math.round(chart.scores.at(-1)!.value)}` : ""}
          </span>
          <Plot
            width={WIDTH}
            height={PANEL_HEIGHT}
            label={`Sleep score, latest ${chart.scores.length ? Math.round(chart.scores.at(-1)!.value) : "none"} of 100`}
          >
            <line x1={0} x2={WIDTH} y1={yScore(50)} y2={yScore(50)} className="stroke-divider" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <LinePath
              data={chart.scores}
              x={(p) => center(p.label)}
              y={(p) => yScore(p.value)}
              className="fill-none stroke-domain-rec"
              strokeWidth={1.8}
              vectorEffect="non-scaling-stroke"
            />
          </Plot>
          <AxisRow start={fmtDate(first)} middle="line at 50" end={fmtDate(last)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">
            Bedtime{bed.length ? ` · ${fmtBedtime(bed.at(-1)!)}` : ""} · later is lower
          </span>
          <Plot
            width={WIDTH}
            height={PANEL_HEIGHT}
            label={`Bedtime, latest ${bed.length ? fmtBedtime(bed.at(-1)!) : "none"}`}
            markers={chart.bedtimes.map((p) => (
              <Marker key={p.label} x={center(p.label)} y={yBed(p.value)} width={WIDTH} height={PANEL_HEIGHT} shape="dot" className="bg-domain-rec" size={5} />
            ))}
          >
            <line x1={0} x2={WIDTH} y1={yBed(0)} y2={yBed(0)} className="stroke-muted-3" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </Plot>
          <AxisRow start={fmtDate(first)} middle="dashed line = midnight" end={fmtDate(last)} />
        </div>
      </div>
    </ChartCard>
  );
}
