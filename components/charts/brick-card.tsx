import { typeLabel } from "@/lib/activity/view";
import type { BrickRow, BrickSummary } from "@/lib/charts/bricks";
import { fmtDate } from "@/lib/dates/format";
import { fmtPace } from "@/lib/running/runs";
import { BrickRows, type BrickRowView } from "./brick-rows";
import { ChartCard, ChartEmpty } from "./chart-card";
import { Stat, StatRow } from "./parts";

/** The card's "?" explanation. */
const HELP =
  "A brick is a run that starts within 15 minutes of a ride ending, the way a triathlon's bike leg hands over to the run. Off-bike cost compares the run's pace with what your fresh runs of the 90 days before averaged at the same heart rate: how much the bike took out of your legs. Opening vs rest compares the first mile (the first 5 minutes on runs under 1.5 miles) with the rest of the run: slower means heavy legs that loosened up, faster means you went out hot. Both should shrink as bricks become routine. Click a brick to open its run.";

/** "+1:42" / "−0:12", seconds per mile. */
const delta = (s: number) => `${s < 0 ? "−" : "+"}${fmtPace(Math.abs(s))}`;
/** Transition time, "3:38". */
const clock = (s: number) => fmtPace(s);

function view(r: BrickRow): BrickRowView {
  const opening = r.drop?.by === "opening" ? "First 5 min" : "First mile";
  return {
    runId: r.run.id,
    date: fmtDate(r.date),
    legs: `${typeLabel(r.ride.activity_type)} ${r.rideMinutes} min → ${r.runMiles.toFixed(1)} mi run`,
    transition: `T2 ${clock(r.gapS)}`,
    cost: r.cost && {
      value: delta(r.cost.costS),
      detail: `${fmtPace(r.cost.pace)} /mi vs ${fmtPace(r.cost.freshPace)} fresh at ${r.run.avg_hr} bpm`,
      tone: r.cost.costS > 0 ? "slower" : "faster",
    },
    drop: r.drop && {
      value: delta(r.drop.dropS),
      detail: `${opening} ${fmtPace(r.drop.firstPace)} vs ${fmtPace(r.drop.restPace)} after${r.drop.dropS < -20 ? " · went out hot" : r.drop.dropS > 20 ? " · heavy legs" : ""}`,
      tone: r.drop.dropS > 0 ? "slower" : "faster",
    },
  };
}

/** Runs off the bike: how much the ride costs the run, and how the opening goes. Hidden before
 * the first brick (the tab checks buildBricks). */
export function BrickCard({ bricks }: { bricks: BrickSummary }) {
  const title = "Bricks";
  const subtitle = "Running off the bike, against your fresh runs";
  if (!bricks.rows.length) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>{bricks.lastBefore ? `no bricks in this range · last one ${fmtDate(bricks.lastBefore)}` : "no bricks in this range"}</ChartEmpty>
      </ChartCard>
    );
  }
  const n = bricks.rows.length;
  const avg = n > 1 ? " · avg" : "";
  return (
    <ChartCard help={HELP} title={title} subtitle={subtitle}>
      <StatRow>
        <Stat label="Bricks" value={n} unit={n === bricks.total ? "so far" : `of ${bricks.total}`} />
        {bricks.avgCostS !== null && <Stat label={`Off-bike cost${avg}`} value={delta(bricks.avgCostS)} unit="/ mi" />}
        {bricks.avgDropS !== null && <Stat label={`Opening vs rest${avg}`} value={delta(bricks.avgDropS)} unit="/ mi" />}
        {bricks.avgGapS !== null && <Stat label={`Transition${avg}`} value={clock(bricks.avgGapS)} />}
      </StatRow>
      <BrickRows rows={bricks.rows.map(view)} />
    </ChartCard>
  );
}
