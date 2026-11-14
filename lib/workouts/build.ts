import type { ActiveSport } from "@/lib/sport";
import { RIDE } from "./ride";
import { RUN } from "./run";
import { clamp, totalSeconds } from "./steps";
import { SWIM } from "./swim";
import type { PlannerData } from "./service";
import type { BuildContext, KindInfo, SportTemplates } from "./templates";
import type { Effort, Workout, WorkoutRequest } from "./types";

/** The builder: one request in, one workout out. Pure, so the modal previews it in the browser
 * and the server action rebuilds the same thing before saving. */

export const TEMPLATES: Record<ActiveSport, SportTemplates> = { run: RUN, ride: RIDE, swim: SWIM };

export function buildContext(data: Pick<PlannerData, "settings" | "ftp">): BuildContext {
  return { swimStage: data.settings.swim_stage as BuildContext["swimStage"], ftpW: data.ftp.watts };
}

/** The Garmin HR zones a sport's targets refer to (swims have none). */
export function zonesFor(data: Pick<PlannerData, "hrZones">, sport: ActiveSport): [number, number][] | null {
  return sport === "ride" ? data.hrZones.ride : sport === "run" ? data.hrZones.run : null;
}

/** The templates a sport offers right now (swim ones above the athlete's stage are left out). */
export function kindsFor(sport: ActiveSport, ctx: BuildContext): KindInfo[] {
  return TEMPLATES[sport].kinds.filter((k) => (k.minSwimStage ?? 0) <= ctx.swimStage);
}

/** The template a request resolves to: its own kind when the sport offers it, else "auto". */
export function resolveKind(sport: ActiveSport, kind: string, effort: Effort, ctx: BuildContext): KindInfo {
  const kinds = kindsFor(sport, ctx);
  const key = kind === "auto" || !kinds.some((k) => k.key === kind) ? TEMPLATES[sport].auto(effort, ctx) : kind;
  return kinds.find((k) => k.key === key) ?? kinds[0];
}

export function buildWorkout(request: Omit<WorkoutRequest, "date">, ctx: BuildContext): Workout {
  const templates = TEMPLATES[request.sport];
  const info = resolveKind(request.sport, request.kind, request.effort, ctx);
  const minutes = Math.round(clamp(request.minutes, info.minutes[0], info.minutes[1]));
  const built = templates.build(info.key, request.effort, minutes, ctx);
  return {
    sport: request.sport,
    ...built,
    seconds: totalSeconds(built.blocks, templates.pace?.(ctx)),
  };
}
