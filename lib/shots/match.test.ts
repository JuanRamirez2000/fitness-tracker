import { describe, expect, it } from "vitest";
import { matchShots, scheduledShotDates, type MatchShotsInput } from "./match";

// Thursday schedule; program starts on Thursday 2026-09-17, today is Sunday 2026-09-20.
const BASE: MatchShotsInput = {
  programStart: "2026-09-17",
  shotWeekday: 4,
  injectionDates: [],
  today: "2026-09-20",
  through: "2026-10-08",
};

const starOn = (stars: ReturnType<typeof matchShots>, date: string) =>
  stars.find((s) => s.date === date);

describe("scheduledShotDates", () => {
  it("lists every matching weekday from the program start", () => {
    expect(scheduledShotDates("2026-09-17", 4, "2026-10-08")).toEqual([
      "2026-09-17",
      "2026-09-24",
      "2026-10-01",
      "2026-10-08",
    ]);
  });

  it("starts at the first matching weekday after a program start on another day", () => {
    // Wednesday 2026-09-16 with a Sunday schedule: first shot Sunday 2026-09-20.
    expect(scheduledShotDates("2026-09-16", 0, "2026-10-04")).toEqual([
      "2026-09-20",
      "2026-09-27",
      "2026-10-04",
    ]);
  });

  it("is empty when the first shot day is after `through`", () => {
    expect(scheduledShotDates("2026-09-18", 4, "2026-09-20")).toEqual([]);
  });
});

describe("matchShots", () => {
  it("marks an on-time shot taken and the following Thursdays scheduled", () => {
    const stars = matchShots({ ...BASE, injectionDates: ["2026-09-17"] });
    expect(starOn(stars, "2026-09-17")).toEqual({
      date: "2026-09-17",
      state: "taken",
      scheduledFor: "2026-09-17",
    });
    expect(starOn(stars, "2026-09-24")?.state).toBe("scheduled");
    expect(starOn(stars, "2026-10-08")?.state).toBe("scheduled");
  });

  it("moves the star to the actual date of a shot logged 2 days late, with no leftover hollow star", () => {
    const stars = matchShots({ ...BASE, injectionDates: ["2026-09-19"] });
    expect(starOn(stars, "2026-09-19")).toEqual({
      date: "2026-09-19",
      state: "taken",
      scheduledFor: "2026-09-17",
    });
    expect(starOn(stars, "2026-09-17")).toBeUndefined();
    expect(stars.filter((s) => s.date >= "2026-09-14" && s.date <= "2026-09-20")).toHaveLength(1);
  });

  it("accepts a shot up to 3 days late or early, and no further", () => {
    for (const date of ["2026-09-14", "2026-09-20"]) {
      const stars = matchShots({ ...BASE, injectionDates: [date] });
      expect(starOn(stars, date)?.scheduledFor).toBe("2026-09-17");
      expect(starOn(stars, "2026-09-17")).toBeUndefined();
    }
  });

  it("lets a shot 4 days after a scheduled day fulfil the next one instead", () => {
    // Mon 2026-09-21 is 4 days after Thu 09-17 and 3 days before Thu 09-24.
    const stars = matchShots({
      ...BASE,
      today: "2026-09-25",
      injectionDates: ["2026-09-21"],
    });
    expect(starOn(stars, "2026-09-21")?.scheduledFor).toBe("2026-09-24");
    expect(starOn(stars, "2026-09-17")?.state).toBe("missed");
    expect(starOn(stars, "2026-09-24")).toBeUndefined();
  });

  it("shows a past scheduled day with no shot as missed, and today or later as scheduled", () => {
    const stars = matchShots({ ...BASE, today: "2026-09-24" });
    expect(starOn(stars, "2026-09-17")?.state).toBe("missed");
    expect(starOn(stars, "2026-09-24")?.state).toBe("scheduled"); // today, not logged yet
    expect(starOn(stars, "2026-10-01")?.state).toBe("scheduled");
  });

  it("draws an extra injection in the same window as a filled star without claiming a schedule", () => {
    const stars = matchShots({ ...BASE, injectionDates: ["2026-09-17", "2026-09-19"] });
    expect(starOn(stars, "2026-09-17")?.scheduledFor).toBe("2026-09-17");
    expect(starOn(stars, "2026-09-19")).toEqual({
      date: "2026-09-19",
      state: "taken",
      scheduledFor: null,
    });
  });

  it("gives the schedule to the nearest injection, and to the earlier one on a tie", () => {
    const nearest = matchShots({ ...BASE, injectionDates: ["2026-09-15", "2026-09-18"] });
    expect(starOn(nearest, "2026-09-18")?.scheduledFor).toBe("2026-09-17");
    expect(starOn(nearest, "2026-09-15")?.scheduledFor).toBeNull();

    const tie = matchShots({ ...BASE, injectionDates: ["2026-09-16", "2026-09-18"] });
    expect(starOn(tie, "2026-09-16")?.scheduledFor).toBe("2026-09-17");
    expect(starOn(tie, "2026-09-18")?.scheduledFor).toBeNull();
  });

  it("counts an early shot for an upcoming scheduled day", () => {
    const stars = matchShots({
      ...BASE,
      today: "2026-09-22",
      injectionDates: ["2026-09-17", "2026-09-22"],
    });
    expect(starOn(stars, "2026-09-22")?.scheduledFor).toBe("2026-09-24");
    expect(starOn(stars, "2026-09-24")).toBeUndefined();
  });

  it("still draws a shot taken before the program start", () => {
    const stars = matchShots({ ...BASE, injectionDates: ["2026-09-01"] });
    expect(starOn(stars, "2026-09-01")).toEqual({
      date: "2026-09-01",
      state: "taken",
      scheduledFor: null,
    });
  });

  it("ignores duplicate dates and returns one star per day in date order", () => {
    const stars = matchShots({
      ...BASE,
      today: "2026-10-05",
      injectionDates: ["2026-09-19", "2026-09-19", "2026-09-24"],
    });
    const dates = stars.map((s) => s.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates).toEqual([...dates].sort());
  });

  it("schedules the first shot day itself when the program starts on it", () => {
    const stars = matchShots({ ...BASE, programStart: "2026-09-20", shotWeekday: 0 });
    expect(starOn(stars, "2026-09-20")?.state).toBe("scheduled");
  });
});
