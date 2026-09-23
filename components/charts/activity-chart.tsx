import { scaleBand } from "@visx/scale";
import { Bar } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildActivityWeeks } from "@/lib/charts/activity";
import { ChartCard } from "./chart-card";

const WIDTH = 400;
const PLOT_HEIGHT = 100;
// A day can carry more than one activity type, so unlike Calories a week's stack has no fixed
// ceiling — a very active week's bar can run taller, same tradeoff the design accepts.
const SEGMENT_UNIT = 9;

/** Weekly stacked bars, one segment per activity type per day it appears on (frame 2A). */
export function ActivityChart({ data }: { data: DashboardData }) {
  const weeks = buildActivityWeeks(data);
  const hasData = weeks.some((w) => Object.values(w.counts).some((c) => c > 0));
  const xScale = scaleBand<string>({ domain: weeks.map((w) => w.weekStart), range: [0, WIDTH], padding: 0.2 });

  return (
    <ChartCard title="Activity" caption={<span>sessions per week</span>}>
      {hasData ? (
        <svg width="100%" viewBox={`0 0 ${WIDTH} ${PLOT_HEIGHT}`} preserveAspectRatio="none" className="overflow-visible">
          {weeks.map((week) => {
            let y = PLOT_HEIGHT;
            return (
              <g key={week.weekStart}>
                {data.activityTypes.map((type) => {
                  const count = week.counts[type.key] ?? 0;
                  if (!count) return null;
                  const height = count * SEGMENT_UNIT;
                  y -= height;
                  return (
                    <Bar
                      key={type.key}
                      x={xScale(week.weekStart) ?? 0}
                      y={y}
                      width={xScale.bandwidth()}
                      height={Math.max(height - 2, 0)}
                      rx={1.5}
                      fill={type.color}
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

      <div className="flex flex-wrap items-center gap-2.5">
        {data.activityTypes.map((type) => (
          <span key={type.key} className="flex items-center gap-1.5 text-[10.5px] text-muted-2">
            <span className="inline-block size-[9px] rounded-[2px]" style={{ background: type.color }} />
            {type.label}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}
