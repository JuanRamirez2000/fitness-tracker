"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A "?" button for a card's top-right corner that opens a short explanation of the card: what it
 * shows and how to read it. Click or tap to open; Escape, a click outside, or the button again
 * closes it.
 */
export function HelpTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`flex size-5 items-center justify-center rounded-full border font-mono text-[10.5px] leading-none transition-colors ${
          open ? "border-muted-1 text-ink" : "border-border-strong text-muted-2 hover:border-muted-2 hover:text-ink"
        }`}
      >
        ?
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={`About ${title}`}
          className="absolute right-0 top-7 z-30 w-[min(300px,calc(100vw-48px))] rounded-[9px] border border-border-strong bg-raised px-3.5 py-3 text-[12px] leading-[1.55] text-muted-1 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-1 font-serif text-[14px] text-ink">{title}</div>
          {children}
        </div>
      )}
    </span>
  );
}
