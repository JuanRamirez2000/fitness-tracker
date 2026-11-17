import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { MOOD_SCALE_LABELS, MOOD_SCALE_WORDS, type MoodScale } from "@/lib/data/mood";
import { buildMoodTrend, type MoodPoint } from "@/lib/charts/mood";
import { OFF_DAY_BG, OFF_DAY_FILL, offDayLabel } from "@/lib/charts/off-days";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { ChartHover, type HoverPoint, type HoverRow } from "./chart-hover";
import { AxisRow, Marker, OffDayBands, Plot, Stat, StatRow, Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP = "What you logged with Log feel, from 1 to 5: mood, energy and motivation as lines (higher is better), soreness as bars (taller is sorer). Gray columns are days you marked sick or injured. Read it next to training readiness: a low score on a day you felt fine, or the other way round, is worth noticing.";

const WIDTH = 1000;
const HEIGHT = 130;
const DOT_POINTS = 45;

/** The three lines; soreness is drawn as bars. */
const LINES: { key: Exclude<MoodScale, "soreness">; stroke: string; bg: string; dashed?: boolean }[] = [
  { key: "mood", stroke: "stroke-accent", bg: "bg-accent" },
  { key: "energy", stroke: "stroke-domain-rec", bg: "bg-domain-rec" },
  { key: "motivation", stroke: "stroke-muted-1", bg: "bg-muted-1", dashed: true },
];

const fmtScore = (v: number | null) => (v === null ? "–" : (Math.round(v * 10) / 10).toFixed(1));

/** Words for a single day's answer, or the mean for a week. */
function answer(key: MoodScale, v: number, weekly: boolean): string {
  return weekly ? `${fmtScore(v)} avg` : `${v} · ${MOOD_SCALE_WORDS[key][v - 1]}`;
}

/** The mood log over the range: mood, energy and motivation lines over soreness bars, with sick
 * and injured days shaded. Weekly means past 35 days. */
export function MoodChart({ data }: { data: DashboardData }) {
  const t = buildMoodTrend(data);
  const title = "How you've felt";
  const subtitle = "From your daily Log feel, 1 to 5";
  if (!t) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>{data.moodLogs.length ? "nothing logged in range" : "nothing logged yet: use Log feel at the top"}</ChartEmpty>
      </ChartCard>
    );
  }

  // The whole range, not just the logged days: a log that started recently sits at the right
  // end instead of two days stretched across the card.
  const from = data.dateRange.from;
  const fromMs = dayStartUtcMs(t.weekly ? t.points[0].label : from);
  const toMs = Math.max(dayStartUtcMs(t.weekly ? t.points.at(-1)!.label : data.dateRange.to), fromMs + 86_400_000);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [10, WIDTH - 10] });
  const xOf = (date: string) => x(dayStartUtcMs(date));
  const y = scaleLinear<number>({ domain: [1, 5], range: [HEIGHT - 6, 6] });
  const unitW = x(fromMs + (t.weekly ? 7 : 1) * 86_400_000) - x(fromMs);
  const barW = Math.max(2, Math.min(18, unitW * 0.5));
  const offDates = t.weekly ? [] : t.points.filter((p) => p.sickDays || p.injuredDays).map((p) => p.label);

  const points: HoverPoint[] = t.points.map((p) => {
    const rows: HoverRow[] = [
      ...LINES.flatMap(({ key, bg, dashed }) => {
        const v = p.values[key];
        return v === null ? [] : [{ label: MOOD_SCALE_LABELS[key], value: answer(key, v, t.weekly), swatch: { shape: dashed ? ("dashed" as const) : ("line" as const), className: dashed ? "border-muted-1" : bg } }];
      }),
      ...(p.values.soreness !== null
        ? [{ label: "Soreness", value: `${answer("soreness", p.values.soreness, t.weekly)}${p.areas.length ? ` · ${p.areas.join(", ")}` : ""}`, swatch: { shape: "square" as const, className: "bg-domain-body/50" } }]
        : []),
      ...offRows(p, t.weekly),
    ];
    return {
      at: xOf(p.label) / WIDTH,
      title: fmtPointTitle(p.label, t.weekly),
      rows,
      marks: LINES.flatMap(({ key, bg }) => (p.values[key] === null ? [] : [{ y: y(p.values[key]!) / HEIGHT, className: bg }])),
    };
  });

  return (
    <ChartCard
      help={HELP}
      title={title}
      subtitle={subtitle}
      note={t.dataFrom > data.dateRange.from ? `log starts ${fmtDate(t.dataFrom)}` : undefined}
      legend={[
        ...LINES.map(({ key, bg, dashed }) => ({ label: MOOD_SCALE_LABELS[key].toLowerCase(), swatch: dashed ? Swatch.dashed("border-muted-1") : Swatch.line(bg) })),
        { label: "soreness", swatch: Swatch.square("bg-domain-body/50") },
        ...(offDates.length ? [{ label: "sick or injured", swatch: Swatch.band(OFF_DAY_BG) }] : []),
      ]}
    >
      <StatRow>
        <Stat label="Mood · average" value={fmtScore(t.averages.mood)} unit="/ 5" />
        <Stat label="Energy · average" value={fmtScore(t.averages.energy)} unit="/ 5" />
        <Stat label="Days logged" value={t.loggedDays} unit={`of ${t.rangeDays}`} />
        {t.offDays > 0 && <Stat label="Sick or injured" value={t.offDays} unit={t.offDays === 1 ? "day" : "days"} />}
      </StatRow>
      <ChartHover points={points} label={t.weekly ? "weeks" : "days"}>
        <Plot
          width={WIDTH}
          height={HEIGHT}
          label={`Mood log: average mood ${fmtScore(t.averages.mood)}, energy ${fmtScore(t.averages.energy)} out of 5, ${t.loggedDays} days logged`}
          markers={
            t.points.length <= DOT_POINTS
              ? t.points.flatMap((p) =>
                  LINES.flatMap(({ key, bg }) =>
                    p.values[key] === null ? [] : [<Marker key={`${p.label}-${key}`} x={xOf(p.label)} y={y(p.values[key]!)} width={WIDTH} height={HEIGHT} shape="dot" className={bg} size={5} />],
                  ),
                )
              : undefined
          }
        >
          <OffDayBands dates={offDates} xOf={xOf} dayWidth={unitW} width={WIDTH} height={HEIGHT} className={OFF_DAY_FILL} />
          {[1, 3, 5].map((v) => (
            <line key={v} x1={0} x2={WIDTH} y1={y(v)} y2={y(v)} className="stroke-divider" vectorEffect="non-scaling-stroke" />
          ))}
          {t.points.map((p) =>
            p.values.soreness === null ? null : (
              <rect
                key={p.label}
                x={xOf(p.label) - barW / 2}
                y={HEIGHT - (p.values.soreness / 5) * (HEIGHT * 0.55)}
                width={barW}
                height={(p.values.soreness / 5) * (HEIGHT * 0.55)}
                rx={1.5}
                className="fill-domain-body/35"
              />
            ),
          )}
          {LINES.map(({ key, stroke, dashed }) => (
            <LinePath
              key={key}
              data={t.points}
              defined={(p) => p.values[key] !== null}
              x={(p) => xOf(p.label)}
              y={(p) => y(p.values[key] ?? 1)}
              className={`fill-none ${stroke}`}
              strokeWidth={1.8}
              strokeDasharray={dashed ? "5 4" : undefined}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </Plot>
      </ChartHover>
      <AxisRow start={fmtDate(t.weekly ? t.points[0].label : from)} end={fmtDate(t.weekly ? t.points.at(-1)!.label : data.dateRange.to)} />
    </ChartCard>
  );
}

function offRows(p: MoodPoint, weekly: boolean): HoverRow[] {
  if (!p.sickDays && !p.injuredDays) return [];
  const value = weekly
    ? [p.sickDays ? `${p.sickDays} sick` : null, p.injuredDays ? `${p.injuredDays} injured` : null].filter(Boolean).join(", ")
    : offDayLabel({ sick: p.sickDays > 0, injured: p.injuredDays > 0 });
  return [{ label: "Logged", value, swatch: { shape: "band", className: OFF_DAY_BG } }];
}
