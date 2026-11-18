"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A minimap of the page, like VS Code's: every card drawn to scale down the right edge, section
 * headings named, and a box for what's on screen. Click or drag anywhere on it to scroll there.
 * Where the window leaves room beside the content it's a full map; otherwise a slim rail in the
 * right gutter (a scrubber on a phone). Built from the page's own layout, so a new card shows up
 * without any wiring. Hidden when the page is barely taller than the window.
 */

interface Block {
  top: number;
  height: number;
  left: number;
  width: number;
  /** A section heading's text: drawn as a label (full mode) and as the blocks' tooltip. */
  label?: string;
}

const FULL_WIDTH = 64;
const SLIM_WIDTH = 10;
/** Room needed beside the content (each side) for the full map. */
const FULL_MARGIN = FULL_WIDTH + 20;
const MIN_PAGE_RATIO = 1.4;

function isGrid(el: Element): boolean {
  return getComputedStyle(el).display === "grid";
}

/** The page's cards, in page coordinates: each section's children, a grid's cells one by one. */
function measure(root: HTMLElement): { blocks: Block[]; left: number; width: number } {
  const box = root.getBoundingClientRect();
  const blocks: Block[] = [];
  const add = (el: Element, label?: string) => {
    const r = el.getBoundingClientRect();
    if (r.height < 4 || r.width < 4) return;
    blocks.push({ top: r.top + window.scrollY, height: r.height, left: r.left - box.left, width: r.width, label });
  };
  const visit = (el: Element, depth: number) => {
    const h2 = el.querySelector(":scope > h2, :scope h2");
    if (h2 && el.getBoundingClientRect().height < 140 && !el.querySelector("section")) return add(el, h2.textContent ?? undefined);
    if (depth < 3 && (el.tagName === "SECTION" || el.tagName === "NAV" || isGrid(el) || el.children.length === 1) && el.children.length > 0 && !el.hasAttribute("data-mm")) {
      for (const c of el.children) visit(c, depth + 1);
      return;
    }
    add(el);
  };
  for (const c of root.children) visit(c, 0);
  return { blocks, left: box.left, width: box.width };
}

export function PageMinimap() {
  const [state, setState] = useState<{ blocks: Block[]; docHeight: number; full: boolean; contentWidth: number; top: number } | null>(null);
  const view = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const recompute = useCallback(() => {
    const root = document.querySelector("main")?.firstElementChild as HTMLElement | null;
    const header = document.querySelector("header");
    if (!root) return;
    const docHeight = document.documentElement.scrollHeight;
    if (docHeight < window.innerHeight * MIN_PAGE_RATIO) return setState(null);
    const { blocks, left, width } = measure(root);
    setState({ blocks, docHeight, full: left >= FULL_MARGIN, contentWidth: width, top: header ? header.getBoundingClientRect().height : 0 });
  }, []);

  // Re-measure when the page's layout changes: streaming content, a resize, an opened fold.
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    };
    schedule();
    const main = document.querySelector("main");
    const ro = new ResizeObserver(schedule);
    if (main) ro.observe(main);
    const mo = new MutationObserver(schedule);
    if (main) mo.observe(main, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("toggle", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("toggle", schedule, true);
    };
  }, [recompute]);

  // The viewport box follows the scroll without a re-render.
  useEffect(() => {
    if (!state) return;
    const railHeight = () => rail.current?.clientHeight ?? 0;
    const update = () => {
      const s = railHeight() / state.docHeight;
      if (view.current) {
        view.current.style.transform = `translateY(${window.scrollY * s}px)`;
        view.current.style.height = `${Math.max(12, window.innerHeight * s)}px`;
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [state]);

  if (!state) return null;
  const width = state.full ? FULL_WIDTH : SLIM_WIDTH;

  const scrollToPointer = (clientY: number, smooth: boolean) => {
    const el = rail.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = ((clientY - r.top) / r.height) * state.docHeight - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, y), behavior: smooth ? "smooth" : "instant" });
  };

  return (
    <div
      ref={rail}
      aria-hidden="true"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        scrollToPointer(e.clientY, !state.full);
      }}
      onPointerMove={(e) => dragging.current && scrollToPointer(e.clientY, false)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      className={`fixed bottom-2 z-10 cursor-pointer touch-none select-none overflow-hidden ${state.full ? "right-3 rounded-md border border-border-strong bg-card/80" : "right-[3px] rounded-full bg-border-strong/70 md:right-2"}`}
      style={{ top: state.top + 8, width }}
    >
      {state.blocks.map((b, i) => {
        const s = 1 / state.docHeight;
        const style = {
          top: `${b.top * s * 100}%`,
          height: `${Math.max(b.height * s * 100, 0.15)}%`,
          left: state.full ? `${(b.left / state.contentWidth) * 100}%` : "15%",
          width: state.full ? `${(b.width / state.contentWidth) * 100}%` : "70%",
        };
        return b.label ? (
          <div key={i} className="absolute flex items-center overflow-hidden" style={style}>
            {state.full ? (
              <span className="truncate px-0.5 font-serif text-[7px] leading-none text-accent">{b.label}</span>
            ) : (
              <span className="h-[2px] w-full rounded-full bg-accent" />
            )}
          </div>
        ) : (
          <div key={i} className="absolute rounded-[1.5px] bg-muted-3/45" style={style} />
        );
      })}
      <div ref={view} className={`absolute inset-x-0 top-0 border border-accent/70 bg-accent/15 ${state.full ? "rounded-[3px]" : "rounded-full"}`} />
    </div>
  );
}
