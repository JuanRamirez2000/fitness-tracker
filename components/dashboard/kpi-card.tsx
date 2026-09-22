import type { KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { sparklinePath } from "@/lib/kpis/sparkline";
import { toneColor } from "@/lib/kpis/tone-color";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";

const MIN_SPARKLINE_POINTS = 2;

function DeltaChip({ text, tone }: { text: string; tone: KpiValue["tone"] }) {
  const color = toneColor(tone, DEFAULT_PALETTE);
  return (
    <span
      className="whitespace-nowrap rounded-[5px] border px-[5px] py-px font-mono text-[10px]"
      style={{ color, background: `${color}1A`, borderColor: `${color}33` }}
    >
      {text}
    </span>
  );
}

interface KpiCardProps {
  def: KpiDefinition;
  value: KpiValue | null;
  /** Mobile's condensed anatomy (frame 2B): no hero span, smaller value text, no
   * sparkline. KpiGrid renders a whole separate mobile grid with this set, rather than
   * trying to make one card respond to both layouts at once. */
  compact?: boolean;
}

/** One card anatomy for every critical number (frame 2A): label, value, delta, an optional
 * sparkline or progress bar, and a caption. `def.emptyMessage` covers compute() returning
 * null for a KPI that IS configured (e.g. "Set a goal") — the grid's own padding for a
 * position with no KpiDefinition at all uses a separate, unlabeled empty-slot card. */
export function KpiCard({ def, value, compact = false }: KpiCardProps) {
  const hero = def.hero && !compact;
  const sizing = compact
    ? "min-h-[86px] px-[13px] py-[11px]"
    : `min-h-[104px] px-[15px] py-[13px] ${hero ? "col-span-2 min-h-[124px]" : ""}`;

  if (!value) {
    return (
      <div className={`flex flex-col gap-[7px] rounded-[10px] border border-border bg-card ${sizing}`}>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{def.label}</span>
        <span className="mt-auto text-[10.5px] leading-[1.35] text-muted-3">{def.emptyMessage ?? "No data yet"}</span>
      </div>
    );
  }

  const formatted = def.format(value);
  const valueSize = hero ? 44 : compact ? 22 : 26;
  const unitSize = hero ? 14 : compact ? 11 : 12;

  return (
    <div className={`flex flex-col gap-[7px] rounded-[10px] border border-border bg-card ${sizing}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted-2">{def.label}</span>
        {formatted.delta && <DeltaChip text={formatted.delta} tone={formatted.tone ?? "neutral"} />}
      </div>

      <div className="flex items-baseline gap-[4px]">
        <span className="text-ink" style={{ fontSize: valueSize, fontWeight: 450, letterSpacing: "-0.015em", lineHeight: 1 }}>
          {formatted.primary}
        </span>
        {value.unit && (
          <span className="text-muted-2" style={{ fontSize: unitSize }}>
            {value.unit}
          </span>
        )}
      </div>

      {def.visual === "progress" && value.progress !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-[3px] bg-track">
          <div
            className="h-full rounded-[3px]"
            style={{ width: `${(value.progress * 100).toFixed(1)}%`, background: DEFAULT_PALETTE.accent }}
          />
        </div>
      )}

      {!compact && def.visual === "sparkline" && value.series && value.series.length >= MIN_SPARKLINE_POINTS && (
        <svg width="100%" height="26" viewBox="0 0 120 26" fill="none">
          <path
            d={sparklinePath(value.series)}
            stroke={DEFAULT_PALETTE.accent}
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <span className="mt-auto line-clamp-2 text-[10.5px] leading-[1.35] text-muted-2">{value.sub}</span>
    </div>
  );
}
