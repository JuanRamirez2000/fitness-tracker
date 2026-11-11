import type { ReactNode } from "react";

/** Column spans at lg and up. Literal class names so Tailwind generates them. */
const SPAN_CLASS = {
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  12: "lg:col-span-12",
} as const;
export type Span = keyof typeof SPAN_CLASS;

/** The 12-column card grid (14px gap). One column below lg. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">{children}</div>;
}

/** One grid cell. min-w-0 lets wide content (tables, heatmaps) scroll inside it instead of
 * stretching the grid. */
export function Cell({ span, children }: { span: Span; children: ReactNode }) {
  return <div className={`min-w-0 ${SPAN_CLASS[span]}`}>{children}</div>;
}

/** A numbered section question ("01  Am I losing fat, not muscle?") over a top rule. */
export function SectionHeading({ n, children, rule = true }: { n: string; children: ReactNode; rule?: boolean }) {
  return (
    <div className={`flex items-baseline gap-3.5 ${rule ? "border-t border-divider pt-7" : ""}`}>
      <span className="font-mono text-[11px] text-accent">{n}</span>
      <h2 className="font-serif text-[clamp(26px,4vw,34px)] leading-[1.1] font-normal">{children}</h2>
    </div>
  );
}

/** A small mono uppercase label over a group of cards ("Recovery and sleep detail"). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">{children}</span>;
}

/** A section: heading, then its cards, 18px apart. */
export function Section({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-[18px]">{children}</section>;
}
