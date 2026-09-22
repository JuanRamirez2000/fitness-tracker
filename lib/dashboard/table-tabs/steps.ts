import { createColumnHelper } from "@tanstack/react-table";
import { deleteSteps, fetchSteps, stepsSchema, upsertSteps, type DailyMetric, type StepsInput } from "@/lib/data/daily-metrics";
import { fmtDate } from "@/lib/dates/format";
import type { TableTab } from "../table-tab";
import type { TableTabContext } from "../table-tab-context";

const helper = createColumnHelper<DailyMetric>();

export function makeStepsTab(_ctx: TableTabContext): TableTab<DailyMetric, StepsInput> {
  return {
    id: "steps",
    label: "Steps",
    table: "daily_metrics",
    schema: stepsSchema,
    primaryField: "value",
    enabled: true,
    fields: [
      { name: "local_date", label: "Date", kind: "date" },
      { name: "value", label: "Steps", kind: "number" },
    ],
    columns: [
      helper.accessor("local_date", { header: "Date", cell: (c) => fmtDate(c.getValue()) }),
      helper.accessor("value", { header: "Steps", cell: (c) => c.getValue().toLocaleString() }),
      helper.accessor("source", { header: "Source", cell: (c) => (c.getValue() === "manual" ? "Manual" : c.getValue()) }),
    ],
    fetchRows: fetchSteps,
    // The table's real key is (user_id, local_date, metric): one steps row a day.
    save: (supabase, userId, values) => upsertSteps(supabase, userId, values),
    remove: (supabase, row) => deleteSteps(supabase, row.user_id, row.local_date),
    rowId: (row) => row.local_date,
    // NaN so the add-row/dialog input starts blank instead of pre-filled with an invalid 0.
    emptyValues: (localDate) => ({ local_date: localDate, value: NaN }),
    toValues: (row) => ({ local_date: row.local_date, value: row.value }),
  };
}
