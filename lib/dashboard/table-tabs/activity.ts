import { createColumnHelper } from "@tanstack/react-table";
import {
  activitySchema,
  deleteActivity,
  fetchActivities,
  insertActivity,
  updateActivity,
  type Activity,
  type ActivityInput,
} from "@/lib/data/activities";
import { fmtDate } from "@/lib/dates/format";
import type { TableTab } from "../table-tab";
import type { TableTabContext } from "../table-tab-context";

const helper = createColumnHelper<Activity>();

export function makeActivityTab(ctx: TableTabContext): TableTab<Activity, ActivityInput> {
  const typeLabel = (key: string) => ctx.activityTypes.find((t) => t.key === key)?.label ?? key;

  return {
    id: "activity",
    label: "Activity",
    table: "activities",
    schema: activitySchema,
    primaryField: "activity_type",
    enabled: true,
    fields: [
      { name: "local_date", label: "Date", kind: "date" },
      {
        name: "activity_type",
        label: "Type",
        kind: "select",
        options: ctx.activityTypes.map((t) => ({ value: t.key, label: t.label })),
      },
      { name: "duration_min", label: "Duration", kind: "number", unit: "min" },
      // Lifting lives here too, as this type plus free-text notes (brief).
      { name: "notes", label: "Notes", kind: "text", multiline: true },
    ],
    columns: [
      helper.accessor("local_date", { header: "Date", cell: (c) => fmtDate(c.getValue()) }),
      helper.accessor("activity_type", { header: "Type", cell: (c) => typeLabel(c.getValue()) }),
      helper.accessor("duration_min", { header: "Duration", cell: (c) => (c.getValue() ? `${c.getValue()} min` : "—") }),
      helper.accessor("notes", { header: "Notes", cell: (c) => c.getValue() ?? "—" }),
    ],
    fetchRows: fetchActivities,
    save: (supabase, userId, values, existing) =>
      existing ? updateActivity(supabase, existing.id, values) : insertActivity(supabase, userId, values),
    remove: (supabase, row) => deleteActivity(supabase, row.id),
    rowId: (row) => row.id,
    emptyValues: (localDate) => ({
      local_date: localDate,
      activity_type: ctx.activityTypes[0]?.key ?? "other",
      duration_min: null,
      notes: null,
    }),
    toValues: (row) => ({
      local_date: row.local_date,
      activity_type: row.activity_type,
      duration_min: row.duration_min,
      notes: row.notes,
    }),
  };
}
