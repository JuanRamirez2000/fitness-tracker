"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout/legacy";
import { updateDashboardLayout } from "@/lib/data/profiles";
import {
  GRID_COLS,
  GRID_ROWS,
  hiddenItemsOf,
  mergeRglPositions,
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

  function commitFromRgl(rglLayout: Layout) {
    persist(mergeRglPositions(layout, rglLayout));
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
          // compactType alone only governs whether gaps get auto-closed after a move — it does
          // NOT stop a drag/resize from settling into an overlap. preventCollision is the prop
          // that actually rejects (snaps back) any move that would overlap another card;
          // without it, two items can end up on the same cells (caught live while testing).
          preventCollision
          isDraggable={editing}
          isResizable={editing}
          resizeHandles={editing ? ["se"] : []}
          draggableCancel=".widget-hide-btn"
          onDragStop={commitFromRgl}
          onResizeStop={commitFromRgl}
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
