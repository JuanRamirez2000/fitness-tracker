import { scaleLinear, scaleLog } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildPowerCurve, fmtDurationShort, type PowerBest } from "@/lib/charts/power-curve";
import { fmtDate } from "@/lib/dates/format";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Marker, Plot, Swatch } from "./parts";
import { PowerRecordButton } from "./power-record-button";

/** The card's "?" explanation. */
const HELP =
  "Your best average power for every length of effort, from a few seconds to an hour, as Garmin records it on each ride with power. The solid line is your best in the selected range; the dashed one, your best ever. Short durations show sprint power, 5 minutes roughly your VO2 max power, and 20 minutes to an hour your threshold (FTP is about 95% of the 20-minute best). Hover the curve, or click a record, to open the ride that set it.";

const WIDTH = 520;
const HEIGHT = 150;

const perKg = (watts: number, kg: number | null) => (kg ? `${(watts / kg).toFixed(1)} W/kg` : null);

/** Best power at each duration, this range against all time, with the record rides listed under it. */
export function PowerCurveCard({ data }: { data: DashboardData }) {
  const curve = buildPowerCurve(data);
  const title = "Power curve";
  const subtitle = "Best average watts for each length of effort";
  if (!curve) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>no rides with power yet</ChartEmpty>
      </ChartCard>
    );
  }

  const { points, weightKg } = curve;
  const x = scaleLog<number>({ domain: [points[0].seconds, Math.max(points.at(-1)!.seconds, points[0].seconds * 2)], range: [4, WIDTH - 4] });
  const top = Math.max(...points.map((p) => p.allTime.watts));
  const y = scaleLinear<number>({ domain: [0, top * 1.08], range: [HEIGHT - 4, 6] }).nice();
  const ranged = points.filter((p) => p.inRange !== null);
  const anyInRange = ranged.length > 0;

  const hover: HoverPoint[] = points.map((p) => {
    const best: PowerBest = p.inRange ?? p.allTime;
    return {
      at: x(p.seconds) / WIDTH,
      title: fmtDurationShort(p.seconds),
      rows: [
        ...(p.inRange
          ? [{ label: "This range", value: [`${p.inRange.watts} W`, perKg(p.inRange.watts, weightKg)].filter(Boolean).join(" · "), swatch: { shape: "line" as const, className: "bg-accent" } }]
          : []),
        { label: "Best ever", value: `${p.allTime.watts} W`, swatch: { shape: "dashed" as const, className: "border-muted-2" }, muted: !!p.inRange },
        { label: "Ride", value: `${best.name}, ${fmtDate(best.date)}`, muted: true },
      ],
      marks: [
        ...(p.inRange ? [{ y: y(p.inRange.watts) / HEIGHT, className: "bg-accent" }] : []),
        { y: y(p.allTime.watts) / HEIGHT, className: "bg-muted-2" },
      ],
      activityId: best.activityId,
    };
  });

  const ticks = [5, 60, 300, 1200, 3600].filter((s) => s >= points[0].seconds && s <= points.at(-1)!.seconds);

  return (
    <ChartCard
      help={HELP}
      title={title}
      subtitle={subtitle}
      note={`${curve.rides} ride${curve.rides === 1 ? "" : "s"} with power`}
      legend={[
        { label: "this range", swatch: Swatch.line("bg-accent") },
        { label: "best ever", swatch: Swatch.dashed("border-muted-2") },
      ]}
    >
      <div className="flex flex-col gap-1.5">
        <ChartHover points={hover} label="durations">
          <Plot
            width={WIDTH}
            height={HEIGHT}
            label={`Power curve: best ever ${points.map((p) => `${fmtDurationShort(p.seconds)} ${p.allTime.watts} watts`).join(", ")}`}
            markers={
              ranged.length === 1 ? (
                <Marker x={x(ranged[0].seconds)} y={y(ranged[0].inRange!.watts)} width={WIDTH} height={HEIGHT} shape="dot" className="bg-accent" />
              ) : undefined
            }
          >
            {y.ticks(3).map((t) => (
              <line key={t} x1={0} x2={WIDTH} y1={y(t)} y2={y(t)} className="stroke-divider" vectorEffect="non-scaling-stroke" />
            ))}
            {ticks.map((s) => (
              <line key={s} x1={x(s)} x2={x(s)} y1={6} y2={HEIGHT - 4} className="stroke-divider/60" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            ))}
            <LinePath
              data={points}
              x={(p) => x(p.seconds)}
              y={(p) => y(p.allTime.watts)}
              className="fill-none stroke-muted-2"
              strokeWidth={1.4}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
            {anyInRange && (
              <LinePath
                data={ranged}
                x={(p) => x(p.seconds)}
                y={(p) => y(p.inRange!.watts)}
                className="fill-none stroke-accent"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </Plot>
        </ChartHover>
        <AxisRow start={fmtDurationShort(points[0].seconds)} middle={`watts · up to ${y.domain()[1]} W`} end={fmtDurationShort(points.at(-1)!.seconds)} />
      </div>

      {curve.records.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-divider pt-3 sm:grid-cols-3">
          {curve.records.map((r) => (
            <li key={r.seconds}>
              <PowerRecordButton
                activityId={r.allTime.activityId}
                label={fmtDurationShort(r.seconds)}
                watts={r.allTime.watts}
                perKg={perKg(r.allTime.watts, weightKg)}
                note={
                  r.inRange === null
                    ? "none in this range"
                    : r.inRange.activityId === r.allTime.activityId
                      ? "▲ best ever, in this range"
                      : `this range ${r.inRange.watts} W`
                }
                good={r.inRange?.activityId === r.allTime.activityId}
                when={fmtDate(r.allTime.date)}
              />
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
