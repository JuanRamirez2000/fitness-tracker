"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import type { DashboardData } from "@/lib/dashboard/types";
import { heatmapStats } from "@/lib/heatmap/caption";
import { READINESS_MODE, SLEEP_SCORE_MODE } from "@/lib/heatmap/modes/recovery";
import { RUNNING_MODE } from "@/lib/heatmap/modes/running";
import { STEPS_MODE } from "@/lib/heatmap/modes/steps";
import { WEIGHT_MODE } from "@/lib/heatmap/modes/weight";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import { HeatmapCard } from "./heatmap-card";

const WEIGHT_SUB_MODES = [
  { value: "avg7" as WeightMode, label: "7-day avg" },
  { value: "raw" as WeightMode, label: "Raw" },
];

const ACTIVITY_MODES = [
  { value: "steps" as const, label: "Steps" },
  { value: "running" as const, label: "Running" },
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

/** The activity heatmap (Training tab): steps or running, toggled locally. */
export function ActivityHeatmap({ data }: { data: DashboardData }) {
  const [activityMode, setActivityMode] = useState<"steps" | "running">("steps");
  const stats = heatmapStats(data);
  const activityToggle = (
    <Segmented aria-label="Activity heatmap" options={ACTIVITY_MODES} value={activityMode} onChange={setActivityMode} />
  );
  return activityMode === "steps" ? (
    <HeatmapCard
      data={data}
      mode={STEPS_MODE}
      title="Activity"
      caption={`${stats.stepDaysOverGoal} of ${stats.stepDays} days over 10k steps`}
      legendTitle="Steps"
      controls={activityToggle}
    />
  ) : (
    <HeatmapCard
      data={data}
      mode={RUNNING_MODE}
      title="Activity"
      caption={`${stats.runs} run${stats.runs === 1 ? "" : "s"} · ${stats.runMiles.toFixed(1)} mi since day 1`}
      legendTitle="Miles"
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
