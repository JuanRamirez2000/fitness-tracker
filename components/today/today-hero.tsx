import type { DashboardData } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import { clockTimeIn } from "@/lib/dates/timezone";
import { readyBy, splitFactors, type FactorPhrase } from "@/lib/insights/daily";
import { buildTodayHero, type ReadinessBand, type TodayHero } from "@/lib/today/hero";

const RING_SIZE = 150;
const RING_STROKE = 10;

const BAND_STROKE: Record<ReadinessBand, string> = { good: "stroke-good", warn: "stroke-warn", bad: "stroke-bad" };
const PHRASE_GLYPH: Record<FactorPhrase["strength"], { glyph: string; className: string }> = {
  good: { glyph: "●", className: "text-good" },
  fair: { glyph: "◐", className: "text-warn" },
  low: { glyph: "○", className: "text-bad" },
};

/** "What's helping" or "What's holding you back": Garmin's readiness factors in plain words,
 * each factor's percent in its hover title. */
function FactorList({ title, items, empty }: { title: string; items: FactorPhrase[]; empty: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">{title}</span>
      {items.length === 0 ? (
        <span className="text-[12.5px] text-muted-2">{empty}</span>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((p) => (
            <li key={p.key} className="flex items-baseline gap-2 text-[13px]" title={`Garmin's ${p.key.replaceAll("_", " ")} factor: ${Math.round(p.percent)}%`}>
              <span className={`font-mono text-[11px] ${PHRASE_GLYPH[p.strength].className}`} aria-hidden>
                {PHRASE_GLYPH[p.strength].glyph}
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The readiness score inside a ring whose arc is the score out of 100. */
function ReadinessRing({ score, band, label }: { score: number; band: ReadinessBand; label: string }) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }} role="img" aria-label={`Training readiness ${score} of 100, ${label}`}>
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden>
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r} className="fill-none stroke-track" strokeWidth={RING_STROKE} />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          className={`fill-none ${BAND_STROKE[band]}`}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5" aria-hidden>
        <span className="font-mono leading-none text-ink" style={{ fontSize: RING_SIZE * 0.34 }}>
          {score}
        </span>
        <span className="text-[12px] text-muted-1">{label}</span>
      </div>
    </div>
  );
}

function BigStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{label}</div>
      <div className="font-mono text-[28px] leading-tight text-ink">
        {value}
        {unit && <span className="text-[13px] text-muted-2"> {unit}</span>}
      </div>
    </div>
  );
}

const STAGES = [
  { key: "deep", label: "Deep", className: "bg-sleep-deep" },
  { key: "rem", label: "REM", className: "bg-sleep-rem" },
  { key: "light", label: "Light", className: "bg-sleep-light" },
  { key: "awake", label: "Awake", className: "bg-sleep-awake" },
] as const;

/** Last night's stages as one stacked bar (2px gaps keep stages apart without color), hours under each. */
function StageBar({ stages }: { stages: NonNullable<TodayHero["lastNight"]>["stages"] }) {
  const total = stages.deep + stages.rem + stages.light + stages.awake || 1;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[3px]" role="img" aria-label={STAGES.map((s) => `${s.label} ${(stages[s.key] / 3600).toFixed(1)} hours`).join(", ")}>
        {STAGES.map((s) => (
          <div key={s.key} className={s.className} style={{ width: `${(stages[s.key] / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-2">
        {STAGES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-[1px] ${s.className}`} aria-hidden />
            {s.label} {(stages[s.key] / 3600).toFixed(1)} h
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The Today hero: training readiness ring, what's helping and holding it back (Garmin's six
 * factors in words), and when you're ready for hard effort, last night and Body Battery at wake
 * beside a stacked sleep-stage bar. A part whose latest data is from an earlier day says which day.
 */
export function TodayHero({ data }: { data: DashboardData }) {
  const hero = buildTodayHero(data);
  const tz = data.profile.timezone;
  const { readiness, lastNight, batteryWake } = hero;
  const dayNote = (date: string) => (date === hero.today ? null : fmtDate(date));
  const ready = readiness ? readyBy({ recovery_hours: readiness.recoveryHours, readiness_at: readiness.at }, tz) : null;
  const factors = readiness ? splitFactors(readiness.factors) : null;

  if (!readiness && !lastNight && !batteryWake) {
    return (
      <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center font-mono text-[11px] text-muted-2">
        no recovery or sleep data yet
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-10 gap-y-7 rounded-[14px] border border-border bg-card p-[clamp(18px,2.4vw,28px)]">
      <div className="flex w-full flex-col items-center gap-2.5 sm:w-auto">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Training readiness</span>
        {readiness ? (
          <>
            <ReadinessRing score={readiness.score} band={readiness.band} label={readiness.label} />
            <span className="font-mono text-[10px] text-muted-2">
              {[dayNote(readiness.date), readiness.at && `as of ${clockTimeIn(readiness.at, tz)}`].filter(Boolean).join(" · ")}
              {readiness.morningScore !== null && readiness.morningScore !== readiness.score && ` · ${readiness.morningScore} at wake`}
            </span>
          </>
        ) : (
          <span className="flex h-[150px] w-[150px] items-center justify-center text-center font-mono text-[10px] text-muted-2">
            no readiness yet
          </span>
        )}
      </div>

      {factors && readiness!.factors.length > 0 && (
        <div className="grid min-w-0 flex-[1_1_300px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-7 gap-y-5">
          <FactorList title="What's helping" items={factors.helping} empty="Nothing stands out today." />
          <FactorList title="What's holding you back" items={factors.holding} empty="Nothing: every factor is in good shape." />
        </div>
      )}

      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-[18px] md:border-l md:border-divider md:pl-7">
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          <BigStat label="Ready for hard effort" value={ready ? ready.label : "–"} />
          {lastNight && (
            <BigStat
              label={`Last night${dayNote(lastNight.date) ? ` · ${dayNote(lastNight.date)}` : ""}`}
              value={lastNight.hours.toFixed(1)}
              unit={`h${lastNight.score !== null ? ` · ${lastNight.score}` : ""}`}
            />
          )}
          {batteryWake && (
            <BigStat label={`Battery at wake${dayNote(batteryWake.date) ? ` · ${dayNote(batteryWake.date)}` : ""}`} value={String(batteryWake.value)} />
          )}
        </div>
        {lastNight && <StageBar stages={lastNight.stages} />}
      </div>
    </div>
  );
}
