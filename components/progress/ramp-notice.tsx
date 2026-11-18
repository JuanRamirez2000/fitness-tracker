import type { RunRamp } from "@/lib/running/ramp";

/** One line when running mileage is climbing too fast (lib/running/ramp.ts). */
export function RampNotice({ ramp }: { ramp: RunRamp }) {
  return (
    <div role="status" className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[12.5px] text-ink md:px-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-warn">Running is ramping up · </span>
      {ramp.text}
    </div>
  );
}
