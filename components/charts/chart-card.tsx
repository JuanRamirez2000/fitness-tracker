import { HelpTip } from "@/components/ui/help-tip";
import type { ReactNode } from "react";

export interface ChartLegendItem {
  label: string;
  /** The shape swatch (a dot, line, square, star…) drawn before the label. Never color alone:
   * the shape should differ between items that the chart draws differently. */
  swatch: ReactNode;
}

/**
 * Shared chrome for every chart card: a serif title with an optional muted subtitle under it,
 * an optional mono caption and an optional actions slot (e.g. a Segmented toggle) on the
 * right, the chart itself, then an optional legend row and a one-line mono note
 * ("scale data starts Sep 1").
 */
export function ChartCard({
  title,
  subtitle,
  caption,
  actions,
  legend,
  note,
  help,
  children,
}: {
  title: string;
  /** What the chart shows and how to read it, behind the "?" in the card's top-right corner. */
  help?: ReactNode;
  subtitle?: ReactNode;
  caption?: ReactNode;
  actions?: ReactNode;
  legend?: readonly ChartLegendItem[];
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-3.5 rounded-xl border border-border bg-card px-4 py-4 md:px-[22px] md:py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="font-serif text-[16px] md:text-[18px]">{title}</span>
          {subtitle && <span className="text-[12px] text-muted-2">{subtitle}</span>}
        </div>
        {(caption || actions || help) && (
          <div className="flex flex-wrap items-center gap-3">
            {caption && <div className="flex flex-wrap items-center gap-3 font-mono text-[9.5px] text-muted-2">{caption}</div>}
            {actions}
            {help && <HelpTip title={title}>{help}</HelpTip>}
          </div>
        )}
      </div>
      {children}
      {legend && legend.length > 0 && <ChartLegend items={legend} />}
      {note && <span className="font-mono text-[10px] text-muted-2">{note}</span>}
    </div>
  );
}

export function ChartLegend({ items }: { items: readonly ChartLegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className="flex items-center">
            {item.swatch}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** The in-chart empty state: one mono line where the chart would be, never an empty axis. */
export function ChartEmpty({ children = "no data in range" }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center font-mono text-[11px] text-muted-2">{children}</div>
  );
}
