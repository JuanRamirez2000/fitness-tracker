"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import type { DashboardData } from "@/lib/dashboard/types";
import { heatmapStats } from "@/lib/heatmap/caption";
import { READINESS_MODE, SLEEP_SCORE_MODE } from "@/lib/heatmap/modes/recovery";
import { TRAINING_MODE, TRAINING_SCALE } from "@/lib/heatmap/modes/training";
import { countOf, SPORT_NOUN } from "@/lib/sport";
import { STEPS_MODE } from "@/lib/heatmap/modes/steps";
import { WEIGHT_MODE } from "@/lib/heatmap/modes/weight";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import { HeatmapCard } from "./heatmap-card";

/** The cards' "?" explanations. */
const WEIGHT_HELP =
  "Every day of the program as a square, colored by how your weight moved: the 7-day average by default, or each raw weigh-in. Stars mark shots. Hover a day for its numbers.";
const ACTIVITY_HELP =
  "Every day of the program as a square: steps (brighter is closer to 10,000), or your training under the sport picked above (miles ridden or run, or minutes for both). Hover a day for its numbers; the bar underneath shows how far into the year you are.";
const RECOVERY_HELP =
  "Every morning of the year as a square, brighter for a higher training readiness, or switch to each night's sleep score. Runs of dark squares show stretches of poor recovery. Hover a day for its readiness, sleep and HRV.";

const WEIGHT_SUB_MODES = [
  { value: "avg7" as WeightMode, label: "7-day avg" },
  { value: "raw" as WeightMode, label: "Raw" },
];


/** The daily weight change heatmap (Weight tab), with its 7-day avg / raw coloring toggle. */
export function WeightHeatmap({ data }: { data: DashboardData }) {
  const [weightSubMode, setWeightSubMode] = useState<WeightMode>("avg7");
  const stats = heatmapStats(data);
  return (
    <HeatmapCard
      data={data}
      mode={WEIGHT_MODE}
      title="Weight changes by day"
      help={WEIGHT_HELP}
      caption={`Day ${stats.elapsed} · ${stats.weighIns} weigh-ins · ${stats.shots} shots`}
      legendTitle="Weight"
      controls={
        <Segmented aria-label="Weight cell coloring" options={WEIGHT_SUB_MODES} value={weightSubMode} onChange={setWeightSubMode} />
      }
      ctxOverrides={{ weightSubMode }}
      showShots
    />
  );
}

/** The activity heatmap (Training tab): steps or the sport filter's training, toggled locally. */
export function ActivityHeatmap({ data }: { data: DashboardData }) {
  const [activityMode, setActivityMode] = useState<"steps" | "training">("training");
  const stats = heatmapStats(data);
  const trainingLabel = { ride: "Rides", run: "Runs", swim: "Swims", all: "Training" }[data.sport];
  const byMinutes = TRAINING_SCALE[data.sport].by === "minutes";
  const activityToggle = (
    <Segmented
      aria-label="Activity heatmap"
      options={[
        { value: "training" as const, label: trainingLabel },
        { value: "steps" as const, label: "Steps" },
      ]}
      value={activityMode}
      onChange={setActivityMode}
    />
  );
  const caption =
    byMinutes
      ? `${countOf(stats.workouts, data.sport)} · ${stats.hours.toFixed(1)} h since day 1`
      : `${countOf(stats.workouts, data.sport)} · ${stats.miles.toFixed(1)} mi since day 1`;
  return activityMode === "steps" ? (
    <HeatmapCard
      data={data}
      mode={STEPS_MODE}
      title="Activity"
      help={ACTIVITY_HELP}
      caption={`${stats.stepDaysOverGoal} of ${stats.stepDays} days over 10k steps`}
      legendTitle="Steps"
      controls={activityToggle}
    />
  ) : (
    <HeatmapCard
      data={data}
      mode={TRAINING_MODE}
      title="Activity"
      help={ACTIVITY_HELP}
      caption={stats.workouts ? caption : `No ${SPORT_NOUN[data.sport].many} since day 1`}
      legendTitle={byMinutes ? "Minutes" : "Miles"}
      controls={activityToggle}
    />
  );
}

const RECOVERY_MODES = [
  { value: "readiness" as const, label: "Readiness" },
  { value: "sleep" as const, label: "Sleep score" },
];

/** The recovery calendar (Daily feel): each morning's readiness or sleep score over the year. */
export function RecoveryHeatmap({ data }: { data: DashboardData }) {
  const [recoveryMode, setRecoveryMode] = useState<"readiness" | "sleep">("readiness");
  const mornings = data.recovery.filter((r) => r.local_date <= data.today && (r.readiness_morning_score ?? r.readiness_score) !== null);
  const ready = mornings.filter((r) => (r.readiness_morning_score ?? r.readiness_score)! >= 75).length;
  const nights = data.sleep.filter((n) => n.local_date <= data.today && n.score !== null);
  const good = nights.filter((n) => n.score! >= 80).length;
  return (
    <HeatmapCard
      data={data}
      mode={recoveryMode === "readiness" ? READINESS_MODE : SLEEP_SCORE_MODE}
      title="Recovery calendar"
      help={RECOVERY_HELP}
      caption={
        recoveryMode === "readiness"
          ? `${ready} of ${mornings.length} mornings at 75 or more`
          : `${good} of ${nights.length} nights scoring 80 or more`
      }
      legendTitle={recoveryMode === "readiness" ? "Readiness" : "Sleep score"}
      controls={<Segmented aria-label="Recovery calendar" options={RECOVERY_MODES} value={recoveryMode} onChange={setRecoveryMode} />}
    />
  );
}
