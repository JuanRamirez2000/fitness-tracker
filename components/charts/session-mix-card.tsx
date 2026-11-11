import type { DashboardData } from "@/lib/dashboard/types";
import { buildSessionMix } from "@/lib/charts/all-sports";
import { fmtDate } from "@/lib/dates/format";
import { SPORT_STYLE } from "@/lib/sport";
import { ChartCard, ChartEmpty } from "./chart-card";
import { Stat, StatRow } from "./parts";

/** The card's "?" explanation. */
const HELP =
  "What each session mostly trained, by Garmin's primary training benefit, one mark per session in its sport's color and shape. A good week has plenty of Recovery and Base with one or two harder sessions (Threshold, VO2 max). A grid full of Tempo means most sessions sit in the middle: too hard to recover from, too easy to push fitness.";

/** Weeks across, Garmin's benefit labels down (hardest at the top), a mark per session. */
export function SessionMixCard({ data }: { data: DashboardData }) {
  const chart = buildSessionMix(data);
  const title = "What your sessions trained";
  const subtitle = "Each session by Garmin's training benefit, per week";
  if (!chart) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>no labelled sessions in range</ChartEmpty>
      </ChartCard>
    );
  }
  const total = chart.counts.easy + chart.counts.tempo + chart.counts.hard;
  const share = (n: number) => `${Math.round((n / total) * 100)}%`;
  // Hardest at the top, like intensity; empty rows above the hardest used one are dropped.
  const used = chart.rows.map((r) => r.cells.some((c) => c.length > 0));
  const lastUsed = used.lastIndexOf(true);
  const rows = chart.rows.slice(0, Math.max(lastUsed + 1, 4)).reverse();
  return (
    <ChartCard
      help={HELP}
      title={title}
      subtitle={subtitle}
      legend={chart.sports.map((s) => ({ label: SPORT_STYLE[s].label.toLowerCase(), swatch: <span className={`text-[10px] leading-none ${SPORT_STYLE[s].text}`}>{SPORT_STYLE[s].glyph}</span> }))}
    >
      <StatRow>
        <Stat label="Easy (Recovery, Base)" value={share(chart.counts.easy)} note={`${chart.counts.easy} of ${total}`} />
        <Stat label="Tempo" value={share(chart.counts.tempo)} note={`${chart.counts.tempo} of ${total}`} />
        <Stat label="Hard (Threshold+)" value={share(chart.counts.hard)} note={`${chart.counts.hard} of ${total}`} />
      </StatRow>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse font-mono text-[10px]" aria-label="Sessions per week by training benefit">
          <thead>
            <tr>
              <th className="w-[76px]" />
              {chart.weeks.map((w) => (
                <th key={w} scope="col" className="pb-1.5 text-center font-normal text-muted-2">
                  {fmtDate(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-divider">
                <th scope="row" className="py-1.5 pr-2 text-left font-normal text-muted-1">
                  {row.label}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={i} className="py-1.5 text-center leading-none">
                    {cell.map((s) => (
                      <span key={s.id} title={`${s.name} · ${fmtDate(s.date)}`} className={`mx-[1px] inline-block text-[11px] ${SPORT_STYLE[s.sport].text}`}>
                        {SPORT_STYLE[s.sport].glyph}
                      </span>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
