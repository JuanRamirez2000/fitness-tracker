"use client";

import { useState, useTransition } from "react";
import { removeWeighIn, saveWeighIn } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { WeighIn } from "@/lib/data/weigh-ins";
import { weighInSchema } from "@/lib/data/weigh-ins";
import type { LocalDate } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";

const PAGE_SIZE = 10;
const cellInput =
  "rounded-md border border-field-border bg-inset px-2 py-1 text-[12.5px] text-ink outline-none focus:border-accent";

/** Weigh-ins in the selected range, newest first. The owner can add, edit and delete; the
 * viewer just sees the rows. Every change goes through a server action, which refreshes the
 * whole page's data, so the cards, heatmap and charts update along with the table. */
export function WeighInTable({ rows, today, canEdit }: { rows: WeighIn[]; today: LocalDate; canEdit: boolean }) {
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
    run(() => saveWeighIn(parsed.data, id), () => setEditingId(null));
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
              {["Date", "Weight", "Source"].map((h) => (
                <th key={h} className="px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2 md:px-6">
                  {h}
                </th>
              ))}
              {canEdit && <th className="w-28" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[12px] text-muted-2">
                  Nothing logged in this range yet.
                </td>
              </tr>
            )}
            {shown.map((row) =>
              editingId === row.id ? (
                <tr key={row.id} className="border-b border-divider/60">
                  <td colSpan={4} className="px-4 py-2 md:px-6">
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
                  <td className="px-4 py-2 text-[12.5px] text-ink md:px-6">{fmtDate(row.local_date)}</td>
                  <td className="px-4 py-2 text-[12.5px] text-ink md:px-6">{row.weight_lb.toFixed(1)} lb</td>
                  <td className="px-4 py-2 text-[12.5px] capitalize text-muted-2 md:px-6">{row.source}</td>
                  {canEdit && (
                    <td className="px-4 text-right md:px-6">
                      <button type="button" onClick={() => setEditingId(row.id)} className="text-[11px] text-muted-2 hover:text-accent">
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
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
