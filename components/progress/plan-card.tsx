import { ChartCard } from "@/components/charts/chart-card";
import { Stat, StatRow } from "@/components/charts/parts";
import { typeLabel } from "@/lib/activity/view";
import type { Activity } from "@/lib/data/activities";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import type { DayPlan, PlanItem, PlanVsDone } from "@/lib/progress/build";
import type { ProgressWeek } from "@/lib/progress/week";
import { sportOf } from "@/lib/sport";
import { planLabel } from "@/lib/workouts/plan";
import { PlanDays, type PlanDayView, type PlanLine } from "./plan-days";

const HELP =
  "Each day's planned sessions (your Runna or Garmin Coach plan and the workouts you built here) against what you actually did. Done: that sport that day. Done another day: the same sport within two days. Swapped: something else that day. Missed: nothing that day. Activities that weren't on the plan show as extras, dashed. Click any activity to open it.";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const minutes = (a: Activity) => Math.round((a.moving_duration_s ?? a.duration_s) / 60);
const hours = (min: number) => (min / 60).toFixed(1);
const activityTitle = (a: Activity) => a.name ?? typeLabel(a.activity_type);
const sportOrNull = (a: Activity) => {
  const s = sportOf(a.activity_type);
  return s === "other" ? null : s;
};

function status(item: PlanItem): PlanLine["status"] {
  const a = item.activity;
  switch (item.status) {
    case "done":
      return { text: `✓ Done · ${minutes(a!)} min`, className: "text-good" };
    case "moved":
      return { text: `✓ Done ${WEEKDAY[new Date(`${a!.local_date}T12:00:00Z`).getUTCDay()]}`, className: "text-good" };
    case "swapped":
      return { text: `↔ ${typeLabel(a!.activity_type)} instead`, className: "text-warn" };
    case "missed":
      return { text: "✗ Missed", className: "text-bad" };
    case "today":
      return { text: "Today", className: "text-accent" };
    case "upcoming":
      return null;
  }
}

/** A day with nothing on it: a rest day, a gap in the plan, or (in a week with no plan) a day off. */
function emptyText(d: DayPlan, week: ProgressWeek, hasPlan: boolean): string | null {
  if (d.restDay) return "Rest day";
  if (hasPlan) return "Nothing planned";
  return d.date > week.through ? null : "No workout";
}

function dayView(d: DayPlan, week: ProgressWeek, hasPlan: boolean): PlanDayView {
  const today = week.current && d.date === week.through;
  const lines: PlanLine[] = [
    ...d.planned.map((item) => ({
      key: item.session.workout_uuid,
      sport: item.sport,
      title: item.session.name ?? "Workout",
      meta: `${planLabel(item.session)}${item.session.duration_s ? ` · ${item.session.plan_name === "Runna" ? "~" : ""}${Math.round(item.session.duration_s / 60)} min` : ""}`,
      status: status(item),
      // A moved session opens from the day it was done.
      activityId: item.status === "moved" ? null : (item.activity?.id ?? null),
    })),
    ...d.movedIn.map(({ activity, from }) => ({
      key: activity.id,
      sport: sportOrNull(activity),
      title: activityTitle(activity),
      meta: `${WEEKDAY[new Date(`${from}T12:00:00Z`).getUTCDay()]}'s session · ${minutes(activity)} min`,
      status: null,
      activityId: activity.id,
      quiet: true,
    })),
    ...d.extras.map((a) => ({
      key: a.id,
      sport: sportOrNull(a),
      title: activityTitle(a),
      meta: `Extra · ${minutes(a)} min`,
      status: null,
      activityId: a.id,
      quiet: true,
    })),
  ];
  return {
    date: d.date,
    heading: today ? `Today · ${fmtDate(d.date)}` : fmtPointTitle(d.date),
    today,
    lines,
    empty: lines.length ? null : emptyText(d, week, hasPlan),
  };
}

/** Planned sessions against what was done, Monday to Sunday. */
export function PlanCard({ plan, week }: { plan: PlanVsDone; week: ProgressWeek }) {
  const off = [plan.swapped && `${plan.swapped} swapped`, plan.missed && `${plan.missed} missed`].filter(Boolean).join(", ");
  return (
    <ChartCard
      help={HELP}
      title="Plan vs done"
      subtitle={plan.hasPlan ? "Your training plan and own workouts, against what you did" : "Nothing was planned this week; here's what you did"}
    >
      <StatRow>
        {plan.hasPlan && <Stat label="Sessions done" value={plan.done} unit={`of ${plan.due}${week.current ? " so far" : ""}`} note={off || undefined} />}
        <Stat label="Time" value={hours(plan.doneMinutes)} unit={plan.hasPlan ? `of ${hours(plan.plannedMinutes)} h planned` : "h"} />
        {plan.extras > 0 && <Stat label="Extras" value={plan.extras} unit={plan.extras === 1 ? "session" : "sessions"} />}
      </StatRow>
      <PlanDays days={plan.days.map((d) => dayView(d, week, plan.hasPlan))} />
    </ChartCard>
  );
}
