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
