import type { CSSProperties } from "react";
import type { HeatmapCell as Cell } from "@/lib/dashboard/types";
import type { ShotStar } from "@/lib/shots/match";
import { starInk } from "@/lib/heatmap/star-ink";
import { CELL_NO_DATA } from "@/lib/heatmap/colors";
import { CARD_BG } from "@/lib/theme/surfaces";

export const CELL_SIZE = 13;

const STAR_GLYPH: Record<ShotStar["state"], string> = { taken: "★", scheduled: "☆", missed: "☆" };
// Taken is fully opaque; scheduled and missed are hollow, and missed reads noticeably more
// muted than an upcoming scheduled shot (frame 2A's star legend).
const STAR_OPACITY: Record<ShotStar["state"], number> = { taken: 1, scheduled: 0.85, missed: 0.55 };

interface HeatmapCellProps {
  cell: Cell;
  star: ShotStar | undefined;
  accent: string;
  isToday: boolean;
  isProgramStart: boolean;
  onHover: (date: string | null) => void;
}

export function HeatmapCell({ cell, star, accent, isToday, isProgramStart, onHover }: HeatmapCellProps) {
  const style: CSSProperties = {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
    boxSizing: "border-box",
    position: "relative",
  };

  // starInk takes every fill actually painted, so ink stays readable on a split cell too.
  let inkBasis = [cell.fill ?? CELL_NO_DATA, ...(cell.secondFill ? [cell.secondFill] : [])];
  if (cell.state === "pre_program") {
    style.background = "rgba(255,255,255,0.03)";
    inkBasis = [CARD_BG];
  } else if (cell.state === "future") {
    style.background = "transparent";
    style.border = "1px dashed #2a313b";
    inkBasis = [CARD_BG];
  } else if (cell.secondFill) {
    // "Multiple" (two or more same-day activities): a diagonal split, not a blended color,
    // so neither activity's own color is lost.
    style.background = `linear-gradient(135deg, ${cell.fill ?? CELL_NO_DATA} 0 50%, ${cell.secondFill} 50% 100%)`;
  } else {
    style.background = cell.fill ?? CELL_NO_DATA;
  }
  if (cell.notch) style.boxShadow = "inset -3px -3px 0 -1.4px rgba(10,12,15,0.85)";

  // Dimming (outside the selected range) only applies within the program; future and
  // pre-program cells already read as muted through their own dashed/faint styling.
  if (!cell.inRange && cell.state !== "future" && cell.state !== "pre_program") {
    style.opacity = 0.3;
  }
  // today's ring takes priority over the notch's inset shadow; a cell is rarely both anyway.
  if (isToday) style.boxShadow = `0 0 0 1.5px ${accent}`;
  if (isProgramStart) style.outline = `1.5px solid ${accent}`;

  return (
    <div
      style={style}
      onMouseEnter={() => onHover(cell.date)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(cell.date)}
      onBlur={() => onHover(null)}
      tabIndex={star ? 0 : -1}
      aria-label={star ? `${cell.date}: shot ${star.state}` : undefined}
    >
      {star && (
        <span
          style={{
            display: "block",
            fontSize: CELL_SIZE - 4,
            lineHeight: `${CELL_SIZE - 3}px`,
            color: starInk(...inkBasis),
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
