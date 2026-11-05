"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { nearestIndex } from "@/lib/charts/hover";
import { openActivity } from "@/components/activity/open";
import { Crosshair, HoverLayer } from "./hover";
import { Swatch } from "./parts";

export type SwatchShape = keyof typeof Swatch;

/** One line of a chart tooltip: the series' legend swatch, its name, and its value that day. */
export interface HoverRow {
  label: string;
  value: string;
  swatch?: { shape: SwatchShape; className: string };
  /** Dimmed: context rather than the measurement (a normal range, a target). */
  muted?: boolean;
}

/**
 * One hoverable point (usually a day), built on the server with the chart: everything here is
 * plain data, so the chart itself stays a server component and only this crosses to the client.
 */
export interface HoverPoint {
  /** Horizontal position, as a fraction (0-1) of the hover area's width. */
  at: number;
  /** The tooltip's header: "Tue, Nov 3", "Week of Oct 27". */
  title: string;
  rows: HoverRow[];
  /** Points to ring while hovered: `y` as a fraction (0-1) of the hover area's height, from the top. */
  marks?: { y: number; className: string }[];
  /** A run: clicking (or Enter) opens its activity modal. */
  activityId?: string;
}

/**
 * Hover for any chart: wrap the plot (or a stack of panels on one x axis), pass its points, and
 * get a crosshair (or, with `band`, a highlighted column for bar charts), rings on the hovered
 * values, and a tooltip that flips sides near the right edge. Mouse, touch and arrow keys.
 */
export function ChartHover({
  points,
  label,
  band,
  children,
  className = "",
}: {
  points: HoverPoint[];
  /** What the arrow keys step through, for screen readers: "days", "weeks". */
  label: string;
  /** Bar charts: highlight a column this wide (fraction of the area) instead of drawing a line. */
  band?: number;
  children: ReactNode;
  className?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const ats = points.map((p) => p.at);
  const point = index !== null ? points[index] : null;

  return (
    <div className={`relative ${className}`}>
      {children}
      {point && band !== undefined && (
        <span
          className="pointer-events-none absolute inset-y-0 rounded-[3px] bg-ink/[0.07]"
          style={{ left: `${(point.at - band / 2) * 100}%`, width: `${band * 100}%` }}
          aria-hidden
        />
      )}
      {point?.marks?.map((m, i) => (
        <span
          key={i}
          className={`pointer-events-none absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card ${m.className}`}
          style={{ left: `${point.at * 100}%`, top: `${m.y * 100}%` }}
          aria-hidden
        />
      ))}
      <HoverLayer
        onHover={(f) => setIndex(f === null ? null : nearestIndex(ats, f))}
        onStep={setIndex}
        steps={points.length}
        current={index}
        label={`${label}: arrow keys step through them${points.some((p) => p.activityId) ? ", Enter opens one" : ""}`}
        onActivate={point?.activityId ? () => openActivity(point.activityId!) : undefined}
      >
        {band === undefined && <Crosshair fraction={point?.at ?? null} />}
      </HoverLayer>
      {point && <Tooltip point={point} />}
    </div>
  );
}

const GAP = 12;
const EDGE = 8;

/**
 * Beside the crosshair: to the right when it fits on screen, else to the left, else pushed
 * inside the viewport (a narrow panel on a phone). Placed after layout, by measuring, so it never
 * runs off the page whatever the panel's width.
 */
function Tooltip({ point }: { point: HoverPoint }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const area = el?.parentElement?.getBoundingClientRect();
    if (!el || !area) return;
    const anchor = area.left + point.at * area.width;
    const width = el.offsetWidth;
    const viewport = document.documentElement.clientWidth;
    let left = anchor + GAP;
    if (left + width > viewport - EDGE) left = anchor - GAP - width;
    if (left < EDGE) left = Math.min(Math.max(EDGE, anchor - width / 2), viewport - EDGE - width);
    el.style.left = `${left - area.left}px`;
    el.style.visibility = "visible";
  }, [point]);
  return (
    <div
      ref={ref}
      role="status"
      className="pointer-events-none invisible absolute top-0 z-10 w-max min-w-[150px] max-w-[240px] rounded-[9px] border border-border-strong bg-raised px-[11px] py-[9px] shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-3">{point.title}</div>
      <div className="flex flex-col gap-1">
        {point.rows.map((row) => (
          <div key={row.label} className="flex items-center gap-[7px] whitespace-nowrap text-[11.5px] leading-[15px]">
            <span className="flex w-3 shrink-0 justify-center">{row.swatch && Swatch[row.swatch.shape](row.swatch.className)}</span>
            <span className="text-muted-2">{row.label}</span>
            <span className={`ml-auto pl-3 tabular-nums ${row.muted ? "text-muted-2" : "text-ink"}`}>{row.value}</span>
          </div>
        ))}
      </div>
      {point.activityId && <div className="mt-1.5 font-mono text-[9.5px] text-muted-3">click to open</div>}
    </div>
  );
}
