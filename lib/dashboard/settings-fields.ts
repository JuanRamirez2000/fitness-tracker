import type { ProfileSettings } from "@/lib/data/profiles";
import type { FieldSpec } from "./table-tab";

const WEEKDAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

/** Not in the design (no frame covers the settings dialog) — built off the same FieldSpec
 * vocabulary the table tabs and quick-log sheet already use, rather than a one-off form.
 * Leaves out id/role (never editable here) and calorie_target_kcal (arrives with the kcal
 * field in V1, same as everywhere else it's mentioned). */
export const SETTINGS_FIELDS: FieldSpec<ProfileSettings>[] = [
  { name: "display_name", label: "Display name", kind: "text" },
  { name: "timezone", label: "Timezone", kind: "text" },
  { name: "shot_weekday", label: "Shot weekday", kind: "select", options: WEEKDAY_OPTIONS },
  { name: "steps_goal", label: "Steps goal", kind: "number", step: 500 },
  { name: "start_weight_lb", label: "Start weight", kind: "number", unit: "lb", step: 0.1 },
  { name: "goal_weight_lb", label: "Goal weight", kind: "number", unit: "lb", step: 0.1 },
  { name: "goal_pace_lb_per_week", label: "Goal pace", kind: "number", unit: "lb/week", step: 0.1 },
];
