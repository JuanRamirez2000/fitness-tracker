import type { DashboardData } from "@/lib/dashboard/types";
import { sportOf, type ActiveSport } from "@/lib/sport";

/** One of today's activities, cut down for the Next 7 days card (a client component). */
export interface DoneActivity {
  id: string;
  sport: ActiveSport | null;
  name: string | null;
  durationS: number;
}

/** Today's activities, oldest first, for the Next 7 days card: done sessions open their review. */
export function doneToday(data: Pick<DashboardData, "activities" | "today">): DoneActivity[] {
  return data.activities
    .filter((a) => a.local_date === data.today)
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((a) => {
      const sport = sportOf(a.activity_type);
      return { id: a.id, sport: sport === "other" ? null : sport, name: a.name, durationS: a.moving_duration_s ?? a.duration_s };
    });
}
