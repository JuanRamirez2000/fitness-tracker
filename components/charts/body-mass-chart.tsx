import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildBodyMass, type MassPoint } from "@/lib/charts/body-composition";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Plot, Stat, StatRow } from "./parts";

const WIDTH = 520;
const PANEL_HEIGHT = 70;

const signedLb = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}`;

function MassPanel({
  label,
  points,
  pick,
  delta,
  strokeClass,
  fillClass,
  x,
}: {
  label: string;
  points: MassPoint[];
  pick: (p: MassPoint) => number;
  delta: number | null;
  strokeClass: string;
  fillClass: string;
  x: (p: MassPoint) => number;
}) {
  const values = points.map(pick);
  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 0.5);
  const y = scaleLinear<number>({ domain: [Math.min(...values) - pad, Math.max(...values) + pad], range: [PANEL_HEIGHT - 4, 4] });
  const latest = values[values.length - 1];
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{label}</span>
        <span className="font-mono text-[20px] leading-tight text-ink">
          {latest.toFixed(1)}
          <span className="text-[11px] text-muted-2"> lb</span>
        </span>
        <span className="font-mono text-[10px] text-muted-2">{delta === null ? "one reading" : `${signedLb(delta)} lb in range`}</span>
      </div>
      <Plot
        width={WIDTH}
        height={PANEL_HEIGHT}
        label={`${label}: ${latest.toFixed(1)} pounds${delta === null ? "" : `, ${signedLb(delta)} pounds in range`}`}
      >
        <AreaClosed data={points} x={x} y={(p) => y(pick(p))} yScale={y} className={fillClass} />
        <LinePath data={points} x={x} y={(p) => y(pick(p))} className={`fill-none ${strokeClass}`} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
      </Plot>
    </div>
  );
}

/**
 * "Am I losing fat, not muscle?": fat mass and lean mass (everything that isn't fat) as two
 * small panels on one date axis, under the change in each since the first scale reading.
 */
export function BodyMassChart({ data }: { data: DashboardData }) {
  const chart = buildBodyMass(data);
  const title = "Fat mass and lean mass";
  const subtitle = "Lean mass is everything that isn't fat";
  if (!chart) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <ChartEmpty>{data.bodyComposition.length ? "no data in range" : "no scale data yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const from = chart.dataFrom > data.dateRange.from ? chart.dataFrom : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const xScale = scaleLinear<number>({ domain: [fromMs, toMs], range: [2, WIDTH - 2] });
  const x = (p: MassPoint) => xScale(dayStartUtcMs(p.date));
  const since = chart.since;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      note={from !== data.dateRange.from ? `scale data starts ${fmtDate(from)}` : undefined}
    >
      {since && (
        <StatRow>
          <Stat
            label={`Fat since ${fmtDate(since.date)}`}
            value={signedLb(since.fat)}
            unit="lb"
            note={since.fatShareOfLoss !== null ? `${Math.round(since.fatShareOfLoss * 100)}% of the ${Math.abs(since.weight).toFixed(1)} lb lost` : undefined}
          />
          <Stat label={`Lean since ${fmtDate(since.date)}`} value={signedLb(since.lean)} unit="lb" />
        </StatRow>
      )}
      <div className="flex flex-col gap-3">
        <MassPanel label="Fat mass" points={chart.points} pick={(p) => p.fat} delta={chart.fatDelta} strokeClass="stroke-domain-body" fillClass="fill-domain-body/12" x={x} />
        <MassPanel label="Lean mass" points={chart.points} pick={(p) => p.lean} delta={chart.leanDelta} strokeClass="stroke-accent" fillClass="fill-accent/10" x={x} />
      </div>
      <div className="pl-[112px]">
        <AxisRow start={fmtDate(from)} end={fmtDate(data.dateRange.to)} />
      </div>
    </ChartCard>
  );
}
