"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { removeWorkout, sendWorkout, type WorkoutActionResult } from "@/app/actions";
import { openActivity } from "@/components/activity/open";
import { Button } from "@/components/ui/button";
import { SportBadge } from "@/components/ui/sport-badge";
import type { PlannedWorkout, PushStatus } from "@/lib/data/planned";
import { fmtDate } from "@/lib/dates/format";
import { SPORT_STYLE } from "@/lib/sport";
import type { DoneActivity } from "@/lib/workouts/done";
import { planLabel, plannedMinutes, sessionSport, type Suggestion } from "@/lib/workouts/plan";
import type { PlannerData } from "@/lib/workouts/service";
import { toPlannedSession } from "@/lib/workouts/session";
import { actionErrorMessage } from "./action-error";
import { PlanWorkoutDialog, type DialogStart } from "./plan-workout-dialog";
import { PlannedWorkoutDialog } from "./planned-workout-dialog";

/**
 * Next 7 days (Home and Training): the Garmin calendar's planned sessions (an app's plan such as
 * Runna, Garmin Coach, workouts made in Garmin Connect) and the tracker's own workouts, suggested
 * sessions for the sports nobody is coaching, and "Plan a workout". A planned session opens its
 * steps and notes (PlannedWorkoutDialog). Today also shows what's been done: a session with a
 * matching activity (same sport) is marked done and opens that activity's review instead, and
 * any other activity today shows on its own. Own workouts show whether they've reached the
 * Garmin calendar; while one is on its way the card polls /api/workouts/status and refreshes
 * when it lands.
 */


const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS: Record<PushStatus, { label: string; className: string }> = {
  draft: { label: "Not sent", className: "text-muted-2" },
  queued: { label: "Sending…", className: "text-accent" },
  sent: { label: "On your watch", className: "text-good" },
  failed: { label: "Send failed", className: "text-bad" },
  removing: { label: "Removing…", className: "text-muted-2" },
};
const POLL_MS = 5000;

function minutesLabel(seconds: number | null): string {
  return seconds ? `${Math.round(seconds / 60)} min` : "";
}

export function WeekPlanner({ planner, canEdit, done = [] }: { planner: PlannerData; canEdit: boolean; done?: DoneActivity[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogStart | null>(null);
  const [opened, setOpened] = useState<PlannedWorkout | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { plan } = planner;
  const own = planner.planned.filter((w) => w.source === "self");
  const inFlight = own.filter((w) => w.push_status === "queued" || w.push_status === "removing").map((w) => w.workout_uuid);
  const inFlightKey = inFlight.join(",");

  // Poll while something is on its way to (or off) the Garmin calendar; refresh when it lands.
  useEffect(() => {
    if (!canEdit || !inFlightKey) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/workouts/status?ids=${inFlightKey}`, { cache: "no-store" });
        if (!res.ok) return;
        const { workouts } = (await res.json()) as { workouts: { workout_uuid: string; push_status: PushStatus | null }[] };
        const settled = inFlightKey.split(",").some((id) => {
          const row = workouts.find((w) => w.workout_uuid === id);
          return !row || (row.push_status !== "queued" && row.push_status !== "removing");
        });
        if (settled) router.refresh();
      } catch {
        // Try again on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [canEdit, inFlightKey, router]);

  function act(run: () => Promise<WorkoutActionResult>) {
    startTransition(async () => {
      try {
        const result = await run();
        setMessage(result.message);
      } catch (err) {
        setMessage(actionErrorMessage(err, "That didn't work. Try again."));
      }
    });
  }

  // Today's planned sessions, each paired with the first unclaimed activity of its sport.
  const doneFor = new Map<string, DoneActivity>();
  const claimed = new Set<string>();
  for (const s of planner.planned.filter((w) => w.local_date === planner.today && !w.rest_day)) {
    const sport = sessionSport(toPlannedSession(s));
    const match = done.find((a) => !claimed.has(a.id) && a.sport !== null && a.sport === sport);
    if (match) {
      doneFor.set(s.workout_uuid, match);
      claimed.add(match.id);
    }
  }
  const extraDone = done.filter((a) => !claimed.has(a.id));
  const doneSports = new Set(done.map((a) => a.sport));
  const openSession = (uuid: string) => {
    const activity = doneFor.get(uuid);
    if (activity) return openActivity(activity.id);
    const row = planner.planned.find((w) => w.workout_uuid === uuid);
    if (row) setOpened(row);
  };

  const hours = (plan.weekMinutes / 60).toFixed(1);
  const over = plan.weekMinutes > plan.budgetMinutes;

  return (
    <div data-toc="Next 7 days" className="flex scroll-mt-28 flex-col gap-3.5 rounded-xl border border-border bg-card px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Next 7 days</span>
          <span className="text-[12.5px] text-muted-1">
            {plan.phase.label}
            {plan.phase.race && plan.phase.weeksToRace !== null ? ` · ${plan.phase.weeksToRace} weeks to ${plan.phase.race.name}` : ""}
            {plan.coached.length > 0 && <> · {planOwner(plan)}: {plan.coached.map((s) => SPORT_STYLE[s].label.toLowerCase()).join(", ")}</>}
          </span>
          <span className={`font-mono text-[10.5px] ${over ? "text-warn" : "text-muted-2"}`}>
            {hours} h planned of your {Math.round(plan.budgetMinutes / 60)} h a week
          </span>
        </div>
        {canEdit && <Button onClick={() => setDialog({})}>Plan a workout</Button>}
      </div>

      <ol className="grid grid-cols-1 gap-2 md:grid-cols-7">
        {plan.days.map((d) => {
          const ownToday = own.filter((w) => w.local_date === d.date);
          const isToday = d.date === planner.today;
          // A sport already done today needs no suggestion.
          const suggestions = plan.suggestions.filter((s) => s.date === d.date && !(isToday && doneSports.has(s.sport)));
          const extras = isToday ? extraDone : [];
          const w = (plan.weather ?? []).find((x) => x.date === d.date);
          return (
            <li key={d.date} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-raised px-2.5 py-2">
              <span className="font-mono text-[10px] text-muted-2">
                {d.date === planner.today ? "Today" : WEEKDAYS[d.weekday]} · {fmtDate(d.date)}
              </span>
              {w && (
                <span className={`font-mono text-[9.5px] ${w.problem ? "text-warn" : "text-muted-2"}`} title={w.problem ? `Not a great day to ride outside: ${w.problem}` : "Forecast"}>
                  {w.highF}°/{w.lowF}° · {w.rainChance}% rain · {w.windMph} mph
                </span>
              )}
              {d.restDay && <span className="text-[12px] text-muted-2">Rest day</span>}
              {d.coach.map((c) => (
                <CoachSession
                  key={c.workout_uuid}
                  name={c.name}
                  sport={sessionSport(c)}
                  minutes={plannedMinutes(c)}
                  keySession={c.key_workout}
                  label={planLabel(c)}
                  done={doneFor.get(c.workout_uuid) ?? null}
                  onOpen={() => openSession(c.workout_uuid)}
                />
              ))}
              {ownToday.map((w) => (
                <OwnWorkout
                  key={w.workout_uuid}
                  workout={w}
                  canEdit={canEdit}
                  pending={pending}
                  done={doneFor.get(w.workout_uuid) ?? null}
                  onOpen={() => openSession(w.workout_uuid)}
                  onSend={() => act(() => sendWorkout(w.workout_uuid))}
                  onRemove={() => act(() => removeWorkout(w.workout_uuid))}
                />
              ))}
              {extras.map((a) => (
                <DoneChip key={a.id} activity={a} />
              ))}
              {canEdit &&
                suggestions.map((s) => (
                  <SuggestionChip key={`${s.sport}-${s.kind}`} suggestion={s} onPick={() => setDialog({ suggestion: s })} />
                ))}
              {!d.restDay && d.coach.length === 0 && ownToday.length === 0 && suggestions.length === 0 && extras.length === 0 && (
                <span className="text-[12px] text-muted-3">Nothing planned</span>
              )}
            </li>
          );
        })}
      </ol>

      {message && (
        <p role="status" className="text-[12px] text-muted-1">
          {message}
        </p>
      )}

      {opened && <PlannedWorkoutDialog workout={opened} planner={planner} onClose={() => setOpened(null)} />}

      {dialog && (
        <PlanWorkoutDialog
          planner={planner}
          start={dialog}
          onClose={() => setDialog(null)}
          onDone={(result) => {
            setDialog(null);
            setMessage(result.message);
          }}
        />
      )}
    </div>
  );
}

/** Whose plans the coached sports follow: "Runna", "Runna + Garmin Coach", "Plan". */
function planOwner(plan: PlannerData["plan"]): string {
  const labels = [...new Set(plan.days.flatMap((d) => d.coach.map(planLabel)))].map((l) => (l === "Coach" ? "Garmin Coach" : l === "Calendar" ? "Garmin" : l));
  return labels.join(" + ") || "Plan";
}

/** "✓ Done · 32 min" under a session that has its activity. */
function DoneLine({ activity }: { activity: DoneActivity }) {
  return <span className="font-mono text-[9.5px] text-good">✓ Done · {Math.round(activity.durationS / 60)} min</span>;
}

/** The clickable part of a session: opens its steps, or once done, its activity's review. */
const OPEN_CLASS = "-mx-1 flex flex-col items-start gap-0.5 rounded-md px-1 py-0.5 text-left hover:bg-card focus-visible:bg-card";

function CoachSession({
  name,
  sport,
  minutes,
  keySession,
  label,
  done,
  onOpen,
}: {
  name: string | null;
  sport: ReturnType<typeof sessionSport>;
  minutes: string;
  keySession: boolean;
  label: string;
  done: DoneActivity | null;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className={OPEN_CLASS} title={done ? "Open the review of this workout" : "Show the steps"}>
      <span className="flex flex-wrap items-center gap-1.5">
        {sport && <SportBadge sport={sport} />}
        {keySession && <span className="font-mono text-[9px] uppercase text-warn">Key</span>}
      </span>
      <span className="text-[12.5px] leading-tight text-ink">{name ?? "Workout"}</span>
      <span className="font-mono text-[9.5px] text-muted-2">
        {label}
        {minutes && ` · ${minutes}`}
      </span>
      {done && <DoneLine activity={done} />}
    </button>
  );
}

/** An activity done today that no planned session claims; opens its review. */
function DoneChip({ activity }: { activity: DoneActivity }) {
  return (
    <button
      type="button"
      onClick={() => openActivity(activity.id)}
      title="Open the review of this workout"
      className="flex flex-col items-start gap-0.5 rounded-md border border-good/30 bg-good/6 px-2 py-1.5 text-left hover:border-good/60"
    >
      {activity.sport && <SportBadge sport={activity.sport} />}
      <span className="text-[12.5px] leading-tight text-ink">{activity.name ?? "Workout"}</span>
      <DoneLine activity={activity} />
    </button>
  );
}

function OwnWorkout({
  workout,
  canEdit,
  pending,
  done,
  onOpen,
  onSend,
  onRemove,
}: {
  workout: PlannedWorkout;
  canEdit: boolean;
  pending: boolean;
  done: DoneActivity | null;
  onOpen: () => void;
  onSend: () => void;
  onRemove: () => void;
}) {
  const sport = sessionSport(toPlannedSession(workout));
  const status = workout.push_status ? STATUS[workout.push_status] : null;
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-accent/30 bg-accent/6 px-2 py-1.5">
      <button type="button" onClick={onOpen} className={OPEN_CLASS} title={done ? "Open the review of this workout" : "Show the steps"}>
        {sport && <SportBadge sport={sport} />}
        <span className="text-[12.5px] leading-tight text-ink">{workout.name}</span>
        <span className="font-mono text-[9.5px] text-muted-2">
          Yours · {minutesLabel(workout.duration_s)}
          {status && <span className={status.className}> · {status.label}</span>}
        </span>
        {done && <DoneLine activity={done} />}
      </button>
      {workout.push_status === "failed" && workout.push_error && (
        <span className="text-[10.5px] text-bad" title={workout.push_error}>
          {workout.push_error.slice(0, 80)}
        </span>
      )}
      {canEdit && workout.push_status !== "removing" && (
        <span className="flex gap-2 pt-0.5">
          {(workout.push_status === "draft" || workout.push_status === "failed") && (
            <button type="button" disabled={pending} onClick={onSend} className="font-mono text-[10px] text-accent hover:underline disabled:opacity-60">
              {workout.push_status === "failed" ? "Retry" : "Send"}
            </button>
          )}
          {workout.push_status !== "queued" && (
            <button type="button" disabled={pending} onClick={onRemove} className="font-mono text-[10px] text-muted-2 hover:text-bad disabled:opacity-60">
              Remove
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function SuggestionChip({ suggestion, onPick }: { suggestion: Suggestion; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      title={suggestion.why}
      className="flex flex-col items-start gap-0.5 rounded-md border border-dashed border-border-strong px-2 py-1.5 text-left hover:border-accent"
    >
      <span className="font-mono text-[9.5px] text-accent">+ Suggested</span>
      <span className="text-[12px] leading-tight text-muted-1">
        {SPORT_STYLE[suggestion.sport].glyph} {suggestionTitle(suggestion)}
      </span>
      <span className="font-mono text-[9.5px] text-muted-2">{suggestion.minutes} min</span>
    </button>
  );
}

function suggestionTitle(s: Suggestion): string {
  if (s.sport === "swim") return "Swim";
  const kind = s.kind === "auto" ? "" : `${s.kind[0].toUpperCase()}${s.kind.slice(1)} `;
  return `${kind}${SPORT_STYLE[s.sport].label.toLowerCase()}`;
}
