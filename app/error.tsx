"use client";

import { useEffect } from "react";

/** Next's route-level error boundary: catches anything loadDashboardData or a render throws
 * that nothing closer to it already handles (every fetch-on-mount client component in this
 * app — DataTable, the charts, DayEditorSheet, FeatureRequestsPanel — has its own inline
 * error state; this is the backstop for the server-rendered page itself). */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <span className="font-serif text-[20px]">Something broke</span>
      <p className="max-w-[360px] text-[13px] text-muted-2">
        The dashboard couldn&rsquo;t load. Nothing was saved incorrectly — try again, and if it keeps happening let
        the other person know.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-1 rounded-lg bg-accent px-4 py-2 text-[12.5px] font-medium text-bg"
      >
        Try again
      </button>
    </main>
  );
}
