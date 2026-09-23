"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import type { FieldValues } from "react-hook-form";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";
import type { TableTab } from "@/lib/dashboard/table-tab";
import { createClient } from "@/lib/supabase/browser";
import { AddRow } from "./add-row";
import { EntryFormDialog } from "./entry-form-dialog";
import { InlineCell } from "./inline-cell";

/** Not in the brief or the design (which shows at most 5 rows in its own review panel) — the
 * user asked, after step 7 shipped, to cap the table at a page of 10 with a way for either
 * the owner or the coach (both have equal access; see lib/dashboard/table-tab.ts) to reveal
 * more, rather than rendering a whole range's rows at once. */
const PAGE_SIZE = 10;

/**
 * Generic across every tab: fetches `tab`'s rows for the current range, renders them through
 * TanStack Table, and wires up all three editing patterns (lib/dashboard/table-tab.ts) with
 * optimistic updates — the local `rows` state changes immediately and only reverts if the
 * Supabase call throws.
 */
export function DataTable<Row extends { local_date: LocalDate }, Values extends FieldValues>({
  tab,
  userId,
  today,
  range,
}: {
  tab: TableTab<Row, Values>;
  userId: string;
  today: LocalDate;
  range: DayWindow;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setLoadError(false);
    setVisibleCount(PAGE_SIZE); // a new tab or range starts back at the first page
    tab
      .fetchRows(supabase, userId, range)
      .then((fetched) => {
        if (!cancelled) setRows(fetched.slice().reverse()); // newest first, matching frame 2A
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // tab.id (not `tab`, a new object every render) plus the actual range bounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, userId, range.from, range.to]);

  const visibleRows = useMemo(() => (rows ?? []).slice(0, visibleCount), [rows, visibleCount]);
  const hiddenCount = (rows?.length ?? 0) - visibleRows.length;

  const table = useReactTable({
    data: visibleRows,
    columns: tab.columns,
    getRowId: (row) => tab.rowId(row),
    getCoreRowModel: getCoreRowModel(),
  });

  async function commitInline(row: Row, raw: string) {
    if (!rows) return;
    const field = tab.fields.find((f) => f.name === tab.primaryField);
    const parsedRaw = field?.kind === "number" ? (raw === "" ? null : Number(raw)) : raw === "" ? null : raw;
    const values = { ...tab.toValues(row), [tab.primaryField]: parsedRaw } as Values;

    const parsed = tab.schema.safeParse(values);
    if (!parsed.success) return; // the field re-shows its last good value; no silent bad save

    const previous = rows;
    setRows(rows.map((r) => (tab.rowId(r) === tab.rowId(row) ? { ...r, [tab.primaryField]: parsedRaw } as Row : r)));
    try {
      const saved = await tab.save(supabase, userId, parsed.data, row);
      setRows((current) => (current ?? previous).map((r) => (tab.rowId(r) === tab.rowId(row) ? saved : r)));
    } catch {
      setRows(previous);
    }
  }

  async function addRow(values: Values) {
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic = { ...values, id: optimisticId } as unknown as Row;
    const previous = rows ?? [];
    setRows([optimistic, ...previous]);
    try {
      const saved = await tab.save(supabase, userId, values);
      setRows((current) => [saved, ...(current ?? previous).filter((r) => tab.rowId(r) !== optimisticId)]);
    } catch (err) {
      setRows(previous);
      throw err;
    }
  }

  async function saveEdit(row: Row, values: Values) {
    if (!rows) return;
    const previous = rows;
    setRows(rows.map((r) => (tab.rowId(r) === tab.rowId(row) ? ({ ...r, ...values } as Row) : r)));
    try {
      const saved = await tab.save(supabase, userId, values, row);
      setRows((current) => (current ?? previous).map((r) => (tab.rowId(r) === tab.rowId(row) ? saved : r)));
    } catch (err) {
      setRows(previous);
      throw err;
    }
  }

  async function removeEdit(row: Row) {
    if (!rows) return;
    const previous = rows;
    setRows(rows.filter((r) => tab.rowId(r) !== tab.rowId(row)));
    try {
      await tab.remove(supabase, row);
    } catch (err) {
      setRows(previous);
      throw err;
    }
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-divider">
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            ))}
          </thead>
          <tbody>
            {rows === null && !loadError && (
              <tr>
                <td colSpan={tab.columns.length + 1} className="px-3 py-6 text-center text-[12px] text-muted-2">
                  Loading…
                </td>
              </tr>
            )}
            {loadError && (
              <tr>
                <td colSpan={tab.columns.length + 1} className="px-3 py-6 text-center text-[12px] text-bad">
                  Could not load {tab.label.toLowerCase()}.
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={tab.columns.length + 1} className="px-3 py-6 text-center text-[12px] text-muted-2">
                  Nothing logged in this range yet.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-divider/60 hover:bg-raised/40">
                {row.getVisibleCells().map((cell) => {
                  const isPrimary = cell.column.id === tab.primaryField;
                  const field = tab.fields.find((f) => f.name === tab.primaryField);
                  return (
                    <td key={cell.id} className="px-3 py-2 text-[12px] text-ink">
                      {isPrimary && field ? (
                        <InlineCell<Values>
                          value={(row.original as Record<string, unknown>)[tab.primaryField]}
                          display={flexRender(cell.column.columnDef.cell, cell.getContext())}
                          field={field}
                          onCommit={(raw) => commitInline(row.original, raw)}
                        />
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  );
                })}
                <td className="px-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(row.original)}
                    aria-label="Edit entry"
                    className="text-[11px] text-muted-2 hover:text-accent"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 && (
        <div className="flex items-center justify-between border-t border-dashed border-border-strong px-[18px] py-2.5">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-3">
            Showing {visibleRows.length} of {rows?.length}
          </span>
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-[11.5px] text-accent hover:underline"
          >
            Show {Math.min(PAGE_SIZE, hiddenCount)} more
          </button>
        </div>
      )}

      <AddRow<Values> fields={tab.fields} schema={tab.schema} defaultValues={tab.emptyValues(today)} onAdd={addRow} />

      <EntryFormDialog<Values>
        key={editing ? tab.rowId(editing) : "new"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit ${tab.label.toLowerCase()}`}
        fields={tab.fields}
        schema={tab.schema}
        defaultValues={editing ? tab.toValues(editing) : tab.emptyValues(today)}
        onSubmit={(values) => saveEdit(editing as Row, values)}
        onDelete={() => removeEdit(editing as Row)}
      />
    </div>
  );
}
