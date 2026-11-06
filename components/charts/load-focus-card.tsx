import type { DashboardData } from "@/lib/dashboard/types";
import { FOCUS_GLYPH, FOCUS_WORD, buildLoadFocus, type FocusState } from "@/lib/charts/training";
import { fmtDate } from "@/lib/dates/format";
import { titleCase } from "@/lib/today/hero";
import { ChartCard, ChartEmpty } from "./chart-card";
import { Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP = "How your last four weeks of training load splits across low aerobic (easy), high aerobic (tempo) and anaerobic (hard) work, against the ranges Garmin suggests for a balanced mix. Bars inside their outlined target are on track.";

const STATE_TEXT: Record<FocusState, string> = { above: "text-warn", in: "text-good", below: "text-warn" };

/** Garmin's 4-week load per focus as bars over a track, each with Garmin's target range outlined. */
export function LoadFocusCard({ data }: { data: DashboardData }) {
  const focus = buildLoadFocus(data);
  const title = "Load focus";
  if (!focus) {
    return (
      <ChartCard help={HELP} title={title} subtitle="Last 4 weeks of load, against Garmin's targets">
        <ChartEmpty>no load focus yet</ChartEmpty>
      </ChartCard>
    );
  }

  const at = (v: number) => `${(v / focus.max) * 100}%`;
  return (
    <ChartCard help={HELP}
      title={title}
      subtitle={`Last 4 weeks of load, against Garmin's targets · ${fmtDate(focus.date)}`}
      legend={[
        { label: "load", swatch: Swatch.band("bg-accent") },
        { label: "target range", swatch: <span className="inline-block h-2.5 w-3 rounded-[2px] border border-ink" /> },
      ]}
      note={focus.feedback ? titleCase(focus.feedback) : undefined}
    >
      <ul className="flex flex-col gap-4">
        {focus.bars.map((b) => (
          <li key={b.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span>{b.label}</span>
              <span className="font-mono text-[11.5px] text-muted-2">
                <span className="text-ink">{Math.round(b.value)}</span>{" "}
                <span className={STATE_TEXT[b.state]} aria-hidden>
                  {FOCUS_GLYPH[b.state]}
                </span>{" "}
                {FOCUS_WORD[b.state]} · target {b.low}–{b.high}
              </span>
            </div>
            <div
              className="relative h-3 rounded-[3px] bg-track"
              role="img"
              aria-label={`${b.label}: ${Math.round(b.value)}, ${FOCUS_WORD[b.state]} the target of ${b.low} to ${b.high}`}
            >
              <div className="absolute inset-y-0 left-0 rounded-[3px] bg-accent/80" style={{ width: at(b.value) }} />
              <div className="absolute -inset-y-[3px] rounded-[3px] border border-ink" style={{ left: at(b.low), width: `calc(${at(b.high)} - ${at(b.low)})` }} />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
