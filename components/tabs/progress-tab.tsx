import { KpiCard } from "@/components/dashboard/kpi-card";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { HoursChart } from "@/components/progress/hours-chart";
import { IntensityCard } from "@/components/progress/intensity-card";
import { MoodCard } from "@/components/progress/mood-card";
import { PlanCard } from "@/components/progress/plan-card";
import { PlanProgressCard } from "@/components/progress/plan-progress-card";
import { RecordsCard } from "@/components/progress/records-card";
import { RecoveryCard } from "@/components/progress/recovery-card";
import { WeeklyReview } from "@/components/progress/weekly-review";
import type { DashboardData, KpiValue } from "@/lib/dashboard/types";
import { countdownCard, hoursBySport, intensitySplit, loadCard, planVsDone, readinessCard, weekMood, weekRecovery } from "@/lib/progress/build";
import { planProgress } from "@/lib/progress/plans";
import { buildRecords } from "@/lib/progress/records";
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
  const plans = planProgress(data, week.through);
  const records = buildRecords(data).filter((r) => r.date <= week.sunday);
  const weekRecords = records.filter((r) => r.date >= week.monday);
  let n = 0;
  const next = () => String(++n).padStart(2, "0");

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
      {plans.length > 0 && (
        <Section>
          <SectionHeading n={next()}>Is my plan working?</SectionHeading>
          <CardGrid>
            {plans.map((p) => (
              <Cell key={p.key} span={12}>
                <PlanProgressCard plan={p} />
              </Cell>
            ))}
          </CardGrid>
        </Section>
      )}
      <Section>
        <SectionHeading n={next()}>Did I do the plan?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <PlanCard plan={planVsDone(data, week)} week={week} />
          </Cell>
          <Cell span={12}>
            <RecordsCard
              title="Records this week"
              subtitle="Personal bests and milestones set this week"
              records={weekRecords}
              latest={records[0] ?? null}
              empty="No new records this week."
            />
          </Cell>
        </CardGrid>
      </Section>
      <Section>
        <SectionHeading n={next()}>How did my body take it?</SectionHeading>
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
        <SectionHeading n={next()}>Am I training enough, and easy enough?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <HoursChart hours={hoursBySport(data, week)} />
          </Cell>
          <Cell span={12}>
            <IntensityCard split={intensitySplit(data, week)} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}

function fmt(value: KpiValue, delta: string | undefined) {
  return { primary: String(value.value), delta, tone: value.tone };
}
