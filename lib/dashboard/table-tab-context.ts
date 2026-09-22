import type { ActivityType } from "@/lib/data/activity-types";

/**
 * Runtime data a tab factory closes over — a table needs more than the static column/schema
 * shape the brief's TableTab type describes: the activity tab's "type" select is the DB's
 * real activity_types, and weigh-ins needs the athlete's timezone to time-stamp a new row.
 */
export interface TableTabContext {
  activityTypes: ActivityType[];
  timezone: string;
}
