"use client";

import { useId } from "react";
import { Dialog } from "@/components/ui/dialog";
import { SportBadge } from "@/components/ui/sport-badge";
import type { PlannedWorkout } from "@/lib/data/planned";
import { fmtDate, weekdayName } from "@/lib/dates/format";
import { zonesFor } from "@/lib/workouts/build";
import { planLabel, plannedMinutes, sessionSport } from "@/lib/workouts/plan";
import { planSteps, type StepRow } from "@/lib/workouts/plan-steps";
import type { PlannerData } from "@/lib/workouts/service";
import { toPlannedSession } from "@/lib/workouts/session";

/**
 * One planned session from the Next 7 days card: who planned it, its notes (Runna's text, or
 * what the tracker's own workout is for) and its steps (lib/workouts/plan-steps.ts). Garmin
 * Coach sessions and rows imported before steps were kept show their notes alone.
 */
export function PlannedWorkoutDialog({ workout, planner, onClose }: { workout: PlannedWorkout; planner: PlannerData; onClose: () => void }) {
  const titleId = useId();
  const session = toPlannedSession(workout);
  const sport = sessionSport(session);
  const minutes = plannedMinutes(session);
  const steps = planSteps(workout, {
    ftpW: planner.ftp.watts,
    hrZones: sport ? zonesFor(planner, sport) : null,
    pool: planner.settings.pool,
  });
  const day = workout.local_date === planner.today ? "Today" : weekdayName(workout.local_date);

  return (
    <Dialog open onClose={onClose} labelledBy={titleId} className="w-[min(560px,calc(100vw-24px))]">
      <div className="flex max-h-[calc(100dvh-48px)] flex-col">
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-1.5">
                {sport && <SportBadge sport={sport} />}
                {workout.key_workout && <span className="font-mono text-[9px] uppercase text-warn">Key</span>}
              </span>
              <h2 id={titleId} className="font-serif text-[20px] leading-tight">
                {workout.name ?? "Workout"}
              </h2>
              <span className="font-mono text-[10.5px] text-muted-2">
                {[`${day}, ${fmtDate(workout.local_date)}`, minutes, planLabel(session), workout.plan_name].filter(Boolean).join(" · ")}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-md px-2 py-1 text-[18px] leading-none text-muted-2 hover:text-ink">
              ×
            </button>
          </div>

          {workout.description && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Notes</span>
              <p className="text-[13px] leading-[1.55] whitespace-pre-line text-muted-1">{workout.description}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Steps</span>
            {steps.length === 0 ? (
              <p className="text-[12.5px] text-muted-2">
                {workout.provider === "Garmin Coach" ? "Garmin Coach sends its steps to the watch only." : "No steps stored for this one yet. They come with the next Garmin import."}
              </p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {steps.map((row, i) =>
                  row.kind === "repeat" ? (
                    <li key={i} className="flex flex-col gap-1.5 rounded-lg border border-border px-2.5 py-2">
                      <span className="font-mono text-[10.5px] text-accent">{row.times}×</span>
                      <ol className="flex flex-col gap-1.5">
                        {row.steps.map((s, j) => (
                          <StepLine key={j} step={s} />
                        ))}
                      </ol>
                    </li>
                  ) : (
                    <StepLine key={i} step={row} />
                  ),
                )}
              </ol>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function StepLine({ step }: { step: StepRow }) {
  return (
    <li className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-md bg-raised px-2.5 py-1.5">
      <span className="text-[12.5px] text-ink">{step.label}</span>
      <span className="flex flex-wrap gap-x-2 font-mono text-[11.5px] text-ink">
        {step.length && <span>{step.length}</span>}
        {step.target && <span className="text-accent">{step.target}</span>}
      </span>
      {step.note && <span className="col-start-2 text-[12px] leading-snug text-muted-1">{step.note}</span>}
    </li>
  );
}
