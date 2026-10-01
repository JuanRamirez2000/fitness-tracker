import { addDays, diffDays, weekdayOf, type LocalDate } from "@/lib/dates/calendar";

/** How many days either side of a scheduled day an injection still counts for it. */
export const SHOT_MATCH_WINDOW_DAYS = 3;

export type ShotStarState = "taken" | "scheduled" | "missed";

export interface ShotStar {
  /** Where the star is drawn: the actual date for a shot, the scheduled date otherwise. */
  date: LocalDate;
  state: ShotStarState;
  /** The scheduled day a taken shot fulfils; null for an extra shot no schedule claims. */
  scheduledFor: LocalDate | null;
}

export interface MatchShotsInput {
  programStart: LocalDate;
  /** 0 = Sunday ... 6 = Saturday, from profiles.shot_weekday. */
  shotWeekday: number;
  injectionDates: readonly LocalDate[];
  today: LocalDate;
  /** Last day to schedule for, normally the end of the heatmap window. */
  through: LocalDate;
}

/** Every date from the program start, up to `through`, that falls on the shot weekday. */
export function scheduledShotDates(
  programStart: LocalDate,
  shotWeekday: number,
  through: LocalDate,
): LocalDate[] {
  const dates: LocalDate[] = [];
  const firstOffset = (shotWeekday - weekdayOf(programStart) + 7) % 7;
  for (let d = addDays(programStart, firstOffset); d <= through; d = addDays(d, 7)) dates.push(d);
  return dates;
}

/**
 * Matches injections to the weekly schedule and decides which star each day gets.
 *
 * A late (or early) shot fulfils its scheduled day and the star moves to the ACTUAL date, so
 * the week shows one star, not a filled one plus a leftover hollow one. Schedule days are 7
 * apart and the window is only +-3, so windows never overlap and an injection can match at
 * most one scheduled day. If several fall in one window the nearest wins (earlier on a tie)
 * and the rest stay unmatched; every injection is still drawn as a filled star.
 */
export function matchShots(input: MatchShotsInput): ShotStar[] {
  const injections = [...new Set(input.injectionDates)].sort();
  const scheduledFor = new Map<LocalDate, LocalDate>();
  const unfulfilled: LocalDate[] = [];

  for (const scheduled of scheduledShotDates(input.programStart, input.shotWeekday, input.through)) {
    let best: LocalDate | undefined;
    let bestGap = Infinity;
    for (const date of injections) {
      const gap = Math.abs(diffDays(date, scheduled));
      // Strict < keeps the earlier date on a tie, because injections are sorted ascending.
      if (gap <= SHOT_MATCH_WINDOW_DAYS && gap < bestGap) {
        best = date;
        bestGap = gap;
      }
    }
    if (best === undefined) unfulfilled.push(scheduled);
    else scheduledFor.set(best, scheduled);
  }

  const stars: ShotStar[] = [
    ...injections.map((date) => ({
      date,
      state: "taken" as const,
      scheduledFor: scheduledFor.get(date) ?? null,
    })),
    // Today still counts as upcoming: the shot may simply not be logged yet.
    ...unfulfilled.map((date) => ({
      date,
      state: date < input.today ? ("missed" as const) : ("scheduled" as const),
      scheduledFor: null,
    })),
  ];
  return stars.sort((a, b) => (a.date < b.date ? -1 : 1));
}
