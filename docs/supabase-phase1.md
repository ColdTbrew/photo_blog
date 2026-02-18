# Supabase Phase 1 (Schema + Import)

## 1) Environment Variables

Set these in Vercel and local `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional compatibility alias for scripts:

- `SUPABASE_URL` (if not set, script falls back to `NEXT_PUBLIC_SUPABASE_URL`)

## 2) Create DB/Storage

Run SQL in Supabase SQL Editor:

- `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0001_create_photos.sql`

This creates:

- `public.photos` table
- indexes (`slug`, `created_at`)
- RLS + public read policy
- storage bucket `photos` (public)
- storage object read policy for `photos` bucket

## 3) Import Existing Metadata

From project root:

```bash
npm run supabase:import:photos
```

The script reads `data/photos.json` and upserts into `public.photos`.

If your JSON source is already removed, skip this step.

## 4) Verify

Quick checks in SQL editor:

```sql
select count(*) from public.photos;
select slug, created_at from public.photos order by created_at desc limit 5;
```

## 5) Storage Upload + URL Sync

Run:

```bash
npm run supabase:sync:storage
```

This command:

- uploads files referenced by `public.photos.storage_path` to `photos` bucket
- rewrites `public.photos.src` to Supabase public URL

## 6) EXIF Metadata Reference (Documented Only, Not Implemented)

The following EXIF fields are noted as available from source images and can be considered in a future phase.
This repository currently does not parse/store/display them in app logic.

- last_used_at (example: `2026-02-18 21:55`)
- resolution (example: `7728x5152`)
- make (example: `FUJIFILM`)
- model (example: `X-E5`)
- color_space (example: `RGB`)
- color_profile (example: `sRGB IEC61966-2.1`)
- focal_length_mm (example: `23`)
- alpha_channel (example: `false`)
- red_eye (example: `false`)
- metering_mode (example: `pattern`)
- f_number (example: `f/2.8`)
- exposure_program (example: `aperture priority`)
- exposure_time (example: `1/140`)
