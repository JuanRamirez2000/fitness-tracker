import { createColumnHelper } from "@tanstack/react-table";
import {
  deleteWeighIn,
  fetchWeighIns,
  insertWeighIn,
  updateWeighIn,
  weighInSchema,
  type WeighIn,
  type WeighInInput,
} from "@/lib/data/weigh-ins";
import { fmtDate } from "@/lib/dates/format";
import { defaultMeasuredAt } from "@/lib/dates/timezone";
import type { TableTab } from "../table-tab";
import type { TableTabContext } from "../table-tab-context";

const helper = createColumnHelper<WeighIn>();

export function makeWeighInsTab(ctx: TableTabContext): TableTab<WeighIn, WeighInInput> {
  return {
    id: "weigh-ins",
    label: "Weigh-ins",
    table: "weigh_ins",
    schema: weighInSchema,
    primaryField: "weight_lb",
    enabled: true,
    fields: [
      { name: "local_date", label: "Date", kind: "date" },
      { name: "weight_lb", label: "Weight", kind: "number", unit: "lb", step: 0.1 },
    ],
    columns: [
      helper.accessor("local_date", { header: "Date", cell: (c) => fmtDate(c.getValue()) }),
      helper.accessor("weight_lb", { header: "Weight", cell: (c) => `${c.getValue().toFixed(1)} lb` }),
      helper.accessor("source", { header: "Source", cell: (c) => (c.getValue() === "manual" ? "Manual" : c.getValue()) }),
    ],
    fetchRows: fetchWeighIns,
    async save(supabase, userId, values, existing) {
      return existing
        ? updateWeighIn(supabase, existing.id, values)
        : insertWeighIn(supabase, userId, values, defaultMeasuredAt(values.local_date, ctx.timezone));
    },
    remove: (supabase, row) => deleteWeighIn(supabase, row.id),
    rowId: (row) => row.id,
    // NaN, not 0: an HTML number input shows NaN as blank, so the add-row/dialog start
    // empty rather than pre-filled with a value that would fail the weight_lb range check.
    emptyValues: (localDate) => ({ local_date: localDate, weight_lb: NaN }),
    toValues: (row) => ({ local_date: row.local_date, weight_lb: row.weight_lb }),
  };
}
