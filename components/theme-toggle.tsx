"use client";

import { useTheme } from "@/lib/theme/theme-context";

/** Sits in the account cluster next to AccountMenu — no design frame covers this either
 * (the whole light theme postdates the design file), so it follows the app's existing
 * small-icon-button convention (AccountMenu's own circular trigger) rather than inventing
 * a new shape. */
export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="flex size-[30px] items-center justify-center rounded-full border border-border-strong bg-raised text-[13px] text-muted-2"
    >
      {mode === "dark" ? "☀" : "☾"}
    </button>
  );
}
