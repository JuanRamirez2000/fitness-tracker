import { z } from "zod";
import type { Footprint } from "@/lib/kpis/footprint";

export const GRID_COLS = 6;
export const GRID_ROWS = 3;

export const widgetLayoutItemSchema = z.object({
  i: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.union([z.literal(1), z.literal(2)]),
  h: z.union([z.literal(1), z.literal(2)]),
  hidden: z.boolean(),
});

// null = never customized — the caller falls back to defaultDashboardLayout(). Always written
// back in full (every widget, visible and hidden), never as a partial diff, so this column is
// always either absent or a complete, self-consistent layout.
export const dashboardLayoutSchema = z.array(widgetLayoutItemSchema).nullable();

export type WidgetLayoutItem = z.infer<typeof widgetLayoutItemSchema>;
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;

export function visibleItems(layout: WidgetLayoutItem[]): WidgetLayoutItem[] {
  return layout.filter((item) => !item.hidden);
}

export function hiddenItemsOf(layout: WidgetLayoutItem[]): WidgetLayoutItem[] {
  return layout.filter((item) => item.hidden);
}

/** Reading order (top-to-bottom, left-to-right) of wherever the user last dragged each card on
 * desktop — a more meaningful "order" for a curated bento grid than raw registry/insertion
 * order would be, and the only ordering concept jsonb's own array storage can't be trusted to
 * preserve on its own merits alone. */
export function orderForMobile(layout: WidgetLayoutItem[]): WidgetLayoutItem[] {
  return [...visibleItems(layout)].sort((a, b) => a.y - b.y || a.x - b.x);
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** First row-major cell a footprint fits into without overlapping any occupied item, within
 * the fixed GRID_ROWS x GRID_COLS bound. null when nothing fits (grid genuinely full). */
export function findOpenSlot(occupied: readonly { x: number; y: number; w: number; h: number }[], footprint: Footprint): { x: number; y: number } | null {
  for (let y = 0; y <= GRID_ROWS - footprint.h; y++) {
    for (let x = 0; x <= GRID_COLS - footprint.w; x++) {
      const candidate = { x, y, w: footprint.w, h: footprint.h };
      if (!occupied.some((item) => overlaps(candidate, item))) return { x, y };
    }
  }
  return null;
}

export function withItemHidden(layout: WidgetLayoutItem[], id: string): WidgetLayoutItem[] {
  return layout.map((item) => (item.i === id ? { ...item, hidden: true } : item));
}

/** Places a hidden widget back onto the grid at the first open slot its default footprint
 * fits, sized back to that default (any previous custom size is not preserved across a
 * hide/show round trip). Returns the layout unchanged, still hidden, if the grid is full. */
export function withItemShown(layout: WidgetLayoutItem[], id: string, footprint: Footprint): WidgetLayoutItem[] {
  const slot = findOpenSlot(visibleItems(layout), footprint);
  if (!slot) return layout;
  return layout.map((item) => (item.i === id ? { ...item, hidden: false, x: slot.x, y: slot.y, w: footprint.w, h: footprint.h } : item));
}

/** Folds react-grid-layout's own {i,x,y,w,h} positions (from onDragStop/onResizeStop, which
 * only ever sees visible items) back into the full layout — hidden entries pass through
 * untouched since RGL never saw them. */
export function mergeRglPositions(layout: WidgetLayoutItem[], rglLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]): WidgetLayoutItem[] {
  const byId = new Map(rglLayout.map((item) => [item.i, item] as const));
  return layout.map((item) => {
    const moved = byId.get(item.i);
    return moved ? { ...item, x: moved.x, y: moved.y, w: moved.w as 1 | 2, h: moved.h as 1 | 2 } : item;
  });
}

/** The one-time default arrangement for an athlete who has never customized their layout —
 * placed via the exact same findOpenSlot the "+ Add widget" flow uses, so there's only one
 * placement algorithm in this file, not a hand-authored set of coordinates that could drift
 * out of sync with it. */
export function defaultDashboardLayout(widgets: readonly { id: string; defaultFootprint: Footprint }[]): WidgetLayoutItem[] {
  const layout: WidgetLayoutItem[] = [];
  for (const widget of widgets) {
    const slot = findOpenSlot(layout, widget.defaultFootprint);
    if (!slot) continue; // more default widgets than the grid can hold — silently skip rather than throw
    layout.push({ i: widget.id, x: slot.x, y: slot.y, w: widget.defaultFootprint.w, h: widget.defaultFootprint.h, hidden: false });
  }
  return layout;
}
