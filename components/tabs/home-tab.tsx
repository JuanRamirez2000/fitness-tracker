import { Section, SectionHeading } from "@/components/dashboard/layout";
import { WeekSoFar } from "@/components/dashboard/week-so-far";
import { PlanCard } from "@/components/progress/plan-card";
import { PlanProgressCard } from "@/components/progress/plan-progress-card";
import { RampNotice } from "@/components/progress/ramp-notice";
import { RecordsCard } from "@/components/progress/records-card";
import { WeeklyReview } from "@/components/progress/weekly-review";
import { DailySummary } from "@/components/today/daily-summary";
import { FocusCarousel, type FocusSlide } from "@/components/ui/focus-carousel";
import { WeekPlanner } from "@/components/workouts/week-planner";
import { homeTiles } from "@/lib/dashboard/week-so-far";
import type { DashboardData } from "@/lib/dashboard/types";
import { planVsDone } from "@/lib/progress/build";
import { planProgress } from "@/lib/progress/plans";
import { buildRecords } from "@/lib/progress/records";
import { progressWeek } from "@/lib/progress/week";
import type { UrlRange } from "@/lib/range/url";
import { runRamp } from "@/lib/running/ramp";

/**
 * Home: is the plan on track this week? The week so far (time, sessions, load, next session),
 * then each plan, plan vs done and the week's records to swipe through, then the weekly review
 * and what's next (the training summary and the planner).
 */
export function HomeTab({ data, urlRange, canEdit }: { data: DashboardData; urlRange: UrlRange | null; canEdit: boolean }) {
  const week = progressWeek(data.week, data.today);
  const plans = planProgress(data, week.through);
  // A run plan's card carries the mileage check; without one it stands alone (this week only).
  const ramp = week.current ? runRamp(data.activities, data.today) : null;
  const records = buildRecords(data).filter((r) => r.date <= week.sunday);
  const weekRecords = records.filter((r) => r.date >= week.monday);
  const slides: FocusSlide[] = [
    ...plans.map((p) => ({ key: p.key, title: p.who, node: <PlanProgressCard plan={p} /> })),
    { key: "plan", title: "Plan vs done", node: <PlanCard plan={planVsDone(data, week)} week={week} /> },
    {
      key: "records",
      title: weekRecords.length ? `Records · ${weekRecords.length}` : "Records",
      node: (
        <RecordsCard
          title={week.current ? "Records this week" : "Records that week"}
          subtitle="Personal bests and milestones set in the week"
          records={weekRecords}
          latest={records[0] ?? null}
          empty={week.current ? "No new records this week." : "No records that week."}
        />
      ),
    },
  ];
  return (
    <>
      <WeekSoFar week={week} tiles={homeTiles(data, week)} />
      {ramp?.warn && !plans.some((p) => p.sport === "run") && <RampNotice ramp={ramp} />}
      <FocusCarousel slides={slides} />
      <Section id="review">
        <SectionHeading n="01">{week.current ? "How's the week going?" : "How did that week go?"}</SectionHeading>
        <WeeklyReview summary={data.weeklySummary} week={week} timezone={data.profile.timezone} range={urlRange} />
      </Section>
      <Section id="next">
        <SectionHeading n="02">What&apos;s next?</SectionHeading>
        <DailySummary data={data} />
        {data.planner && <WeekPlanner planner={data.planner} canEdit={canEdit} />}
      </Section>
    </>
  );
}
