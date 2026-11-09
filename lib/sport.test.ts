import { describe, expect, it } from "vitest";
import { inSport, isRide, isRun, parseSportParam, sportOf } from "./sport";

describe("sportOf", () => {
  it.each([
    ["indoor_cycling", "ride"],
    ["road_biking", "ride"],
    ["gravel_cycling", "ride"],
    ["virtual_ride", "ride"],
    ["e_bike_mountain", "ride"],
    ["some_new_cycling_type", "ride"],
    ["running", "run"],
    ["treadmill_running", "run"],
    ["virtual_run", "run"],
    ["ultra_run", "run"],
    ["walking", "other"],
    ["hiking", "other"],
    ["strength_training", "other"],
    ["lap_swimming", "other"],
  ])("%s is %s", (type, sport) => {
    expect(sportOf(type)).toBe(sport);
  });

  it("matches the predicates", () => {
    expect(isRide({ activity_type: "mountain_biking" })).toBe(true);
    expect(isRun({ activity_type: "mountain_biking" })).toBe(false);
    expect(isRun({ activity_type: "trail_running" })).toBe(true);
  });
});

describe("inSport", () => {
  const ride = { activity_type: "cycling" };
  const run = { activity_type: "running" };
  const walk = { activity_type: "walking" };

  it("filters to one sport, or rides and runs for all", () => {
    expect([ride, run, walk].filter((a) => inSport(a, "ride"))).toEqual([ride]);
    expect([ride, run, walk].filter((a) => inSport(a, "run"))).toEqual([run]);
    expect([ride, run, walk].filter((a) => inSport(a, "all"))).toEqual([ride, run]);
  });
});

describe("parseSportParam", () => {
  it("defaults to ride", () => {
    expect(parseSportParam(undefined)).toBe("ride");
    expect(parseSportParam("swim")).toBe("ride");
    expect(parseSportParam("run")).toBe("run");
    expect(parseSportParam("all")).toBe("all");
  });
});
