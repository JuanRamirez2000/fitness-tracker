import type { ReactNode } from "react";

export interface TooltipRow {
  key: string;
  value: string;
  dot?: string;
}

/**
 * The heatmap's tooltip card (frame 2A): a fixed slot at the card's top-right, date header
 * plus a stack of key/value lines. Every mode's Tooltip renders into this shell.
 */
export function TooltipShell({ date, rows }: { date: string; rows: TooltipRow[] }) {
  return (
    <div className="absolute right-6 top-[78px] z-10 w-[214px] rounded-[9px] border border-border-strong bg-raised px-[11px] py-[9px] shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-3">
        {date}
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-[7px] whitespace-nowrap text-[11.5px] leading-[15px]">
            {row.dot && (
              <span
                className="inline-block size-[11px] shrink-0 rounded-[3px]"
                style={{ background: row.dot }}
              />
            )}
            <span className="w-[52px] shrink-0 text-muted-2">{row.key}</span>
            <span className="text-ink">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A single free-form line, for a mode with no per-row swatch (e.g. "No weigh-in"). */
export function TooltipEmpty({ date, text }: { date: string; text: ReactNode }) {
  return (
    <div className="absolute right-6 top-[78px] z-10 w-[214px] rounded-[9px] border border-border-strong bg-raised px-[11px] py-[9px] text-[11.5px] text-muted-2 shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-3">
        {date}
      </div>
      {text}
    </div>
  );
}
