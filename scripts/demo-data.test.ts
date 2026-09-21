import { describe, expect, it } from "vitest";
import { activitySchema } from "@/lib/data/activities";
import { stepsSchema } from "@/lib/data/daily-metrics";
import { injectionSchema } from "@/lib/data/injections";
import { nutritionDaySchema } from "@/lib/data/nutrition-days";
import { weighInSchema } from "@/lib/data/weigh-ins";
import { addDays, diffDays, weekdayOf } from "@/lib/dates/calendar";
import { localDateIn } from "@/lib/dates/timezone";
import { generateDemoData, type DemoOptions } from "./demo-data";

const TODAY = "2027-03-17";
const OPTIONS: DemoOptions = {
  userId: "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01",
  timeZone: "America/Los_Angeles",
  today: TODAY,
  programStart: addDays(TODAY, -181),
  shotWeekday: 4,
  startWeightLb: 232.4,
  activityTypes: ["run", "lift", "walk", "ride", "swim", "other"],
  seed: 20260917,
};

const data = generateDemoData(OPTIONS);
const uniq = (values: string[]) => new Set(values).size === values.length;

describe("generateDemoData", () => {
  it("is deterministic for a seed and different for another", () => {
    expect(generateDemoData(OPTIONS)).toEqual(data);
    expect(generateDemoData({ ...OPTIONS, seed: 1 })).not.toEqual(data);
  });

  it("produces rows the app's own schemas accept", () => {
    data.weighIns.forEach((r) => expect(weighInSchema.safeParse(r).success).toBe(true));
    data.nutritionDays.forEach((r) => expect(nutritionDaySchema.safeParse(r).success).toBe(true));
    data.activities.forEach((r) => expect(activitySchema.safeParse(r).success).toBe(true));
    data.injections.forEach((r) => expect(injectionSchema.safeParse(r).success).toBe(true));
    data.dailyMetrics.forEach((r) => expect(stepsSchema.safeParse(r).success).toBe(true));
  });

  it("stays inside the program window and never uses a future day", () => {
    const all = [
      ...data.weighIns,
      ...data.nutritionDays,
      ...data.activities,
      ...data.injections,
      ...data.dailyMetrics,
    ].map((r) => r.local_date);
    expect(all.every((d) => d >= OPTIONS.programStart && d <= TODAY)).toBe(true);
  });

  it("respects the unique keys in schema.sql", () => {
    expect(uniq(data.nutritionDays.map((r) => r.local_date))).toBe(true);
    expect(uniq(data.dailyMetrics.map((r) => r.local_date))).toBe(true);
    expect(uniq(data.injections.map((r) => r.local_date))).toBe(true);
  });

  it("starts at exactly the start weight and drifts down", () => {
    expect(data.weighIns[0]).toMatchObject({
      local_date: OPTIONS.programStart,
      weight_lb: 232.4,
    });
    expect(data.weighIns[data.weighIns.length - 1].weight_lb).toBeLessThan(232.4 - 8);
  });

  it("gives every weigh-in a measured_at that lands on its own local day", () => {
    for (const row of data.weighIns) {
      expect(localDateIn(row.measured_at, OPTIONS.timeZone)).toBe(row.local_date);
    }
  });

  it("includes missed weigh-in days and same-day double weigh-ins, the later one second", () => {
    const days = data.weighIns.map((r) => r.local_date);
    const distinct = new Set(days);
    expect(distinct.size).toBeLessThan(182);
    expect(distinct.size).toBeGreaterThan(182 * 0.75);
    const doubled = [...distinct].filter((d) => days.filter((x) => x === d).length === 2);
    expect(doubled.length).toBeGreaterThan(0);
    for (const day of doubled) {
      const [first, second] = data.weighIns.filter((r) => r.local_date === day);
      expect(first.measured_at < second.measured_at).toBe(true);
    }
  });

  it("puts every shot on schedule except the deliberate late, skipped and extra ones", () => {
    const dates = data.injections.map((r) => r.local_date);
    const onSchedule = dates.filter((d) => weekdayOf(d) === OPTIONS.shotWeekday);
    expect(onSchedule.length).toBeGreaterThan(20);
    // Late by two days: a Saturday for a Thursday schedule, with a note.
    const late = data.injections.filter((r) => r.notes === "Traveling");
    expect(late.map((r) => weekdayOf(r.local_date)).sort()).toEqual([
      (OPTIONS.shotWeekday + 1) % 7,
      (OPTIONS.shotWeekday + 2) % 7,
    ]);
    // 26 scheduled weeks, one skipped, one extra entry.
    const scheduledWeeks = Math.floor(diffDays(TODAY, OPTIONS.programStart) / 7) + 1;
    expect(dates.length).toBe(scheduledWeeks - 1 + 1);
  });

  it("gives lifting sessions notes and includes two-activity days", () => {
    const lifts = data.activities.filter((r) => r.activity_type === "lift");
    expect(lifts.length).toBeGreaterThan(0);
    expect(lifts.every((r) => r.notes)).toBe(true);
    const perDay = new Map<string, number>();
    data.activities.forEach((r) => perDay.set(r.local_date, (perDay.get(r.local_date) ?? 0) + 1));
    expect([...perDay.values()].some((n) => n >= 2)).toBe(true);
  });

  it("only uses activity types that exist", () => {
    const only = generateDemoData({ ...OPTIONS, activityTypes: ["walk"] });
    expect(new Set(only.activities.map((r) => r.activity_type))).toEqual(new Set(["walk"]));
    expect(() => generateDemoData({ ...OPTIONS, activityTypes: [] })).toThrow();
  });

  it("works for a brand-new program with a single day", () => {
    const one = generateDemoData({ ...OPTIONS, programStart: TODAY });
    expect(one.weighIns).toHaveLength(1);
    expect(one.weighIns[0].local_date).toBe(TODAY);
  });
});
