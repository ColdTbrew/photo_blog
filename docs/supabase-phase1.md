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
node scripts/supabase/import-photos.mjs
```

The script reads:

- `/Users/coldbrew/Documents/photo_blog/photo_blog/data/photos.json`

Then upserts into:

- `public.photos`

## 4) Verify

Quick checks in SQL editor:

```sql
select count(*) from public.photos;
select slug, created_at from public.photos order by created_at desc limit 5;
```

## 5) Storage Upload (manual in Phase 1)

Upload all files from:

- `/Users/coldbrew/Documents/photo_blog/photo_blog/public/photos`

To bucket:

- `photos`

Object path recommendation:

- Keep only filename (for example `IMG_7804.JPG`)

`storage_path` is prefilled from existing `src` (`/photos/<file>`) so later URL conversion is straightforward.
