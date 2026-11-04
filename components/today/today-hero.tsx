import type { DashboardData } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import { clockTimeIn } from "@/lib/dates/timezone";
import { FACTOR_GLYPH, FACTOR_WORD, buildTodayHero, type FactorState, type ReadinessBand, type TodayHero } from "@/lib/today/hero";

const RING_SIZE = 150;
const RING_STROKE = 10;

const BAND_STROKE: Record<ReadinessBand, string> = { good: "stroke-good", warn: "stroke-warn", bad: "stroke-bad" };
const STATE_TEXT: Record<FactorState, string> = { good: "text-good", fair: "text-warn", low: "text-bad" };
const STATE_BG: Record<FactorState, string> = { good: "bg-good", fair: "bg-warn", low: "bg-bad" };

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
 * The Today hero: training readiness ring, its six factor rows, and recovery left, last night
 * and Body Battery at wake beside a stacked sleep-stage bar. A part whose latest data is from
 * an earlier day says which day.
 */
export function TodayHero({ data }: { data: DashboardData }) {
  const hero = buildTodayHero(data);
  const tz = data.profile.timezone;
  const { readiness, lastNight, batteryWake } = hero;
  const dayNote = (date: string) => (date === hero.today ? null : fmtDate(date));

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

      {readiness && readiness.factors.length > 0 && (
        <ul className="grid min-w-0 flex-[1_1_300px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-7 gap-y-3.5">
          {readiness.factors.map((f) => (
            <li key={f.key} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2.5 text-[12.5px]">
                <span>{f.label}</span>
                <span className="shrink-0 whitespace-nowrap font-mono text-[11.5px] text-muted-2">
                  <span className={STATE_TEXT[f.state]} aria-hidden>
                    {FACTOR_GLYPH[f.state]}
                  </span>{" "}
                  {FACTOR_WORD[f.state]} · {Math.round(f.percent)}%
                </span>
              </div>
              <div className="h-[5px] rounded-[3px] bg-track" aria-hidden>
                <div className={`h-full rounded-[3px] ${STATE_BG[f.state]}`} style={{ width: `${Math.min(100, f.percent)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-[18px] md:border-l md:border-divider md:pl-7">
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          <BigStat label="Recovery left" value={readiness?.recoveryHours != null ? readiness.recoveryHours.toFixed(1) : "–"} unit="h" />
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
