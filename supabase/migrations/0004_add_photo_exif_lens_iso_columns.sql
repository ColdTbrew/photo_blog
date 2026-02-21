-- Add additional EXIF metadata fields used in photo detail display.

alter table public.photos
  add column if not exists exif_lens_model text,
  add column if not exists exif_iso numeric;
