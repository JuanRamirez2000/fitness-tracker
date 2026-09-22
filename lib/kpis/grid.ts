import type { KpiDefinition } from "@/lib/dashboard/types";

export const GRID_COLUMNS = 5;

/** How many columns a KPI's card occupies: 2 for the hero, 1 otherwise. */
export function kpiSpan(def: Pick<KpiDefinition, "hero">): number {
  return def.hero ? 2 : 1;
}

/**
 * How many generic, unlabeled empty-slot cards pad the grid out to a full row — "when fewer
 * KPIs are configured than the grid has slots, render the design's empty-slot state."
 * 0 when the configured KPIs already fill exact rows.
 */
export function emptySlotCount(defs: readonly Pick<KpiDefinition, "hero">[], columns = GRID_COLUMNS): number {
  const used = defs.reduce((sum, def) => sum + kpiSpan(def), 0);
  const remainder = used % columns;
  return remainder === 0 ? 0 : columns - remainder;
}
