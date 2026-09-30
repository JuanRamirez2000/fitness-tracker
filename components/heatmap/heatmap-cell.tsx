import type { CSSProperties } from "react";
import type { HeatmapCell as Cell } from "@/lib/dashboard/types";
import { CELL_NO_DATA } from "@/lib/heatmap/colors";

export const CELL_SIZE = 13;

interface HeatmapCellProps {
  cell: Cell;
  accent: string;
  isToday: boolean;
  isProgramStart: boolean;
  onHover: (date: string | null) => void;
}

export function HeatmapCell({ cell, accent, isToday, isProgramStart, onHover }: HeatmapCellProps) {
  const style: CSSProperties = { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, boxSizing: "border-box" };

  if (cell.state === "pre_program") {
    style.background = "color-mix(in srgb, var(--ink) 3%, transparent)";
  } else if (cell.state === "future") {
    style.background = "transparent";
    style.border = "1px dashed var(--border-strong)";
  } else {
    style.background = cell.fill ?? CELL_NO_DATA;
  }

  // Dimming (outside the selected range) only applies within the program; future and
  // pre-program cells already read as muted through their own dashed/faint styling.
  if (!cell.inRange && cell.state !== "future" && cell.state !== "pre_program") style.opacity = 0.3;
  if (isToday) style.boxShadow = `0 0 0 1.5px ${accent}`;
  if (isProgramStart) style.outline = `1.5px solid ${accent}`;

  return (
    <div
      style={style}
      onMouseEnter={() => onHover(cell.date)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(cell.date)}
      onBlur={() => onHover(null)}
      tabIndex={cell.tooltip ? 0 : -1}
      aria-label={cell.date}
    />
  );
}
