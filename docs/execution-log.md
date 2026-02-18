# Execution Log

## 2026-02-18 - Supabase Migration Kickoff (Phase 1)

- Goal: Start Supabase migration and enforce a reusable study log process in-repo.
- Steps taken:
  - Added project rule file at `/Users/coldbrew/Documents/photo_blog/photo_blog/AGENTS.md`.
  - Created this log file and logging format.
  - Audited current data source: `/Users/coldbrew/Documents/photo_blog/photo_blog/data/photos.json` and `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts`.
  - Added initial Supabase schema SQL and JSON import script scaffold.
- Troubleshooting:
  - Issue: No existing repo-level rule file for execution logging.
  - Cause: Project started without agent/runbook constraints.
  - Fix: Added explicit mandatory log-update rule in `AGENTS.md`.
- Tech stack/tools used:
  - Next.js App Router (existing)
  - Supabase Postgres + Storage (new plan)
  - Node.js script runtime (`.mjs`)
  - Shell tools: `rg`, `cat`, `ls`
- Usage notes/commands:
  - Inspect source model: `cat data/photos.json`
  - Run migration SQL in Supabase SQL editor: `supabase/migrations/0001_create_photos.sql`
  - Run import script: `node scripts/supabase/import-photos.mjs`
- Next action:
  - Connect env vars, execute SQL, import records, upload image files to `photos` bucket, then switch read queries to Supabase in app code.

## 2026-02-18 - Phase 1 Artifacts Added

- Goal: Make Supabase migration executable and documentable from this repository.
- Steps taken:
  - Added migration SQL: `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0001_create_photos.sql`
  - Added import script: `/Users/coldbrew/Documents/photo_blog/photo_blog/scripts/supabase/import-photos.mjs`
  - Added env template: `/Users/coldbrew/Documents/photo_blog/photo_blog/.env.example`
  - Added docs: `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md`
  - Updated `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md` with rule and Phase 1 runbook
  - Added npm command: `supabase:import:photos`
  - Installed dependency: `@supabase/supabase-js`
  - Verified repository lint passes.
- Troubleshooting:
  - Issue: Initial environment template was missing.
  - Cause: Project started as local-file gallery MVP without secret-based services.
  - Fix: Added `.env.example` and script-side validation for missing vars.
- Tech stack/tools used:
  - Supabase Postgres + Storage
  - Node.js + `@supabase/supabase-js`
  - SQL migration + RLS policy
  - ESLint for verification
- Usage notes/commands:
  - Install deps: `npm install`
  - Import JSON to DB: `npm run supabase:import:photos`
  - Validate lint: `npm run lint`
- Next action:
  - Execute SQL in Supabase, upload storage objects, then switch `src/lib/photos.ts` read path from file to Supabase queries.

## 2026-02-18 - Supabase Skill Install + Key Refresh Guide

- Goal: Install Supabase skill package and clarify where to fetch current API keys.
- Steps taken:
  - Ran `npx skills add supabase/agent-skills` (interactive output observed).
  - Re-ran non-interactive install for Codex: `npx skills add supabase/agent-skills -y -a codex`.
  - Confirmed installation path: `/Users/coldbrew/Documents/photo_blog/photo_blog/.agents/skills/supabase-postgres-best-practices`.
  - Verified current Supabase docs guidance on key transition (`anon/service_role` and new `publishable`).
- Troubleshooting:
  - Issue: First install attempt showed interactive selector, ambiguous completion.
  - Cause: command executed without explicit non-interactive flags.
  - Fix: re-run with `-y -a codex`.
- Tech stack/tools used:
  - `skills` CLI
  - Supabase Dashboard API Keys settings
  - Supabase Docs references
- Usage notes/commands:
  - Install: `npx skills add supabase/agent-skills -y -a codex`
  - Local env file: `/Users/coldbrew/Documents/photo_blog/photo_blog/.env.local`
- Next action:
  - Copy fresh Project URL + Publishable key + Service role key from Supabase dashboard and rerun import.

## 2026-02-18 - Import Attempt After Key Update

- Goal: Verify Supabase connection and run metadata import.
- Steps taken:
  - Loaded env from `.env.local` and executed `npm run supabase:import:photos`.
- Troubleshooting:
  - Issue: `Could not find the table 'public.photos' in the schema cache`.
  - Cause: SQL migration not yet applied in Supabase project.
  - Fix: run `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0001_create_photos.sql` in Supabase SQL Editor, then rerun import.
- Tech stack/tools used:
  - Supabase REST via `@supabase/supabase-js`
  - Node script (`import-photos.mjs`)
- Usage notes/commands:
  - `set -a; source .env.local; set +a; npm run supabase:import:photos`
- Next action:
  - Apply SQL migration and retry import.

## 2026-02-18 - Import UX Improvement

- Goal: Make import command easier and clearer.
- Steps taken:
  - Updated npm script to auto-load `.env.local` using `node --env-file=.env.local`.
  - Improved import error handling for missing `public.photos` table with actionable message.
  - Re-ran import to confirm failure message is explicit.
- Troubleshooting:
  - Issue: user had to manually source env before running command.
  - Cause: Node process did not auto-load local env file.
  - Fix: changed npm script to pass `--env-file=.env.local`.
- Tech stack/tools used:
  - Node.js runtime flags
  - Supabase JS client
- Usage notes/commands:
  - `npm run supabase:import:photos`
- Next action:
  - Execute migration SQL in Supabase dashboard, then rerun import.

## 2026-02-18 - Supabase Read Path Switchover

- Goal: Switch app read path from local JSON to Supabase while keeping safe fallback behavior.
- Steps taken:
  - Confirmed import success: `Imported 12 records into public.photos`.
  - Updated `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts` to:
    - read from `public.photos` via Supabase client using publishable key
    - preserve existing pagination behavior in app layer
    - fallback to local `data/photos.json` if Supabase read fails or env is missing
  - Updated `/Users/coldbrew/Documents/photo_blog/photo_blog/next.config.ts` to allow Supabase storage remote image pattern.
  - Ran lint: pass.
- Troubleshooting:
  - Issue: initial import failed due to missing table.
  - Cause: migration SQL had not been executed yet.
  - Fix: SQL executed in dashboard, then import succeeded.
- Tech stack/tools used:
  - Next.js App Router
  - Supabase JS client
  - Supabase Postgres
  - ESLint
- Usage notes/commands:
  - `npm run supabase:import:photos`
  - `npm run lint`
- Next action:
  - Upload originals to Supabase Storage `photos` bucket and (optional) switch `src` to storage public URLs in DB or read-time mapping.

## 2026-02-18 - JSON Source Removal + Commit Prep

- Goal: Remove local JSON dependency and make Supabase the single source of truth.
- Steps taken:
  - Deleted `/Users/coldbrew/Documents/photo_blog/photo_blog/data/photos.json`.
  - Updated `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts` to use Supabase-only reads (no JSON fallback).
  - Updated `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md` photo add flow for Supabase.
  - Added `.agents/` to git ignore.
  - Verified lint passes.
- Troubleshooting:
  - Troubleshooting: none.
- Tech stack/tools used:
  - Next.js, TypeScript, Supabase JS client, ESLint
- Usage notes/commands:
  - `npm run lint`
- Next action:
  - Create commit, then upload files to Supabase Storage and update DB `src` to public URLs.

## 2026-02-18 - Storage Sync + Public URL Cutover

- Goal: Finish remaining migration work by uploading images to Supabase Storage and switching DB image URLs.
- Steps taken:
  - Added `/Users/coldbrew/Documents/photo_blog/photo_blog/scripts/supabase/sync-storage.mjs`.
  - Added npm script `supabase:sync:storage` in `/Users/coldbrew/Documents/photo_blog/photo_blog/package.json`.
  - Ran `npm run supabase:sync:storage`.
  - Verified DB rows now contain Supabase public URL in `src`.
  - Updated docs in `README.md` and `docs/supabase-phase1.md` to reflect JSON removal and new sync command.
- Troubleshooting:
  - Issue: first sync attempt failed on `DSC00636.heif` upload.
  - Cause: script uploaded every local file, including files not referenced by DB.
  - Fix: changed script to upload only filenames listed in `public.photos.storage_path`.
- Tech stack/tools used:
  - Supabase Storage API
  - Supabase Postgres update API
  - Node.js scripts
- Usage notes/commands:
  - `npm run supabase:sync:storage`
  - `node --env-file=.env.local -e "...select slug,src from photos..."` (verification)
- Next action:
  - Run `npm run dev` and verify feed/detail images render from Supabase URLs in browser.

## 2026-02-18 - Branding Update (Lightlog by Coldbrew)

- Goal: Apply chosen brand naming across visible UI and metadata.
- Steps taken:
  - Updated global metadata title/description in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/layout.tsx`.
  - Updated home header branding in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/page.tsx`.
  - Updated photo detail page metadata suffix in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/photo/[slug]/page.tsx`.
  - Ran lint check.
- Troubleshooting:
  - Troubleshooting: none.
- Tech stack/tools used:
  - Next.js App Router metadata
  - TypeScript
  - ESLint
- Usage notes/commands:
  - `npm run lint`
- Next action:
  - Add custom domain/OG image and finalize production brand assets.

## 2026-02-18 - Admin Upload MVP Added

- Goal: Add admin upload page to create photos without manual SQL/script steps.
- Steps taken:
  - Added API route `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts`.
  - Added admin UI page `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx`.
  - Added cache invalidation helper in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts`.
  - Added `ADMIN_UPLOAD_TOKEN` env template in `/Users/coldbrew/Documents/photo_blog/photo_blog/.env.example`.
  - Updated admin usage docs in `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`.
- Troubleshooting:
  - Troubleshooting: none.
- Tech stack/tools used:
  - Next.js App Router API Routes + Client Page
  - Supabase Storage + Postgres insert (service role key)
  - Token-based endpoint protection
- Usage notes/commands:
  - Open `/admin/upload`
  - Input `ADMIN_UPLOAD_TOKEN`
  - Fill metadata + select image + upload
- Next action:
  - Replace token form with Supabase Auth session-based admin guard.

## 2026-02-18 21:56 KST - EXIF Fields Documentation (No Implementation)

- Goal: Record available EXIF metadata fields for future planning without implementing any feature changes.
- Steps taken:
  - Updated `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md`.
  - Added a dedicated section listing EXIF fields observed from sample image metadata.
  - Explicitly documented that parsing/storage/display is not implemented yet.
- Troubleshooting:
  - Troubleshooting: none.
- Tech stack/tools used:
  - Markdown documentation
  - Shell command: `date` (timestamp confirmation)
- Usage notes/commands:
  - Reference doc: `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md`
- Next action:
  - If needed, define DB/app requirements for selected EXIF fields in a separate implementation phase.

## 2026-02-18 - Vercel Env Sync for Admin Upload Token

- Goal: Add ADMIN_UPLOAD_TOKEN to Vercel project environments.
- Steps taken:
  - Checked Vercel project link from `.vercel/project.json`.
  - Verified Vercel login via `npx vercel whoami`.
  - Added `ADMIN_UPLOAD_TOKEN` from local `.env.local` to Development, Preview, Production.
  - Verified with `npx vercel env ls`.
- Troubleshooting:
  - Issue: `vercel` command not found.
  - Cause: Vercel CLI not installed globally in current shell.
  - Fix: used `npx vercel ...` commands.
- Tech stack/tools used:
  - Vercel CLI (`npx vercel`)
- Usage notes/commands:
  - `npx vercel env add ADMIN_UPLOAD_TOKEN development|preview|production`
  - `npx vercel env ls`
- Next action:
  - Redeploy and validate `/admin/upload` in production.

## 2026-02-18 - Vercel CLI Usage Documentation

- Goal: Document repeatable Vercel CLI usage in project docs.
- Steps taken:
  - Added `Vercel CLI Usage` section in `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`.
  - Included login check, env list, env add, and production deploy commands.
- Troubleshooting:
  - Troubleshooting: none.
- Tech stack/tools used:
  - Vercel CLI (`npx vercel`)
- Usage notes/commands:
  - `npx vercel whoami`
  - `npx vercel env ls`
  - `npx vercel env add ...`
  - `npx vercel --prod`
- Next action:
  - Commit docs update.

## 2026-02-18 - Local Upload Not Visible (Cache Issue)

- Goal: Fix newly uploaded image not appearing immediately on localhost.
- Steps taken:
  - Removed long-lived in-memory photo cache in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts`.
  - Kept `invalidatePhotosCache` as compatibility no-op.
  - Verified lint passes.
- Troubleshooting:
  - Issue: newly uploaded item (`sushi`) was in DB/Storage but not visible in feed.
  - Cause: module-level cache prevented fresh Supabase reads.
  - Fix: always fetch from Supabase per request (cache removed).
- Tech stack/tools used:
  - Next.js server module behavior
  - Supabase read path
  - ESLint
- Usage notes/commands:
  - `npm run lint`
- Next action:
  - hard refresh localhost and verify new uploads appear immediately.

## 2026-02-18 22:14 KST - EXIF Auto-fill + Editable Upload Metadata

- Goal: Save EXIF metadata automatically during admin upload while allowing full manual edits for missing EXIF cases (for example film camera scans).
- Steps taken:
  - Added DB migration `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0002_add_photo_exif_columns.sql`.
  - Extended upload API `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts` to accept optional EXIF form fields and persist nullable values.
  - Extended admin upload UI `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx` with EXIF form section.
  - Added EXIF auto extraction from selected file using `exifr`, with editable inputs for all EXIF fields.
  - Added dependency `exifr` to project dependencies.
  - Updated runbook/docs in `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md` and `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`.
- Troubleshooting:
  - Troubleshooting: none.
- Tech stack/tools used:
  - Next.js App Router (client page + route handler)
  - Supabase Postgres
  - `exifr` (browser-side EXIF parsing)
  - ESLint
- Usage notes/commands:
  - Apply SQL: `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0002_add_photo_exif_columns.sql`
  - Run lint: `npm run lint`
  - Upload UI: `/admin/upload`
- Next action:
  - Apply migration `0002` in Supabase SQL Editor, then verify EXIF fields are inserted/nullable as expected on new uploads.

## 2026-02-18 22:20 KST - Vercel Admin Token Mismatch Fix

- Goal: Resolve `Unauthorized` on production admin upload despite local token input.
- Steps taken:
  - Verified Vercel env entries existed for `ADMIN_UPLOAD_TOKEN`.
  - Reproduced mismatch with protected API check via `vercel curl` and confirmed `Unauthorized` when posting local token.
  - Re-synced `ADMIN_UPLOAD_TOKEN` in Vercel Development/Preview/Production from local `.env.local`.
  - Triggered new production deployment and confirmed alias moved to `https://photoblog-two.vercel.app`.
  - Re-tested API with local token and confirmed response changed to `file is required` (token accepted).
- Troubleshooting:
  - Issue: production `/api/admin/photos` returned `Unauthorized`.
  - Cause: deployed `ADMIN_UPLOAD_TOKEN` value did not match local `.env.local` token.
  - Fix: replaced Vercel env token values and redeployed production.
- Tech stack/tools used:
  - Vercel CLI (`npx vercel env`, `npx vercel --prod`, `npx vercel curl`)
  - Next.js API route auth check (`ADMIN_UPLOAD_TOKEN`)
- Usage notes/commands:
  - `npx vercel env rm ADMIN_UPLOAD_TOKEN <environment> -y`
  - `printf '%s' \"$ADMIN_UPLOAD_TOKEN\" | npx vercel env add ADMIN_UPLOAD_TOKEN <environment>`
  - `npx vercel --prod --yes`
  - `npx vercel curl /api/admin/photos --deployment https://photoblog-two.vercel.app -- --request POST --form \"token=...\"`
- Next action:
  - Retry upload in browser on latest production deployment and confirm record insert succeeds.

## 2026-02-18 22:49 KST - Home Intro Copy Update

- Goal: Update home intro sentence to the new Korean copy requested by user.
- Steps taken:
  - Changed intro text in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/page.tsx`.
  - Replaced sentence with: `사진들로 기억을 남긴 갤러리입니다.`
- Troubleshooting:
  - Troubleshooting: none.
- Tech stack/tools used:
  - Next.js App Router
  - TypeScript/TSX text update
- Usage notes/commands:
  - Verify locally: `npm run dev` then open `/`
- Next action:
  - Commit and push copy update to trigger Vercel auto deployment.

## 2026-02-18 - Production Deploy via Vercel CLI

- Goal: Deploy latest commit to production.
- Steps taken:
  - Ran `npx vercel --prod --yes`.
  - First deploy failed during Next.js prerender due to missing Supabase public env vars in Vercel production.
  - Added production env vars:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
  - Re-ran `npx vercel --prod --yes`.
  - Deployment succeeded and alias connected.
- Troubleshooting:
  - Issue: build error on `/` with message about missing Supabase read env vars.
  - Cause: Vercel production had only `ADMIN_UPLOAD_TOKEN` configured.
  - Fix: synced missing Supabase env vars to production and redeployed.
- Tech stack/tools used:
  - Vercel CLI (`npx vercel`)
  - Next.js build logs
- Usage notes/commands:
  - `npx vercel env add <NAME> production`
  - `npx vercel --prod --yes`
- Next action:
  - Verify production feed/admin upload behavior at the aliased domain.

## 2026-02-18 - EXIF Change Verification + Production Redeploy

- Goal: Review EXIF-related changes and redeploy production.
- Steps taken:
  - Scanned repository for EXIF changes (admin UI/API, docs, migration `0002`).
  - Verified local build and lint pass.
  - Checked Supabase schema compatibility by selecting EXIF columns.
  - Redeployed production using `npx vercel --prod --yes` and confirmed alias update.
- Troubleshooting:
  - Issue: DB query returned `column photos.exif_make does not exist`.
  - Cause: migration `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0002_add_photo_exif_columns.sql` not applied yet.
  - Fix: pending manual SQL apply in Supabase SQL Editor.
- Tech stack/tools used:
  - Vercel CLI
  - Supabase JS client schema check
  - Next.js build pipeline
- Usage notes/commands:
  - `npm run lint`
  - `npm run build`
  - `npx vercel --prod --yes`
- Next action:
  - Apply migration `0002_add_photo_exif_columns.sql` in Supabase, then test admin upload EXIF save.

## 2026-02-18 - Supabase CLI Migration Apply (0002)

- Goal: Apply EXIF schema migration via Supabase CLI.
- Steps taken:
  - Logged in with `npx supabase login` (user completed auth).
  - Linked project: `npx supabase link --project-ref czecclgcdhfgqzqsdbgj`.
  - Applied migrations: `npx supabase db push`.
  - Re-verified EXIF columns by selecting `exif_make`, `exif_model`, `exif_f_number` via Supabase JS.
- Troubleshooting:
  - Issue: initial EXIF column check still failed.
  - Cause: check command ran in parallel with migration apply.
  - Fix: reran check sequentially after push completion.
- Tech stack/tools used:
  - Supabase CLI (`npx supabase`)
  - Supabase JS verification query
- Usage notes/commands:
  - `npx supabase link --project-ref czecclgcdhfgqzqsdbgj`
  - `npx supabase db push`
- Next action:
  - Test `/admin/upload` with EXIF-populated image and verify saved EXIF values in DB.

## 2026-02-18 - Admin Upload UX Fix (Slug + TakenAt Optional)

- Goal: Fix admin upload usability issues (slug input friction, takenAt required friction).
- Steps taken:
  - Updated `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx`:
    - slug field no longer required
    - slug is sanitized on blur/submit instead of every keystroke
    - takenAt is auto-filled from EXIF date when available
    - added `Taken At 없음 (none)` checkbox
  - Updated `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts`:
    - slug auto-generation when empty
    - `takenAt` optional parsing (`none` or empty -> null)
    - required fields reduced to title/caption
  - Added DB migration `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0003_make_taken_at_nullable.sql`.
  - Applied migration with `npx supabase db push`.
  - Updated photo type to allow nullable takenAt and fallback rendering in detail view.
  - Redeployed production with `npx vercel --prod --yes`.
- Troubleshooting:
  - Issue: `taken_at` previously required by schema.
  - Cause: `public.photos.taken_at` had `NOT NULL` constraint from initial schema.
  - Fix: migration 0003 dropped not-null constraint.
- Tech stack/tools used:
  - Next.js App Router
  - Supabase Postgres + CLI
  - Vercel CLI
- Usage notes/commands:
  - `npx supabase db push`
  - `npx vercel --prod --yes`
- Next action:
  - Validate `/admin/upload` with both cases: EXIF date present and `Taken At 없음` checked.
