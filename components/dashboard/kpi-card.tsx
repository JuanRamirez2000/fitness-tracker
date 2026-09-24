import type { KpiTone, KpiValue } from "@/lib/dashboard/types";
import { resolveCardTier, type Footprint } from "@/lib/kpis/footprint";
import { sparklinePath } from "@/lib/kpis/sparkline";
import { toneColor } from "@/lib/kpis/tone-color";

const MIN_SPARKLINE_POINTS = 2;

function DeltaChip({ text, tone }: { text: string; tone: KpiValue["tone"] }) {
  const color = toneColor(tone);
  // color is a var(--x) reference, not a literal hex, since toneColor re-themes for free via
  // the CSS cascade — the old `${color}1A` hex-alpha-suffix trick only works on a literal, so
  // the translucent wash is color-mix() instead (~10%/~20%, matching the old 0x1A/0x33 alphas).
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

export interface ResolvedWidget {
  id: string;
  label: string;
  visual?: "sparkline" | "progress" | "none";
  emptyMessage?: string;
  value: KpiValue | null;
  /** def.format(value), already run server-side — KpiCard renders inside a "use client"
   * boundary (WidgetGrid) on desktop, and a KpiDefinition's compute()/format() are functions,
   * which React cannot serialize across that boundary. Every field here is plain data instead;
   * this is the exact "functions cannot be passed directly to Client Components" class of bug
   * this codebase has hit once before (HEATMAP_MODES, per project history) — resolve to plain
   * data server-side rather than passing the definition itself. */
  formatted: { primary: string; delta?: string; tone?: KpiTone } | null;
}

interface KpiCardProps {
  widget: ResolvedWidget;
  /** How much room this card currently has on the bento grid (lib/kpis/footprint.ts) — the
   * one thing that decides how much of the card's content renders. Desktop passes whatever
   * the user last dragged/resized it to; mobile always passes {w:1,h:1}. */
  footprint: Footprint;
}

/** One card anatomy for every widget (frame 2A, generalized past its original fixed grid):
 * label, value, and — footprint permitting — a delta chip, a sparkline or progress bar, and a
 * caption. `emptyMessage` covers compute() returning null for a widget that IS configured
 * (e.g. "Set a goal"), distinct from a position with no widget at all. */
export function KpiCard({ widget, footprint }: KpiCardProps) {
  const tier = resolveCardTier(footprint);
  const { value, formatted } = widget;

  if (!value || !formatted) {
    return (
      <div className="flex h-full w-full flex-col gap-[7px] rounded-[10px] border border-border bg-card px-[15px] py-[13px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{widget.label}</span>
        <span className="mt-auto text-[10.5px] leading-[1.35] text-muted-3">{widget.emptyMessage ?? "No data yet"}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-[7px] rounded-[10px] border border-border bg-card px-[15px] py-[13px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted-2">{widget.label}</span>
        {tier.showDelta && formatted.delta && <DeltaChip text={formatted.delta} tone={formatted.tone ?? "neutral"} />}
      </div>

      <div className="flex items-baseline gap-[4px]">
        <span className="text-ink" style={{ fontSize: tier.valueSize, fontWeight: 450, letterSpacing: "-0.015em", lineHeight: 1 }}>
          {formatted.primary}
        </span>
        {value.unit && (
          <span className="text-muted-2" style={{ fontSize: tier.unitSize }}>
            {value.unit}
          </span>
        )}
      </div>

      {tier.showVisual && widget.visual === "progress" && value.progress !== undefined && (
        <div className="overflow-hidden rounded-[3px] bg-track" style={{ height: tier.progressBarHeight }}>
          <div className="h-full rounded-[3px] bg-accent" style={{ width: `${(value.progress * 100).toFixed(1)}%` }} />
        </div>
      )}

      {tier.showSparkline && widget.visual === "sparkline" && value.series && value.series.length >= MIN_SPARKLINE_POINTS && (
        <svg width="100%" height={tier.sparklineHeight} viewBox={`0 0 120 ${tier.sparklineHeight}`} fill="none">
          <path
            d={sparklinePath(value.series, tier.sparklineHeight)}
            className="stroke-accent"
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {tier.showSub && <span className="mt-auto line-clamp-2 text-[10.5px] leading-[1.35] text-muted-2">{value.sub}</span>}
    </div>
  );
}
