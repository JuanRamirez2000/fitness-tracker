import type { CSSProperties, ReactNode } from "react";

/** A labelled stat over a chart: mono uppercase label, mono numeral, muted unit and note. */
export function Stat({ label, value, unit, note }: { label: string; value: ReactNode; unit?: string; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{label}</span>
      <span className="font-mono text-[22px] leading-none text-ink">
        {value}
        {unit && <span className="text-[12px] text-muted-2"> {unit}</span>}
      </span>
      {note && <span className="font-mono text-[10px] text-muted-2">{note}</span>}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-7 gap-y-3">{children}</div>;
}

/**
 * A plot whose SVG stretches to the card (preserveAspectRatio="none") with point markers
 * drawn as HTML on top, so dots stay round and squares stay square at any width. Children
 * are SVG; `markers` are positioned in percent of the plot.
 */
export function Plot({
  width,
  height,
  label,
  children,
  markers,
  className = "",
}: {
  width: number;
  height: number;
  /** The chart's text summary for screen readers. */
  label: string;
  children: ReactNode;
  markers?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className}`} style={{ height }} role="img" aria-label={label}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 overflow-visible"
        aria-hidden
      >
        {children}
      </svg>
      {markers && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {markers}
        </div>
      )}
    </div>
  );
}

/** A point marker inside a Plot: `x`/`y` in the plot's own units. */
export function Marker({
  x,
  y,
  width,
  height,
  shape,
  className,
  size = 6,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "dot" | "square";
  className: string;
  size?: number;
}) {
  const style: CSSProperties = {
    left: `${(x / width) * 100}%`,
    top: `${(y / height) * 100}%`,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
  };
  return <span className={`absolute ${shape === "dot" ? "rounded-full" : "rounded-[1px]"} ${className}`} style={style} />;
}

/** First and last labels under a chart, with an optional middle note. */
export function AxisRow({ start, middle, end }: { start: ReactNode; middle?: ReactNode; end: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 font-mono text-[9.5px] text-muted-2">
      <span>{start}</span>
      {middle && <span className="text-center">{middle}</span>}
      <span>{end}</span>
    </div>
  );
}

/** Legend swatches. */
export const Swatch = {
  square: (className: string) => <span className={`inline-block h-2 w-2 rounded-[1px] ${className}`} />,
  dot: (className: string) => <span className={`inline-block h-[7px] w-[7px] rounded-full ${className}`} />,
  line: (className: string) => <span className={`inline-block h-[2px] w-3 rounded ${className}`} />,
  dashed: (className: string) => <span className={`inline-block w-3 border-t-[1.5px] border-dashed ${className}`} />,
  band: (className: string) => <span className={`inline-block h-2 w-3 rounded-[2px] ${className}`} />,
};
