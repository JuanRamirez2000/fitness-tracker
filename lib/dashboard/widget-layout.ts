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

function inBounds(item: { x: number; y: number; w: number; h: number }): boolean {
  return item.x >= 0 && item.y >= 0 && item.x + item.w <= GRID_COLS && item.y + item.h <= GRID_ROWS;
}

/** True if any two visible items in the layout occupy overlapping cells — the final check
 * before ever persisting, regardless of how the layout was arrived at. */
export function hasOverlap(layout: WidgetLayoutItem[]): boolean {
  const items = visibleItems(layout);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) return true;
    }
  }
  return false;
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

/**
 * Applies react-grid-layout's reported end position for ONLY the single item actually being
 * dragged or resized — deliberately not react-grid-layout's own full reported layout array.
 * Caught live: even with compactType={null} and no preventCollision, react-grid-layout's own
 * drag engine still silently nudges a second, uninvolved item out of the way as part of its
 * internal single-collision avoidance — and that nudge isn't itself collision-checked against
 * a THIRD item, so trusting its whole reported array can hand back a layout with a fresh
 * overlap RGL introduced itself. Only the moved item's own new position is trustworthy;
 * everyone else is resolved by this app's own resolveMove() below instead.
 */
export function applyItemMove(layout: WidgetLayoutItem[], id: string, next: { x: number; y: number; w: number; h: number }): WidgetLayoutItem[] {
  return layout.map((item) => (item.i === id ? { ...item, x: next.x, y: next.y, w: next.w as 1 | 2, h: next.h as 1 | 2 } : item));
}

/**
 * Resolves the single moved/resized item against everything else after a drag or resize
 * gesture (`merged` = applyItemMove(layout, movedId, ...)).
 *
 * - No collision: the move stands as-is.
 * - Dragging ("drag" mode) onto exactly one other item, where that item's own footprint
 *   fits back into the mover's OLD spot: a real swap, trading places.
 * - Anything else that collides — a drag onto more than one item, a drag whose swap doesn't
 *   fit, or ANY resize (growing a card is "claim empty space," not "trade places," so there's
 *   no single natural swap partner) — shifts every colliding widget to its own first open
 *   slot elsewhere on the grid, in registry order, each avoiding the mover and every widget
 *   already placed (including ones already shifted earlier in the same gesture). This is what
 *   makes a resize actually make room instead of just bouncing off occupied cells.
 *
 * Returns null only when even shifting has no valid resolution (the grid is genuinely too
 * full to make room) — the caller then leaves state untouched, which snaps the drag/resize
 * back to its last valid position (react-grid-layout is fully controlled by the `layout`
 * prop, so an unchanged prop is what makes it visually revert).
 */
export function resolveMove(merged: WidgetLayoutItem[], movedId: string, oldPos: { x: number; y: number }, mode: "drag" | "resize"): WidgetLayoutItem[] | null {
  const moved = merged.find((item) => item.i === movedId);
  if (!moved) return merged;

  const others = visibleItems(merged).filter((item) => item.i !== movedId);
  const colliders = others.filter((item) => overlaps(moved, item));
  if (colliders.length === 0) return merged;

  if (mode === "drag" && colliders.length === 1) {
    const [collider] = colliders;
    const swapped = { ...collider, x: oldPos.x, y: oldPos.y };
    if (inBounds(swapped) && !others.some((item) => item.i !== collider.i && overlaps(swapped, item))) {
      return merged.map((item) => (item.i === collider.i ? swapped : item));
    }
    // The swap itself doesn't fit (e.g. a 2x2 landing where only a 1x1 fits back) — fall
    // through to shifting the collider elsewhere instead of rejecting outright.
  }

  const settled = [moved, ...others.filter((item) => !colliders.includes(item))];
  let result = merged;
  for (const collider of colliders) {
    const slot = findOpenSlot(settled, { w: collider.w, h: collider.h });
    if (!slot) return null; // no room anywhere left for this one — reject the whole gesture
    const relocated = { ...collider, x: slot.x, y: slot.y };
    settled.push(relocated);
    result = result.map((item) => (item.i === collider.i ? relocated : item));
  }
  return result;
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
