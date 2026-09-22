import { CRITICAL_NUMBERS } from "@/dashboard.config";
import type { DashboardData } from "@/lib/dashboard/types";
import { emptySlotCount, GRID_COLUMNS } from "@/lib/kpis/grid";
import { KpiCard } from "./kpi-card";

// The core four only, matching frame 2B — the four example slots are a desktop-only row.
const MOBILE_COUNT = 4;

function OpenSlotCard() {
  return (
    <div className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-border-strong px-[15px] py-[13px] text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-3">open slot</span>
      <span className="max-w-[220px] text-[11.5px] leading-[1.5] text-muted-2">
        Same card anatomy. Room for what comes next.
      </span>
    </div>
  );
}

/** Adding a critical number is one new file plus one line in dashboard.config.ts — this
 * component never changes. It just runs the registry and pads out to full rows. */
export function KpiGrid({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Critical numbers</span>
        <span className="hidden font-mono text-[10px] text-muted-3 md:inline">
          {"one card anatomy · slots open for new metrics"}
        </span>
      </div>

      {/* Mobile (frame 2B): the core four, 2 columns, no sparklines. */}
      <div className="grid grid-cols-2 gap-2.5 md:hidden">
        {CRITICAL_NUMBERS.slice(0, MOBILE_COUNT).map((def) => (
          <KpiCard key={def.id} def={def} value={def.compute(data)} compact />
        ))}
      </div>

      {/* Desktop (frame 2A): every configured KPI, padded out to full rows. */}
      <div className="hidden gap-3 md:grid" style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` }}>
        {CRITICAL_NUMBERS.map((def) => (
          <KpiCard key={def.id} def={def} value={def.compute(data)} />
        ))}
        {Array.from({ length: emptySlotCount(CRITICAL_NUMBERS) }, (_, i) => (
          <OpenSlotCard key={`open-slot-${i}`} />
        ))}
      </div>
    </div>
  );
}
