"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/session";
import { profileSettingsSchema } from "@/lib/data/profiles";
import { deleteWeighIn, fetchOwnerProfile, insertWeighIn, updateProfile, updateWeighIn } from "@/lib/data/queries";
import { weighInSchema } from "@/lib/data/weigh-ins";
import { defaultMeasuredAt } from "@/lib/dates/timezone";

// Every write re-checks the session (server actions are public endpoints) and validates its
// input with the same zod schema the form uses, then refreshes the page's server data.

async function ownerProfile() {
  await requireOwner();
  const profile = await fetchOwnerProfile();
  if (!profile) throw new Error("No profile row exists yet. See README.");
  return profile;
}

export async function saveWeighIn(values: unknown, id?: string): Promise<void> {
  const profile = await ownerProfile();
  const parsed = weighInSchema.parse(values);
  if (id) await updateWeighIn(profile.id, id, parsed);
  else await insertWeighIn(profile.id, parsed, defaultMeasuredAt(parsed.local_date, profile.timezone));
  refresh();
}

export async function removeWeighIn(id: string): Promise<void> {
  const profile = await ownerProfile();
  await deleteWeighIn(profile.id, id);
  refresh();
}

export async function saveSettings(values: unknown): Promise<void> {
  const profile = await ownerProfile();
  await updateProfile(profile.id, profileSettingsSchema.parse(values));
  refresh();
}
