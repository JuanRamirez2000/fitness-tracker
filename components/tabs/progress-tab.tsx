import { KpiCard } from "@/components/dashboard/kpi-card";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { HoursChart } from "@/components/progress/hours-chart";
import { MoodCard } from "@/components/progress/mood-card";
import { PlanCard } from "@/components/progress/plan-card";
import { RecoveryCard } from "@/components/progress/recovery-card";
import { WeeklyReview } from "@/components/progress/weekly-review";
import type { DashboardData, KpiValue } from "@/lib/dashboard/types";
import { countdownCard, hoursBySport, loadCard, planVsDone, readinessCard, weekMood, weekRecovery } from "@/lib/progress/build";
import { progressWeek } from "@/lib/progress/week";
import type { UrlRange } from "@/lib/range/url";

const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${unit}`;

/**
 * One Monday-to-Sunday week (the header's week picker, `?week=`): how much training against the
 * week before, how recovered, how far to the race; then the plan against what was done, the
 * week's mornings and mood, and weekly hours by sport against the 4–7 h band, under the week's
 * AI review.
 */
export function ProgressTab({ data, urlRange }: { data: DashboardData; urlRange: UrlRange | null }) {
  const week = progressWeek(data.week, data.today);
  const load = loadCard(data.activities, week);
  const readiness = readinessCard(data, week);
  const countdown = countdownCard(data, week);

  return (
    <>
      <WeeklyReview summary={data.weeklySummary} week={week} timezone={data.profile.timezone} range={urlRange} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label={week.current ? "Load so far" : "Training load"}
          visual="sparkline"
          value={load}
          formatted={{ primary: String(load.value), delta: load.delta === undefined ? undefined : signed(load.delta, "%"), tone: load.tone }}
        />
        <KpiCard
          label="Readiness and mood"
          visual="sparkline"
          emptyMessage="No readiness this week yet"
          value={readiness}
          formatted={readiness && fmt(readiness, readiness.delta === undefined ? undefined : `${signed(readiness.delta)} vs last week`)}
        />
        <KpiCard
          label="Race countdown"
          visual="none"
          emptyMessage="Set your race in the workout planner"
          value={countdown}
          formatted={countdown && { primary: countdown.value === null ? "Done" : String(countdown.value), delta: countdown.deltaText, tone: "neutral" }}
        />
      </div>
      <Section>
        <SectionHeading n="01">Did I do the plan?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <PlanCard plan={planVsDone(data, week)} week={week} />
          </Cell>
        </CardGrid>
      </Section>
      <Section>
        <SectionHeading n="02">How did my body take it?</SectionHeading>
        <CardGrid>
          <Cell span={6}>
            <RecoveryCard recovery={weekRecovery(data, week)} week={week} />
          </Cell>
          <Cell span={6}>
            <MoodCard mood={weekMood(data, week)} week={week} />
          </Cell>
        </CardGrid>
      </Section>
      <Section>
        <SectionHeading n="03">Am I training enough for April?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <HoursChart hours={hoursBySport(data, week)} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}

function fmt(value: KpiValue, delta: string | undefined) {
  return { primary: String(value.value), delta, tone: value.tone };
}
