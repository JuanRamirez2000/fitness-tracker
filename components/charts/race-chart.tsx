import type { CSSProperties } from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildRacePredictions, fmtRaceChange, fmtRaceTime, racePaceSec, type RacePrediction } from "@/lib/charts/fitness";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { fmtPace } from "@/lib/running/runs";
import { ChartCard, ChartEmpty } from "./chart-card";
import { ChartHover, type HoverPoint, type HoverRow, type SwatchShape } from "./chart-hover";
import { Plot, Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP =
  "Garmin's predicted finish times if you raced each distance today, worked out from your VO2 max and recent training, drawn as pace per mile so the four distances share one scale (faster at the top). The longer the race, the slower the pace. Hover any day for its predicted finish times; the chips below show today's.";

const WIDTH = 520;
const HEIGHT = 190;
const Y_LABEL_W = 34;
/** Marker points along each line: enough to read the shape, few enough not to clutter it. */
const MARKERS = 7;

/** Each distance's look: shape for the markers and swatch, and its color (zone colors, contrast-checked in both themes). */
const STYLE: Record<string, { shape: SwatchShape; stroke: string; bg: string; short: string }> = {
  "5K": { shape: "dot", stroke: "stroke-z2", bg: "bg-z2", short: "5K" },
  "10K": { shape: "triangle", stroke: "stroke-z3", bg: "bg-z3", short: "10K" },
  "Half marathon": { shape: "square", stroke: "stroke-z4", bg: "bg-z4", short: "Half" },
  Marathon: { shape: "diamond", stroke: "stroke-z5", bg: "bg-z5", short: "Marathon" },
};

/** A marker shape positioned over the plot, in the plot's own units. */
function ShapeMarker({ x, y, shape, bg }: { x: number; y: number; shape: SwatchShape; bg: string }) {
  const size = shape === "triangle" ? 10 : shape === "diamond" ? 8 : 8;
  const style: CSSProperties = {
    left: `${(x / WIDTH) * 100}%`,
    top: `${(y / HEIGHT) * 100}%`,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
    ...(shape === "triangle" ? { clipPath: "polygon(50% 0, 100% 100%, 0 100%)" } : {}),
  };
  const form = shape === "dot" ? "rounded-full" : shape === "diamond" ? "rotate-45 rounded-[1px]" : shape === "square" ? "rounded-[1px]" : "";
  return <span className={`absolute ${form} ${bg}`} style={style} />;
}

/**
 * Garmin's predicted 5K, 10K, half and full marathon over the range, as pace per mile on one
 * shared axis (faster at the top), each with its own marker shape and color. Hovering a day shows
 * every predicted finish time and pace; the chips underneath give today's.
 */
export function RaceChart({ data }: { data: DashboardData }) {
  const races = buildRacePredictions(data);
  const title = "Race predictions";
  const subtitle = "Predicted pace per mile if you raced today";
  if (races.length === 0) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>{data.training.length ? "no data in range" : "no predictions yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const pace = (r: RacePrediction, seconds: number) => racePaceSec(seconds, r.miles);
  const first = races.map((r) => r.points[0].date).sort()[0];
  const from = first > data.dateRange.from ? first : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [Y_LABEL_W + 6, WIDTH - 6] });
  const xOf = (date: string) => x(dayStartUtcMs(date));
  const paces = races.flatMap((r) => r.points.map((p) => pace(r, p.value)));
  const pad = Math.max((Math.max(...paces) - Math.min(...paces)) * 0.08, 10);
  // Faster (fewer seconds a mile) at the top.
  const y = scaleLinear<number>({ domain: [Math.min(...paces) - pad, Math.max(...paces) + pad], range: [6, HEIGHT - 6] });
  const ticks = y.ticks(4);

  // Hover: every day any distance has a prediction, with each distance as of that day.
  const days = [...new Set(races.flatMap((r) => r.points.map((p) => p.date)))].sort();
  const asOf = (r: RacePrediction, date: string) => [...r.points].reverse().find((p) => p.date <= date) ?? null;
  const points: HoverPoint[] = days.map((date) => {
    const rows: HoverRow[] = [];
    const marks: { y: number; className: string }[] = [];
    for (const r of races) {
      const p = asOf(r, date);
      if (!p) continue;
      const s = STYLE[r.label];
      rows.push({ label: s.short, value: `${fmtRaceTime(p.value)} · ${fmtPace(pace(r, p.value))}/mi`, swatch: { shape: s.shape, className: s.bg } });
      marks.push({ y: y(pace(r, p.value)) / HEIGHT, className: s.bg });
    }
    return { at: xOf(date) / WIDTH, title: fmtPointTitle(date), rows, marks };
  });

  const markerIdx = (n: number) => (n <= MARKERS ? [...Array(n).keys()] : [...new Set(Array.from({ length: MARKERS }, (_, i) => Math.round((i * (n - 1)) / (MARKERS - 1))))]);

  return (
    <ChartCard help={HELP} title={title} subtitle={subtitle} note={from !== data.dateRange.from ? `predictions start ${fmtDate(from)}` : undefined}>
      <ChartHover points={points} label="days">
        <Plot
          width={WIDTH}
          height={HEIGHT}
          label={`Predicted race paces: ${races.map((r) => `${r.label} ${fmtRaceTime(r.latest)}`).join(", ")}`}
          markers={races.flatMap((r) =>
            markerIdx(r.points.length).map((i) => {
              const p = r.points[i];
              return <ShapeMarker key={`${r.label}-${p.date}`} x={xOf(p.date)} y={y(pace(r, p.value))} shape={STYLE[r.label].shape} bg={STYLE[r.label].bg} />;
            }),
          )}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={Y_LABEL_W} x2={WIDTH} y1={y(t)} y2={y(t)} className="stroke-divider" vectorEffect="non-scaling-stroke" />
              <text x={0} y={y(t) + 3} className="fill-muted-2 font-mono text-[9px]">
                {fmtPace(t)}
              </text>
            </g>
          ))}
          {races.map((r) => (
            <LinePath
              key={r.label}
              data={r.points}
              x={(p) => xOf(p.date)}
              y={(p) => y(pace(r, p.value))}
              className={`fill-none ${STYLE[r.label].stroke}`}
              strokeWidth={1.8}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </Plot>
      </ChartHover>
      <div className="flex justify-between pl-[40px] font-mono text-[9.5px] text-muted-2">
        <span>{fmtDate(from)}</span>
        <span>{fmtDate(data.dateRange.to)}</span>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Today's predicted finish times">
        {races.map((r) => {
          const s = STYLE[r.label];
          const faster = r.change !== null && r.change < 0;
          return (
            <li key={r.label} className="flex items-center gap-2 rounded-full border border-border-strong bg-inset px-3 py-1.5">
              <span aria-hidden className="flex items-center">
                {Swatch[s.shape](s.bg)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-2">{s.short}</span>
              <span className="font-mono text-[14px] leading-none text-ink">{fmtRaceTime(r.latest)}</span>
              {r.change !== null && Math.round(r.change) !== 0 && (
                <span className={`font-mono text-[9.5px] ${faster ? "text-good" : "text-muted-2"}`} title={`${fmtRaceChange(r.change).slice(2)} over the range`}>
                  {faster ? "▼" : "▲"} {fmtRaceTime(r.change)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
