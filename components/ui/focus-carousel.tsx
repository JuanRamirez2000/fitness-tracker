"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface FocusSlide {
  key: string;
  /** Short name for the dot's label and the tab above ("Today", "Runna", "Plan vs done"). */
  title: string;
  node: ReactNode;
}

/**
 * "In focus": one big view at a time, swiped sideways (scroll-snap, so it's the browser's own
 * momentum and works without JS), with the next one peeking in at the edge. Named tabs above
 * and dots below jump between them and show which is on screen; arrows step through them from a
 * tablet up. The track is as tall as the view on screen.
 */
export function FocusCarousel({ slides, label = "In focus" }: { slides: FocusSlide[]; label?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // The slide most in view is the active one.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const items = [...el.children] as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(items.indexOf(e.target as HTMLElement));
      },
      { root: el, threshold: 0.6 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, [slides.length]);

  // The track takes the height of the view on screen, not the tallest one.
  useEffect(() => {
    const el = track.current;
    const item = el?.children[active] as HTMLElement | undefined;
    if (!el || !item) return;
    const fit = () => (el.style.height = `${item.offsetHeight + 4}px`);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(item);
    return () => ro.disconnect();
  }, [active]);

  const go = (i: number) => {
    const el = track.current;
    const item = el?.children[Math.max(0, Math.min(slides.length - 1, i))] as HTMLElement | undefined;
    if (el && item) el.scrollTo({ left: item.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  if (!slides.length) return null;
  return (
    <section aria-roledescription="carousel" aria-label={label} data-mm className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label={`${label} views`} className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => go(i)}
              className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
                i === active ? "bg-accent text-bg" : "text-muted-2 hover:text-ink"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="hidden shrink-0 gap-1.5 md:flex">
          <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous view" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-1 hover:text-ink disabled:opacity-40">
            ←
          </button>
          <button type="button" onClick={() => go(active + 1)} disabled={active === slides.length - 1} aria-label="Next view" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-1 hover:text-ink disabled:opacity-40">
            →
          </button>
        </div>
      </div>
      <div ref={track} className="-mx-4 flex items-start snap-x snap-mandatory overflow-y-hidden transition-[height] duration-200 scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:scroll-px-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((s, i) => (
          <div
            key={s.key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${s.title}`}
            className="w-[calc(100%-28px)] shrink-0 snap-start md:w-full"
          >
            {s.node}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            tabIndex={-1}
            onClick={() => go(i)}
            className={`rounded-full transition-all ${i === active ? "h-2 w-2 bg-ink" : "h-1.5 w-1.5 bg-muted-3"}`}
          />
        ))}
      </div>
    </section>
  );
}
