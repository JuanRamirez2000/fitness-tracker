import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildFitness, type DatedValue, type FactorTag, type FitnessData } from "@/lib/charts/fitness";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { ChartHover, type HoverRow } from "./chart-hover";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Marker, Plot, Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP = "VO2 max is Garmin's estimate of your aerobic capacity; higher is fitter. Garmin keeps one from your runs and a separate one from outdoor rides with power, and this card follows the sport picked above (All shows both). Fitness age compares your fitness and habits with typical people your age; below your real age is good. The list shows what would lower it most.";

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
  rows,
  markClass,
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
  /** The tooltip for a day: both panels' values, so either panel reads the same. */
  rows: (date: string) => HoverRow[];
  markClass: string;
}) {
  const values = points.map((p) => p.value).concat(reference ?? []);
  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 0.5);
  const y = scaleLinear<number>({ domain: [Math.min(...values) - pad, Math.max(...values) + pad], range: [PANEL_HEIGHT - 5, 5] });
  const hoverPoints = points.map((p) => ({
    at: x(p.date) / WIDTH,
    title: fmtPointTitle(p.date),
    rows: rows(p.date),
    marks: [{ y: y(p.value) / PANEL_HEIGHT, className: markClass }],
  }));
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{label}</span>
        <span className="font-mono text-[20px] leading-tight text-ink">{value}</span>
        <span className="font-mono text-[10px] text-muted-2">{note}</span>
      </div>
      <ChartHover points={hoverPoints} label="updates">
        <Plot
          width={WIDTH}
          height={PANEL_HEIGHT}
          label={summary}
          markers={
            points.length === 1 ? (
              <Marker x={x(points[0].date)} y={y(points[0].value)} width={WIDTH} height={PANEL_HEIGHT} shape="dot" className={markClass} />
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
      </ChartHover>
    </div>
  );
}

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}`;

/** One VO2 max line: which of Garmin's two it is, and how it's drawn. */
interface Vo2Line {
  label: string;
  fit: FitnessData;
  stroke: string;
  mark: string;
}

/** VO2 max and fitness age as panels on one date axis, then Garmin's ranked levers for fitness
 * age. Under All, cycling and running VO2 max each get a panel, in their sport's color. */
export function FitnessChart({ data }: { data: DashboardData }) {
  const all = data.sport === "all";
  // Garmin keeps a VO2 max for running and one for cycling, none for swimming: a swim view shows
  // fitness age only (both builds carry it; the cycling one drops its VO2 line below).
  const cyclingFit = data.sport === "ride" || all || data.sport === "swim" ? buildFitness(data, { cycling: true }) : null;
  const runningFit = data.sport === "run" || all ? buildFitness(data) : null;
  const fit = cyclingFit ?? runningFit;
  const title = "VO2 max and fitness age";
  const subtitle = all
    ? "Garmin's cycling and running VO2 max, and the age your fitness matches"
    : data.sport === "swim"
      ? "Garmin keeps no swimming VO2 max; the age your fitness matches"
      : `Garmin's ${data.sport === "ride" ? "cycling" : "running"} VO2 max, and the age your fitness matches`;
  if (!fit) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>{data.training.length ? "no data in range" : "no fitness data yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const lines: Vo2Line[] = [
    ...(cyclingFit && data.sport !== "swim" && cyclingFit.vo2.length > 0 && cyclingFit.vo2Latest !== null
      ? [{ label: all ? "Cycling VO2" : "VO2 max", fit: cyclingFit, stroke: all ? "stroke-sport-ride" : "stroke-domain-rec", mark: all ? "bg-sport-ride" : "bg-domain-rec" }]
      : []),
    ...(runningFit && runningFit.vo2.length > 0 && runningFit.vo2Latest !== null
      ? [{ label: all ? "Running VO2" : "VO2 max", fit: runningFit, stroke: all ? "stroke-sport-run" : "stroke-domain-rec", mark: all ? "bg-sport-run" : "bg-domain-rec" }]
      : []),
  ];

  const first = [...lines.map((l) => l.fit.vo2[0]?.date), fit.fitnessAge[0]?.date].filter(Boolean).sort()[0] as string;
  const from = first > data.dateRange.from ? first : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const xScale = scaleLinear<number>({ domain: [fromMs, toMs], range: [3, WIDTH - 3] });
  const x = (date: string) => xScale(dayStartUtcMs(date));
  // Each panel's points are its own days; the tooltip shows the latest of each as of that day.
  const asOf = (series: { date: string; value: number }[], date: string) => [...series].reverse().find((p) => p.date <= date) ?? null;
  const rows = (date: string): HoverRow[] => {
    const a = asOf(fit.fitnessAge, date);
    return [
      ...lines.flatMap((l) => {
        const v = asOf(l.fit.vo2, date);
        return v ? [{ label: l.label, value: v.value.toFixed(1), swatch: { shape: "line" as const, className: l.mark } }] : [];
      }),
      ...(a ? [{ label: "Fitness age", value: a.value.toFixed(1), swatch: { shape: "line" as const, className: "bg-accent" } }] : []),
      ...(fit.realAge !== null ? [{ label: "Real age", value: String(fit.realAge), swatch: { shape: "dashed" as const, className: "border-muted-2" }, muted: true }] : []),
    ];
  };

  return (
    <ChartCard help={HELP}
      title={title}
      subtitle={subtitle}
      note={from !== data.dateRange.from ? `data starts ${fmtDate(from)}` : undefined}
      legend={[
        ...(all
          ? lines.map((l) => ({ label: l.label.toLowerCase().replace("vo2", "VO2"), swatch: Swatch.line(l.mark) }))
          : [{ label: "VO2 max", swatch: Swatch.line("bg-domain-rec") }]),
        { label: "fitness age", swatch: Swatch.line("bg-accent") },
        { label: "real age", swatch: Swatch.dashed("border-muted-2") },
      ]}
    >
      <div className="flex flex-col gap-3">
        {lines.map((l) => (
          <Panel
            key={l.label + l.stroke}
            label={l.label}
            value={l.fit.vo2Latest!.toFixed(1)}
            note={l.fit.vo2Delta === null ? "one update in range" : `${signed(l.fit.vo2Delta)} in range`}
            points={l.fit.vo2}
            x={x}
            strokeClass={l.stroke}
            rows={rows}
            markClass={l.mark}
            summary={`${l.label} ${l.fit.vo2Latest!.toFixed(1)}${l.fit.vo2Delta !== null ? `, ${signed(l.fit.vo2Delta)} in range` : ""}`}
          />
        ))}
        {fit.fitnessAge.length > 0 && fit.fitnessAgeLatest !== null && (
          <Panel
            label="Fitness age"
            value={fit.fitnessAgeLatest.toFixed(1)}
            note={[fit.realAge !== null && `real age ${fit.realAge}`, fit.achievableAge !== null && `can reach ${fit.achievableAge}`].filter(Boolean).join(" · ")}
            points={fit.fitnessAge}
            x={x}
            reference={fit.realAge}
            strokeClass="stroke-accent"
            rows={rows}
            markClass="bg-accent"
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
