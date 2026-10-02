"use client";

import { useMemo, useState } from "react";
import type { DashboardData, HeatmapMode, ModeContext } from "@/lib/dashboard/types";
import { diffDays } from "@/lib/dates/calendar";
import { monthLabels } from "@/lib/heatmap/month-labels";
import { HEATMAP_WEEKS } from "@/lib/heatmap/window";
import { matchShots } from "@/lib/shots/match";
import { HeatmapCell } from "./heatmap-cell";

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const LABEL_COLUMN = 24;
const MAX_CELL = 14;

/**
 * One CSS grid: a day-label column, then 53 week columns that share the card's width, so the
 * same grid fits a full-width card or half of one. Cells are square at whatever size that
 * leaves, up to MAX_CELL; below `min-w` the parent scrolls sideways instead of shrinking
 * cells to nothing.
 * The window starts on a Sunday (lib/heatmap/window.ts), so cell i sits in week i/7, row i%7.
 */
export function HeatmapGrid({
  data,
  mode,
  ctx,
  cardBg,
  showShots = false,
}: {
  data: DashboardData;
  mode: HeatmapMode;
  ctx: ModeContext;
  /** The active theme's real --card hex, for a star's contrast on a cell with no fill. */
  cardBg: string;
  /** Draws the shot stars (the weight heatmap's, not the steps one's). */
  showShots?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const cells = useMemo(() => mode.toCells(data, ctx), [data, mode, ctx]);

  const starsByDate = useMemo(() => {
    if (!showShots) return new Map();
    const stars = matchShots({
      programStart: data.programStart,
      shotWeekday: data.profile.shot_weekday,
      injectionDates: data.injections.map((i) => i.local_date),
      today: data.today,
      through: data.heatmap.window.to,
    });
    return new Map(stars.map((s) => [s.date, s] as const));
  }, [data, showShots]);

  const months = useMemo(() => monthLabels(data.heatmap.window), [data.heatmap.window]);

  const elapsedPct = Math.min(
    1,
    Math.max(0, (diffDays(data.today, data.heatmap.window.from) + 1) / (HEATMAP_WEEKS * 7)),
  );

  const hoveredCell = hovered ? cells.find((c) => c.date === hovered) : undefined;

  return (
    <div className="relative w-fit min-w-[400px]">
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `${LABEL_COLUMN}px repeat(${HEATMAP_WEEKS}, minmax(0, ${MAX_CELL}px))` }}
      >
        {months.map((m) => (
          <span
            key={m.column}
            className="whitespace-nowrap pb-1 font-mono text-[9px] leading-none text-muted-2"
            style={{ gridRow: 1, gridColumn: m.column + 2 }}
          >
            {m.label}
          </span>
        ))}

        {DAY_LABELS.map((label, i) => (
          <span
            key={i}
            className="flex items-center justify-end pr-1 font-mono text-[8.5px] leading-none text-muted-2"
            style={{ gridRow: i + 2, gridColumn: 1 }}
          >
            {label}
          </span>
        ))}

        {cells.map((cell, i) => (
          <div key={cell.date} style={{ gridRow: (i % 7) + 2, gridColumn: Math.floor(i / 7) + 2 }}>
            <HeatmapCell
              cell={cell}
              star={starsByDate.get(cell.date)}
              accent={ctx.palette.accent}
              isToday={cell.date === data.today}
              isProgramStart={cell.date === data.programStart}
              cardBg={cardBg}
              onHover={setHovered}
            />
          </div>
        ))}
      </div>

      <div className="relative mt-2 h-0.5 rounded-full bg-track" style={{ marginLeft: LABEL_COLUMN + 2 }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent opacity-55"
          style={{ width: `${(elapsedPct * 100).toFixed(1)}%` }}
        />
      </div>

      {hoveredCell && <mode.Tooltip cell={hoveredCell} />}
    </div>
  );
}
