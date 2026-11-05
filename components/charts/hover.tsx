"use client";

import { useRef, type ReactNode } from "react";

/**
 * A transparent layer over a chart that reports where the pointer is, as a fraction of the
 * plot's width (0 = left edge, 1 = right), or null when it leaves. Mouse, pen and touch alike:
 * a finger drags the crosshair, and vertical swipes still scroll the page (touch-action: pan-y).
 * Arrow keys step through `steps` points when the layer has focus.
 */
export function HoverLayer({
  onHover,
  onStep,
  label,
  steps,
  current,
  children,
  className = "",
}: {
  onHover: (fraction: number | null) => void;
  /** Arrow keys: the index of the point to move to. */
  onStep?: (index: number) => void;
  /** What the arrow keys move through, for the screen-reader label. */
  label: string;
  /** How many points the arrow keys step across, and the current point's position. */
  steps?: number;
  current?: number | null;
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const report = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onHover(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  };
  return (
    <div
      ref={ref}
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={steps ? steps - 1 : 1}
      aria-valuenow={current ?? 0}
      className={`absolute inset-0 touch-pan-y outline-none focus-visible:ring-1 focus-visible:ring-accent/60 ${className}`}
      onPointerMove={(e) => report(e.clientX)}
      onPointerDown={(e) => report(e.clientX)}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") onHover(null);
      }}
      onBlur={() => onHover(null)}
      onKeyDown={(e) => {
        if (!steps || steps < 2 || !onStep) return;
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const at = current ?? (e.key === "ArrowLeft" ? steps : -1);
        const next = Math.min(steps - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)));
        onStep(next);
      }}
    >
      {children}
    </div>
  );
}

/** A vertical rule at `fraction` of a plot's width, drawn in HTML so it stays one pixel wide. */
export function Crosshair({ fraction }: { fraction: number | null }) {
  if (fraction === null) return null;
  return (
    <span
      className="pointer-events-none absolute inset-y-0 w-px bg-ink/45"
      style={{ left: `${fraction * 100}%` }}
      aria-hidden
    />
  );
}
