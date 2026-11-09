import type { ReactNode } from "react";
import type { ActivityContext, IntervalRow, RideSplitRow, SplitRow, StatGroup, ZoneRow } from "@/lib/activity/view";
import { fmtPace } from "@/lib/running/runs";

const ZONE_BG = ["bg-z1", "bg-z2", "bg-z3", "bg-z4", "bg-z5"];
const ZONE_NAMES = ["Warm-up", "Easy", "Aerobic", "Threshold", "Maximum"];

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 md:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-[15px] md:text-[16px]">{title}</h3>
        {aside && <span className="font-mono text-[9.5px] text-muted-2">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

const th = "pb-1.5 font-mono text-[9.5px] font-normal uppercase tracking-[0.08em] text-muted-2";
const td = "py-1.5 text-[12.5px] tabular-nums";

/** Mile by mile, with a bar per mile scaled to its speed and the fastest full mile marked. */
export function SplitsTable({ splits }: { splits: SplitRow[] }) {
  const full = splits.filter((s) => s.label === String(s.mile));
  const fastest = full.length > 1 ? Math.min(...full.map((s) => s.pace_s)) : null;
  const slowest = Math.max(...splits.map((s) => s.pace_s));
  const quickest = Math.min(...splits.map((s) => s.pace_s));
  const hasGap = splits.some((s) => s.gapPace_s !== null);
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-divider">
          <th className={th}>Mile</th>
          <th className={th}>Pace</th>
          <th className={`${th} hidden sm:table-cell`} aria-label="Pace bar" />
          {hasGap && <th className={`${th} text-right`}>GAP</th>}
          <th className={`${th} text-right`}>HR</th>
          <th className={`${th} text-right`}>Cad</th>
          <th className={`${th} text-right`}>Elev ft</th>
        </tr>
      </thead>
      <tbody>
        {splits.map((s) => {
          // Faster miles get longer bars: the slowest gets a quarter of the width, the quickest all of it.
          const share = slowest === quickest ? 1 : 0.25 + (0.75 * (slowest - s.pace_s)) / (slowest - quickest);
          const best = s.pace_s === fastest;
          return (
            <tr key={s.mile} className="border-b border-divider/50 last:border-0">
              <td className={`${td} text-muted-1`}>{s.label}</td>
              <td className={`${td} whitespace-nowrap text-ink`}>
                {fmtPace(s.pace_s)}
                {best && (
                  <span className="ml-1.5 font-mono text-[9px] text-accent" title="Fastest full mile">
                    ▲ best
                  </span>
                )}
              </td>
              <td className={`${td} hidden w-[34%] sm:table-cell`}>
                <span className={`block h-1.5 rounded-full ${best ? "bg-accent" : "bg-muted-3/60"}`} style={{ width: `${share * 100}%` }} />
              </td>
              {hasGap && <td className={`${td} text-right text-muted-2`}>{s.gapPace_s !== null ? fmtPace(s.gapPace_s) : "—"}</td>}
              <td className={`${td} text-right text-muted-2`}>{s.hr ?? "—"}</td>
              <td className={`${td} text-right text-muted-2`}>{s.cadence ?? "—"}</td>
              <td className={`${td} whitespace-nowrap text-right text-muted-2`}>
                +{s.elevGainFt} / −{s.elevLossFt}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A ride's 5-mile (or, indoors, 5-minute) splits, with a bar per split scaled to its power, or speed without a power meter. */
export function RideSplitsTable({ splits }: { splits: RideSplitRow[] }) {
  const hasPower = splits.some((s) => s.power !== null);
  const hasSpeed = splits.some((s) => s.mph !== null);
  const hasClimb = splits.some((s) => s.elevGainFt > 0);
  const hasCadence = splits.some((s) => s.cadence !== null);
  const measure = (s: RideSplitRow) => (hasPower ? s.power : s.mph) ?? 0;
  const top = Math.max(...splits.map(measure));
  const low = Math.min(...splits.map(measure));
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-divider">
          <th className={th}>Split</th>
          <th className={`${th} text-right`}>Time</th>
          {hasSpeed && <th className={`${th} text-right`}>Mph</th>}
          {hasPower && <th className={`${th} text-right`}>Watts</th>}
          <th className={`${th} hidden sm:table-cell`} aria-label={hasPower ? "Power bar" : "Speed bar"} />
          <th className={`${th} text-right`}>HR</th>
          {hasCadence && <th className={`${th} text-right`}>Rpm</th>}
          {hasClimb && <th className={`${th} text-right`}>Climb ft</th>}
        </tr>
      </thead>
      <tbody>
        {splits.map((s) => {
          const share = top === low ? 1 : 0.25 + (0.75 * (measure(s) - low)) / (top - low);
          return (
            <tr key={s.split} className="border-b border-divider/50 last:border-0">
              <td className={`${td} whitespace-nowrap text-muted-1`}>{s.label}</td>
              <td className={`${td} text-right text-muted-2`}>{s.duration}</td>
              {hasSpeed && <td className={`${td} text-right text-ink`}>{s.mph !== null ? s.mph.toFixed(1) : "—"}</td>}
              {hasPower && <td className={`${td} text-right text-ink`}>{s.power ?? "—"}</td>}
              <td className={`${td} hidden w-[28%] sm:table-cell`}>
                <span className="block h-1.5 rounded-full bg-muted-3/60" style={{ width: `${share * 100}%` }} />
              </td>
              <td className={`${td} text-right text-muted-2`}>{s.hr ?? "—"}</td>
              {hasCadence && <td className={`${td} text-right text-muted-2`}>{s.cadence ?? "—"}</td>}
              {hasClimb && <td className={`${td} text-right text-muted-2`}>+{s.elevGainFt}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A stacked bar of time in each zone, then one row per zone with its bpm range. */
export function ZonesBreakdown({ zones }: { zones: ZoneRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[3px]" role="img" aria-label={zones.map((z) => `Zone ${z.zone} ${Math.round(z.share * 100)}%`).join(", ")}>
        {zones.map((z) => (z.share > 0 ? <span key={z.zone} className={ZONE_BG[z.zone - 1]} style={{ width: `${z.share * 100}%` }} /> : null))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {[...zones].reverse().map((z) => (
          <li key={z.zone} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 text-[12px]">
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted-1">
              <span className={`inline-block h-2 w-2 rounded-[1px] ${ZONE_BG[z.zone - 1]}`} />Z{z.zone}
            </span>
            <span className="truncate text-muted-2">
              {ZONE_NAMES[z.zone - 1]}
              {z.low !== null && <span className="text-muted-3"> · {z.low}–{z.high}</span>}
            </span>
            <span className="tabular-nums text-ink">{z.minutes >= 1 ? `${Math.round(z.minutes)} min` : z.minutes > 0 ? "<1 min" : "—"}</span>
            <span className="w-9 text-right tabular-nums text-muted-2">{Math.round(z.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IntervalsTable({ intervals, isRun }: { intervals: IntervalRow[]; isRun: boolean }) {
  const hasPower = intervals.some((r) => r.power !== null);
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-divider">
          <th className={th}>Segment</th>
          <th className={`${th} text-right`}>×</th>
          <th className={`${th} text-right`}>Mi</th>
          <th className={`${th} text-right`}>Time</th>
          <th className={`${th} text-right`}>{isRun ? "Pace" : "Speed"}</th>
          {hasPower && <th className={`${th} text-right`}>Watts</th>}
          <th className={`${th} text-right`}>HR</th>
        </tr>
      </thead>
      <tbody>
        {intervals.map((r) => (
          <tr key={r.label} className="border-b border-divider/50 last:border-0">
            <td className={`${td} text-ink`}>{r.label}</td>
            <td className={`${td} text-right text-muted-2`}>{r.count}</td>
            <td className={`${td} text-right text-muted-2`}>{r.miles !== null ? r.miles.toFixed(2) : "—"}</td>
            <td className={`${td} text-right text-muted-2`}>{r.duration ?? "—"}</td>
            <td className={`${td} whitespace-nowrap text-right text-ink`}>{r.speed ?? "—"}</td>
            {hasPower && <td className={`${td} text-right text-muted-2`}>{r.power ?? "—"}</td>}
            <td className={`${td} text-right text-muted-2`}>{r.hr ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Fact({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">{label}</span>
      <span className={`text-[14px] ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink"}`}>{value}</span>
      {note && <span className="text-[11.5px] leading-snug text-muted-2">{note}</span>}
    </div>
  );
}

/** How this activity sits against the rest of the training, and the body going into it. */
export function ContextFacts({ context: c, isRun, isRide }: { context: ActivityContext; isRun: boolean; isRide: boolean }) {
  const facts: ReactNode[] = [];
  if (c.similar?.sport === "ride") {
    const s = c.similar;
    const kind = s.kind ? `${s.kind === "easy" ? "easy" : "hard"} rides` : "rides";
    const pool = `${s.count + 1} ${kind} this long in the last 4 months`;
    if (s.powerDelta_w !== null) {
      facts.push(
        <Fact
          key="power"
          label="Power vs similar rides"
          value={s.powerDelta_w === 0 ? "Same as usual" : `${Math.abs(s.powerDelta_w)} W ${s.powerDelta_w > 0 ? "more" : "less"}`}
          note={`${s.paceRank === 1 ? "Strongest" : `#${s.paceRank}`} of ${pool}`}
          tone={s.powerDelta_w >= 5 ? "good" : undefined}
        />,
      );
    }
    if (s.speedDelta_mph !== null) {
      facts.push(
        <Fact
          key="speed"
          label="Speed vs similar rides"
          value={s.speedDelta_mph === 0 ? "Same as usual" : `${Math.abs(s.speedDelta_mph).toFixed(1)} mph ${s.speedDelta_mph > 0 ? "faster" : "slower"}`}
          note={s.powerDelta_w === null ? `${s.paceRank === 1 ? "Fastest" : `#${s.paceRank}`} of ${pool}` : "terrain and wind move this more than fitness"}
        />,
      );
    }
    if (s.efficiencyPct !== null) {
      facts.push(
        <Fact
          key="eff"
          label="Watts per heartbeat"
          value={`${s.efficiencyPct > 0 ? "+" : s.efficiencyPct < 0 ? "−" : "±"}${Math.abs(s.efficiencyPct).toFixed(1)}%`}
          note={s.hrDelta !== null ? `Average HR ${s.hrDelta === 0 ? "the same as" : `${Math.abs(s.hrDelta)} bpm ${s.hrDelta > 0 ? "higher" : "lower"} than`} usual` : undefined}
          tone={s.efficiencyPct >= 2 ? "good" : s.efficiencyPct <= -4 ? "bad" : undefined}
        />,
      );
    }
  } else if (c.similar) {
    const s = c.similar;
    const kind = s.kind ? `${s.kind === "easy" ? "easy" : "workout"} runs` : "runs";
    facts.push(
      <Fact
        key="pace"
        label="Pace vs similar runs"
        value={
          s.paceDelta_s === 0 ? (
            "Same as usual"
          ) : (
            <>
              {fmtPace(Math.abs(s.paceDelta_s))}
              <span className="text-muted-2"> /mi</span> {s.paceDelta_s < 0 ? "faster" : "slower"}
            </>
          )
        }
        note={`${s.paceRank === 1 ? "Fastest" : `#${s.paceRank}`} of ${s.count + 1} ${kind} this distance in the last 4 months`}
        tone={s.paceDelta_s < -5 ? "good" : undefined}
      />,
    );
    if (s.efficiencyPct !== null) {
      facts.push(
        <Fact
          key="eff"
          label="Speed per heartbeat"
          value={`${s.efficiencyPct > 0 ? "+" : s.efficiencyPct < 0 ? "−" : "±"}${Math.abs(s.efficiencyPct).toFixed(1)}%`}
          note={s.hrDelta !== null ? `Average HR ${s.hrDelta === 0 ? "the same as" : `${Math.abs(s.hrDelta)} bpm ${s.hrDelta > 0 ? "higher" : "lower"} than`} usual` : undefined}
          tone={s.efficiencyPct >= 2 ? "good" : s.efficiencyPct <= -4 ? "bad" : undefined}
        />,
      );
    }
  }
  if (c.load) {
    facts.push(
      <Fact
        key="load"
        label="Training load"
        value={c.load.value}
        note={c.load.avg28 !== null ? `Your activities averaged ${c.load.avg28} over the 4 weeks before` : undefined}
      />,
    );
  }
  if (isRun || isRide) {
    const noun = c.week.sport === "ride" ? "ride" : "run";
    facts.push(
      <Fact
        key="week"
        label="That week"
        value={c.week.sport === "ride" ? `${c.week.hours} h` : `${c.week.miles} mi`}
        note={`${c.week.count} ${noun}${c.week.count === 1 ? "" : "s"} in the 7 days to this one${
          c.week.sport === "ride" ? ` · ${c.week.miles} mi` : ` · ${c.week.milesPrior} mi the week before`
        }`}
      />,
    );
  }
  if (c.goingIn) {
    const g = c.goingIn;
    facts.push(
      <Fact
        key="goingin"
        label="Load going in"
        value={g.status ?? `Acute ${Math.round(g.acute)}`}
        note={`Acute ${Math.round(g.acute)}${g.chronic !== null ? ` · chronic ${Math.round(g.chronic)}` : ""}${g.ratio !== null ? ` · ratio ${g.ratio.toFixed(1)}` : ""}`}
      />,
    );
  }
  const m = c.morning;
  if (m?.readiness != null) {
    facts.push(<Fact key="ready" label="Readiness that morning" value={m.readiness} note={m.readinessLevel ?? undefined} />);
  }
  if (m?.sleepHours != null) {
    facts.push(
      <Fact
        key="sleep"
        label="Sleep the night before"
        value={`${m.sleepHours} h`}
        note={[m.sleepNeedHours !== null ? `need ${m.sleepNeedHours} h` : null, m.sleepScore !== null ? `score ${m.sleepScore}` : null].filter(Boolean).join(" · ") || undefined}
        tone={m.sleepNeedHours !== null && m.sleepHours < m.sleepNeedHours - 1 ? "bad" : undefined}
      />,
    );
  }
  if (m?.hrv != null) {
    const outside = m.hrvRange && (m.hrv < m.hrvRange[0] || m.hrv > m.hrvRange[1]);
    facts.push(
      <Fact
        key="hrv"
        label="Overnight HRV"
        value={`${Math.round(m.hrv)} ms`}
        note={m.hrvRange ? `${outside ? "Outside" : "Inside"} its ${m.hrvRange[0]}–${m.hrvRange[1]} ms normal range` : undefined}
        tone={outside ? "bad" : undefined}
      />,
    );
  }
  if (m?.bodyBatteryWake != null) facts.push(<Fact key="bb" label="Body Battery at wake" value={m.bodyBatteryWake} note={m.restingHr !== null ? `Resting HR ${m.restingHr}` : undefined} />);

  if (!facts.length) return <p className="text-[12px] text-muted-2">Not enough other training stored around this day to compare against.</p>;
  return <div className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">{facts}</div>;
}

export function StatGroups({ groups }: { groups: StatGroup[] }) {
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <div key={g.title} className="flex min-w-0 flex-col gap-2">
          <span className="border-b border-divider pb-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">{g.title}</span>
          <dl className="flex flex-col gap-1.5">
            {g.stats.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <dt className="text-muted-2">{s.label}</dt>
                <dd className="text-right tabular-nums text-ink">
                  {s.value}
                  {s.unit && <span className="text-muted-2"> {s.unit}</span>}
                  {s.note && <span className="block text-[10.5px] text-muted-3">{s.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
