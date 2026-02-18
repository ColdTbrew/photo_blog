-- Phase 1: photo metadata migration from local JSON to Supabase.

create table if not exists public.photos (
  id text primary key,
  slug text not null unique,
  src text not null,
  storage_path text,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  title text not null,
  caption text not null,
  tags text[] not null default '{}',
  taken_at date not null,
  created_at timestamptz not null,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photos_created_at_desc_idx
  on public.photos (created_at desc);

create index if not exists photos_slug_idx
  on public.photos (slug);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists photos_set_updated_at on public.photos;
create trigger photos_set_updated_at
before update on public.photos
for each row
execute function public.set_updated_at();

alter table public.photos enable row level security;

drop policy if exists "Public can read photos" on public.photos;
create policy "Public can read photos"
on public.photos
for select
to public
using (true);

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can read photos bucket objects" on storage.objects;
create policy "Public can read photos bucket objects"
on storage.objects
for select
to public
using (bucket_id = 'photos');
