import { ChartCard, ChartEmpty } from "@/components/charts/chart-card";
import { Stat, StatRow } from "@/components/charts/parts";
import { MOOD_SCALE_LABELS, MOOD_SCALE_WORDS, MOOD_SCALES, type MoodScale } from "@/lib/data/mood";
import type { WeekMood } from "@/lib/progress/build";
import type { ProgressWeek } from "@/lib/progress/week";
import { DayGrid, EMPTY, EMPTY_FUTURE, type DayCell } from "./day-grid";

const HELP =
  "Your daily Log feel answers for the week, 1 to 5 (5 is the good end, except soreness, where 5 is very sore), with sick and injured days. Low mood or energy for a few days in a row, or soreness that doesn't fade, says more about whether the training is too much than any single number.";

function cell(scale: MoodScale, value: number | null): DayCell {
  if (value === null) return EMPTY;
  const good = scale === "soreness" ? value <= 2 : value >= 4;
  const bad = scale === "soreness" ? value >= 4 : value <= 2;
  return { text: value, className: good ? "text-good" : bad ? "text-warn" : "text-ink", title: MOOD_SCALE_WORDS[scale][value - 1] };
}

/** The week's Log feel answers, day by day. */
export function MoodCard({ mood, week }: { mood: WeekMood; week: ProgressWeek }) {
  const title = "How you felt";
  const subtitle = "Your daily Log feel, 1 to 5";
  if (mood.logged === 0) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>nothing logged this week · Log feel is in the header</ChartEmpty>
      </ChartCard>
    );
  }
  const off = mood.days.some((d) => d.log?.sick || d.log?.injured);
  return (
    <ChartCard help={HELP} title={title} subtitle={subtitle}>
      <StatRow>
        <Stat label="Logged" value={mood.logged} unit={`of ${mood.span} days`} />
        {mood.avgMood !== null && <Stat label="Mood · avg" value={mood.avgMood.toFixed(1)} />}
        {mood.avgEnergy !== null && <Stat label="Energy · avg" value={mood.avgEnergy.toFixed(1)} />}
      </StatRow>
      <DayGrid
        days={week.days}
        today={week.current ? week.through : ""}
        caption="Mood, energy, soreness and motivation for each day of the week"
        rows={[
          ...MOOD_SCALES.map((scale) => ({
            label: MOOD_SCALE_LABELS[scale],
            cells: mood.days.map((d) => (d.log ? cell(scale, d.log[scale]) : d.future ? EMPTY_FUTURE : EMPTY)),
          })),
          ...(off
            ? [
                {
                  label: "Off",
                  cells: mood.days.map((d): DayCell =>
                    d.log?.sick ? { text: "Sick", className: "text-bad text-[10px]" } : d.log?.injured ? { text: "Hurt", className: "text-bad text-[10px]", title: "Injured" } : { text: "" },
                  ),
                },
              ]
            : []),
        ]}
      />
    </ChartCard>
  );
}
