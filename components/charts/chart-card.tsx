import type { ReactNode } from "react";

/** Shared chrome for every chart card (frame 2A's "Charts" section): a serif title, an
 * optional mono caption/legend on the right, and whatever the chart itself renders below. */
export function ChartCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card px-4 py-4 md:px-[22px] md:py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <span className="font-serif text-[16px]">{title}</span>
        {caption && <div className="flex flex-wrap items-center gap-3 font-mono text-[9.5px] text-muted-2">{caption}</div>}
      </div>
      {children}
    </div>
  );
}
