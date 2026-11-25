"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { use, useState, useTransition } from "react";
import { logMood } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { actionErrorMessage } from "@/components/workouts/action-error";
import {
  MOOD_SCALES,
  MOOD_SCALE_LABELS,
  MOOD_SCALE_WORDS,
  SORE_AREAS,
  SORE_AREAS_FROM,
  type MoodLog,
  type MoodScale,
  type SoreArea,
} from "@/lib/data/mood";
import { addDays, type LocalDate } from "@/lib/dates/calendar";

/** `?log=1` opens the modal on load: the target of the evening email's button. */
export const LOG_PARAM = "log";

type Day = "today" | "yesterday";

interface Answers {
  ratings: Record<MoodScale, number | null>;
  sore_areas: SoreArea[];
  sick: boolean;
  injured: boolean;
}

function answersFrom(log: MoodLog | undefined): Answers {
  return {
    ratings: Object.fromEntries(MOOD_SCALES.map((k) => [k, log?.[k] ?? null])) as Answers["ratings"],
    sore_areas: log?.sore_areas ?? [],
    sick: log?.sick ?? false,
    injured: log?.injured ?? false,
  };
}

/**
 * The header's "Log feel" button, with a dot until today is logged, and the modal behind it:
 * four rows of 1-5 taps, body areas once soreness is 3 or more, and sick/injured toggles.
 * `recent` is a promise (started on the server alongside the tab's rows) so the header never
 * waits on it; until it resolves the button renders without its dot (see the Suspense in
 * AppHeader).
 */
export function MoodLogButton({ recent, today }: { recent: Promise<MoodLog[]>; today: LocalDate }) {
  const logs = use(recent);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(() => searchParams.get(LOG_PARAM) === "1");
  const loggedToday = logs.some((l) => l.local_date === today);

  function close() {
    setOpen(false);
    // Drop ?log=1 so a reload doesn't reopen it.
    if (new URLSearchParams(window.location.search).has(LOG_PARAM)) {
      const params = new URLSearchParams(window.location.search);
      params.delete(LOG_PARAM);
      const query = params.toString();
      router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
    }
  }

  return (
    <>
      <MoodButton onClick={() => setOpen(true)} logged={loggedToday} />
      <Dialog open={open} onClose={close} labelledBy="mood-title" className="w-[min(460px,calc(100vw-16px))]">
        <MoodForm logs={logs} today={today} onDone={close} />
      </Dialog>
    </>
  );
}

/** The button alone, also the Suspense fallback before the logs arrive. */
export function MoodButton({ onClick, logged }: { onClick?: () => void; logged?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={logged ? "Edit today's mood log" : "Log how you feel today"}
      className="relative rounded-lg border border-border-strong px-2.5 py-[7px] text-[12.5px] text-muted-1 disabled:opacity-50 lg:px-3"
    >
      {/* An icon in the phone header; the words from lg up. */}
      <span className="lg:hidden">{logged ? "✎ ✓" : "✎"}</span>
      <span className="hidden lg:inline">{logged ? "Feel ✓" : "Log feel"}</span>
      {logged === false && (
        <span aria-hidden className="absolute -top-[3px] -right-[3px] h-2 w-2 rounded-full bg-accent ring-2 ring-bg" />
      )}
    </button>
  );
}

function MoodForm({ logs, today, onDone }: { logs: MoodLog[]; today: LocalDate; onDone: () => void }) {
  const byDate = new Map(logs.map((l) => [l.local_date, l]));
  const yesterday = addDays(today, -1);
  const [day, setDay] = useState<Day>("today");
  const [answers, setAnswers] = useState<Answers>(() => answersFrom(byDate.get(today)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const date = day === "today" ? today : yesterday;
  const existing = byDate.get(date);

  function switchDay(next: Day) {
    setDay(next);
    setAnswers(answersFrom(byDate.get(next === "today" ? today : yesterday)));
    setError(null);
  }

  function rate(scale: MoodScale, value: number) {
    // Tapping the chosen answer again clears it: every question is optional.
    setAnswers((a) => ({ ...a, ratings: { ...a.ratings, [scale]: a.ratings[scale] === value ? null : value } }));
  }

  function toggleArea(area: SoreArea) {
    setAnswers((a) => ({
      ...a,
      sore_areas: a.sore_areas.includes(area) ? a.sore_areas.filter((x) => x !== area) : [...a.sore_areas, area],
    }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await logMood({ local_date: date, ...answers.ratings, sore_areas: answers.sore_areas, sick: answers.sick, injured: answers.injured });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        onDone();
      } catch (err) {
        setError(actionErrorMessage(err, "Couldn't save. Try again."));
      }
    });
  }

  const showAreas = (answers.ratings.soreness ?? 0) >= SORE_AREAS_FROM;
  return (
    <form
      className="flex flex-col gap-5 px-5 py-5 md:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="mood-title" className="font-serif text-[18px]">How do you feel?</h2>
          <span className="text-[12px] text-muted-2">{existing ? "Logged. Change anything and save." : "Every question is optional."}</span>
        </div>
        <Segmented<Day>
          aria-label="Which day"
          value={day}
          onChange={switchDay}
          options={[
            { value: "today", label: "Today" },
            { value: "yesterday", label: "Yesterday" },
          ]}
        />
      </div>

      {MOOD_SCALES.map((scale) => (
        <fieldset key={scale} className="flex flex-col gap-2">
          <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{MOOD_SCALE_LABELS[scale]}</legend>
          <div role="radiogroup" aria-label={MOOD_SCALE_LABELS[scale]} className="grid grid-cols-5 gap-1.5">
            {MOOD_SCALE_WORDS[scale].map((word, i) => {
              const value = i + 1;
              const on = answers.ratings[scale] === value;
              return (
                <button
                  key={word}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => rate(scale, value)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 transition-colors ${
                    on ? "bg-accent text-bg" : "border border-field-border bg-raised text-muted-1 hover:text-ink"
                  }`}
                >
                  <span className="font-mono text-[14px] leading-none">{value}</span>
                  <span className={`text-[10.5px] leading-tight ${on ? "text-bg" : "text-muted-2"}`}>{word}</span>
                </button>
              );
            })}
          </div>
          {scale === "soreness" && showAreas && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Where it's sore">
              {SORE_AREAS.map((area) => {
                const on = answers.sore_areas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleArea(area)}
                    className={`rounded-full px-3 py-1 font-mono text-[10.5px] capitalize ${
                      on ? "bg-accent text-bg" : "border border-field-border bg-raised text-muted-2"
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      ))}

      <div className="flex flex-wrap gap-2">
        {(["sick", "injured"] as const).map((flag) => (
          <button
            key={flag}
            type="button"
            aria-pressed={answers[flag]}
            onClick={() => setAnswers((a) => ({ ...a, [flag]: !a[flag] }))}
            className={`rounded-lg px-3 py-2 text-[12.5px] ${
              answers[flag] ? "bg-bad text-bg" : "border border-field-border text-muted-1"
            }`}
          >
            {flag === "sick" ? "Sick" : "Injured"}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-[12px] text-bad">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
