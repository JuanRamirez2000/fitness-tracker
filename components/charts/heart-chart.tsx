import { scaleLinear } from "@visx/scale";
import { Area, LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildHeartChart, type HrvPoint } from "@/lib/charts/heart";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { ChartHover, type HoverPoint, type HoverRow } from "./chart-hover";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Marker, Plot, Stat, StatRow, Swatch } from "./parts";

const WIDTH = 520;
const PANEL_HEIGHT = 90;

const signed = (v: number, unit: string) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(Math.round(v))} ${unit} in range`;

/** The y domain of a series, padded so the line never touches the panel edges. */
function padded(values: number[], pad: number): [number, number] {
  return [Math.min(...values) - pad, Math.max(...values) + pad];
}

/**
 * Two panels on one date axis: resting HR, then overnight HRV over Garmin's own balanced
 * range for each day. HRV outside the range is a square in the bad color, inside a dot.
 */
export function HeartChart({ data }: { data: DashboardData }) {
  const chart = buildHeartChart(data);
  const title = "Resting HR and HRV";
  if (!chart) {
    return (
      <ChartCard title={title} subtitle="Lower resting HR and HRV inside its normal range are good signs">
        <ChartEmpty>{data.recovery.length ? "no data in range" : "no heart data yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const from = chart.dataFrom > data.dateRange.from ? chart.dataFrom : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [4, WIDTH - 4] });
  const xOf = (p: { date: string }) => x(dayStartUtcMs(p.date));

  const yRhr = chart.restingHr.length
    ? scaleLinear<number>({ domain: padded(chart.restingHr.map((p) => p.value), 2), range: [PANEL_HEIGHT - 6, 6] })
    : null;
  const hrvValues = chart.hrv.flatMap((p) => [p.value, p.low ?? p.value, p.high ?? p.value]);
  const yHrv = chart.hrv.length ? scaleLinear<number>({ domain: padded(hrvValues, 3), range: [PANEL_HEIGHT - 6, 6] }) : null;
  const banded = chart.hrv.filter((p): p is HrvPoint & { low: number; high: number } => p.low !== null && p.high !== null);
  const latestBand = chart.hrvLatest && chart.hrvLatest.low !== null ? `${chart.hrvLatest.low}–${chart.hrvLatest.high} ms normal` : undefined;

  // Hover: either panel shows the day's resting HR, HRV and normal range together.
  const rhrBy = new Map(chart.restingHr.map((p) => [p.date, p]));
  const hrvBy = new Map(chart.hrv.map((p) => [p.date, p]));
  const days = [...new Set([...rhrBy.keys(), ...hrvBy.keys()])].sort();
  const rowsFor = (date: string): HoverRow[] => {
    const r = rhrBy.get(date);
    const h = hrvBy.get(date);
    return [
      ...(r ? [{ label: "Resting HR", value: `${r.value} bpm`, swatch: { shape: "line" as const, className: "bg-muted-1" } }] : []),
      ...(h
        ? [
            {
              label: "HRV",
              value: `${Math.round(h.value)} ms`,
              swatch: h.inBand ? { shape: "dot" as const, className: "bg-domain-rec" } : { shape: "square" as const, className: "bg-bad" },
            },
          ]
        : []),
      ...(h?.low != null && h.high != null
        ? [{ label: h.inBand ? "Normal range" : "Outside range", value: `${h.low}–${h.high} ms`, swatch: { shape: "band" as const, className: "bg-domain-rec/20" }, muted: true }]
        : []),
    ];
  };
  const pointsFor = (mark: (date: string) => number | null, className: string): HoverPoint[] =>
    days.map((date) => {
      const y = mark(date);
      return {
        at: x(dayStartUtcMs(date)) / WIDTH,
        title: fmtPointTitle(date),
        rows: rowsFor(date),
        marks: y === null ? undefined : [{ y: y / PANEL_HEIGHT, className }],
      };
    });
  const rhrPoints = yRhr ? pointsFor((d) => (rhrBy.has(d) ? yRhr(rhrBy.get(d)!.value) : null), "bg-muted-1") : [];
  const hrvPoints = yHrv ? pointsFor((d) => (hrvBy.has(d) ? yHrv(hrvBy.get(d)!.value) : null), "bg-domain-rec") : [];

  return (
    <ChartCard
      title={title}
      subtitle="Lower resting HR and HRV inside its normal range are good signs"
      note={from !== data.dateRange.from ? `watch data starts ${fmtDate(from)}` : undefined}
      legend={[
        { label: "resting HR", swatch: Swatch.line("bg-muted-1") },
        { label: "HRV", swatch: Swatch.line("bg-domain-rec") },
        { label: "normal range", swatch: Swatch.band("bg-domain-rec/20") },
        { label: "inside range", swatch: Swatch.dot("bg-domain-rec") },
        { label: "outside range", swatch: Swatch.square("bg-bad") },
      ]}
    >
      <StatRow>
        <Stat
          label="Resting HR"
          value={chart.rhrLatest ?? "–"}
          unit="bpm"
          note={chart.rhrDelta !== null ? signed(chart.rhrDelta, "bpm") : undefined}
        />
        <Stat label="HRV" value={chart.hrvLatest ? Math.round(chart.hrvLatest.value) : "–"} unit="ms" note={latestBand} />
        <Stat label="Outside range" value={chart.hrvOutOfBand} unit={`of ${chart.hrv.length} nights`} />
      </StatRow>

      {yRhr && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">Resting HR · bpm</span>
          <ChartHover points={rhrPoints} label="days">
            <Plot
              width={WIDTH}
              height={PANEL_HEIGHT}
              label={`Resting heart rate, latest ${chart.rhrLatest} bpm${chart.rhrDelta !== null ? `, ${signed(chart.rhrDelta, "bpm")}` : ""}`}
            >
              <LinePath
                data={chart.restingHr}
                x={xOf}
                y={(p) => yRhr(p.value)}
                className="fill-none stroke-muted-1"
                strokeWidth={1.8}
                vectorEffect="non-scaling-stroke"
              />
              {yRhr.ticks(3).map((t) => (
                <text key={t} x={WIDTH} y={yRhr(t) + 3} textAnchor="end" className="fill-muted-3 font-mono text-[9px]">
                  {t}
                </text>
              ))}
            </Plot>
          </ChartHover>
        </div>
      )}

      {yHrv && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">HRV · ms overnight</span>
          <ChartHover points={hrvPoints} label="days">
            <Plot
              width={WIDTH}
              height={PANEL_HEIGHT}
              label={`Overnight HRV, latest ${chart.hrvLatest ? Math.round(chart.hrvLatest.value) : "none"} ms, ${chart.hrvOutOfBand} of ${chart.hrv.length} nights outside the normal range`}
              markers={chart.hrv.map((p) => (
                <Marker
                  key={p.date}
                  x={xOf(p)}
                  y={yHrv(p.value)}
                  width={WIDTH}
                  height={PANEL_HEIGHT}
                  shape={p.inBand ? "dot" : "square"}
                  className={p.inBand ? "bg-domain-rec" : "bg-bad"}
                  size={p.inBand ? 5 : 7}
                />
              ))}
            >
              <Area
                data={banded}
                x={xOf}
                y0={(p) => yHrv(p.low)}
                y1={(p) => yHrv(p.high)}
                className="fill-domain-rec/15"
              />
              <LinePath
                data={chart.hrv}
                x={xOf}
                y={(p) => yHrv(p.value)}
                className="fill-none stroke-domain-rec"
                strokeWidth={1.5}
                strokeOpacity={0.8}
                vectorEffect="non-scaling-stroke"
              />
            </Plot>
          </ChartHover>
        </div>
      )}
      <AxisRow start={fmtDate(from)} end={fmtDate(data.dateRange.to)} />
    </ChartCard>
  );
}
