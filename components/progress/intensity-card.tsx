import { ChartCard, ChartEmpty } from "@/components/charts/chart-card";
import { Swatch } from "@/components/charts/parts";
import { EASY_SHARE_AIM } from "@/lib/charts/training";
import { fmtDate } from "@/lib/dates/format";
import type { IntensitySplit } from "@/lib/progress/build";

const HELP =
  "Each week's training time split by heart rate, every sport together: easy (zones 1 and 2), moderate (zone 3) and hard (zones 4 and 5). Most endurance coaches suggest about 80% easy, which builds the engine without wearing you down. Zone 3 is the trap: hard enough to tire you, not hard enough to make you faster. Cycling uses Garmin's cycling zones.";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Weekly easy / moderate / hard bars, each scaled to its own week's total, with the 80% aim marked. */
export function IntensityCard({ split }: { split: IntensitySplit | null }) {
  const title = "Easy vs hard";
  const subtitle = "Share of each week's time by heart rate, against the 80% easy aim";
  if (!split) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>no heart rate zones in these weeks</ChartEmpty>
      </ChartCard>
    );
  }
  const verdict =
    split.share === null
      ? "No training with heart rate this week yet."
      : split.share >= EASY_SHARE_AIM
        ? `${pct(split.share)} easy this week: right where it should be.`
        : `${pct(split.share)} easy this week, under the ${pct(EASY_SHARE_AIM)} aim. Slow the easy sessions down rather than cutting the hard ones.`;
  return (
    <ChartCard
      help={HELP}
      title={title}
      subtitle={subtitle}
      legend={[
        { label: "easy", swatch: Swatch.band("bg-z2") },
        { label: "moderate", swatch: Swatch.band("bg-z3") },
        { label: "hard", swatch: Swatch.band("bg-z5") },
        { label: "80% aim", swatch: <span className="inline-block h-3 w-px bg-ink" /> },
      ]}
      note={split.priorShare !== null ? `The 4 weeks before: ${pct(split.priorShare)} easy` : undefined}
    >
      <p className={`text-[12.5px] ${split.share !== null && split.share < EASY_SHARE_AIM ? "text-warn" : "text-muted-1"}`}>{verdict}</p>
      <ul className="flex flex-col gap-1.5">
        {split.weeks.map((w) => {
          const total = w.easy + w.moderate + w.hard;
          return (
            <li key={w.monday} className="grid grid-cols-[64px_minmax(0,1fr)_40px] items-center gap-2 font-mono text-[10px] text-muted-2">
              <span>{fmtDate(w.monday)}{w.partial ? "*" : ""}</span>
              <div className="relative h-3 overflow-hidden rounded-[3px] bg-track" role="img" aria-label={total ? `${w.easy} min easy, ${w.moderate} moderate, ${w.hard} hard` : "no heart rate data"}>
                {total > 0 && (
                  <div className="flex h-full">
                    <div className="bg-z2" style={{ width: `${(w.easy / total) * 100}%` }} />
                    <div className="bg-z3" style={{ width: `${(w.moderate / total) * 100}%` }} />
                    <div className="bg-z5" style={{ width: `${(w.hard / total) * 100}%` }} />
                  </div>
                )}
                <div className="absolute inset-y-0 w-px bg-ink" style={{ left: `${EASY_SHARE_AIM * 100}%` }} />
              </div>
              <span className="text-right">{w.easyShare === null ? "–" : pct(w.easyShare)}</span>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
