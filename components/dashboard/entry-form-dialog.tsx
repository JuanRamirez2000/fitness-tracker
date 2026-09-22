"use client";

import { useState } from "react";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import type { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { FieldSpec } from "@/lib/dashboard/table-tab";
import { zodFormResolver } from "@/lib/dashboard/zod-resolver";
import { FieldInput } from "./field-input";

interface EntryFormDialogProps<Values extends FieldValues> {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: FieldSpec<Values>[];
  schema: z.ZodType<Values>;
  defaultValues: Values;
  onSubmit: (values: Values) => Promise<void>;
  /** Omitted for the add-row path's own dialog (nothing to delete yet). */
  onDelete?: () => Promise<void>;
}

/**
 * Frame 2D: the third editing pattern, and the only one that reaches every field. Built once
 * off FieldSpec[] so a tab never hand-rolls its own form — see lib/dashboard/table-tab.ts.
 *
 * react-hook-form only reads `defaultValues` on mount, and this dialog opens for a different
 * row each time — rather than an effect that resets form state on every `open` (a real
 * anti-pattern: setState synchronously inside an effect, cascading a render), the caller
 * gives this component a `key` derived from which row is being edited (DataTable does), so
 * React remounts it fresh — defaultValues just work, with no reset logic to keep in sync.
 */
export function EntryFormDialog<Values extends FieldValues>({
  open,
  onClose,
  title,
  fields,
  schema,
  defaultValues,
  onSubmit,
  onDelete,
}: EntryFormDialogProps<Values>) {
  // DefaultValues<Values>/handleSubmit's callback param are deep mapped/generic types that
  // do not reduce under a generic Values (see zod-resolver.ts) — Values is always flat here.
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodFormResolver(schema), defaultValues: defaultValues as DefaultValues<Values> });
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = handleSubmit(async (values: Values) => {
    setFormError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch {
      setFormError("Could not save. Try again.");
    }
  });

  return (
    <Dialog open={open} onClose={onClose} labelledBy="entry-form-title" className="w-[420px] max-w-[calc(100vw-40px)]">
      <div className="flex items-center justify-between border-b border-divider px-5 py-4">
        <span id="entry-form-title" className="font-serif text-[17px]">
          {title}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[14px] text-muted-2">
          {"×"}
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3.5 px-5 py-[18px]">
        {fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1.5">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">{field.label}</span>
            <FieldInput<Values> field={field} register={register} />
            {errors[field.name as keyof typeof errors] && (
              <span className="text-[11px] text-bad">
                {String(errors[field.name as keyof typeof errors]?.message ?? "Invalid value")}
              </span>
            )}
          </div>
        ))}
        {formError && <p className="text-[12px] text-bad">{formError}</p>}

        <div className="mt-1 flex items-center justify-between border-t border-divider pt-3.5">
          {onDelete ? (
            <button
              type="button"
              disabled={deleting || isSubmitting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await onDelete();
                  onClose();
                } catch {
                  setFormError("Could not delete. Try again.");
                  setDeleting(false);
                }
              }}
              className="text-[12.5px] text-bad disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting || deleting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || deleting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

