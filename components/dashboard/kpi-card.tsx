import { ChartHover, type HoverPoint } from "@/components/charts/chart-hover";
import type { KpiDefinition, KpiPoint, KpiTone, KpiValue } from "@/lib/dashboard/types";
import { fmtPointTitle } from "@/lib/dates/format";
import { SPARKLINE_WIDTH, sparklineBandPath, sparklinePath, sparklineX, sparklineY } from "@/lib/kpis/sparkline";
import { toneColor } from "@/lib/kpis/tone-color";

const SPARKLINE_HEIGHT = 26;
/** A wide card has room for a taller line, and for its band to read. */
const WIDE_SPARKLINE_HEIGHT = 40;

/**
 * The card's trend line with a hover: the day (or week) and the value it shows, plus the band
 * behind it when the KPI has one. Points are evenly spaced, newest at the right.
 */
function Sparkline({ points, invert, height, bandLabel }: { points: KpiPoint[]; invert?: boolean; height: number; bandLabel?: string }) {
  const values = points.map((p) => p.value);
  const banded = points.every((p) => p.low !== undefined && p.high !== undefined);
  const all = banded ? values.concat(points.flatMap((p) => [p.low!, p.high!])) : values;
  const domain: [number, number] = [Math.min(...all), Math.max(...all)];
  const hover: HoverPoint[] = points.map((p, i) => ({
    at: sparklineX(i, points.length) / SPARKLINE_WIDTH,
    title: p.title ?? fmtPointTitle(p.date),
    rows: [
      { label: "Value", value: p.text, swatch: { shape: "line", className: "bg-accent" } },
      ...(p.low !== undefined && p.high !== undefined
        ? [{ label: bandLabel ?? "Range", value: `${p.low}–${p.high}`, swatch: { shape: "band" as const, className: "bg-accent/20" }, muted: true }]
        : []),
    ],
    marks: [{ y: sparklineY(p.value, domain, height, invert) / height, className: "bg-accent" }],
  }));
  return (
    <ChartHover points={hover} label="recent values">
      <svg width="100%" height={height} viewBox={`0 0 ${SPARKLINE_WIDTH} ${height}`} preserveAspectRatio="none" fill="none" className="block">
        {banded && (
          <path
            d={sparklineBandPath(points.map((p) => p.low!), points.map((p) => p.high!), height, domain, invert)}
            className="fill-accent/15"
          />
        )}
        <path
          d={sparklinePath(values, height, domain, invert)}
          className="stroke-accent"
          strokeWidth={1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </ChartHover>
  );
}

function DeltaChip({ text, tone }: { text: string; tone: KpiTone }) {
  const color = toneColor(tone);
  return (
    <span
      className="whitespace-nowrap rounded-[5px] border px-[5px] py-px font-mono text-[10px]"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      {text}
    </span>
  );
}

interface KpiCardProps {
  label: string;
  span?: 1 | 2;
  /** The wide card's band, named in its hover ("normal range"). */
  bandLabel?: string;
  visual: KpiDefinition["visual"];
  emptyMessage?: string;
  value: KpiValue | null;
  formatted: { primary: string; delta?: string; tone?: KpiTone } | null;
}

/** Label, value, delta chip, an optional sparkline or progress bar, and a caption. */
export function KpiCard({ label, span = 1, bandLabel, visual, emptyMessage, value, formatted }: KpiCardProps) {
  return (
    <div className={`flex flex-col gap-[7px] rounded-[10px] border border-border bg-card px-[15px] py-[13px] ${span === 2 ? "col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted-2">{label}</span>
        {formatted?.delta && <DeltaChip text={formatted.delta} tone={formatted.tone ?? "neutral"} />}
      </div>

      {value && formatted ? (
        <>
          <div className="flex items-baseline gap-[4px]">
            <span className="text-[26px] leading-none text-ink" style={{ fontWeight: 450, letterSpacing: "-0.015em" }}>
              {formatted.primary}
            </span>
            {value.unit && <span className="text-[12px] text-muted-2">{value.unit}</span>}
          </div>

          {visual === "progress" && value.progress !== undefined && (
            <div className="h-1 overflow-hidden rounded-[3px] bg-track">
              <div className="h-full rounded-[3px] bg-accent" style={{ width: `${(value.progress * 100).toFixed(1)}%` }} />
            </div>
          )}

          {visual === "sparkline" && value.points && value.points.length >= 2 && (
            <Sparkline points={value.points} invert={value.invert} height={span === 2 ? WIDE_SPARKLINE_HEIGHT : SPARKLINE_HEIGHT} bandLabel={bandLabel} />
          )}

          <span className="mt-auto line-clamp-2 text-[10.5px] leading-[1.35] text-muted-2">{value.sub}</span>
        </>
      ) : (
        <span className="mt-auto text-[10.5px] leading-[1.35] text-muted-3">{emptyMessage ?? "No data yet"}</span>
      )}
    </div>
  );
}
