import type { KpiDefinition, KpiTone, KpiValue } from "@/lib/dashboard/types";
import { sparklinePath } from "@/lib/kpis/sparkline";
import { toneColor } from "@/lib/kpis/tone-color";

const SPARKLINE_HEIGHT = 26;

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
  visual: KpiDefinition["visual"];
  emptyMessage?: string;
  value: KpiValue | null;
  formatted: { primary: string; delta?: string; tone?: KpiTone } | null;
}

/** Label, value, delta chip, an optional sparkline or progress bar, and a caption. */
export function KpiCard({ label, visual, emptyMessage, value, formatted }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-[7px] rounded-[10px] border border-border bg-card px-[15px] py-[13px]">
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

          {visual === "sparkline" && value.series && value.series.length >= 2 && (
            <svg width="100%" height={SPARKLINE_HEIGHT} viewBox={`0 0 120 ${SPARKLINE_HEIGHT}`} preserveAspectRatio="none" fill="none">
              <path
                d={sparklinePath(value.series, SPARKLINE_HEIGHT)}
                className="stroke-accent"
                strokeWidth={1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          <span className="mt-auto line-clamp-2 text-[10.5px] leading-[1.35] text-muted-2">{value.sub}</span>
        </>
      ) : (
        <span className="mt-auto text-[10.5px] leading-[1.35] text-muted-3">{emptyMessage ?? "No data yet"}</span>
      )}
    </div>
  );
}
