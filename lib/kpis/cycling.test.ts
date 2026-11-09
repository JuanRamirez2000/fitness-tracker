import { describe, expect, it } from "vitest";
import { currentFtp, ftp } from "./ftp";
import { rideHours, rideMiles, trainingHours } from "./ride-volume";
import { testDashboardData, testRide, testRun, testTraining, trendRow, TODAY } from "./testing";
import { vo2maxCycling } from "./vo2max-cycling";

// TODAY is 2026-09-20.
describe("rideMiles", () => {
  it("adds the last 7 days of rides against the 7 before, with climbing in the caption", () => {
    const v = rideMiles.compute(
      testDashboardData({
        today: TODAY,
        activities: [
          testRide({ local_date: "2026-09-10" }), // the week before
          testRide({ local_date: "2026-09-18" }),
          testRide({ local_date: "2026-09-20", distance_m: 20 * 1609.344, elevation_gain_m: 300 }),
          testRun({ local_date: "2026-09-19" }), // not a ride
        ],
      }),
    )!;
    expect(v.value).toBeCloseTo(35, 6);
    expect(v.delta).toBeCloseTo(20, 6);
    expect(v.sub).toBe("Last 7 days · 2 rides · 1,476 ft climbed");
    expect(v.points).toHaveLength(8);
  });

  it("is empty with no rides at all", () => {
    expect(rideMiles.compute(testDashboardData({ activities: [testRun({ local_date: TODAY })] }))).toBeNull();
  });
});

describe("rideHours and trainingHours", () => {
  it("count moving time, and All adds rides and runs", () => {
    const activities = [testRide({ local_date: "2026-09-19", activity_type: "indoor_cycling" }), testRun({ local_date: "2026-09-20" })];
    const rides = rideHours.compute(testDashboardData({ activities }))!;
    expect(rides.value).toBeCloseTo(1, 6);
    expect(rides.sub).toBe("Last 7 days · 1 indoor");
    const all = trainingHours.compute(testDashboardData({ activities }))!;
    expect(all.value).toBeCloseTo(1.6, 6);
    expect(all.sub).toBe("Last 7 days · 1 ride · 1 run");
  });
});

describe("ftp", () => {
  it("prefers Garmin's FTP from the unofficial import, with watts per kilo", () => {
    const data = testDashboardData({
      training: [testTraining({ local_date: "2026-09-01", ftp_w: 180 })],
      activities: [testRide({ local_date: "2026-09-19" })],
      weightTrend: [trendRow({ local_date: "2026-09-19", weight_lb: 198.4 })],
    });
    expect(currentFtp(data)).toEqual({ watts: 180, date: "2026-09-01", source: "garmin" });
    const v = ftp.compute(data)!;
    expect(v.value).toBe(180);
    expect(v.sub).toBe("Set in Garmin · as of Sep 1 · 2.0 W/kg");
  });

  it("works Garmin's setting back from a ride's NP and IF, and flags one far above the rides", () => {
    // The real indoor ride: NP 147 W at IF 0.442 is an FTP of 333 W, with a best 20 min of 138 W.
    const data = testDashboardData({
      activities: [testRide({ local_date: "2026-09-19", norm_power_w: 147, intensity_factor: 0.442, max_20min_power_w: 138 })],
    });
    expect(currentFtp(data)).toEqual({ watts: 333, date: "2026-09-19", source: "ride" });
    const v = ftp.compute(data)!;
    expect(v.tone).toBe("warn");
    expect(v.sub).toBe("Garmin's setting · your rides suggest ~131 W");
  });

  it("falls back to 95% of the best 20 minutes in 90 days", () => {
    const data = testDashboardData({
      activities: [testRide({ local_date: "2026-05-01", max_20min_power_w: 300 }), testRide({ local_date: "2026-09-19", max_20min_power_w: 200 })],
    });
    expect(currentFtp(data)).toEqual({ watts: 190, date: "2026-09-19", source: "estimate" });
  });

  it("is empty without any power", () => {
    const data = testDashboardData({ activities: [testRide({ local_date: "2026-09-19", max_20min_power_w: null, power_curve: null, norm_power_w: null })] });
    expect(ftp.compute(data)).toBeNull();
  });
});

describe("vo2maxCycling", () => {
  it("reads Garmin's cycling VO2 max", () => {
    const v = vo2maxCycling.compute(testDashboardData({ training: [testTraining({ local_date: "2026-09-18", vo2max_cycling: 44.5 })] }))!;
    expect(vo2maxCycling.format(v).primary).toBe("44.5");
  });
});
