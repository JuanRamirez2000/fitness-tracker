/**
 * Captures one activity's raw Garmin payloads as test fixtures (lib/garmin/fixtures/), so the
 * mapping tests run against real keys instead of guessed ones.
 *
 *   npx tsx --env-file=.env.local scripts/garmin-fixture.ts --sport ride          # latest ride in 30 days
 *   npx tsx --env-file=.env.local scripts/garmin-fixture.ts --id 123 --prefix ride
 *
 * Writes <prefix>-activity-search.json, <prefix>-activity.json and <prefix>-activity-details.json.
 * Position and identity are stripped (no lat/lon or polyline, no account ids, names or device serials) and the details are thinned
 * to FIXTURE_ROWS samples, so the files stay small and say nothing about where you ride. The
 * untouched payloads go to --raw-dir when given, for a one-off look at every key Garmin sent.
 *
 * Also probes the Personal API for a cycling FTP and prints what comes back.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { GarminClient } from "../lib/garmin/client";
import { isRideType } from "../lib/sport";

const FIXTURE_DIR = join(import.meta.dirname, "../lib/garmin/fixtures");
/** Samples kept in the details fixture: plenty for splits, efforts and series tests. */
const FIXTURE_ROWS = 600;
const POSITION_KEY = /lat|lon|polyline|location|coordinate/i;
/** Who and what: account ids, names, profile images, device serials. */
const PRIVATE_KEY = /owner|userprofile|userinfo|profileimage|displayname|fullname|serial|uuid/i;
const POSITION_METRICS = new Set(["directLatitude", "directLongitude"]);

type Json = Record<string, unknown>;

/** A copy with every position-like key dropped, at any depth. Location names stay: they're coarse. */
function stripPosition(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPosition);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Json)
        .filter(([k]) => (k === "locationName" || !POSITION_KEY.test(k)) && !PRIVATE_KEY.test(k))
        .map(([k, v]) => [k, stripPosition(v)]),
    );
  }
  return value;
}

/** Thins the samples evenly to FIXTURE_ROWS and drops the position metrics (keeping indexes valid). */
function thinDetails(raw: Json): Json {
  const descriptors = (raw.metricDescriptors as { metricsIndex: number; key: string }[] | undefined) ?? [];
  const rows = (raw.activityDetailMetrics as { metrics?: (number | null)[] }[] | undefined) ?? [];
  const blanked = new Set(descriptors.filter((d) => POSITION_METRICS.has(d.key)).map((d) => d.metricsIndex));
  const step = Math.max(1, Math.ceil(rows.length / FIXTURE_ROWS));
  const kept = rows
    .filter((_, i) => i % step === 0 || i === rows.length - 1)
    .map((r) => ({ metrics: (r.metrics ?? []).map((v, i) => (blanked.has(i) ? null : v)) }));
  return {
    activityId: 1,
    measurementCount: descriptors.length,
    metricsCount: kept.length,
    metricDescriptors: descriptors,
    activityDetailMetrics: kept,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      sport: { type: "string", default: "ride" },
      prefix: { type: "string" },
      days: { type: "string", default: "30" },
      "raw-dir": { type: "string" },
    },
  });
  const garmin = new GarminClient();
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - Number(values.days) * 86_400_000).toISOString().slice(0, 10);
  const list = (await garmin.activities(start, end)) as unknown as Json[];
  const typeKey = (a: Json) => ((a.activityType as Json | undefined)?.typeKey as string | undefined) ?? "";

  console.log(`${list.length} activities ${start}..${end}:`);
  for (const a of list) console.log(`  ${a.activityId}  ${a.startTimeLocal}  ${typeKey(a)}  ${a.activityName ?? ""}`);

  const pick = values.id
    ? list.find((a) => String(a.activityId) === values.id)
    : [...list].reverse().find((a) => (values.sport === "ride" ? isRideType(typeKey(a)) : typeKey(a).includes(values.sport!)));
  if (!pick) throw new Error(values.id ? `Activity ${values.id} isn't in the last ${values.days} days.` : `No ${values.sport} in the last ${values.days} days.`);
  const id = String(pick.activityId);
  const prefix = values.prefix ?? values.sport;
  console.log(`\nCapturing ${id} (${typeKey(pick)}) as "${prefix}"`);

  const [details, record] = await Promise.all([garmin.activityDetails(id), garmin.activityRecord(id)]);

  if (values["raw-dir"]) {
    mkdirSync(values["raw-dir"], { recursive: true });
    writeFileSync(join(values["raw-dir"], `${prefix}-search.raw.json`), JSON.stringify(pick, null, 2));
    writeFileSync(join(values["raw-dir"], `${prefix}-record.raw.json`), JSON.stringify(record, null, 2));
    writeFileSync(join(values["raw-dir"], `${prefix}-details.raw.json`), JSON.stringify(details, null, 2));
  }

  const search = { ...(stripPosition(pick) as Json), activityId: 1 };
  writeFileSync(join(FIXTURE_DIR, `${prefix}-activity-search.json`), JSON.stringify([search], null, 2) + "\n");
  writeFileSync(join(FIXTURE_DIR, `${prefix}-activity.json`), JSON.stringify({ ...(stripPosition(record) as Json), activityId: 1 }, null, 2) + "\n");
  if (details) writeFileSync(join(FIXTURE_DIR, `${prefix}-activity-details.json`), JSON.stringify(thinDetails(details as unknown as Json)) + "\n");

  const interesting = /cadence|power|stress|intensity|zone|vo2|ftp|work|balance|elev/i;
  console.log("\nSearch-row keys of interest:");
  for (const [k, v] of Object.entries(pick)) if (interesting.test(k)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  console.log(`\nDetail metrics: ${(details?.metricDescriptors ?? []).map((d) => d.key).join(", ")}`);
  console.log(`Split types: ${((record as Json | null)?.splitSummaries as Json[] | undefined)?.map((s) => s.splitType).join(", ") ?? "none"}`);

  for (const path of ["/biometric-service/biometric/latestFunctionalThresholdPower/CYCLING", "/biometric-service/biometric/powerToWeight/latest/" + end]) {
    try {
      console.log(`\n${path}:\n  ${JSON.stringify(await garmin.get<unknown>(path))}`);
    } catch (err) {
      console.log(`\n${path}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
