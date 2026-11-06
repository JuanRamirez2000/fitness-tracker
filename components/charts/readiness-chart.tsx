import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { READINESS_FACTOR_KEYS } from "@/lib/data/recovery";
import { buildReadinessTrend } from "@/lib/charts/readiness";
import { readinessWord } from "@/lib/activity/view";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { FACTOR_GLYPH, FACTOR_LABELS, FACTOR_WORD, factorState, type FactorState } from "@/lib/today/hero";
import { ChartCard, ChartEmpty } from "./chart-card";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { AxisRow, Marker, Plot, Stat, StatRow, Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP = "Training readiness is Garmin's 0-100 score each morning for how ready you are to train hard (75 or more is high, under 50 is low). The rows underneath are what feeds it: sleep, HRV, recovery time, training load and stress, each shaded good, fair or low that day, so you can see what pulled a low morning down.";

const WIDTH = 1000;
const LINE_HEIGHT = 120;
const GAP = 10;
const ROW_HEIGHT = 11;
const ROW_GAP = 3;
const STRIP_HEIGHT = READINESS_FACTOR_KEYS.length * ROW_HEIGHT + (READINESS_FACTOR_KEYS.length - 1) * ROW_GAP;
const TOTAL_HEIGHT = LINE_HEIGHT + GAP + STRIP_HEIGHT;
/** Up to this many days, each morning also gets a dot on the line. */
const DOT_DAYS = 45;

const STATE_FILL: Record<FactorState, string> = { good: "fill-good", fair: "fill-warn", low: "fill-bad" };
const STATE_BG: Record<FactorState, string> = { good: "bg-good", fair: "bg-warn", low: "bg-bad" };

/**
 * Each morning's training readiness over the High (75+) and Low (<50) zones, and under it one row
 * per factor, each day shaded Good, Fair or Low: which part of recovery pulled a morning down.
 * One hover across both shows the score and every factor that day.
 */
export function ReadinessChart({ data }: { data: DashboardData }) {
  const t = buildReadinessTrend(data);
  const title = "Training readiness";
  const subtitle = "Each morning's score, and what drove it";
  if (!t) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>{data.recovery.some((r) => r.readiness_score !== null) ? "no readiness in range" : "no readiness yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const from = t.days[0].date > data.dateRange.from ? t.days[0].date : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [6, WIDTH - 6] });
  const xOf = (date: string) => x(dayStartUtcMs(date));
  const y = scaleLinear<number>({ domain: [0, 100], range: [LINE_HEIGHT - 3, 3] });
  const span = (toMs - fromMs) / 86_400_000 + 1;
  const cellW = Math.max(1.5, Math.min(16, ((WIDTH - 12) / span) * 0.8));

  const points: HoverPoint[] = t.days.map((d) => ({
    at: xOf(d.date) / WIDTH,
    title: fmtPointTitle(d.date),
    rows: [
      { label: "Readiness", value: `${d.score} · ${readinessWord(d.score)}`, swatch: { shape: "line", className: "bg-accent" } },
      ...READINESS_FACTOR_KEYS.flatMap((k) => {
        const v = d.factors[k];
        if (v === null) return [];
        const s = factorState(v);
        return [{ label: FACTOR_LABELS[k], value: `${FACTOR_GLYPH[s]} ${FACTOR_WORD[s]} · ${v}%`, swatch: { shape: "square" as const, className: STATE_BG[s] }, muted: s === "good" }];
      }),
    ],
    marks: [{ y: y(d.score) / TOTAL_HEIGHT, className: "bg-accent" }],
  }));

  return (
    <ChartCard help={HELP}
      title={title}
      subtitle={subtitle}
      note={from !== data.dateRange.from ? `readiness starts ${fmtDate(from)}` : undefined}
      legend={[
        { label: "readiness at wake", swatch: Swatch.line("bg-accent") },
        { label: "high 75+", swatch: Swatch.band("bg-good/15") },
        { label: "low under 50", swatch: Swatch.band("bg-bad/15") },
        { label: "factor good", swatch: Swatch.square("bg-good") },
        { label: "fair", swatch: Swatch.square("bg-warn") },
        { label: "low", swatch: Swatch.square("bg-bad") },
      ]}
    >
      <StatRow>
        <Stat label="Average" value={Math.round(t.average)} note={readinessWord(t.average)} />
        <Stat label={`Latest · ${fmtDate(t.latest.date)}`} value={t.latest.score} note={readinessWord(t.latest.score)} />
        <Stat label="High mornings" value={t.highDays} unit={`of ${t.days.length}`} note={`${t.lowDays} low`} />
        {t.weakest && <Stat label="Most often low" value={<span className="text-[17px]">{FACTOR_LABELS[t.weakest.key]}</span>} note={`${t.weakest.lowDays} of ${t.days.length} mornings`} />}
      </StatRow>

      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3">
        <div aria-hidden>
          <div style={{ height: LINE_HEIGHT + GAP }} />
          <div className="flex flex-col" style={{ gap: ROW_GAP }}>
            {READINESS_FACTOR_KEYS.map((k) => (
              <span key={k} className="truncate text-right font-mono text-[9.5px] leading-none text-muted-2" style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}>
                {FACTOR_LABELS[k]}
              </span>
            ))}
          </div>
        </div>
        <ChartHover points={points} label="mornings">
          <Plot
            width={WIDTH}
            height={LINE_HEIGHT}
            label={`Training readiness: average ${Math.round(t.average)}, latest ${t.latest.score}, ${t.highDays} high and ${t.lowDays} low mornings`}
            markers={
              t.days.length <= DOT_DAYS
                ? t.days.map((d) => <Marker key={d.date} x={xOf(d.date)} y={y(d.score)} width={WIDTH} height={LINE_HEIGHT} shape="dot" className="bg-accent" size={4} />)
                : undefined
            }
          >
            <rect x={0} y={y(100)} width={WIDTH} height={y(75) - y(100)} className="fill-good/10" />
            <rect x={0} y={y(50)} width={WIDTH} height={y(0) - y(50)} className="fill-bad/10" />
            {[50, 75].map((v) => (
              <line key={v} x1={0} x2={WIDTH} y1={y(v)} y2={y(v)} className="stroke-divider" vectorEffect="non-scaling-stroke" />
            ))}
            <LinePath data={t.days} x={(d) => xOf(d.date)} y={(d) => y(d.score)} className="fill-none stroke-accent" strokeWidth={1.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </Plot>
          <svg width="100%" height={STRIP_HEIGHT} viewBox={`0 0 ${WIDTH} ${STRIP_HEIGHT}`} preserveAspectRatio="none" className="mt-[10px] block" aria-hidden>
            {READINESS_FACTOR_KEYS.map((k, row) => (
              <g key={k}>
                <rect x={0} y={row * (ROW_HEIGHT + ROW_GAP)} width={WIDTH} height={ROW_HEIGHT} rx={2} className="fill-track/60" />
                {t.days.map((d) => {
                  const v = d.factors[k];
                  if (v === null) return null;
                  return (
                    <rect
                      key={d.date}
                      x={xOf(d.date) - cellW / 2}
                      y={row * (ROW_HEIGHT + ROW_GAP)}
                      width={cellW}
                      height={ROW_HEIGHT}
                      rx={1}
                      className={STATE_FILL[factorState(v)]}
                      fillOpacity={0.85}
                    />
                  );
                })}
              </g>
            ))}
          </svg>
        </ChartHover>
      </div>
      <div className="pl-[100px]">
        <AxisRow start={fmtDate(from)} end={fmtDate(data.dateRange.to)} />
      </div>
    </ChartCard>
  );
}
