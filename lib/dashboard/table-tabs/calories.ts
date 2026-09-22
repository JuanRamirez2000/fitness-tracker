import { createColumnHelper } from "@tanstack/react-table";
import {
  deleteNutritionDay,
  fetchNutritionDays,
  nutritionDaySchema,
  TRACKING_STATUSES,
  upsertNutritionDay,
  type NutritionDay,
  type NutritionDayInput,
  type TrackingStatus,
} from "@/lib/data/nutrition-days";
import { fmtDate } from "@/lib/dates/format";
import type { TableTab } from "../table-tab";
import type { TableTabContext } from "../table-tab-context";

const STATUS_LABEL: Record<(typeof TRACKING_STATUSES)[number], string> = {
  accurate: "Accurate",
  uncertain: "May be off",
  missed: "Missed",
};

const helper = createColumnHelper<NutritionDay>();

export function makeCaloriesTab(_ctx: TableTabContext): TableTab<NutritionDay, NutritionDayInput> {
  return {
    id: "calories",
    label: "Calories",
    table: "nutrition_days",
    schema: nutritionDaySchema,
    primaryField: "tracking_status",
    enabled: true,
    fields: [
      { name: "local_date", label: "Date", kind: "date" },
      {
        name: "tracking_status",
        label: "Status",
        kind: "select",
        options: TRACKING_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] })),
      },
      { name: "notes", label: "Notes", kind: "text" },
    ],
    columns: [
      helper.accessor("local_date", { header: "Date", cell: (c) => fmtDate(c.getValue()) }),
      // c.getValue() would otherwise widen to `any`: the whole columns array is
      // contextually typed against TableTab.columns' ColumnDef<Row, any>[] (see
      // table-tab.ts), which back-propagates into this literal before inference runs.
      helper.accessor("tracking_status", { header: "Status", cell: (c) => STATUS_LABEL[c.getValue() as TrackingStatus] }),
      // Reserved for V1 (brief: "keep the design's reserved kcal slot").
      helper.accessor("calories_kcal", { header: "kcal", cell: (c) => c.getValue() ?? "—" }),
      helper.accessor("notes", { header: "Notes", cell: (c) => c.getValue() ?? "—" }),
    ],
    fetchRows: fetchNutritionDays,
    // The table's real key is (user_id, local_date): one row a day, so save() is always
    // this same upsert whether or not `existing` was passed.
    save: (supabase, userId, values) => upsertNutritionDay(supabase, userId, values),
    remove: (supabase, row) => deleteNutritionDay(supabase, row.user_id, row.local_date),
    rowId: (row) => row.local_date,
    emptyValues: (localDate) => ({ local_date: localDate, tracking_status: "accurate", calories_kcal: null, notes: null }),
    toValues: (row) => ({
      local_date: row.local_date,
      tracking_status: row.tracking_status,
      calories_kcal: row.calories_kcal,
      notes: row.notes,
    }),
  };
}
