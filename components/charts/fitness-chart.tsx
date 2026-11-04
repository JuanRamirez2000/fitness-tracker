import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildFitness, type DatedValue, type FactorTag } from "@/lib/charts/fitness";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Marker, Plot, Swatch } from "./parts";

const WIDTH = 520;
const PANEL_HEIGHT = 64;

const TAG_CLASS: Record<FactorTag, string> = {
  "largest lever": "border-domain-body/50 text-domain-body",
  lever: "border-border-strong text-muted-1",
  "on target": "border-good/50 text-good",
  context: "border-border-strong text-muted-3",
};

function Panel({
  label,
  value,
  note,
  points,
  x,
  reference,
  strokeClass,
  summary,
}: {
  label: string;
  value: string;
  note: string;
  points: DatedValue[];
  x: (date: string) => number;
  /** A dashed horizontal reference (real age), included in the y domain. */
  reference?: number | null;
  strokeClass: string;
  summary: string;
}) {
  const values = points.map((p) => p.value).concat(reference ?? []);
  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 0.5);
  const y = scaleLinear<number>({ domain: [Math.min(...values) - pad, Math.max(...values) + pad], range: [PANEL_HEIGHT - 5, 5] });
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{label}</span>
        <span className="font-mono text-[20px] leading-tight text-ink">{value}</span>
        <span className="font-mono text-[10px] text-muted-2">{note}</span>
      </div>
      <Plot
        width={WIDTH}
        height={PANEL_HEIGHT}
        label={summary}
        markers={
          points.length === 1 ? (
            <Marker x={x(points[0].date)} y={y(points[0].value)} width={WIDTH} height={PANEL_HEIGHT} shape="dot" className="bg-domain-rec" />
          ) : undefined
        }
      >
        {reference != null && (
          <line x1={0} x2={WIDTH} y1={y(reference)} y2={y(reference)} className="stroke-muted-2" strokeWidth={1.2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        )}
        <LinePath
          data={points}
          x={(p) => x(p.date)}
          y={(p) => y(p.value)}
          className={`fill-none ${strokeClass}`}
          strokeWidth={1.8}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </Plot>
    </div>
  );
}

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}`;

/** VO2 max and fitness age as two panels on one date axis, then Garmin's ranked levers for fitness age. */
export function FitnessChart({ data }: { data: DashboardData }) {
  const fit = buildFitness(data);
  const title = "VO2 max and fitness age";
  const subtitle = "Garmin's running VO2 max, and the age your fitness matches";
  if (!fit) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <ChartEmpty>{data.training.length ? "no data in range" : "no fitness data yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const first = [fit.vo2[0]?.date, fit.fitnessAge[0]?.date].filter(Boolean).sort()[0] as string;
  const from = first > data.dateRange.from ? first : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const xScale = scaleLinear<number>({ domain: [fromMs, toMs], range: [3, WIDTH - 3] });
  const x = (date: string) => xScale(dayStartUtcMs(date));

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      note={from !== data.dateRange.from ? `data starts ${fmtDate(from)}` : undefined}
      legend={[
        { label: "VO2 max", swatch: Swatch.line("bg-domain-rec") },
        { label: "fitness age", swatch: Swatch.line("bg-accent") },
        { label: "real age", swatch: Swatch.dashed("border-muted-2") },
      ]}
    >
      <div className="flex flex-col gap-3">
        {fit.vo2.length > 0 && fit.vo2Latest !== null && (
          <Panel
            label="VO2 max"
            value={fit.vo2Latest.toFixed(1)}
            note={fit.vo2Delta === null ? "one update in range" : `${signed(fit.vo2Delta)} in range`}
            points={fit.vo2}
            x={x}
            strokeClass="stroke-domain-rec"
            summary={`VO2 max ${fit.vo2Latest.toFixed(1)}${fit.vo2Delta !== null ? `, ${signed(fit.vo2Delta)} in range` : ""}`}
          />
        )}
        {fit.fitnessAge.length > 0 && fit.fitnessAgeLatest !== null && (
          <Panel
            label="Fitness age"
            value={fit.fitnessAgeLatest.toFixed(1)}
            note={[fit.realAge !== null && `real age ${fit.realAge}`, fit.achievableAge !== null && `can reach ${fit.achievableAge}`].filter(Boolean).join(" · ")}
            points={fit.fitnessAge}
            x={x}
            reference={fit.realAge}
            strokeClass="stroke-accent"
            summary={`Fitness age ${fit.fitnessAgeLatest.toFixed(1)}${fit.realAge !== null ? ` against a real age of ${fit.realAge}` : ""}`}
          />
        )}
        <div className="pl-[112px]">
          <AxisRow start={fmtDate(from)} end={fmtDate(data.dateRange.to)} />
        </div>
      </div>

      {fit.factors.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-divider pt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">What would lower fitness age</span>
          <ol className="flex flex-col gap-1.5">
            {fit.factors.map((f) => (
              <li key={f.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12.5px]">
                <span>
                  {f.label}{" "}
                  <span className="font-mono text-[11px] text-muted-2">
                    {f.value}
                    {f.target && ` → ${f.target}`}
                    {f.potentialAge !== null && ` · age ${f.potentialAge.toFixed(1).replace(/\.0$/, "")}`}
                  </span>
                </span>
                <span className={`rounded-full border px-2 py-[1px] font-mono text-[10px] ${TAG_CLASS[f.tag]}`}>{f.tag}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </ChartCard>
  );
}
