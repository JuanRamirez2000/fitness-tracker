"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Stat } from "@/components/charts/parts";
import type { ActivityView } from "@/lib/activity/view";
import { fmtDate, weekdayName } from "@/lib/dates/format";
import { clockTimeIn, localDateIn } from "@/lib/dates/timezone";
import { ACTIVITY_PARAM, closeActivity, forgetPushed } from "./open";
import { RouteMap } from "./route-map";
import { ContextFacts, IntervalsTable, RideSplitsTable, Section, SplitsTable, StatGroups, ZonesBreakdown } from "./sections";
import { SeriesChart } from "./series-chart";

/**
 * One activity, everything about it: opened from the Runs table (and anywhere else that calls
 * openActivity), driven by `?activity=<id>`. Data comes from GET /api/activity/<id>; each
 * activity is fetched once per page load, so reopening one is instant.
 */
/** GET /api/activity/<id>: the view, and whether this viewer should ask for its summary. */
type ActivityResponse = ActivityView & { writeSummary?: boolean };

export function ActivityModal({ timezone }: { timezone: string }) {
  const id = useSearchParams().get(ACTIVITY_PARAM);
  const [views, setViews] = useState<Record<string, ActivityResponse>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const view = id ? views[id] : undefined;
  const error = id ? errors[id] : undefined;

  useEffect(() => {
    if (!id) {
      forgetPushed();
      return;
    }
    if (view || error) return;
    const abort = new AbortController();
    fetch(`/api/activity/${encodeURIComponent(id)}`, { signal: abort.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn’t load this activity.");
        setViews((v) => ({ ...v, [id]: body as ActivityResponse }));
      })
      .catch((err) => {
        if (abort.signal.aborted) return;
        setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : "Couldn’t load this activity." }));
      });
    return () => abort.abort();
  }, [id, view, error]);

  return (
    <Dialog
      open={!!id}
      onClose={closeActivity}
      labelledBy="activity-title"
      className="max-h-[calc(100dvh-16px)] w-[min(calc(100vw-16px),1040px)] max-w-none overflow-hidden max-sm:h-dvh max-sm:max-h-dvh max-sm:w-screen max-sm:rounded-none"
    >
      <div className="flex max-h-[calc(100dvh-16px)] flex-col max-sm:h-dvh max-sm:max-h-dvh">
        {view ? (
          // Keyed so the hover readout starts fresh for each activity.
          <ActivityBody
            key={view.id}
            view={view}
            timezone={timezone}
            onSummary={(summary) => setViews((v) => ({ ...v, [view.id]: { ...view, summary, writeSummary: false } }))}
          />
        ) : (
          <>
            <Header onClose={closeActivity} />
            <div className="flex items-center gap-3 px-5 pb-8 pt-2 text-[13px] text-muted-2 md:px-7">
              {error ?? "Loading activity…"}
              {error && id && (
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() =>
                    setErrors((e) => {
                      const rest = { ...e };
                      delete rest[id];
                      return rest;
                    })
                  }
                >
                  Try again
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** What the stacked chart shows: pace for a run, speed otherwise, and power when there is any. */
function seriesTitle(view: ActivityView): string {
  const s = view.series!;
  const parts = [view.isRun ? "Pace" : view.indoor ? null : "Speed", s.power ? "power" : null, "heart rate", s.cadence && view.isRide ? "cadence" : null, s.elev && !view.indoor ? "elevation" : null].filter(
    (p): p is string => p !== null,
  );
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Header({ view, onClose }: { view?: ActivityView; onClose: () => void }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-divider px-5 pb-4 pt-5 md:px-7">
      <div className="flex min-w-0 flex-col gap-1.5">
        {view && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-border-strong px-2 py-[1px] font-mono text-[10px] text-muted-1">{view.typeLabel}</span>
            {view.kind && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-[1px] font-mono text-[10px] ${
                  view.kind === "workout" ? "border-accent/40 text-accent" : "border-border-strong text-muted-1"
                }`}
              >
                <span aria-hidden>{view.kind === "workout" ? "▲" : "●"}</span>
                {view.kind === "workout" ? "Workout" : "Easy"}
              </span>
            )}
            {view.benefit && <span className="font-mono text-[10px] text-muted-2">{view.benefit}</span>}
          </div>
        )}
        <h2 id="activity-title" className="truncate font-serif text-[22px] leading-tight md:text-[26px]">
          {view?.name ?? "Activity"}
        </h2>
        {view && (
          <span className="text-[12.5px] text-muted-2">
            {weekdayName(view.date)}, {fmtDate(view.date)} · {view.startClock}
            {view.location && ` · ${view.location}`}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="-mr-1 shrink-0 rounded-md px-2 py-1 text-[20px] leading-none text-muted-2 hover:bg-raised hover:text-ink"
        aria-label="Close"
      >
        ×
      </button>
    </header>
  );
}

function ActivityBody({
  view,
  timezone,
  onSummary,
}: {
  view: ActivityResponse;
  timezone: string;
  onSummary: (summary: NonNullable<ActivityView["summary"]>) => void;
}) {
  const [hover, onHover] = useState<number | null>(null);
  const hasRoute = !!view.series?.lat;
  return (
    <>
      <Header view={view} onClose={closeActivity} />
      <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4 md:px-7">
        <div className="flex flex-wrap gap-x-8 gap-y-3 px-1">
          {view.headline.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} unit={s.unit} />
          ))}
        </div>

        <ActivitySummary view={view} timezone={timezone} onSummary={onSummary} />

        {view.detailState !== "ok" && (
          <p className="rounded-lg border border-border bg-inset px-3 py-2 text-[12px] text-muted-2">
            {view.detailState === "missing"
              ? "The second-by-second data for this activity hasn’t been fetched from Garmin yet, so only the summary is shown."
              : "Garmin has no second-by-second data for this activity (it may have been entered by hand)."}
          </p>
        )}

        {view.series && (
          <div className={`grid gap-4 ${hasRoute ? "lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]" : ""}`}>
            <Section title={seriesTitle(view)}>
              <SeriesChart series={view.series} isRun={view.isRun} timeAxis={view.indoor} hover={hover} onHover={onHover} />
            </Section>
            {hasRoute && (
              <Section title="Route" aside={view.zones ? "colored by HR zone" : undefined}>
                <RouteMap series={view.series} zones={view.zones} hover={hover} />
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-[9.5px] text-muted-2">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full border-[1.5px] border-ink" />start
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 bg-ink" />finish
                  </span>
                  {view.zones &&
                    view.zones.map((z) => (
                      <span key={z.zone} className="flex items-center gap-1">
                        <span className={`inline-block h-[3px] w-3 rounded ${["bg-z1", "bg-z2", "bg-z3", "bg-z4", "bg-z5"][z.zone - 1]}`} />Z{z.zone}
                      </span>
                    ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {(view.splits.length > 0 || view.rideSplits.length > 0 || view.zones || view.intervals.length > 0) && (
          <div className="grid items-start gap-4 md:grid-cols-2">
            {view.splits.length > 0 && (
              <Section title="Mile splits" aside={view.splits.some((s) => s.gapPace_s !== null) ? "GAP = grade-adjusted pace" : undefined}>
                <SplitsTable splits={view.splits} />
              </Section>
            )}
            {view.rideSplits.length > 0 && (
              <Section title="Splits" aside={view.indoor ? "every 5 minutes (indoors)" : "every 5 miles"}>
                <RideSplitsTable splits={view.rideSplits} />
              </Section>
            )}
            <div className="flex flex-col gap-4">
              {view.zones && (
                <Section title="Time in heart-rate zones">
                  <ZonesBreakdown zones={view.zones} />
                </Section>
              )}
              {view.intervals.length > 0 && (
                <Section title={view.isRun ? "Run/walk and intervals" : "Intervals"} aside="Garmin’s split totals">
                  <IntervalsTable intervals={view.intervals} isRun={view.isRun} />
                </Section>
              )}
            </div>
          </div>
        )}

        <Section title="Compared with your training">
          <ContextFacts context={view.context} isRun={view.isRun} isRide={view.isRide} />
        </Section>

        <Section title="All the numbers">
          <StatGroups groups={view.groups} />
        </Section>
      </div>
    </>
  );
}

/**
 * The AI summary under the headline numbers. When the owner opens an activity that has none,
 * asks for one (POST /api/activity/<id>/summary) and says so while Gemini writes it.
 */
function ActivitySummary({
  view,
  timezone,
  onSummary,
}: {
  view: ActivityResponse;
  timezone: string;
  onSummary: (summary: NonNullable<ActivityView["summary"]>) => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const want = !!view.writeSummary && !view.summary;

  useEffect(() => {
    if (!want) return;
    const abort = new AbortController();
    fetch(`/api/activity/${encodeURIComponent(view.id)}/summary`, { method: "POST", signal: abort.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn’t write a summary right now.");
        onSummary(body);
      })
      .catch((err) => {
        if (!abort.signal.aborted) setFailed(err instanceof Error ? err.message : "Couldn’t write a summary right now.");
      });
    return () => abort.abort();
    // onSummary is a fresh closure each render; the request depends only on which activity this is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, view.id]);

  if (!view.summary && !want) return null;
  return (
    <div className="flex max-w-[860px] flex-col gap-2 px-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
        Activity summary · AI-written
        {view.summary && ` · ${fmtDate(localDateIn(view.summary.generated_at, timezone))} ${clockTimeIn(view.summary.generated_at, timezone)}`}
      </span>
      {view.summary ? (
        <p className="font-serif text-[clamp(16px,2vw,19px)] leading-[1.5] text-pretty">{view.summary.text}</p>
      ) : (
        <p className="text-[13px] text-muted-2">{failed ?? `Writing a summary from this ${view.isRide ? "ride" : view.isRun ? "run" : "activity"} and the rest of your training…`}</p>
      )}
    </div>
  );
}
