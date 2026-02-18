-- Phase 2 (partial): store EXIF metadata captured during admin upload.

alter table public.photos
  add column if not exists exif_last_used_at timestamptz,
  add column if not exists exif_make text,
  add column if not exists exif_model text,
  add column if not exists exif_color_space text,
  add column if not exists exif_color_profile text,
  add column if not exists exif_focal_length_mm numeric,
  add column if not exists exif_alpha_channel boolean,
  add column if not exists exif_red_eye boolean,
  add column if not exists exif_metering_mode text,
  add column if not exists exif_f_number numeric,
  add column if not exists exif_exposure_program text,
  add column if not exists exif_exposure_time text;
