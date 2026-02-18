-- Allow unknown capture date on admin uploads.

alter table public.photos
  alter column taken_at drop not null;
