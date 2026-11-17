import { describe, expect, it } from "vitest";
import type { MoodLog } from "@/lib/data/mood";
import { moodLogInputSchema } from "@/lib/data/mood";
import { buildMoodTrend } from "./mood";
import { offDayLabel, offDaysIn } from "./off-days";

function log(over: Partial<MoodLog> & { local_date: string }): MoodLog {
  return {
    user_id: "00000000-0000-4000-8000-000000000000",
    mood: null,
    energy: null,
    soreness: null,
    sore_areas: [],
    motivation: null,
    sick: false,
    injured: false,
    updated_at: "2026-11-17T20:00:00Z",
    ...over,
  };
}

describe("buildMoodTrend", () => {
  it("returns null with no logs in the range", () => {
    expect(buildMoodTrend({ moodLogs: [log({ local_date: "2026-10-01", mood: 4 })], dateRange: { key: "week", from: "2026-11-11", to: "2026-11-17" }, today: "2026-11-17" })).toBeNull();
  });

  it("gives one point per logged day with averages over answered days only", () => {
    const t = buildMoodTrend({
      moodLogs: [
        log({ local_date: "2026-11-15", mood: 4, energy: 2 }),
        log({ local_date: "2026-11-16", mood: 2, sick: true }),
        log({ local_date: "2026-11-17", mood: 3, energy: 4, soreness: 4, sore_areas: ["legs"] }),
      ],
      dateRange: { key: "week", from: "2026-11-11", to: "2026-11-17" },
      today: "2026-11-17",
    })!;
    expect(t.weekly).toBe(false);
    expect(t.points.map((p) => p.label)).toEqual(["2026-11-15", "2026-11-16", "2026-11-17"]);
    expect(t.averages.mood).toBe(3);
    expect(t.averages.energy).toBe(3);
    expect(t.averages.motivation).toBeNull();
    expect(t.loggedDays).toBe(3);
    expect(t.rangeDays).toBe(7);
    expect(t.offDays).toBe(1);
    expect(t.points[2].areas).toEqual(["legs"]);
  });

  it("averages by week past 35 days and stops counting days at today", () => {
    const t = buildMoodTrend({
      moodLogs: [log({ local_date: "2026-11-02", mood: 2 }), log({ local_date: "2026-11-03", mood: 4, injured: true })],
      dateRange: { key: "6m", from: "2026-06-01", to: "2026-11-30" },
      today: "2026-11-17",
    })!;
    expect(t.weekly).toBe(true);
    expect(t.points).toHaveLength(1);
    expect(t.points[0].values.mood).toBe(3);
    expect(t.points[0].injuredDays).toBe(1);
    expect(t.rangeDays).toBe(170);
  });
});

describe("off days", () => {
  it("keeps sick or injured days inside the window", () => {
    const off = offDaysIn(
      [log({ local_date: "2026-11-01", sick: true }), log({ local_date: "2026-11-10", injured: true, sick: true }), log({ local_date: "2026-11-11", mood: 3 })],
      { from: "2026-11-05", to: "2026-11-17" },
    );
    expect(off.days.map((d) => d.date)).toEqual(["2026-11-10"]);
    expect(offDayLabel(off.byDate.get("2026-11-10")!)).toBe("Sick and injured");
  });
});

describe("moodLogInputSchema", () => {
  it("drops body areas unless soreness is 3 or more", () => {
    const base = { local_date: "2026-11-17", mood: 4, energy: null, motivation: null, sick: false, injured: false };
    expect(moodLogInputSchema.parse({ ...base, soreness: 2, sore_areas: ["legs"] }).sore_areas).toEqual([]);
    expect(moodLogInputSchema.parse({ ...base, soreness: 4, sore_areas: ["legs", "legs", "back"] }).sore_areas).toEqual(["legs", "back"]);
  });

  it("refuses ratings outside 1-5", () => {
    expect(moodLogInputSchema.safeParse({ local_date: "2026-11-17", mood: 6, energy: null, soreness: null, motivation: null, sore_areas: [], sick: false, injured: false }).success).toBe(false);
  });
});
