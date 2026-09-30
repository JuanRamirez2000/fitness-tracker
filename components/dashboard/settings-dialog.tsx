"use client";

import { useState, useTransition } from "react";
import { saveSettings } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { profileSettingsSchema, type Profile } from "@/lib/data/profiles";

const optionalNumber = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));

export function SettingsDialog({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    const parsed = profileSettingsSchema.safeParse({
      display_name: form.get("display_name"),
      timezone: form.get("timezone"),
      program_start_date: form.get("program_start_date") || null,
      goal_weight_lb: optionalNumber(form.get("goal_weight_lb")),
      goal_pace_lb_per_week: optionalNumber(form.get("goal_pace_lb_per_week")),
      start_weight_lb: optionalNumber(form.get("start_weight_lb")),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the values and try again.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await saveSettings(parsed.data);
        setOpen(false);
      } catch {
        setError("Couldn't save settings. Try again.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] text-muted-2 hover:text-ink">
        Settings
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="settings-title" className="w-[min(420px,calc(100vw-32px))]">
        <form
          className="flex flex-col gap-4 px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <h2 id="settings-title" className="font-serif text-[18px]">Settings</h2>
          <Field label="Name" htmlFor="display_name">
            <TextInput id="display_name" name="display_name" defaultValue={profile.display_name} required />
          </Field>
          <Field label="Timezone" htmlFor="timezone">
            <TextInput id="timezone" name="timezone" defaultValue={profile.timezone} required />
          </Field>
          <Field label="Program start" htmlFor="program_start_date">
            <TextInput id="program_start_date" name="program_start_date" type="date" defaultValue={profile.program_start_date ?? ""} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start lb" htmlFor="start_weight_lb">
              <TextInput id="start_weight_lb" name="start_weight_lb" type="number" step="0.1" defaultValue={profile.start_weight_lb ?? ""} />
            </Field>
            <Field label="Goal lb" htmlFor="goal_weight_lb">
              <TextInput id="goal_weight_lb" name="goal_weight_lb" type="number" step="0.1" defaultValue={profile.goal_weight_lb ?? ""} />
            </Field>
            <Field label="lb / week" htmlFor="goal_pace_lb_per_week">
              <TextInput id="goal_pace_lb_per_week" name="goal_pace_lb_per_week" type="number" step="0.1" defaultValue={profile.goal_pace_lb_per_week ?? ""} />
            </Field>
          </div>
          {error && <p role="alert" className="text-[12px] text-bad">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
