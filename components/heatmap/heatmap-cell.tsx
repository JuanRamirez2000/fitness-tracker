import type { CSSProperties } from "react";
import type { HeatmapCell as Cell } from "@/lib/dashboard/types";
import { CELL_NO_DATA } from "@/lib/heatmap/colors";
import { starInk } from "@/lib/heatmap/star-ink";
import type { ShotStar } from "@/lib/shots/match";

export const CELL_SIZE = 13;

export const STAR_GLYPH: Record<ShotStar["state"], string> = { taken: "★", scheduled: "☆", missed: "☆" };
// Taken is fully opaque; scheduled and missed are hollow, and missed reads noticeably more
// muted than an upcoming scheduled shot.
export const STAR_OPACITY: Record<ShotStar["state"], number> = { taken: 1, scheduled: 0.85, missed: 0.55 };

interface HeatmapCellProps {
  cell: Cell;
  star: ShotStar | undefined;
  accent: string;
  isToday: boolean;
  isProgramStart: boolean;
  /** The active theme's --card hex: the star's contrast basis on a cell with no fill. */
  cardBg: string;
  onHover: (date: string | null) => void;
}

export function HeatmapCell({ cell, star, accent, isToday, isProgramStart, cardBg, onHover }: HeatmapCellProps) {
  const style: CSSProperties = { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, boxSizing: "border-box" };

  let inkBasis = cell.fill ?? CELL_NO_DATA;
  if (cell.state === "pre_program") {
    style.background = "color-mix(in srgb, var(--ink) 3%, transparent)";
    inkBasis = cardBg;
  } else if (cell.state === "future") {
    style.background = "transparent";
    style.border = "1px dashed var(--border-strong)";
    inkBasis = cardBg;
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
      tabIndex={cell.tooltip || star ? 0 : -1}
      aria-label={star ? `${cell.date}: shot ${star.state}` : cell.date}
    >
      {star && (
        <span
          style={{
            display: "block",
            fontSize: CELL_SIZE - 4,
            lineHeight: `${CELL_SIZE - 3}px`,
            color: starInk(inkBasis),
            opacity: STAR_OPACITY[star.state],
            textAlign: "center",
          }}
        >
          {STAR_GLYPH[star.state]}
        </span>
      )}
    </div>
  );
}
