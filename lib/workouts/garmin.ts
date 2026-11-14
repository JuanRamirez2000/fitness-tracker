import type { ActiveSport } from "@/lib/sport";
import { watts } from "./describe";
import type { Block, Equipment, Step, StepKind, Stroke, Workout } from "./types";

/**
 * A Workout as Garmin Connect's workout JSON (the shape cyberjunky/python-garminconnect uploads),
 * for scripts/garmin/push_workout.py. Field ids were checked with real uploads on 2026-11-13:
 * HR zones as `zoneNumber`, swim pools as `poolLength` + `poolLengthUnit`, pool lengths as a
 * distance in meters with a preferred unit, drills on the lap button, rest as fixed seconds,
 * notes as the step `description`. Pure.
 */

const SPORT: Record<ActiveSport, { sportTypeId: number; sportTypeKey: string; displayOrder: number }> = {
  run: { sportTypeId: 1, sportTypeKey: "running", displayOrder: 1 },
  ride: { sportTypeId: 2, sportTypeKey: "cycling", displayOrder: 2 },
  swim: { sportTypeId: 4, sportTypeKey: "swimming", displayOrder: 3 },
};

const STEP_TYPE: Record<StepKind | "repeat", { stepTypeId: number; stepTypeKey: string; displayOrder: number }> = {
  warmup: { stepTypeId: 1, stepTypeKey: "warmup", displayOrder: 1 },
  cooldown: { stepTypeId: 2, stepTypeKey: "cooldown", displayOrder: 2 },
  work: { stepTypeId: 3, stepTypeKey: "interval", displayOrder: 3 },
  recover: { stepTypeId: 4, stepTypeKey: "recovery", displayOrder: 4 },
  rest: { stepTypeId: 5, stepTypeKey: "rest", displayOrder: 5 },
  repeat: { stepTypeId: 6, stepTypeKey: "repeat", displayOrder: 6 },
};

const CONDITION = {
  lap: { conditionTypeId: 1, conditionTypeKey: "lap.button", displayOrder: 1, displayable: true },
  time: { conditionTypeId: 2, conditionTypeKey: "time", displayOrder: 2, displayable: true },
  distance: { conditionTypeId: 3, conditionTypeKey: "distance", displayOrder: 3, displayable: true },
  iterations: { conditionTypeId: 7, conditionTypeKey: "iterations", displayOrder: 7, displayable: false },
  fixedRest: { conditionTypeId: 8, conditionTypeKey: "fixed.rest", displayOrder: 8, displayable: true },
};

const TARGET = {
  none: { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target", displayOrder: 1 },
  power: { workoutTargetTypeId: 2, workoutTargetTypeKey: "power.zone", displayOrder: 2 },
  hr: { workoutTargetTypeId: 4, workoutTargetTypeKey: "heart.rate.zone", displayOrder: 4 },
};

const STROKE: Record<Stroke, { strokeTypeId: number; strokeTypeKey: string }> = {
  any: { strokeTypeId: 1, strokeTypeKey: "any_stroke" },
  back: { strokeTypeId: 2, strokeTypeKey: "backstroke" },
  breast: { strokeTypeId: 3, strokeTypeKey: "breaststroke" },
  drill: { strokeTypeId: 4, strokeTypeKey: "drill" },
  free: { strokeTypeId: 6, strokeTypeKey: "free" },
};

const EQUIPMENT: Record<Equipment, { equipmentTypeId: number; equipmentTypeKey: string }> = {
  fins: { equipmentTypeId: 1, equipmentTypeKey: "fins" },
  kickboard: { equipmentTypeId: 2, equipmentTypeKey: "kickboard" },
  pull_buoy: { equipmentTypeId: 4, equipmentTypeKey: "pull_buoy" },
};

const UNIT = {
  yard: { unitId: 230, unitKey: "yard", factor: 91.44 },
  meter: { unitId: 1, unitKey: "meter", factor: 100 },
};

const METERS_PER_UNIT = { yard: 0.9144, meter: 1 };

export interface GarminContext {
  ftpW: number | null;
  pool: { length: number; unit: "yard" | "meter" };
}

type Json = Record<string, unknown>;

function executable(s: Step, order: number, sport: ActiveSport, ctx: GarminContext): Json {
  const out: Json = { type: "ExecutableStepDTO", stepOrder: order, stepType: STEP_TYPE[s.kind] };
  if (s.length.by === "time") {
    // Swim rest at the wall is Garmin's "fixed rest"; everything else timed is plain time.
    out.endCondition = sport === "swim" && s.kind === "rest" ? CONDITION.fixedRest : CONDITION.time;
    out.endConditionValue = s.length.seconds;
  } else if (s.length.by === "lengths") {
    out.endCondition = CONDITION.distance;
    out.endConditionValue = Math.round(s.length.count * ctx.pool.length * METERS_PER_UNIT[ctx.pool.unit] * 100) / 100;
    out.preferredEndConditionUnit = UNIT[ctx.pool.unit];
  } else {
    out.endCondition = CONDITION.lap;
  }
  if (s.target.by === "hr") {
    out.targetType = TARGET.hr;
    out.zoneNumber = s.target.zone;
  } else if (s.target.by === "power" && ctx.ftpW) {
    out.targetType = TARGET.power;
    out.targetValueOne = watts(s.target.low, ctx.ftpW);
    out.targetValueTwo = watts(s.target.high, ctx.ftpW);
  } else if (s.kind !== "rest") {
    out.targetType = TARGET.none;
  }
  if (sport === "swim" && s.kind !== "rest") out.strokeType = STROKE[s.stroke ?? "free"];
  if (s.equipment) out.equipmentType = EQUIPMENT[s.equipment];
  if (s.note) out.description = s.note.slice(0, 200);
  return out;
}

export function toGarminWorkout(workout: Workout, ctx: GarminContext): Json {
  const sport = SPORT[workout.sport];
  let order = 0;
  const steps = workout.blocks.map((b: Block): Json => {
    order += 1;
    if (b.kind !== "repeat") return executable(b, order, workout.sport, ctx);
    const groupOrder = order;
    const children = b.steps.map((s) => executable(s, ++order, workout.sport, ctx));
    return {
      type: "RepeatGroupDTO",
      stepOrder: groupOrder,
      stepType: STEP_TYPE.repeat,
      numberOfIterations: b.times,
      endCondition: CONDITION.iterations,
      endConditionValue: b.times,
      smartRepeat: false,
      workoutSteps: children,
    };
  });
  const out: Json = {
    workoutName: workout.name.slice(0, 80),
    description: workout.why.slice(0, 500),
    sportType: sport,
    estimatedDurationInSecs: workout.seconds,
    workoutSegments: [{ segmentOrder: 1, sportType: sport, workoutSteps: steps }],
  };
  if (workout.sport === "swim") {
    out.poolLength = ctx.pool.length;
    out.poolLengthUnit = UNIT[ctx.pool.unit];
  }
  return out;
}
