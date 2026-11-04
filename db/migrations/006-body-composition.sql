-- Dashboard v2, Weight tab: body composition from the Index scale, as columns on the
-- weigh-ins it comes with (same rows, same idempotent key, so nothing is re-keyed and the
-- start weight and the heatmap's first day can't move). Null for manual entries. Fat mass is
-- not stored: it is weight x body_fat_pct. Already part of db/schema.sql. Safe to re-run.
alter table weigh_ins
  add column if not exists body_fat_pct numeric(4,1),
  add column if not exists muscle_mass_lb numeric(6,2),
  add column if not exists bone_mass_lb numeric(5,2),
  add column if not exists body_water_pct numeric(4,1);
