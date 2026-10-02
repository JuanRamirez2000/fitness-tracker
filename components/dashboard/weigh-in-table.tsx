"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { removeWeighIn, saveWeighIn, toggleShot } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { weighInSchema } from "@/lib/data/weigh-ins";
import { fmtDate } from "@/lib/dates/format";
import type { DashboardData } from "@/lib/dashboard/types";
import { starInk } from "@/lib/heatmap/star-ink";
import { STEPS_GOAL } from "@/lib/data/steps";
import { signed } from "@/lib/kpis/format";
import { dayHeat, type HeatValue } from "@/lib/table/heat";
import { paletteFor } from "@/lib/theme/palette";
import { useTheme } from "@/lib/theme/theme-context";

const PAGE_SIZE = 10;
const cellInput =
  "rounded-md border border-field-border bg-inset px-2 py-1 text-[12.5px] text-ink outline-none focus:border-accent";

const cellPad = "px-3 py-2 md:px-4";

/** A number shaded with the heatmap's own color for that day, ink picked for contrast. */
function HeatCell({ heat, children }: { heat: HeatValue | undefined; children: ReactNode }) {
  const fill = heat?.fill;
  return (
    <td className={`${cellPad} text-[12.5px] tabular-nums`}>
      <span
        className="inline-block min-w-[58px] rounded-[5px] px-2 py-0.5 text-right"
        style={fill ? { background: fill, color: starInk(fill) } : { color: "var(--muted-2)" }}
      >
        {children}
      </span>
    </td>
  );
}

/** Weigh-ins in the selected range, newest first, shaded like the heatmap so trends read at a
 * glance. The owner can add, edit and delete, and toggle the day's shot; the public view just
 * sees the rows. Every change goes through a server action, which refreshes the whole page's
 * data, so the cards, heatmap and charts update along with the table. */
export function WeighInTable({
  data,
  canEdit,
}: {
  data: Pick<DashboardData, "weighIns" | "weightTrend" | "injections" | "steps" | "today">;
  canEdit: boolean;
}) {
  const { weighIns: rows, today } = data;
  const { mode } = useTheme();
  const heat = useMemo(() => dayHeat(data.weightTrend, paletteFor(mode)), [data.weightTrend, mode]);
  const stepsByDay = useMemo(() => new Map(data.steps.map((s) => [s.local_date, s.steps] as const)), [data.steps]);
  const shotDays = useMemo(() => new Set(data.injections.map((i) => i.local_date)), [data.injections]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onDone?.();
      } catch {
        setError("Couldn't save that. Check the date and weight and try again.");
      }
    });
  }

  function submit(form: FormData, id?: string) {
    const parsed = weighInSchema.safeParse({
      local_date: form.get("local_date"),
      weight_lb: Number(form.get("weight_lb")),
    });
    if (!parsed.success) {
      setError(`Enter a date and a weight between 50 and 800 lb.`);
      return false;
    }
    const withShot = !id && form.get("shot") === "on";
    run(async () => {
      await saveWeighIn(parsed.data, id);
      if (withShot) await toggleShot(parsed.data.local_date, true);
    }, () => setEditingId(null));
    return true;
  }

  const shown = rows.slice(0, visible);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2 md:px-6">
        <span className="font-serif text-[16px]">Weigh-ins</span>
        <span className="font-mono text-[10px] text-muted-3">{rows.length} in range</span>
      </div>

      {canEdit && (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-divider px-4 pb-3 md:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (submit(new FormData(form))) form.reset();
          }}
        >
          <input name="local_date" type="date" defaultValue={today} max={today} required className={cellInput} />
          <input name="weight_lb" type="number" step="0.1" min={50} max={800} placeholder="Weight (lb)" required className={`${cellInput} w-32`} />
          <label className="flex items-center gap-1.5 text-[12px] text-muted-2">
            <input name="shot" type="checkbox" className="accent-[var(--accent)]" />
            Shot ★
          </label>
          <Button type="submit" disabled={pending}>
            Add
          </Button>
        </form>
      )}
      {error && <p role="alert" className="px-4 pt-2 text-[12px] text-bad md:px-6">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-divider">
              {["Date", "Weight", "Change", "7-day avg", "Steps", "Shot", "Source"].map((h) => (
                <th key={h} className={`${cellPad} font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2`}>
                  {h}
                </th>
              ))}
              {canEdit && <th className="w-16" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[12px] text-muted-2">
                  Nothing logged in this range yet.
                </td>
              </tr>
            )}
            {shown.map((row) => {
              const day = heat.get(row.local_date);
              const shot = shotDays.has(row.local_date);
              const steps = stepsByDay.get(row.local_date);
              return editingId === row.id ? (
                <tr key={row.id} className="border-b border-divider/60">
                  <td colSpan={8} className="px-4 py-2 md:px-6">
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submit(new FormData(e.currentTarget), row.id);
                      }}
                    >
                      <input name="local_date" type="date" defaultValue={row.local_date} max={today} required className={cellInput} />
                      <input name="weight_lb" type="number" step="0.1" min={50} max={800} defaultValue={row.weight_lb} required className={`${cellInput} w-28`} autoFocus />
                      <Button type="submit" disabled={pending}>Save</Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Delete the ${fmtDate(row.local_date)} weigh-in?`)) run(() => removeWeighIn(row.id), () => setEditingId(null));
                        }}
                        className="ml-auto text-[12px] text-bad hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="border-b border-divider/60 hover:bg-raised/40">
                  <td className={`${cellPad} whitespace-nowrap text-[12.5px] text-ink`}>{fmtDate(row.local_date)}</td>
                  <HeatCell heat={day?.raw}>{row.weight_lb.toFixed(1)}</HeatCell>
                  <HeatCell heat={day?.raw}>{day?.raw.deltaLb == null ? "—" : signed(day.raw.deltaLb)}</HeatCell>
                  <HeatCell heat={day?.avg7}>{day ? day.avg7.avg7Lb.toFixed(1) : "—"}</HeatCell>
                  <td className={`${cellPad} text-right text-[12.5px] tabular-nums ${steps !== undefined && steps >= STEPS_GOAL ? "text-accent" : "text-muted-2"}`}>
                    {steps === undefined ? "—" : steps.toLocaleString("en-US")}
                  </td>
                  <td className={`${cellPad} text-[13px]`}>
                    {canEdit ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => toggleShot(row.local_date, !shot))}
                        aria-label={shot ? `Remove the ${fmtDate(row.local_date)} shot` : `Log a shot on ${fmtDate(row.local_date)}`}
                        className={shot ? "text-accent" : "text-muted-3 opacity-40 hover:opacity-100"}
                      >
                        {shot ? "★" : "☆"}
                      </button>
                    ) : (
                      shot && <span className="text-accent">★</span>
                    )}
                  </td>
                  <td className={`${cellPad} text-[12px] capitalize text-muted-2`}>{row.source}</td>
                  {canEdit && (
                    <td className="px-3 text-right md:px-4">
                      <button type="button" onClick={() => setEditingId(row.id)} className="text-[11px] text-muted-2 hover:text-accent">
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > visible && (
        <div className="flex items-center justify-between px-4 py-2.5 md:px-6">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-3">
            Showing {shown.length} of {rows.length}
          </span>
          <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="text-[11.5px] text-accent hover:underline">
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
