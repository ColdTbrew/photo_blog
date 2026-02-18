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
