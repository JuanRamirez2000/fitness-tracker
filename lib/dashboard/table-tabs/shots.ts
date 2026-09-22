import { createColumnHelper } from "@tanstack/react-table";
import {
  deleteInjection,
  fetchInjections,
  injectionSchema,
  upsertInjection,
  type Injection,
  type InjectionInput,
} from "@/lib/data/injections";
import { fmtDate } from "@/lib/dates/format";
import type { TableTab } from "../table-tab";
import type { TableTabContext } from "../table-tab-context";

const helper = createColumnHelper<Injection>();

export function makeShotsTab(_ctx: TableTabContext): TableTab<Injection, InjectionInput> {
  return {
    id: "shots",
    label: "Shots",
    table: "injections",
    schema: injectionSchema,
    primaryField: "dose_mg",
    enabled: true,
    fields: [
      { name: "local_date", label: "Date", kind: "date" },
      { name: "dose_mg", label: "Dose", kind: "number", unit: "mg", step: 0.1 },
      { name: "notes", label: "Notes", kind: "text" },
    ],
    columns: [
      helper.accessor("local_date", { header: "Date", cell: (c) => fmtDate(c.getValue()) }),
      helper.accessor("dose_mg", { header: "Dose", cell: (c) => (c.getValue() !== null ? `${c.getValue()} mg` : "—") }),
      helper.accessor("notes", { header: "Notes", cell: (c) => c.getValue() ?? "—" }),
    ],
    fetchRows: fetchInjections,
    // The table's real key is unique(user_id, local_date): at most one shot a day.
    save: (supabase, userId, values) => upsertInjection(supabase, userId, values),
    remove: (supabase, row) => deleteInjection(supabase, row.id),
    rowId: (row) => row.id,
    emptyValues: (localDate) => ({ local_date: localDate, dose_mg: null, notes: null }),
    toValues: (row) => ({ local_date: row.local_date, dose_mg: row.dose_mg, notes: row.notes }),
  };
}
