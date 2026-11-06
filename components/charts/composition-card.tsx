import type { DashboardData } from "@/lib/dashboard/types";
import { buildComposition, type CompositionPart } from "@/lib/charts/body-composition";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";

/** The card's "?" explanation. */
const HELP = "Your latest scale reading split into fat, muscle, bone and the rest, as pounds and share of body weight. Body water sits inside those, so it's shown on its own.";

const SIZE = 132;
const STROKE = 18;
/** Gap between segments, in degrees, so parts stay apart without relying on color. */
const GAP_DEG = 2;

const FILL: Record<CompositionPart, string> = {
  fat: "stroke-domain-body",
  muscle: "stroke-accent",
  bone: "stroke-muted-1",
  other: "stroke-muted-3",
};
const SWATCH: Record<CompositionPart, string> = {
  fat: "bg-domain-body",
  muscle: "bg-accent",
  bone: "bg-muted-1",
  other: "bg-muted-3",
};

/** An SVG arc from `start` to `end` degrees (0 = top, clockwise) on a circle of radius r. */
function arcPath(r: number, start: number, end: number): string {
  const c = SIZE / 2;
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${c + r * Math.cos(rad)} ${c + r * Math.sin(rad)}`;
  };
  return `M ${point(start)} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${point(end)}`;
}

/** The latest scale reading as a donut (fat, muscle, bone, other) with the parts listed beside it, and body water as its own bar. */
export function CompositionCard({ data }: { data: DashboardData }) {
  const comp = buildComposition(data);
  if (!comp) {
    return (
      <ChartCard help={HELP} title="Composition today" subtitle="From the Index scale">
        <ChartEmpty>no scale data yet</ChartEmpty>
      </ChartCard>
    );
  }

  const r = (SIZE - STROKE) / 2;
  const sweeps = comp.segments.map((s) => (s.pct / 100) * 360);
  const arcs = comp.segments.map((s, i) => {
    const offset = sweeps.slice(0, i).reduce((sum, v) => sum + v, 0);
    const start = offset + GAP_DEG / 2;
    const end = offset + Math.max(sweeps[i] - GAP_DEG / 2, GAP_DEG / 2 + 0.5);
    return { ...s, d: arcPath(r, start, end) };
  });
  const summary = comp.segments.map((s) => `${s.label} ${s.pct.toFixed(1)}%, ${s.lb.toFixed(1)} pounds`).join("; ");

  return (
    <ChartCard help={HELP} title="Composition today" subtitle={`Index scale, ${fmtDate(comp.date)} · ${comp.weight.toFixed(1)} lb`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} role="img" aria-label={`Body composition: ${summary}`}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
            {arcs.map((a) => (
              <path key={a.part} d={a.d} className={`fill-none ${FILL[a.part]}`} strokeWidth={STROKE} />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
            <span className="font-mono text-[20px] leading-none text-ink">{comp.bodyFatPct.toFixed(1)}%</span>
            <span className="mt-1 text-[11px] text-muted-2">body fat</span>
          </div>
        </div>
        <table className="min-w-[150px] flex-1 border-collapse text-[12.5px]">
          <tbody>
            {comp.segments.map((s) => (
              <tr key={s.part} className="border-b border-divider/60 last:border-0">
                <td className="py-1.5 pr-2">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-[2px] ${SWATCH[s.part]}`} aria-hidden />
                    {s.label}
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-muted-1">{s.pct.toFixed(1)}%</td>
                <td className="py-1.5 text-right font-mono text-muted-2">{s.lb.toFixed(1)} lb</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comp.waterPct !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between font-mono text-[10px] text-muted-2">
            <span className="uppercase tracking-[0.1em]">Body water</span>
            <span>{comp.waterPct.toFixed(1)}% · inside the masses above</span>
          </div>
          <div className="h-[5px] rounded-[3px] bg-track" role="img" aria-label={`Body water ${comp.waterPct.toFixed(1)} percent`}>
            <div className="h-full rounded-[3px] bg-accent/70" style={{ width: `${Math.min(comp.waterPct, 100)}%` }} />
          </div>
        </div>
      )}
    </ChartCard>
  );
}
