"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * `app/layout.tsx` runs a small blocking inline script before first paint that reads
 * localStorage and sets `document.documentElement.dataset.theme` synchronously — the same
 * flash-of-wrong-theme fix every theme switcher needs, since React itself can't run before
 * paint. This provider's initial state of "dark" only matters for the render before that
 * effect below can read what the script already set; the `useEffect` corrects it on mount,
 * same category of one-render correction as RangeControl's own localStorage read.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    // Genuinely not the same shape as this codebase's other two set-state-in-effect fixes
    // (EntryFormDialog's remount key, QuickLogSheet's conditional mount) — those replaced an
    // unnecessary reset effect with letting React's own fresh-mount state do the work. This
    // effect has nothing to replace it with: it reads a DOM attribute an external, non-React
    // script set before hydration, which is exactly the "subscribe to an external system"
    // case react-hooks/set-state-in-effect's own description carves out as legitimate. Every
    // theme switcher that avoids an SSR/client mismatch (including next-themes) needs this
    // same one-time read-after-mount; there is no version of it that isn't "effect + setState".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    setMode((previous) => {
      const next: ThemeMode = previous === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing or blocked storage — the toggle still works for this page load,
        // it just won't be remembered next time. Not worth surfacing as an error.
      }
      return next;
    });
  }

  return <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** The exact script app/layout.tsx inlines before first paint. Exported as a string (not run
 * here) so the one source of truth is trivially unit-testable without a DOM. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light")document.documentElement.dataset.theme="light";}catch(e){}})();`;
