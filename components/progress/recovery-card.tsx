import { ChartCard, ChartEmpty } from "@/components/charts/chart-card";
import { Stat, StatRow } from "@/components/charts/parts";
import type { WeekRecovery } from "@/lib/progress/build";
import type { ProgressWeek } from "@/lib/progress/week";
import { DayGrid, EMPTY, EMPTY_FUTURE, type DayCell } from "./day-grid";

const HELP =
  "Each morning of the week: Garmin's training readiness (0–100), the night's sleep score, your HRV status against your own normal range (OK = balanced, Off = unbalanced, Low = below it) and Body Battery on waking. A run of low mornings after a hard block is the cue to back off; steady mornings while training goes up mean the load is landing well.";

const score = (value: number | null, future: boolean, good: number, ok: number): DayCell =>
  value === null ? (future ? EMPTY_FUTURE : EMPTY) : { text: value, className: value >= good ? "text-good" : value >= ok ? "text-ink" : "text-warn" };

const HRV: Record<string, DayCell> = {
  BALANCED: { text: "OK", className: "text-good", title: "Balanced" },
  UNBALANCED: { text: "Off", className: "text-warn", title: "Unbalanced" },
  LOW: { text: "Low", className: "text-bad", title: "Low" },
  POOR: { text: "Low", className: "text-bad", title: "Poor" },
};

/** The week's mornings: readiness, sleep, HRV status and Body Battery, day by day. */
export function RecoveryCard({ recovery, week }: { recovery: WeekRecovery | null; week: ProgressWeek }) {
  const title = "How you recovered";
  const subtitle = "Each morning of the week";
  if (!recovery) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>no readiness or sleep this week</ChartEmpty>
      </ChartCard>
    );
  }
  const { days } = recovery;
  return (
    <ChartCard help={HELP} title={title} subtitle={subtitle}>
      <StatRow>
        {recovery.avgReadiness !== null && <Stat label="Readiness · avg" value={Math.round(recovery.avgReadiness)} />}
        {recovery.avgSleep !== null && <Stat label="Sleep score · avg" value={Math.round(recovery.avgSleep)} />}
        {recovery.hrvDays > 0 && <Stat label="HRV balanced" value={recovery.balanced} unit={`of ${recovery.hrvDays} days`} />}
      </StatRow>
      <DayGrid
        days={week.days}
        today={week.current ? week.through : ""}
        caption="Readiness, sleep score, HRV status and morning Body Battery for each day of the week"
        rows={[
          { label: "Readiness", cells: days.map((d) => score(d.readiness, d.future, 75, 50)) },
          { label: "Sleep", cells: days.map((d) => score(d.sleep, d.future, 80, 60)) },
          { label: "HRV", cells: days.map((d) => (d.hrv ? (HRV[d.hrv.toUpperCase()] ?? { text: d.hrv.slice(0, 3), title: d.hrv }) : d.future ? EMPTY_FUTURE : EMPTY)) },
          { label: "Battery", cells: days.map((d) => score(d.battery, d.future, 75, 40)) },
        ]}
      />
    </ChartCard>
  );
}
