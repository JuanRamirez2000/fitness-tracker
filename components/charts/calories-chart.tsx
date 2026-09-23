"use client";

import { scaleBand } from "@visx/scale";
import { Bar } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildCaloriesLegend, buildCaloriesWeeks, CALORIES_STATUSES } from "@/lib/charts/calories";
import { paletteFor } from "@/lib/theme/palette";
import { useTheme } from "@/lib/theme/theme-context";
import { ChartCard } from "./chart-card";

const WIDTH = 400;
const PLOT_HEIGHT = 100;
// Each logged day within a week stacks a segment this tall; a week can have at most 7 days,
// one status each (accurate/uncertain/missed are mutually exclusive per day), so the tallest
// possible bar (7 * 12 = 84px) always fits inside PLOT_HEIGHT.
const SEGMENT_UNIT = 12;

/** Weekly stacked bars of calorie tracking state (frame 2A). kcal totals have no UI until V1
 * — schema.sql's calories_kcal column is live but unused — so this keeps the design's own
 * "reserved" placeholder for the kcal-vs-target chart that comes later. */
export function CaloriesChart({ data }: { data: DashboardData }) {
  const { mode } = useTheme();
  const legend = buildCaloriesLegend(paletteFor(mode));
  const weeks = buildCaloriesWeeks(data);
  const hasData = weeks.some((w) => Object.values(w.counts).some((c) => c > 0));
  const xScale = scaleBand<string>({ domain: weeks.map((w) => w.weekStart), range: [0, WIDTH], padding: 0.2 });

  return (
    <ChartCard title="Calories" caption={<span>tracking state by week</span>}>
      {hasData ? (
        <svg width="100%" viewBox={`0 0 ${WIDTH} ${PLOT_HEIGHT}`} preserveAspectRatio="none" className="overflow-visible">
          {weeks.map((week) => {
            let y = PLOT_HEIGHT;
            return (
              <g key={week.weekStart}>
                {CALORIES_STATUSES.map((status) => {
                  const count = week.counts[status];
                  if (!count) return null;
                  const height = count * SEGMENT_UNIT;
                  y -= height;
                  return (
                    <Bar
                      key={status}
                      x={xScale(week.weekStart) ?? 0}
                      y={y}
                      width={xScale.bandwidth()}
                      height={Math.max(height - 2, 0)}
                      rx={1.5}
                      fill={legend.find((l) => l.status === status)!.color}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="py-8 text-center text-[12px] text-muted-2">Nothing logged in this range yet.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {legend.map((l) => (
          <span key={l.status} className="flex items-center gap-1.5 text-[10.5px] text-muted-2">
            <span className="inline-block size-[9px] rounded-[2px]" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-3">Reserved</span>
        <span className="text-[11px] text-muted-2">Daily kcal vs target — kcal field arrives in V1</span>
      </div>
    </ChartCard>
  );
}
