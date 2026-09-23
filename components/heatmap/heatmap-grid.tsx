"use client";

import { useMemo, useState } from "react";
import type { DashboardData, HeatmapMode, ModeContext } from "@/lib/dashboard/types";
import { diffDays } from "@/lib/dates/calendar";
import { monthLabels } from "@/lib/heatmap/month-labels";
import { HEATMAP_WEEKS } from "@/lib/heatmap/window";
import { matchShots } from "@/lib/shots/match";
import { HeatmapCell, CELL_SIZE } from "./heatmap-cell";

const GAP = 4;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const GRID_WIDTH = HEATMAP_WEEKS * (CELL_SIZE + GAP) - GAP;

export function HeatmapGrid({
  data,
  mode,
  ctx,
  onSelectDate,
  cardBg,
}: {
  data: DashboardData;
  mode: HeatmapMode;
  ctx: ModeContext;
  /** Opens the day editor for a clicked cell — omitted cells (future or before the program
   * started) simply render without a click handler. */
  onSelectDate?: (date: string) => void;
  /** The active theme's real --card hex, for HeatmapCell's star-ink contrast math on a
   * future/pre-program cell (which has no solid fill of its own to check against). */
  cardBg: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const cells = useMemo(() => mode.toCells(data, ctx), [data, mode, ctx]);

  const starsByDate = useMemo(() => {
    const stars = matchShots({
      programStart: data.programStart,
      shotWeekday: data.profile.shot_weekday,
      injectionDates: data.injections.map((i) => i.local_date),
      today: data.today,
      through: data.heatmap.window.to,
    });
    return new Map(stars.map((s) => [s.date, s] as const));
  }, [data]);

  const months = useMemo(() => monthLabels(data.heatmap.window), [data.heatmap.window]);

  const elapsedPct = Math.min(
    1,
    Math.max(0, (diffDays(data.today, data.heatmap.window.from) + 1) / (HEATMAP_WEEKS * 7)),
  );

  const hoveredCell = hovered ? cells.find((c) => c.date === hovered) : undefined;

  return (
    <div className="relative flex gap-2.5">
      <div className="flex flex-col gap-1 pt-[17px]" style={{ width: 26 }}>
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="text-right font-mono text-[9px] leading-[13px] text-muted-2"
            style={{ height: CELL_SIZE }}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, ${CELL_SIZE}px)`, gap: GAP, height: CELL_SIZE }}
        >
          {months.map((m) => (
            <span
              key={m.column}
              className="whitespace-nowrap font-mono text-[9.5px] leading-[13px] text-muted-2"
              style={{ gridColumn: m.column + 1 }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div
          className="grid"
          style={{
            gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
            gridAutoFlow: "column",
            gridAutoColumns: `${CELL_SIZE}px`,
            gap: GAP,
          }}
        >
          {cells.map((cell) => (
            <HeatmapCell
              key={cell.date}
              cell={cell}
              star={starsByDate.get(cell.date)}
              accent={ctx.palette.accent}
              isToday={cell.date === data.today}
              isProgramStart={cell.date === data.programStart}
              cardBg={cardBg}
              onHover={setHovered}
              onSelect={onSelectDate && cell.state !== "future" && cell.state !== "pre_program" ? onSelectDate : undefined}
            />
          ))}
        </div>

        <div
          className="relative mt-2 h-0.5 rounded-full bg-track"
          style={{ width: GRID_WIDTH }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent opacity-55"
            style={{ width: `${(elapsedPct * 100).toFixed(1)}%` }}
          />
        </div>
      </div>

      {hoveredCell && <mode.Tooltip cell={hoveredCell} />}
    </div>
  );
}
