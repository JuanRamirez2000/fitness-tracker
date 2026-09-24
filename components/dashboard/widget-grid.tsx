"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GridLayout, { WidthProvider, type Layout, type LayoutItem } from "react-grid-layout/legacy";
import { updateDashboardLayout } from "@/lib/data/profiles";
import {
  applyItemMove,
  GRID_COLS,
  GRID_ROWS,
  hasOverlap,
  hiddenItemsOf,
  resolveMove,
  visibleItems,
  withItemHidden,
  withItemShown,
  type WidgetLayoutItem,
} from "@/lib/dashboard/widget-layout";
import { createClient } from "@/lib/supabase/browser";
import { KpiCard, type ResolvedWidget } from "./kpi-card";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./widget-grid-theme.css";

// WidthProvider measures its own container and must be wrapped once at module scope — doing
// this inside the component would create a new component type every render, remounting the
// whole grid each time.
const GridLayoutWithWidth = WidthProvider(GridLayout);

const ROW_HEIGHT = 110;
const GRID_GAP: [number, number] = [12, 12];

export interface WidgetEntry {
  widget: ResolvedWidget;
  defaultFootprint: { w: 1 | 2; h: 1 | 2 };
}

export function WidgetGrid({
  items,
  athleteId,
  initialLayout,
}: {
  items: WidgetEntry[];
  athleteId: string;
  initialLayout: WidgetLayoutItem[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [layout, setLayout] = useState(initialLayout);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !addMenuRef.current?.contains(event.target)) setAddOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [addOpen]);

  const byId = useMemo(() => new Map(items.map((item) => [item.widget.id, item] as const)), [items]);
  const visible = visibleItems(layout);
  const hidden = hiddenItemsOf(layout);

  async function persist(next: WidgetLayoutItem[]) {
    const previous = layout;
    setLayout(next);
    try {
      const saved = await updateDashboardLayout(supabase, athleteId, next);
      setLayout(saved.dashboard_layout ?? next);
      setSaveError(null);
      router.refresh();
    } catch {
      setLayout(previous);
      setSaveError("Could not save layout — try again.");
    }
  }

  // Dragging onto exactly one occupied cell swaps the two widgets (resolveMove); resizing into
  // occupied space never does (growing is "claim empty space," not "trade places"). Either way,
  // a gesture with no valid resolution just leaves `layout` state untouched — react-grid-layout
  // is fully controlled by that prop, so an unchanged prop is what makes the drag/resize
  // visually snap back on its own, no error message needed for something this routine.
  //
  // Deliberately ignores react-grid-layout's own reported positions for every item except the
  // one actually being dragged/resized (applyItemMove, not a full merge): caught live that
  // react-grid-layout's own drag engine can silently nudge a second, uninvolved item to avoid
  // the immediate collision — a nudge that isn't itself checked against a third item, so
  // trusting react-grid-layout's full reported layout could hand back an overlap it introduced.
  // Only newItem's own reported position is trustworthy; everyone else is resolved by
  // resolveMove() below instead.
  function commit(oldItem: LayoutItem | null, newItem: LayoutItem | null, allowSwap: boolean) {
    if (!newItem) return;
    const merged = applyItemMove(layout, newItem.i, newItem);
    const resolved = resolveMove(merged, newItem.i, oldItem ?? newItem, allowSwap);
    if (!resolved || hasOverlap(resolved)) return;
    persist(resolved);
  }

  function handleDragStop(_rglLayout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null) {
    commit(oldItem, newItem, true);
  }

  function handleResizeStop(_rglLayout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null) {
    commit(oldItem, newItem, false);
  }

  function hide(id: string) {
    persist(withItemHidden(layout, id));
  }

  function show(id: string) {
    const entry = byId.get(id);
    if (!entry) return;
    setAddOpen(false);
    const next = withItemShown(layout, id, entry.defaultFootprint);
    if (next.find((item) => item.i === id)?.hidden) {
      setSaveError("Grid is full — hide something first.");
      return;
    }
    persist(next);
  }

  const rglLayout: Layout = visible.map((item) => ({ ...item, minW: 1, minH: 1, maxW: 2, maxH: 2 }));

  return (
    <div className="hidden flex-col gap-3 md:flex">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Critical numbers</span>
        <div className="flex items-center gap-3">
          {saveError && <span className="text-[11px] text-bad">{saveError}</span>}
          {editing && (
            <div ref={addMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAddOpen((value) => !value)}
                disabled={hidden.length === 0}
                className="rounded-md border border-border-strong px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-1 disabled:opacity-40"
              >
                + Add widget
              </button>
              {addOpen && hidden.length > 0 && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-2 w-48 rounded-[10px] border border-border-strong bg-card p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
                >
                  {hidden.map((item) => {
                    const entry = byId.get(item.i);
                    if (!entry) return null;
                    return (
                      <button
                        key={item.i}
                        type="button"
                        role="menuitem"
                        onClick={() => show(item.i)}
                        className="w-full rounded-md px-3 py-2 text-left text-[12.5px] text-muted-1 hover:bg-raised"
                      >
                        {entry.widget.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${
              editing ? "border-accent text-accent" : "border-border-strong text-muted-1"
            }`}
          >
            {editing ? "Done" : "Edit layout"}
          </button>
        </div>
      </div>

      <div
        className="relative"
        // The grid body's own height only reserves room for the rows actually in use — with
        // an empty row 3, that's 2 rows. In edit mode, force the full 3-row height so the
        // dashed empty-cell background isn't overlapped by the section below, and so there's
        // visible room to drag a card down into row 3.
        style={editing ? { minHeight: GRID_ROWS * ROW_HEIGHT + (GRID_ROWS - 1) * GRID_GAP[1] } : undefined}
      >
        {editing && (
          <div
            className="widget-grid-background"
            style={{ display: "grid", gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridAutoRows: ROW_HEIGHT, gap: GRID_GAP[0] }}
          >
            {Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => (
              <div key={i} className="rounded-[10px] border border-dashed border-border-strong" />
            ))}
          </div>
        )}
        <GridLayoutWithWidth
          className={editing ? "widget-grid editing" : "widget-grid"}
          layout={rglLayout}
          cols={GRID_COLS}
          rowHeight={ROW_HEIGHT}
          margin={GRID_GAP}
          containerPadding={[0, 0]}
          maxRows={GRID_ROWS}
          isBounded
          compactType={null}
          // preventCollision is deliberately OFF: it would block a drag from ever reaching an
          // occupied cell at all, which is exactly the case commit()/resolveMove() needs to see
          // in order to swap two widgets. Every result is re-validated with hasOverlap() before
          // it's ever persisted, so this doesn't reopen the overlap bug preventCollision used to
          // guard against — that safety now lives in our own logic instead of react-grid-layout's.
          isDraggable={editing}
          isResizable={editing}
          resizeHandles={editing ? ["se"] : []}
          draggableCancel=".widget-hide-btn"
          onDragStop={handleDragStop}
          onResizeStop={handleResizeStop}
        >
          {visible.map((item) => {
            const entry = byId.get(item.i);
            if (!entry) return null;
            return (
              <div key={item.i}>
                <div className="widget-card">
                  <KpiCard widget={entry.widget} footprint={{ w: item.w, h: item.h }} />
                </div>
                {editing && (
                  <button type="button" className="widget-hide-btn" aria-label={`Hide ${entry.widget.label}`} onClick={() => hide(item.i)}>
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </GridLayoutWithWidth>
      </div>
    </div>
  );
}
