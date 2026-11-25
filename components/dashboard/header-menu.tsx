"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/lib/auth/actions";
import type { TabKey } from "@/lib/dashboard/types";
import type { Profile } from "@/lib/data/profiles";
import { ThemeToggle } from "../theme-toggle";
import { GarminRefreshButton } from "./garmin-refresh-button";
import { SettingsDialog } from "./settings-dialog";

/** The phone header's menu with its contents: what the lg header shows in a row. */
export function PhoneHeaderMenu({ tab, profile, canEdit }: { tab: TabKey; profile: Profile; canEdit: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <HeaderMenu busy={busy}>
      {canEdit && <GarminRefreshButton tab={tab} onBusyChange={setBusy} stacked />}
      {canEdit && (
        <MenuRow label="Goals and profile">
          <SettingsDialog profile={profile} />
        </MenuRow>
      )}
      <MenuRow label="Theme">
        <ThemeToggle />
      </MenuRow>
      <div className="border-t border-divider pt-2.5">
        {canEdit ? (
          <form action={signOut}>
            <button type="submit" className="text-[12.5px] text-muted-2 hover:text-ink">
              Lock editing
            </button>
          </form>
        ) : (
          <Link href="/login" className="text-[12.5px] text-muted-2 hover:text-ink">
            Unlock editing
          </Link>
        )}
      </div>
    </HeaderMenu>
  );
}

/**
 * The phone header's ⋯ menu (below lg): Refresh, Settings, the theme and Lock or Edit, which sit
 * in a row of their own from lg up. The panel stays mounted while closed (only hidden), so a
 * dialog opened from it (Settings) and a Refresh still running keep their state. Clicks inside the
 * panel, the Settings dialog included, don't close it; a click anywhere else or Escape does.
 */
export function HeaderMenu({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      // Escape inside an open dialog closes the dialog only.
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={busy ? "More: refreshing" : "More"}
        className="flex size-[32px] items-center justify-center rounded-full border border-border-strong bg-raised text-[15px] leading-none text-muted-1"
      >
        {busy ? <span className="animate-spin">↻</span> : "⋯"}
      </button>
      <div
        className={`${open ? "flex" : "hidden"} absolute top-[calc(100%+8px)] right-0 z-30 w-[220px] flex-col items-stretch gap-3 rounded-[12px] border border-border-strong bg-card p-3 shadow-[0_16px_36px_rgba(0,0,0,0.35)]`}
      >
        {children}
      </div>
    </div>
  );
}

/** One labelled line in the menu: the words on the left, the control on the right. */
export function MenuRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px] text-muted-1">
      <span>{label}</span>
      {children}
    </div>
  );
}
