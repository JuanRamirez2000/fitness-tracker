"use client";

import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { Crosshair, HoverLayer } from "@/components/charts/hover";
import { Plot } from "@/components/charts/parts";
import type { ActivitySeries } from "@/lib/data/activity-details";
import { nearestIndex } from "@/lib/charts/hover";
import { paceOf } from "@/lib/activity/view";
import { METERS_PER_MILE, fmtDuration, fmtPace } from "@/lib/running/runs";

const WIDTH = 720;
const PANEL_HEIGHT = 84;
const FEET_PER_METER = 3.28084;

interface Panel {
  key: string;
  label: string;
  unit: string;
  values: (number | null)[];
  format: (v: number) => string;
  /** Faster pace is a smaller number: draw it higher. */
  invert?: boolean;
  /** Trim the domain to this quantile range, so a stop or a GPS spike doesn't flatten the line. */
  trim?: number;
  kind: "line" | "area";
  stroke: string;
  fill?: string;
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

function domainOf(values: (number | null)[], trim = 0): [number, number] | null {
  const defined = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (defined.length < 2) return null;
  let lo = quantile(defined, trim);
  let hi = quantile(defined, 1 - trim);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

/** The x axis: miles when the activity has distance, minutes otherwise (strength, treadmill without a footpod). */
export function seriesAxis(series: ActivitySeries): { xs: (number | null)[]; unit: "mi" | "min" } {
  const d = series.d;
  const hasDistance = d && (d.at(-1) ?? 0) > 200;
  return hasDistance
    ? { xs: d!.map((v) => (v === null ? null : v / METERS_PER_MILE)), unit: "mi" }
    : { xs: series.t.map((v) => v / 60), unit: "min" };
}

/**
 * Pace (or speed), heart rate and elevation stacked on one distance axis with one shared hover:
 * a vertical rule across every panel and a readout of everything the watch recorded at that point.
 */
export function SeriesChart({
  series,
  isRun,
  hover,
  onHover,
}: {
  series: ActivitySeries;
  isRun: boolean;
  hover: number | null;
  onHover: (index: number | null) => void;
}) {
  const { xs, unit } = seriesAxis(series);
  const defined = xs.filter((v): v is number => v !== null);
  if (defined.length < 2) return null;
  const xMin = defined[0];
  const xMax = defined[defined.length - 1];
  const x = scaleLinear<number>({ domain: [xMin, xMax], range: [0, WIDTH] });

  const panels: Panel[] = [];
  if (series.speed) {
    panels.push(
      isRun
        ? {
            key: "pace",
            label: "Pace",
            unit: "/mi",
            values: series.speed.map(paceOf),
            format: fmtPace,
            invert: true,
            trim: 0.03,
            kind: "line",
            stroke: "stroke-accent",
          }
        : {
            key: "speed",
            label: "Speed",
            unit: "mph",
            values: series.speed.map((v) => (v === null ? null : (v * 3600) / METERS_PER_MILE)),
            format: (v) => v.toFixed(1),
            trim: 0.02,
            kind: "line",
            stroke: "stroke-accent",
          },
    );
  }
  if (series.hr) {
    panels.push({ key: "hr", label: "Heart rate", unit: "bpm", values: series.hr, format: (v) => String(Math.round(v)), kind: "line", stroke: "stroke-z4" });
  }
  if (series.elev) {
    panels.push({
      key: "elev",
      label: "Elevation",
      unit: "ft",
      values: series.elev.map((v) => (v === null ? null : v * FEET_PER_METER)),
      format: (v) => String(Math.round(v)),
      kind: "area",
      stroke: "stroke-muted-1",
      fill: "fill-muted-1/15",
    });
  }
  if (!panels.length) return null;

  const fraction = hover !== null && xs[hover] !== null ? x(xs[hover] as number) / WIDTH : null;
  const fromFraction = (f: number | null) => onHover(f === null ? null : nearestIndex(xs, xMin + f * (xMax - xMin)));
  const at = (values: (number | null)[] | undefined) => (hover !== null && values ? values[hover] : null);

  const readout: [string, string][] = [];
  if (hover !== null) {
    const xv = xs[hover];
    if (xv !== null) readout.push([unit === "mi" ? "Mile" : "Minute", xv.toFixed(unit === "mi" ? 2 : 0)]);
    readout.push(["Time", fmtDuration(series.t[hover])]);
    const pace = isRun ? paceOf(at(series.speed)) : null;
    if (pace !== null) readout.push(["Pace", `${fmtPace(pace)} /mi`]);
    const gap = isRun ? paceOf(at(series.gap)) : null;
    if (gap !== null) readout.push(["Grade-adj.", `${fmtPace(gap)} /mi`]);
    const speed = at(series.speed);
    if (!isRun && speed !== null) readout.push(["Speed", `${((speed * 3600) / METERS_PER_MILE).toFixed(1)} mph`]);
    const extras: [keyof ActivitySeries, string, (v: number) => string][] = [
      ["hr", "HR", (v) => `${Math.round(v)} bpm`],
      ["cadence", "Cadence", (v) => `${Math.round(v)} ${isRun ? "spm" : "rpm"}`],
      ["power", "Power", (v) => `${Math.round(v)} W`],
      ["elev", "Elevation", (v) => `${Math.round(v * FEET_PER_METER)} ft`],
      ["stride", "Stride", (v) => `${(v / 100).toFixed(2)} m`],
      ["gct", "Contact", (v) => `${Math.round(v)} ms`],
      ["stamina", "Stamina", (v) => `${Math.round(v)}%`],
      ["bb", "Body Battery", (v) => String(Math.round(v))],
    ];
    for (const [key, label, fmt] of extras) {
      const v = at(series[key] as (number | null)[] | undefined);
      if (v !== null && v !== undefined) readout.push([label, fmt(v)]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-[54px] flex-wrap content-start items-baseline gap-x-4 gap-y-1 font-mono text-[11px]" aria-live="polite">
        {readout.length ? (
          readout.map(([label, value]) => (
            <span key={label} className="whitespace-nowrap">
              <span className="text-[9.5px] uppercase tracking-[0.08em] text-muted-2">{label} </span>
              <span className="text-ink">{value}</span>
            </span>
          ))
        ) : (
          <span className="text-muted-3">Move along the chart to read any point.</span>
        )}
      </div>

      <div className="relative flex flex-col gap-2.5">
        {panels.map((p) => {
          const domain = domainOf(p.values, p.trim);
          if (!domain) return null;
          const y = scaleLinear<number>({ domain, range: p.invert ? [6, PANEL_HEIGHT - 6] : [PANEL_HEIGHT - 6, 6], clamp: true });
          const points = p.values.map((v, i) => ({ x: xs[i], v }));
          const isDefined = (pt: { x: number | null; v: number | null }) => pt.x !== null && pt.v !== null;
          const current = at(p.values);
          // Low to high as numbers: for pace, fastest to slowest.
          const [lo, hi] = domain;
          return (
            <div key={p.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">
                <span>
                  {p.label} · {p.unit}
                </span>
                <span className="normal-case tracking-normal text-muted-3">
                  {current !== null && current !== undefined ? (
                    <span className="text-ink">{p.format(current)}</span>
                  ) : (
                    `${p.format(Math.max(lo, 0))}–${p.format(hi)}`
                  )}
                </span>
              </div>
              <Plot width={WIDTH} height={PANEL_HEIGHT} label={`${p.label} over ${unit === "mi" ? "distance" : "time"}`}>
                <line x1={0} x2={WIDTH} y1={PANEL_HEIGHT - 0.5} y2={PANEL_HEIGHT - 0.5} className="stroke-divider" vectorEffect="non-scaling-stroke" />
                {p.kind === "area" ? (
                  <AreaClosed
                    data={points}
                    x={(pt) => x(pt.x as number)}
                    y={(pt) => y(pt.v as number)}
                    yScale={y}
                    defined={isDefined}
                    className={`${p.fill} ${p.stroke}`}
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <LinePath
                    data={points}
                    x={(pt) => x(pt.x as number)}
                    y={(pt) => y(pt.v as number)}
                    defined={isDefined}
                    className={`fill-none ${p.stroke}`}
                    strokeWidth={1.6}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </Plot>
            </div>
          );
        })}
        <HoverLayer
          onHover={fromFraction}
          onStep={onHover}
          steps={xs.length}
          current={hover}
          label={`Activity samples along the ${unit === "mi" ? "route" : "session"}; arrow keys move the readout`}
        >
          <Crosshair fraction={fraction} />
        </HoverLayer>
      </div>

      <div className="flex justify-between font-mono text-[9.5px] text-muted-2">
        <span>
          {xMin.toFixed(unit === "mi" ? 1 : 0)} {unit}
        </span>
        <span>
          {xMax.toFixed(unit === "mi" ? 2 : 0)} {unit}
        </span>
      </div>
    </div>
  );
}
