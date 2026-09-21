import { z } from "zod";

/** Where a row came from. Manual entry is the only source in V0; imports arrive in V1. */
export const sourceSchema = z.enum(["manual", "garmin", "apple_health"]);

export const uuidSchema = z.uuid();

/** timestamptz as PostgREST returns it (an ISO 8601 string). */
export const timestampSchema = z.string();
