"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActivityType } from "@/lib/data/activity-types";
import { deleteActivity, fetchActivities, insertActivity } from "@/lib/data/activities";
import { fetchSteps, upsertSteps } from "@/lib/data/daily-metrics";
import { deleteInjection, fetchInjections, upsertInjection } from "@/lib/data/injections";
import { fetchNutritionDays, TRACKING_STATUSES, upsertNutritionDay, type TrackingStatus } from "@/lib/data/nutrition-days";
import { fetchWeighIns, insertWeighIn, updateWeighIn } from "@/lib/data/weigh-ins";
import type { LocalDate } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { defaultMeasuredAt } from "@/lib/dates/timezone";
import { createClient } from "@/lib/supabase/browser";

const STATUS_LABEL: Record<TrackingStatus, string> = {
  accurate: "Accurate",
  uncertain: "May be off",
  missed: "Missed",
};

interface QuickLogSheetProps {
  onClose: () => void;
  userId: string;
  timezone: string;
  today: LocalDate;
  activityTypes: ActivityType[];
  stepsGoal: number;
}

/**
 * Frame 2C: one form across five tables (weight, steps, calorie status, activities, shot),
 * all for `today`, target under 15 seconds. Loads whatever is already logged for today so
 * reopening it edits rather than duplicates — weigh-ins in particular has no natural upsert
 * key, so this looks up today's own earliest row first, matching how the table tab does.
 *
 * No `open` prop: QuickLogLauncher only mounts this while open, so `loading`/`error`'s own
 * useState initial values do the "fresh state each time it opens" work, rather than this
 * effect resetting them itself (a real anti-pattern: setState synchronously inside an effect,
 * cascading a render — same fix as entry-form-dialog.tsx, a different way to get there).
 */
export function QuickLogSheet({ onClose, userId, timezone, today, activityTypes, stepsGoal }: QuickLogSheetProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weighInId, setWeighInId] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [steps, setSteps] = useState("");
  const [calStatus, setCalStatus] = useState<TrackingStatus>("accurate");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [activityNotes, setActivityNotes] = useState("");
  const [existingActivityIds, setExistingActivityIds] = useState<string[]>([]);
  const [shotOn, setShotOn] = useState(false);
  const [shotDate, setShotDate] = useState<LocalDate>(today);
  const [existingInjectionId, setExistingInjectionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const window = { from: today, to: today };
    Promise.all([
      fetchWeighIns(supabase, userId, window),
      fetchSteps(supabase, userId, window),
      fetchNutritionDays(supabase, userId, window),
      fetchActivities(supabase, userId, window),
      fetchInjections(supabase, userId, window),
    ])
      .then(([weighIns, stepsRows, nutritionRows, activityRows, injectionRows]) => {
        if (cancelled) return;
        setWeighInId(weighIns[0]?.id ?? null);
        setWeight(weighIns[0] ? String(weighIns[0].weight_lb) : "");
        setSteps(stepsRows[0] ? String(stepsRows[0].value) : "");
        setCalStatus(nutritionRows[0]?.tracking_status ?? "accurate");
        setSelectedTypes(activityRows.map((a) => a.activity_type));
        setActivityNotes(activityRows.find((a) => a.notes)?.notes ?? "");
        setExistingActivityIds(activityRows.map((a) => a.id));
        setShotOn(injectionRows.length > 0);
        setShotDate(injectionRows[0]?.local_date ?? today);
        setExistingInjectionId(injectionRows[0]?.id ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load today's entry.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, today]);

  function toggleType(key: string) {
    setSelectedTypes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const weightNum = weight.trim() === "" ? null : Number(weight);
      if (weightNum !== null && !Number.isNaN(weightNum)) {
        if (weighInId) await updateWeighIn(supabase, weighInId, { local_date: today, weight_lb: weightNum });
        else await insertWeighIn(supabase, userId, { local_date: today, weight_lb: weightNum }, defaultMeasuredAt(today, timezone));
      }

      const stepsNum = steps.trim() === "" ? null : Number(steps);
      if (stepsNum !== null && !Number.isNaN(stepsNum)) {
        await upsertSteps(supabase, userId, { local_date: today, value: stepsNum });
      }

      await upsertNutritionDay(supabase, userId, { local_date: today, tracking_status: calStatus, calories_kcal: null, notes: null });

      // Simplest way to keep today's activity rows in sync with the chip selection: clear
      // and re-insert, rather than diffing — there are at most a handful a day.
      for (const id of existingActivityIds) await deleteActivity(supabase, id);
      for (const key of selectedTypes) {
        await insertActivity(supabase, userId, { local_date: today, activity_type: key, duration_min: null, notes: activityNotes.trim() || null });
      }

      if (shotOn) await upsertInjection(supabase, userId, { local_date: shotDate, dose_mg: null, notes: null });
      else if (existingInjectionId) await deleteInjection(supabase, existingInjectionId);

      router.refresh();
      onClose();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-log-title"
        className="relative mx-auto flex w-full max-w-[420px] flex-col gap-[15px] rounded-t-[20px] border-t border-border-strong bg-card px-5 pb-[22px] pt-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
      >
        <div className="mx-auto h-1 w-[38px] rounded-full bg-field-border" />

        <div className="flex items-center justify-between">
          <span className="w-6" />
          <div className="flex flex-col items-center gap-0.5">
            <span id="quick-log-title" className="font-serif text-[17px]">
              {fmtDate(today)}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted-2">Today</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-6 text-right text-[14px] text-muted-2">
            {"×"}
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-[12px] text-muted-2">{"Loading…"}</p>
        ) : (
          <>
            <div className="flex gap-[10px]">
              <div className="flex flex-[1.3] flex-col gap-[7px]">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">Weight</span>
                <div className="flex h-[54px] items-baseline justify-center gap-1.5 rounded-[10px] border border-field-border bg-inset">
                  <input
                    type="number"
                    step={0.1}
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="—"
                    className="w-20 bg-transparent text-center text-[27px] font-[450] text-ink outline-none"
                  />
                  <span className="text-[12px] text-muted-2">lb</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-[7px]">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">Steps</span>
                <div className="flex h-[54px] items-center justify-center gap-1.5 rounded-[10px] border border-field-border bg-inset">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    placeholder="—"
                    className="w-16 bg-transparent text-center text-[21px] font-[450] text-ink outline-none"
                  />
                  {steps !== "" && Number(steps) >= stepsGoal && <span className="text-[11px] text-good">10k {"✓"}</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[7px]">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">Calories</span>
                <span className="font-mono text-[9px] text-muted-3">kcal field arrives in V1</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 rounded-[10px] border border-field-border bg-inset p-1">
                {TRACKING_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setCalStatus(status)}
                    className={`rounded-[7px] py-2 text-[11.5px] ${calStatus === status ? "bg-raised text-ink" : "text-muted-3"}`}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-[7px]">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">Activity</span>
              <div className="flex flex-wrap gap-1.5">
                {activityTypes.map((type) => {
                  const on = selectedTypes.includes(type.key);
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => toggleType(type.key)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] ${
                        on ? "border-accent/40 bg-raised text-ink" : "border-field-border bg-inset text-muted-2"
                      }`}
                    >
                      <span className="inline-block size-[7px] shrink-0 rounded-[2px]" style={{ background: type.color }} />
                      {type.label}
                    </button>
                  );
                })}
              </div>
              {selectedTypes.length > 0 && (
                <input
                  value={activityNotes}
                  onChange={(e) => setActivityNotes(e.target.value)}
                  placeholder="Notes (e.g. Squat 3×5 @ 185)"
                  className="rounded-[9px] border border-field-border bg-inset px-3 py-2.5 text-[12px] text-ink outline-none focus:border-accent"
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-2 rounded-[10px] border border-field-border bg-inset px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] text-accent">{"★"}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13.5px]">{shotOn ? "Shot taken" : "Shot not taken"}</span>
                  {shotOn && (
                    <label className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-2">
                      <span>Date</span>
                      <input
                        type="date"
                        value={shotDate}
                        onChange={(e) => setShotDate(e.target.value)}
                        className="rounded border border-field-border bg-transparent px-1 text-ink"
                      />
                    </label>
                  )}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={shotOn}
                onClick={() => {
                  setShotOn((v) => !v);
                  if (!shotOn) setShotDate(today);
                }}
                className={`flex h-6 w-[42px] shrink-0 items-center rounded-full px-0.5 transition-colors ${shotOn ? "justify-end bg-accent" : "justify-start bg-field-border"}`}
              >
                <span className="size-[18px] rounded-full bg-bg" />
              </button>
            </div>

            {error && <p className="text-[12px] text-bad">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="h-12 flex-1 rounded-[11px] bg-accent text-[15px] font-medium text-bg disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <span className="w-[70px] font-mono text-[10px] leading-[1.35] text-muted-2">{"≈14s to log"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
