import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildGoalProjection } from "@/lib/charts/weight-plan";
import { addDays, dayStartUtcMs, diffDays, type LocalDate } from "@/lib/dates/calendar";
import { fmtDate, fmtMonthYear, fmtPointTitle } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { ChartHover, type HoverPoint, type HoverRow } from "./chart-hover";
import { AxisRow, Marker, Plot, Stat, StatRow, Swatch } from "./parts";

const WIDTH = 520;
const HEIGHT = 150;
const MAX_DAYS_AHEAD = 3 * 365;

const lb = (v: number) => `${v.toFixed(1)} lb`;

/**
 * Where the 7-day average is heading: its history since the program started, the plan's line
 * from the start weight to its goal date, and the current pace carried forward to the day it
 * reaches the goal. Range-independent: it's about the whole program.
 */
export function GoalProjectionChart({ data }: { data: DashboardData }) {
  const p = buildGoalProjection(data);
  const title = "Goal projection";
  const subtitle = "Where the 7-day average is heading, at your recent pace and at the plan's";
  if (!p) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <ChartEmpty>{data.profile.goal_weight_lb === null ? "set a goal weight in settings" : "no weigh-ins yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const start = p.history[0]?.date ?? p.latest.date;
  const ends = [p.eta, p.plan?.goalDate, p.plan?.etaFromNow].filter((d): d is LocalDate => d !== null && d !== undefined);
  const latestEnd = ends.length ? ends.sort().at(-1)! : addDays(p.latest.date, 90);
  const end = latestEnd > addDays(p.latest.date, MAX_DAYS_AHEAD) ? addDays(p.latest.date, MAX_DAYS_AHEAD) : latestEnd;
  const x = scaleLinear<number>({ domain: [dayStartUtcMs(start), dayStartUtcMs(end)], range: [2, WIDTH - 2] });
  const xOf = (d: LocalDate) => x(dayStartUtcMs(d));
  const top = Math.max(...p.history.map((h) => h.avg), p.plan?.start.weight ?? 0, p.latest.avg);
  const y = scaleLinear<number>({ domain: [p.goal - 4, top + 3], range: [HEIGHT - 4, 4] });

  const planAt = (d: LocalDate) =>
    p.plan ? Math.max(p.goal, p.plan.start.weight - (Math.max(0, diffDays(d, p.plan.start.date)) / 7) * p.plan.pace) : null;
  const projectedAt = (d: LocalDate) =>
    p.pace !== null && p.pace > 0 ? Math.max(p.goal, p.latest.avg - (diffDays(d, p.latest.date) / 7) * p.pace) : null;
  // Drawn whenever the weight is coming down: to the goal when the pace gets there within the
  // chart, else to the chart's edge (where it would be by then).
  const losing = p.pace !== null && p.pace > 0;
  const projectionEnd = p.eta ?? (losing ? end : null);

  // Hover: weekly through the history, then monthly ahead.
  const pastDays = p.history.filter((_, i) => i % 7 === 0 || i === p.history.length - 1);
  const futureDays: LocalDate[] = [];
  for (let d = addDays(p.latest.date, 30); d <= end; d = addDays(d, 30)) futureDays.push(d);
  const rowsFor = (d: LocalDate, actual: number | null): HoverRow[] => {
    const plan = planAt(d);
    const proj = actual === null ? projectedAt(d) : null;
    return [
      ...(actual !== null ? [{ label: "7-day avg", value: lb(actual), swatch: { shape: "line" as const, className: "bg-accent" } }] : []),
      ...(proj !== null ? [{ label: "At your pace", value: lb(proj), swatch: { shape: "dashed" as const, className: "border-accent" } }] : []),
      ...(plan !== null ? [{ label: "Plan", value: lb(plan), swatch: { shape: "dashed" as const, className: "border-muted-2" }, muted: true }] : []),
      { label: "Goal", value: lb(p.goal), swatch: { shape: "dashed", className: "border-good" }, muted: true },
    ];
  };
  const points: HoverPoint[] = [
    ...pastDays.map((h) => ({
      at: xOf(h.date) / WIDTH,
      title: fmtPointTitle(h.date),
      rows: rowsFor(h.date, h.avg),
      marks: [{ y: y(h.avg) / HEIGHT, className: "bg-accent" }],
    })),
    ...futureDays.map((d) => {
      const proj = projectedAt(d);
      return {
        at: xOf(d) / WIDTH,
        title: fmtMonthYear(d),
        rows: rowsFor(d, null),
        marks: proj !== null && projectionEnd && d <= projectionEnd ? [{ y: y(proj) / HEIGHT, className: "bg-accent" }] : undefined,
      };
    }),
  ];

  const paceNote =
    p.pace === null ? "not enough weigh-ins lately" : p.pace > 0 ? `${p.pace.toFixed(1)} lb/wk over 4 weeks` : `${Math.abs(p.pace).toFixed(1)} lb/wk gained over 4 weeks`;
  const summary = `Goal ${p.goal} lb, ${p.leftToGoal.toFixed(1)} lb to go. ${p.eta ? `At the recent pace, reached in ${fmtMonthYear(p.eta)}.` : "Not on course to reach it at the recent pace."}${p.plan ? ` The plan reaches it in ${fmtMonthYear(p.plan.goalDate)}.` : ""}`;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={[
        { label: "7-day avg", swatch: Swatch.line("bg-accent") },
        ...(projectionEnd ? [{ label: "at your pace", swatch: Swatch.dashed("border-accent") }] : []),
        ...(p.plan ? [{ label: "plan", swatch: Swatch.dashed("border-muted-2") }] : []),
        { label: `goal ${p.goal}`, swatch: Swatch.dashed("border-good") },
      ]}
      note={!p.eta && p.pace !== null && p.pace > 0 ? "at this pace the goal is more than 3 years out" : undefined}
    >
      <StatRow>
        <Stat label="At your pace" value={p.eta ? fmtMonthYear(p.eta) : "–"} note={paceNote} />
        {p.plan && (
          <Stat
            label="On plan"
            value={fmtMonthYear(p.plan.goalDate)}
            note={`${Math.abs(p.plan.ahead).toFixed(1)} lb ${p.plan.ahead >= 0 ? "ahead of" : "behind"} it today`}
          />
        )}
        <Stat label="To go" value={p.leftToGoal.toFixed(1)} unit="lb" />
      </StatRow>
      <ChartHover points={points} label="weeks and months">
        <Plot
          width={WIDTH}
          height={HEIGHT}
          label={summary}
          markers={
            p.eta ? <Marker x={xOf(p.eta)} y={y(p.goal)} width={WIDTH} height={HEIGHT} shape="dot" className="bg-good" size={7} /> : undefined
          }
        >
          <line x1={0} x2={WIDTH} y1={y(p.goal)} y2={y(p.goal)} className="stroke-good" strokeWidth={1.2} strokeDasharray="5 4" strokeOpacity={0.75} vectorEffect="non-scaling-stroke" />
          <line x1={xOf(p.latest.date)} x2={xOf(p.latest.date)} y1={0} y2={HEIGHT} className="stroke-border-strong" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          {p.plan && (
            <line
              x1={xOf(p.plan.start.date)}
              y1={y(p.plan.start.weight)}
              x2={xOf(p.plan.goalDate < end ? p.plan.goalDate : end)}
              y2={y(planAt(p.plan.goalDate < end ? p.plan.goalDate : end)!)}
              className="stroke-muted-2"
              strokeWidth={1.2}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {projectionEnd && (
            <line
              x1={xOf(p.latest.date)}
              y1={y(p.latest.avg)}
              x2={xOf(projectionEnd)}
              y2={y(projectedAt(projectionEnd) ?? p.goal)}
              className="stroke-accent"
              strokeWidth={1.6}
              strokeDasharray="2 4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <LinePath data={p.history} x={(h) => xOf(h.date)} y={(h) => y(h.avg)} className="fill-none stroke-accent" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </Plot>
      </ChartHover>
      <AxisRow start={fmtDate(start)} middle={`latest · ${fmtDate(p.latest.date)}`} end={fmtMonthYear(end)} />
    </ChartCard>
  );
}
