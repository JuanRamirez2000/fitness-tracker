import type { SupabaseClient } from "@supabase/supabase-js";
import type { ColumnDef } from "@tanstack/react-table";
import type { FieldValues } from "react-hook-form";
import type { z } from "zod";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";

export interface SelectOption {
  value: string;
  label: string;
}

/** Drives both the add-row inputs and the form dialog's fields (frame 2D) from one source,
 * so the three editing patterns can never drift out of sync with each other. Values is bound
 * by react-hook-form's own FieldValues (Record<string, any>), not a stricter `unknown` bound
 * — useForm's generic needs exactly that shape to type-check. */
export type FieldSpec<Values extends FieldValues> =
  | { name: keyof Values & string; label: string; kind: "date" }
  | { name: keyof Values & string; label: string; kind: "number"; unit?: string; step?: number }
  | { name: keyof Values & string; label: string; kind: "text"; multiline?: boolean }
  | { name: keyof Values & string; label: string; kind: "select"; options: SelectOption[] };

/**
 * The brief's TableTab<Row> (id, label, table, columns, schema, enabled) describes the shape
 * of a tab but not how it reads or writes — a real generic table component needs those too,
 * so this adds them: fetch/save/remove plus the field metadata the add-row and dialog forms
 * render from. `Values` is the editable-fields type (what `schema` validates); `Row` extends
 * it with the DB-assigned fields (id, timestamps, ...).
 */
export interface TableTab<Row extends { local_date: LocalDate }, Values extends FieldValues> {
  id: string;
  label: string;
  table: string;
  schema: z.ZodType<Values>;
  // TValue is `any`, not the default `unknown`: each column's own helper.accessor(...) call
  // infers its own concrete TValue (string, number, ...), and TanStack's per-column cell
  // renderer types are contravariant in it, so a heterogeneous array typed at `unknown`
  // rejects every concrete column. This is TanStack's own documented workaround, not a
  // widening of what a tab can put in a cell — each accessor call is still fully checked
  // against its own field's real type where it is written.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<Row, any>[];
  fields: FieldSpec<Values>[];
  /** Which editable field gets a click-to-edit cell in the table (frame 2D's other fields
   * only open through the dialog) — Weigh-ins' weight, Steps' count, and so on. */
  primaryField: keyof Values & string;
  enabled: boolean;

  fetchRows(supabase: SupabaseClient, userId: string, range?: DayWindow): Promise<Row[]>;
  /** Insert when `existing` is omitted, otherwise update/upsert it — one call either way. */
  save(supabase: SupabaseClient, userId: string, values: Values, existing?: Row): Promise<Row>;
  remove(supabase: SupabaseClient, row: Row): Promise<void>;
  rowId(row: Row): string;
  emptyValues(localDate: LocalDate): Values;
  toValues(row: Row): Values;
}
