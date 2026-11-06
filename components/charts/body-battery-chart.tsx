import { scaleBand, scaleLinear } from "@visx/scale";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildBodyBattery } from "@/lib/charts/body-battery";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Marker, Plot, Stat, StatRow, Swatch } from "./parts";

// Drawn for a half-width card (it shares a row with the heart chart).
const WIDTH = 520;
const HEIGHT = 130;
const Y_LABEL_W = 26;

/** Each day's Body Battery range (high to low) with a square at the value at wake. Weekly means past 35 days. */
export function BodyBatteryChart({ data }: { data: DashboardData }) {
  const chart = buildBodyBattery(data);
  if (!chart) {
    return (
      <ChartCard title="Body Battery" subtitle="Daily high to low, and the charge you woke up with">
        <ChartEmpty>{data.recovery.length ? "no data in range" : "no Body Battery data yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const plotW = WIDTH - Y_LABEL_W;
  const x = scaleBand<string>({ domain: chart.bars.map((b) => b.label), range: [0, plotW], padding: 0.35 });
  const y = scaleLinear<number>({ domain: [0, 100], range: [HEIGHT - 2, 2] });
  const center = (label: string) => Y_LABEL_W + (x(label) ?? 0) + x.bandwidth() / 2;
  const unit = chart.weekly ? "weekly mean" : "daily";
  const points: HoverPoint[] = chart.bars.map((b) => ({
    at: center(b.label) / WIDTH,
    title: fmtPointTitle(b.label, chart.weekly),
    rows: [
      ...(b.wake !== null ? [{ label: "At wake", value: String(Math.round(b.wake)), swatch: { shape: "square" as const, className: "bg-ink" } }] : []),
      { label: "High", value: String(Math.round(b.high)), swatch: { shape: "band", className: "bg-domain-rec/45" } },
      { label: "Low", value: String(Math.round(b.low)) },
    ],
    marks: b.wake !== null ? [{ y: y(b.wake) / HEIGHT, className: "bg-ink" }] : undefined,
  }));

  return (
    <ChartCard
      title="Body Battery"
      subtitle={`High to low, ${unit}, and the charge you woke up with`}
      note={chart.dataFrom > data.dateRange.from ? `watch data starts ${fmtDate(chart.dataFrom)}` : undefined}
      legend={[
        { label: "high to low", swatch: Swatch.band("bg-domain-rec/45") },
        { label: "at wake", swatch: Swatch.square("bg-ink") },
      ]}
    >
      <StatRow>
        <Stat label="At wake · latest" value={chart.latestWake ?? "–"} />
        <Stat label="At wake · average" value={chart.avgWake !== null ? Math.round(chart.avgWake) : "–"} />
      </StatRow>
      <ChartHover points={points} label={chart.weekly ? "weeks" : "days"} band={x.bandwidth() / WIDTH}>
        <Plot
          width={WIDTH}
          height={HEIGHT}
          label={`Body Battery ${unit}, latest at wake ${chart.latestWake ?? "none"}, average at wake ${chart.avgWake !== null ? Math.round(chart.avgWake) : "none"}`}
          markers={chart.bars.flatMap((b) =>
            b.wake === null
              ? []
              : [<Marker key={b.label} x={center(b.label)} y={y(b.wake)} width={WIDTH} height={HEIGHT} shape="square" className="bg-ink" size={6} />],
          )}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={Y_LABEL_W} x2={WIDTH} y1={y(v)} y2={y(v)} className="stroke-divider" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={0} y={y(v) + 3} className="fill-muted-2 font-mono text-[9px]">
                {v}
              </text>
            </g>
          ))}
          {chart.bars.map((b) => (
            <rect
              key={b.label}
              x={Y_LABEL_W + (x(b.label) ?? 0)}
              y={y(b.high)}
              width={x.bandwidth()}
              height={Math.max(y(b.low) - y(b.high), 1)}
              rx={2}
              className="fill-domain-rec/45"
            />
          ))}
        </Plot>
      </ChartHover>
      <AxisRow start={fmtDate(chart.bars[0].label)} end={fmtDate(chart.bars.at(-1)!.label)} />
    </ChartCard>
  );
}
