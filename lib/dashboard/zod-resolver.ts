import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * A minimal, hand-written stand-in for @hookform/resolvers/zod: that package's zodResolver()
 * does not type-check against a generic z.ZodType<Values> parameter (only a concrete zod
 * schema), which is exactly what every one of this app's shared, generic form components
 * need to pass it. Every form here is flat (no nested objects), so this only needs to map
 * each zod issue's top-level field name to one FieldError — safeParse does the real work.
 */
export function zodFormResolver<Values extends FieldValues>(schema: z.ZodType<Values>): Resolver<Values> {
  return (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "root");
      if (!errors[key]) errors[key] = { type: issue.code, message: issue.message };
    }
    // The runtime shape (flat field name -> {type, message}) is exactly what RHF's
    // FieldErrors<Values> needs for a flat form; the deep conditional mapped type behind
    // FieldErrors does not reduce under a generic Values, so it is asserted here once
    // rather than fought at every call site.
    return { values: {}, errors: errors as never };
  };
}
