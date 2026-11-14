"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { planWorkout, saveWorkoutSettings, type WorkoutActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { inputClass, labelClass } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { fmtDate } from "@/lib/dates/format";
import { SPORTS, SPORT_STYLE, type ActiveSport } from "@/lib/sport";
import { TEMPLATES, buildContext, buildWorkout, kindsFor, resolveKind, zonesFor } from "@/lib/workouts/build";
import { fmtDuration, stepLine, zoneOf, type DescribeContext } from "@/lib/workouts/describe";
import { warningsFor, type Suggestion } from "@/lib/workouts/plan";
import type { PlannerData } from "@/lib/workouts/service";
import { SWIM_STAGES } from "@/lib/workouts/settings";
import { stepSeconds } from "@/lib/workouts/steps";
import { EFFORT_LABELS, type Block, type Effort, type Step } from "@/lib/workouts/types";
import { actionErrorMessage } from "./action-error";

/**
 * "Plan a workout": sport, day, type, effort and length, with a live preview built in the
 * browser by the same builder the server uses (lib/workouts/build.ts). Save keeps it on the
 * plan; Send to watch also queues it for the Garmin calendar (scripts/garmin/push_workout.py).
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ZONE_BG = ["bg-muted-3/50", "bg-z1", "bg-z2", "bg-z3", "bg-z4", "bg-z5"] as const;

export interface DialogStart {
  sport?: ActiveSport;
  suggestion?: Suggestion;
}

export function PlanWorkoutDialog({
  planner,
  start,
  onClose,
  onDone,
}: {
  planner: PlannerData;
  start: DialogStart;
  onClose: () => void;
  onDone: (result: WorkoutActionResult) => void;
}) {
  const titleId = useId();
  const firstUncoached = SPORTS.find((s) => !planner.plan.coached.includes(s)) ?? "run";
  const initialSport = start.suggestion?.sport ?? start.sport ?? firstUncoached;
  const suggestionFor = (sport: ActiveSport) => planner.plan.suggestions.find((s) => s.sport === sport);
  const seed = start.suggestion ?? suggestionFor(initialSport);

  const [sport, setSport] = useState<ActiveSport>(initialSport);
  const [date, setDate] = useState(seed?.date ?? planner.today);
  const [kind, setKind] = useState(seed?.kind ?? "auto");
  const [effort, setEffort] = useState<Effort>(seed?.effort ?? 2);
  const [minutes, setMinutes] = useState(seed?.minutes ?? 30);
  const [swimStage, setSwimStage] = useState(planner.settings.swim_stage);
  const [ftpInput, setFtpInput] = useState(planner.settings.ftp_w ? String(planner.settings.ftp_w) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ftpW = ftpInput ? Number(ftpInput) || null : planner.ftp.watts;
  const ctx = useMemo(
    () => buildContext({ settings: { ...planner.settings, swim_stage: swimStage }, ftp: { ...planner.ftp, watts: ftpW } }),
    [planner, swimStage, ftpW],
  );
  const kinds = kindsFor(sport, ctx);
  const info = resolveKind(sport, kind, effort, ctx);
  const [minM, maxM] = info.minutes;
  const shownMinutes = Math.min(maxM, Math.max(minM, minutes));
  const workout = buildWorkout({ sport, kind, effort, minutes: shownMinutes }, ctx);
  const warnings = warningsFor({ sport, date, effort, minutes: Math.round(workout.seconds / 60) }, planner.plan);
  const describe: DescribeContext = { ftpW, hrZones: zonesFor(planner, sport), pool: planner.settings.pool };
  const suggested = suggestionFor(sport);

  function pickSport(next: ActiveSport) {
    setSport(next);
    const s = suggestionFor(next);
    setKind(s?.kind ?? "auto");
    if (s) {
      setDate(s.date);
      setEffort(s.effort);
      setMinutes(s.minutes);
    } else {
      setMinutes(TEMPLATES[next].kinds[0].minutes[2]);
    }
  }

  function pickKind(next: string) {
    setKind(next);
    const k = kinds.find((x) => x.key === next);
    if (k) setMinutes(k.minutes[2]);
  }

  function saveSetting(patch: { ftp_w?: number | null; swim_stage?: number }) {
    startTransition(async () => {
      try {
        await saveWorkoutSettings(patch);
      } catch (err) {
        setError(actionErrorMessage(err, "Couldn't save that setting."));
      }
    });
  }

  function submit(send: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await planWorkout({ sport, date, kind: workout.kind, effort, minutes: shownMinutes }, send);
        if (result.ok) onDone(result);
        else setError(result.message);
      } catch (err) {
        setError(actionErrorMessage(err, "Couldn't save the workout. Try again."));
      }
    });
  }

  return (
    <Dialog open onClose={onClose} labelledBy={titleId} className="w-[min(640px,calc(100vw-24px))]">
      <div className="flex max-h-[calc(100dvh-48px)] flex-col">
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5 md:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={titleId} className="font-serif text-[20px]">Plan a workout</h2>
            <span className="font-mono text-[10px] text-muted-2">
              {planner.plan.phase.label}
              {planner.plan.phase.weeksToRace !== null && planner.plan.phase.race
                ? ` · ${planner.plan.phase.weeksToRace} wk to ${planner.plan.phase.race.name.replace(/^Cal Tri /, "")}`
                : ""}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Sport</span>
            <Segmented
              aria-label="Sport"
              value={sport}
              onChange={pickSport}
              options={SPORTS.map((s) => ({
                value: s,
                label: `${SPORT_STYLE[s].glyph} ${SPORT_STYLE[s].label}${planner.plan.coached.includes(s) ? " · Coach" : ""}`,
              }))}
            />
            {planner.plan.coached.includes(sport) && (
              <p className="text-[11.5px] text-muted-2">Your Garmin Coach plan covers this sport. An extra session here adds to its load.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Day</span>
            <div role="radiogroup" aria-label="Day" className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {planner.plan.days.map((d) => {
                const on = d.date === date;
                const star = suggested?.date === d.date;
                const coach = d.coach[0];
                return (
                  <button
                    key={d.date}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setDate(d.date)}
                    className={`flex min-w-0 flex-col items-start gap-0.5 overflow-hidden rounded-lg border px-2 py-1.5 text-left ${
                      on ? "border-accent bg-accent/12" : "border-field-border bg-inset hover:border-border-strong"
                    }`}
                  >
                    <span className="font-mono text-[10.5px] text-ink">
                      {d.date === planner.today ? "Today" : WEEKDAYS[d.weekday]} {Number(d.date.slice(8))}
                      {star && <span className="text-accent" title="Suggested day"> ★</span>}
                    </span>
                    <span className={`max-w-full truncate font-mono text-[9px] ${d.keyDay ? "text-warn" : "text-muted-2"}`} title={coach?.name ?? undefined}>
                      {d.restDay ? "Rest" : coach ? `${d.keyDay ? "Key · " : ""}${coach.name ?? "Coach"}` : "Free"}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-[11.5px] text-muted-2">
              Later:
              <input
                type="date"
                min={planner.today}
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className={`${inputClass} w-auto px-2 py-1 text-[12px]`}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Type</span>
            <div role="radiogroup" aria-label="Workout type" className="flex flex-wrap gap-1.5">
              {[{ key: "auto", label: "Auto", blurb: "Picked from the effort" }, ...kinds].map((k) => {
                const on = kind === k.key || (kind !== "auto" && !kinds.some((x) => x.key === kind) && k.key === "auto");
                return (
                  <button
                    key={k.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    title={k.blurb}
                    onClick={() => pickKind(k.key)}
                    className={`rounded-full px-3 py-1.5 font-mono text-[10.5px] ${
                      on ? "bg-accent text-bg" : "border border-field-border bg-raised text-muted-2 hover:text-ink"
                    }`}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] text-muted-2">{info.blurb}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>
                Effort · <span className="text-ink">{EFFORT_LABELS[effort]}</span>
              </span>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={effort}
                onChange={(e) => setEffort(Number(e.target.value) as Effort)}
                className="accent-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>
                Length · <span className="text-ink">{shownMinutes} min</span>
              </span>
              <input
                type="range"
                min={minM}
                max={maxM}
                step={5}
                value={shownMinutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
          </div>

          {sport === "swim" && (
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Where your swimming is</span>
              <select
                value={swimStage}
                onChange={(e) => {
                  const stage = Number(e.target.value);
                  setSwimStage(stage);
                  setKind("auto");
                  saveSetting({ swim_stage: stage });
                }}
                className={inputClass}
              >
                {SWIM_STAGES.map((s) => (
                  <option key={s.stage} value={s.stage}>{s.label}</option>
                ))}
              </select>
            </label>
          )}

          {sport === "ride" && (
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>FTP for the power targets</span>
              <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={50}
                  max={500}
                  placeholder={planner.ftp.watts ? String(planner.ftp.watts) : "W"}
                  value={ftpInput}
                  onChange={(e) => setFtpInput(e.target.value)}
                  onBlur={() => {
                    const value = ftpInput ? Math.round(Number(ftpInput)) : null;
                    if (value === null || (value >= 50 && value <= 500)) saveSetting({ ftp_w: value });
                  }}
                  className={inputClass}
                />
                <span className="text-[11.5px] text-muted-2">
                  {ftpInput
                    ? "Your own setting. Clear it to use the estimate."
                    : planner.ftp.source === "estimate"
                      ? `Estimated: 95% of your best 20 minutes (${planner.best20MinW} W). ERG holds these watts.`
                      : planner.ftp.source === "garmin"
                        ? "Garmin's FTP. A ramp test on the Kickr would make this more accurate."
                        : "No FTP yet: targets use heart rate."}
                </span>
              </div>
            </label>
          )}

          <Preview blocks={workout.blocks} sport={sport} describe={describe} ctxPace={TEMPLATES[sport].pace?.(ctx)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-serif text-[17px]">{workout.name}</span>
              <span className="font-mono text-[10.5px] text-muted-2">
                ≈ {fmtDuration(Math.round(workout.seconds / 60) * 60)} · {WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}, {fmtDate(date)}
              </span>
            </div>
            <p className="text-[12.5px] leading-[1.5] text-muted-1">{workout.why}</p>
          </Preview>

          {warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-warn/40 bg-warn/8 px-3 py-2 text-[12px] text-warn">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-divider px-5 py-3.5 md:px-6">
          {error && <span className="mr-auto text-[12px] text-bad">{error}</span>}
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={pending}>Save to plan</Button>
          <Button onClick={() => submit(true)} disabled={pending}>{pending ? "Saving…" : "Send to watch"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** The workout as a strip of blocks (width = time, color = zone) over its step list. */
function Preview({
  blocks,
  sport,
  describe,
  ctxPace,
  children,
}: {
  blocks: Block[];
  sport: ActiveSport;
  describe: DescribeContext;
  ctxPace?: { secondsPerLength: number; secondsPerLap: number };
  children: React.ReactNode;
}) {
  const flat: Step[] = blocks.flatMap((b) => (b.kind === "repeat" ? Array.from({ length: b.times }, () => b.steps).flat() : [b]));
  const total = flat.reduce((sum, s) => sum + stepSeconds(s, ctxPace), 0) || 1;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-raised px-4 py-3.5">
      {children}
      <div className="flex h-10 items-end gap-px overflow-hidden rounded-md" aria-hidden>
        {flat.map((s, i) => {
          const zone = zoneOf(s);
          const height = s.kind === "rest" ? 12 : zone ? 25 + zone * 15 : s.kind === "work" ? 60 : 35;
          return (
            <div
              key={i}
              className={`${sport === "swim" && s.kind !== "rest" ? "bg-sport-swim/70" : ZONE_BG[zone]} min-w-[2px] rounded-t-[2px]`}
              style={{ width: `${(stepSeconds(s, ctxPace) / total) * 100}%`, height: `${height}%` }}
            />
          );
        })}
      </div>
      <ol className="flex flex-col gap-1 font-mono text-[11px] leading-[1.45] text-muted-1">
        {blocks.map((b, i) =>
          b.kind === "repeat" ? (
            <li key={i} className="flex flex-col gap-0.5">
              <span className="text-ink">{b.times}×</span>
              <ol className="flex flex-col gap-0.5 border-l border-border-strong pl-3">
                {b.steps.map((s, j) => (
                  <li key={j}>{stepLine(s, describe)}</li>
                ))}
              </ol>
            </li>
          ) : (
            <li key={i}>{stepLine(b, describe)}</li>
          ),
        )}
      </ol>
    </div>
  );
}
