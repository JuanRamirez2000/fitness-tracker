import { scaleLinear } from "@visx/scale";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildSessionCost } from "@/lib/charts/all-sports";
import { fmtDate } from "@/lib/dates/format";
import { SPORT_NOUN, SPORT_STYLE } from "@/lib/sport";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Plot, Stat, StatRow } from "./parts";

/** The card's "?" explanation. */
const HELP =
  "Each session as a mark: how much training load it put in (across) against how much Body Battery it took out (up). Marks high and to the left cost you a lot for little training, often a sign of poor sleep, heat or stress going in. The numbers above are the typical Body Battery drain per 10 points of load for each sport, so you can see which one is harder on you.";

const WIDTH = 520;
const HEIGHT = 150;
const PAD_L = 28;
const PAD_B = 4;

/** Training load against Body Battery drained, a mark per session in its sport's glyph. */
export function SessionCostChart({ data }: { data: DashboardData }) {
  const chart = buildSessionCost(data);
  const title = "What each session cost you";
  const subtitle = "Training load put in against Body Battery taken out";
  if (!chart) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>no sessions with load and Body Battery in range</ChartEmpty>
      </ChartCard>
    );
  }
  const x = scaleLinear<number>({ domain: [0, chart.maxLoad * 1.08], range: [PAD_L + 4, WIDTH - 6] }).nice();
  const y = scaleLinear<number>({ domain: [0, Math.max(5, chart.maxDrain * 1.15)], range: [HEIGHT - PAD_B, 6] }).nice();
  const sorted = [...chart.points].sort((a, b) => a.load - b.load);
  const points: HoverPoint[] = sorted.map((p) => ({
    at: x(p.load) / WIDTH,
    title: `${p.name} · ${fmtDate(p.date)}`,
    rows: [
      { label: SPORT_STYLE[p.sport].label, value: `load ${Math.round(p.load)}`, swatch: { shape: "dot" as const, className: SPORT_STYLE[p.sport].bg } },
      { label: "Body Battery", value: `−${p.drain}` },
    ],
    marks: [{ y: y(p.drain) / HEIGHT, className: SPORT_STYLE[p.sport].bg }],
    activityId: p.id,
  }));

  return (
    <ChartCard
      help={HELP}
      title={title}
      subtitle={subtitle}
      legend={[...new Set(chart.points.map((p) => p.sport))].map((s) => ({
        label: SPORT_STYLE[s].label.toLowerCase(),
        swatch: <span className={`text-[10px] leading-none ${SPORT_STYLE[s].text}`}>{SPORT_STYLE[s].glyph}</span>,
      }))}
    >
      <StatRow>
        {chart.costPer10.length > 0 ? (
          chart.costPer10.map((c) => (
            <Stat key={c.sport} label={`${SPORT_STYLE[c.sport].label} cost`} value={c.value.toFixed(1)} unit="per 10 load" note={`${c.sessions} ${SPORT_NOUN[c.sport].many}`} />
          ))
        ) : (
          <Stat label="Sessions" value={chart.points.length} />
        )}
      </StatRow>
      <ChartHover points={points} label="sessions">
        <Plot
          width={WIDTH}
          height={HEIGHT}
          label={`Session cost: ${chart.costPer10.map((c) => `${SPORT_NOUN[c.sport].many} drain ${c.value.toFixed(1)} Body Battery per 10 load`).join(", ") || `${chart.points.length} sessions`}`}
          markers={chart.points.map((p) => (
            <span
              key={p.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 text-[11px] leading-none ${SPORT_STYLE[p.sport].text}`}
              style={{ left: `${(x(p.load) / WIDTH) * 100}%`, top: `${(y(p.drain) / HEIGHT) * 100}%` }}
            >
              {SPORT_STYLE[p.sport].glyph}
            </span>
          ))}
        >
          {y.ticks(3).map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={WIDTH} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={0} y={y(t) + 3} className="fill-muted-2 font-mono text-[9px]">
                {t === 0 ? "0" : `−${t}`}
              </text>
            </g>
          ))}
        </Plot>
      </ChartHover>
      <AxisRow start="load 0" middle="training load →" end={`${Math.round(x.domain()[1])}`} />
    </ChartCard>
  );
}
