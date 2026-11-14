import type { SwimStage } from "./settings";
import type { Block, Effort } from "./types";

/** What a sport module (run.ts, ride.ts, swim.ts) provides to the builder. */

export interface KindInfo {
  key: string;
  label: string;
  /** One line for the modal's picker. */
  blurb: string;
  /** [min, max, default] minutes for the duration slider. */
  minutes: [number, number, number];
  /** Swim only: the lowest swim stage it suits. */
  minSwimStage?: SwimStage;
}

export interface BuildContext {
  swimStage: SwimStage;
  /** Watts; null when there's no FTP to build power targets from (rides fall back to HR). */
  ftpW: number | null;
}

export interface Built {
  kind: string;
  name: string;
  why: string;
  blocks: Block[];
}

export interface SportTemplates {
  kinds: KindInfo[];
  /** The template "auto" resolves to at this effort. */
  auto(effort: Effort, ctx: BuildContext): string;
  build(kind: string, effort: Effort, minutes: number, ctx: BuildContext): Built;
  /** Seconds per pool length / lap-button step, for the time estimate. */
  pace?(ctx: BuildContext): { secondsPerLength: number; secondsPerLap: number };
}
