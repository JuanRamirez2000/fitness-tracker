"use client";

import { useState } from "react";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import type { z } from "zod";
import type { FieldSpec } from "@/lib/dashboard/table-tab";
import { zodFormResolver } from "@/lib/dashboard/zod-resolver";
import { FieldInput } from "./field-input";

/** The second editing pattern: a persistent row of real inputs, not a dialog — matches every
 * FieldSpec the tab defines, submits on Enter or the Add button, and clears itself after. */
export function AddRow<Values extends FieldValues>({
  fields,
  schema,
  defaultValues,
  onAdd,
}: {
  fields: FieldSpec<Values>[];
  schema: z.ZodType<Values>;
  defaultValues: Values;
  onAdd: (values: Values) => Promise<void>;
}) {
  // DefaultValues<Values> is another deep mapped type that does not reduce under a generic
  // Values (same root cause noted in zod-resolver.ts); our Values is always a flat object,
  // so the plain value is always structurally valid.
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({ resolver: zodFormResolver(schema), defaultValues: defaultValues as DefaultValues<Values> });
  const [error, setError] = useState<string | null>(null);

  const submit = handleSubmit(async (values: Values) => {
    setError(null);
    try {
      await onAdd(values);
      reset(defaultValues as DefaultValues<Values>);
    } catch {
      setError("Could not add. Try again.");
    }
  });

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 border-t border-dashed border-border-strong px-[18px] py-2.5"
    >
      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-3">+ Add</span>
      {fields.map((field) => (
        <div key={field.name} className="min-w-[90px] flex-1">
          <FieldInput<Values> field={field} register={register} className="w-full rounded-md border border-field-border bg-inset px-2 py-1 text-[12px] text-ink outline-none focus:border-accent" />
        </div>
      ))}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-accent px-3 py-1 text-[11.5px] font-medium text-bg disabled:opacity-50"
      >
        Add
      </button>
      {error && <span className="w-full text-[11px] text-bad">{error}</span>}
    </form>
  );
}
