"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A native <dialog>-based modal: real focus trapping and Escape-to-close for free, styled
 * to match the app's form-dialog frames (2D, 2E, 2F all share this shell). Clicking the
 * backdrop closes it, same as pressing Escape.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        // A click that lands on the <dialog> element itself (not a descendant) hit the
        // backdrop area outside the panel's own box, since the panel is sized to its content.
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={labelledBy}
      className={`m-auto rounded-[14px] border border-border-strong bg-card p-0 text-ink shadow-[0_22px_50px_rgba(0,0,0,0.55)] backdrop:bg-black/60 ${className}`}
    >
      {open && children}
    </dialog>
  );
}
