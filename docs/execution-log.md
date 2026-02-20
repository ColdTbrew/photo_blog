# Execution Log

## 2026-02-18 - Supabase Migration Kickoff (Phase 1)

- 목표: 시작 Supabase migration and enforce a reusable study log process in-repo.
- 수행 단계:
  - Added project rule file at `/Users/coldbrew/Documents/photo_blog/photo_blog/AGENTS.md`.
  - Created this log file and logging format.
  - Audited current data source: `/Users/coldbrew/Documents/photo_blog/photo_blog/data/photos.json` and `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts`.
  - Added initial Supabase schema SQL and JSON import script scaffold.
- 트러블슈팅:
  - 이슈: No existing repo-level rule file for execution logging.
  - 원인: Project started without agent/runbook constraints.
  - 조치: Added explicit mandatory log-update rule in `AGENTS.md`.
- 사용 기술/도구:
  - Next.js App Router (existing)
  - Supabase Postgres + Storage (new plan)
  - Node.js script runtime (`.mjs`)
  - Shell tools: `rg`, `cat`, `ls`
- 사용 메모/명령어:
  - Inspect source model: `cat data/photos.json`
  - 실행 migration SQL in Supabase SQL editor: `supabase/migrations/0001_create_photos.sql`
  - 실행 import script: `node scripts/supabase/import-photos.mjs`
- 다음 액션:
  - Connect env vars, execute SQL, import records, upload image files to `photos` bucket, then switch read queries to Supabase in app code.

## 2026-02-18 - Phase 1 Artifacts Added

- 목표: Make Supabase migration executable and documentable from this repository.
- 수행 단계:
  - Added migration SQL: `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0001_create_photos.sql`
  - Added import script: `/Users/coldbrew/Documents/photo_blog/photo_blog/scripts/supabase/import-photos.mjs`
  - Added env template: `/Users/coldbrew/Documents/photo_blog/photo_blog/.env.example`
  - Added docs: `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md`
  - 수정: `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md` with rule and Phase 1 runbook
  - Added npm command: `supabase:import:photos`
  - Installed dependency: `@supabase/supabase-js`
  - 검증: repository lint passes.
- 트러블슈팅:
  - 이슈: Initial environment template was missing.
  - 원인: Project started as local-file gallery MVP without secret-based services.
  - 조치: 추가: `.env.example` and script-side validation for missing vars.
- 사용 기술/도구:
  - Supabase Postgres + Storage
  - Node.js + `@supabase/supabase-js`
  - SQL migration + RLS policy
  - ESLint for verification
- 사용 메모/명령어:
  - Install deps: `npm install`
  - Import JSON to DB: `npm run supabase:import:photos`
  - Validate lint: `npm run lint`
- 다음 액션:
  - Execute SQL in Supabase, upload storage objects, then switch `src/lib/photos.ts` read path from file to Supabase queries.

## 2026-02-18 - Supabase Skill Install + Key Refresh Guide

- 목표: Install Supabase skill package and clarify where to fetch current API keys.
- 수행 단계:
  - 실행: `npx skills add supabase/agent-skills` (interactive output observed).
  - Re-ran non-interactive install for Codex: `npx skills add supabase/agent-skills -y -a codex`.
  - Confirmed installation path: `/Users/coldbrew/Documents/photo_blog/photo_blog/.agents/skills/supabase-postgres-best-practices`.
  - 검증: current Supabase docs guidance on key transition (`anon/service_role` and new `publishable`).
- 트러블슈팅:
  - 이슈: First install attempt showed interactive selector, ambiguous completion.
  - 원인: command executed without explicit non-interactive flags.
  - 조치: re-run with `-y -a codex`.
- 사용 기술/도구:
  - `skills` CLI
  - Supabase Dashboard API Keys settings
  - Supabase Docs references
- 사용 메모/명령어:
  - Install: `npx skills add supabase/agent-skills -y -a codex`
  - Local env file: `/Users/coldbrew/Documents/photo_blog/photo_blog/.env.local`
- 다음 액션:
  - Copy fresh Project URL + Publishable key + Service role key from Supabase dashboard and rerun import.

## 2026-02-18 - Import Attempt After Key Update

- 목표: Verify Supabase connection and run metadata import.
- 수행 단계:
  - Loaded env from `.env.local` and executed `npm run supabase:import:photos`.
- 트러블슈팅:
  - 이슈: `Could not find the table 'public.photos' in the schema cache`.
  - 원인: SQL migration not yet applied in Supabase project.
  - 조치: run `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0001_create_photos.sql` in Supabase SQL Editor, then rerun import.
- 사용 기술/도구:
  - Supabase REST via `@supabase/supabase-js`
  - Node script (`import-photos.mjs`)
- 사용 메모/명령어:
  - `set -a; source .env.local; set +a; npm run supabase:import:photos`
- 다음 액션:
  - 적용 SQL migration and retry import.

## 2026-02-18 - Import UX Improvement

- 목표: Make import command easier and clearer.
- 수행 단계:
  - Updated npm script to auto-load `.env.local` using `node --env-file=.env.local`.
  - Improved import error handling for missing `public.photos` table with actionable message.
  - Re-ran import to confirm failure message is explicit.
- 트러블슈팅:
  - 이슈: user had to manually source env before running command.
  - 원인: Node process did not auto-load local env file.
  - 조치: changed npm script to pass `--env-file=.env.local`.
- 사용 기술/도구:
  - Node.js runtime flags
  - Supabase JS client
- 사용 메모/명령어:
  - `npm run supabase:import:photos`
- 다음 액션:
  - Execute migration SQL in Supabase dashboard, then rerun import.

## 2026-02-18 - Supabase Read Path Switchover

- 목표: Switch app read path from local JSON to Supabase while keeping safe fallback behavior.
- 수행 단계:
  - Confirmed import success: `Imported 12 records into public.photos`.
  - 수정: `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts` to:
    - read from `public.photos` via Supabase client using publishable key
    - preserve existing pagination behavior in app layer
    - fallback to local `data/photos.json` if Supabase read fails or env is missing
  - 수정: `/Users/coldbrew/Documents/photo_blog/photo_blog/next.config.ts` to allow Supabase storage remote image pattern.
  - Ran lint: pass.
- 트러블슈팅:
  - 이슈: initial import failed due to missing table.
  - 원인: migration SQL had not been executed yet.
  - 조치: SQL executed in dashboard, then import succeeded.
- 사용 기술/도구:
  - Next.js App Router
  - Supabase JS client
  - Supabase Postgres
  - ESLint
- 사용 메모/명령어:
  - `npm run supabase:import:photos`
  - `npm run lint`
- 다음 액션:
  - Upload originals to Supabase Storage `photos` bucket and (optional) switch `src` to storage public URLs in DB or read-time mapping.

## 2026-02-18 - JSON Source Removal + Commit Prep

- 목표: Remove local JSON dependency and make Supabase the single source of truth.
- 수행 단계:
  - Deleted `/Users/coldbrew/Documents/photo_blog/photo_blog/data/photos.json`.
  - 수정: `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts` to use Supabase-only reads (no JSON fallback).
  - 수정: `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md` photo add flow for Supabase.
  - 추가: `.agents/` to git ignore.
  - 검증: lint passes.
- 트러블슈팅:
  - 트러블슈팅: 없음.
- 사용 기술/도구:
  - Next.js, TypeScript, Supabase JS client, ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - Create commit, then upload files to Supabase Storage and update DB `src` to public URLs.

## 2026-02-18 - Storage Sync + Public URL Cutover

- 목표: Finish remaining migration work by uploading images to Supabase Storage and switching DB image URLs.
- 수행 단계:
  - 추가: `/Users/coldbrew/Documents/photo_blog/photo_blog/scripts/supabase/sync-storage.mjs`.
  - Added npm script `supabase:sync:storage` in `/Users/coldbrew/Documents/photo_blog/photo_blog/package.json`.
  - 실행: `npm run supabase:sync:storage`.
  - 검증: DB rows now contain Supabase public URL in `src`.
  - Updated docs in `README.md` and `docs/supabase-phase1.md` to reflect JSON removal and new sync command.
- 트러블슈팅:
  - 이슈: first sync attempt failed on `DSC00636.heif` upload.
  - 원인: script uploaded every local file, including files not referenced by DB.
  - 조치: changed script to upload only filenames listed in `public.photos.storage_path`.
- 사용 기술/도구:
  - Supabase Storage API
  - Supabase Postgres update API
  - Node.js scripts
- 사용 메모/명령어:
  - `npm run supabase:sync:storage`
  - `node --env-file=.env.local -e "...select slug,src from photos..."` (verification)
- 다음 액션:
  - 실행 `npm run dev` and verify feed/detail images render from Supabase URLs in browser.

## 2026-02-18 - Branding Update (Lightlog by Coldbrew)

- 목표: 적용 chosen brand naming across visible UI and metadata.
- 수행 단계:
  - Updated global metadata title/description in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/layout.tsx`.
  - Updated home header branding in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/page.tsx`.
  - Updated photo detail page metadata suffix in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/photo/[slug]/page.tsx`.
  - Ran lint check.
- 트러블슈팅:
  - 트러블슈팅: 없음.
- 사용 기술/도구:
  - Next.js App Router metadata
  - TypeScript
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - Add custom domain/OG image and finalize production brand assets.

## 2026-02-18 - Admin Upload MVP Added

- 목표: Add admin upload page to create photos without manual SQL/script steps.
- 수행 단계:
  - Added API route `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts`.
  - Added admin UI page `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx`.
  - Added cache invalidation helper in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts`.
  - 추가: `ADMIN_UPLOAD_TOKEN` env template in `/Users/coldbrew/Documents/photo_blog/photo_blog/.env.example`.
  - Updated admin usage docs in `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`.
- 트러블슈팅:
  - 트러블슈팅: 없음.
- 사용 기술/도구:
  - Next.js App Router API Routes + Client Page
  - Supabase Storage + Postgres insert (service role key)
  - Token-based endpoint protection
- 사용 메모/명령어:
  - Open `/admin/upload`
  - Input `ADMIN_UPLOAD_TOKEN`
  - Fill metadata + select image + upload
- 다음 액션:
  - Replace token form with Supabase Auth session-based admin guard.

## 2026-02-18 21:56 KST - EXIF Fields Documentation (No Implementation)

- 목표: Record available EXIF metadata fields for future planning without implementing any feature changes.
- 수행 단계:
  - 수정: `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md`.
  - Added a dedicated section listing EXIF fields observed from sample image metadata.
  - Explicitly documented that parsing/storage/display is not implemented yet.
- 트러블슈팅:
  - 트러블슈팅: 없음.
- 사용 기술/도구:
  - Markdown documentation
  - Shell command: `date` (timestamp confirmation)
- 사용 메모/명령어:
  - Reference doc: `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md`
- 다음 액션:
  - If needed, define DB/app requirements for selected EXIF fields in a separate implementation phase.

## 2026-02-18 - Vercel Env Sync for Admin Upload Token

- 목표: Add ADMIN_UPLOAD_TOKEN to Vercel project environments.
- 수행 단계:
  - Checked Vercel project link from `.vercel/project.json`.
  - 검증: Vercel login via `npx vercel whoami`.
  - 추가: `ADMIN_UPLOAD_TOKEN` from local `.env.local` to Development, Preview, Production.
  - 검증: with `npx vercel env ls`.
- 트러블슈팅:
  - 이슈: `vercel` command not found.
  - 원인: Vercel CLI not installed globally in current shell.
  - 조치: used `npx vercel ...` commands.
- 사용 기술/도구:
  - Vercel CLI (`npx vercel`)
- 사용 메모/명령어:
  - `npx vercel env add ADMIN_UPLOAD_TOKEN development|preview|production`
  - `npx vercel env ls`
- 다음 액션:
  - Redeploy and validate `/admin/upload` in production.

## 2026-02-18 - Vercel CLI Usage Documentation

- 목표: Document repeatable Vercel CLI usage in project docs.
- 수행 단계:
  - 추가: `Vercel CLI Usage` section in `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`.
  - Included login check, env list, env add, and production deploy commands.
- 트러블슈팅:
  - 트러블슈팅: 없음.
- 사용 기술/도구:
  - Vercel CLI (`npx vercel`)
- 사용 메모/명령어:
  - `npx vercel whoami`
  - `npx vercel env ls`
  - `npx vercel env add ...`
  - `npx vercel --prod`
- 다음 액션:
  - Commit docs update.

## 2026-02-18 - Local Upload Not Visible (Cache Issue)

- 목표: Fix newly uploaded image not appearing immediately on localhost.
- 수행 단계:
  - Removed long-lived in-memory photo cache in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/photos.ts`.
  - Kept `invalidatePhotosCache` as compatibility no-op.
  - 검증: lint passes.
- 트러블슈팅:
  - 이슈: newly uploaded item (`sushi`) was in DB/Storage but not visible in feed.
  - 원인: module-level cache prevented fresh Supabase reads.
  - 조치: always fetch from Supabase per request (cache removed).
- 사용 기술/도구:
  - Next.js server module behavior
  - Supabase read path
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - hard refresh localhost and verify new uploads appear immediately.

## 2026-02-18 22:14 KST - EXIF Auto-fill + Editable Upload Metadata

- 목표: Save EXIF metadata automatically during admin upload while allowing full manual edits for missing EXIF cases (for example film camera scans).
- 수행 단계:
  - Added DB migration `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0002_add_photo_exif_columns.sql`.
  - Extended upload API `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts` to accept optional EXIF form fields and persist nullable values.
  - Extended admin upload UI `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx` with EXIF form section.
  - Added EXIF auto extraction from selected file using `exifr`, with editable inputs for all EXIF fields.
  - Added dependency `exifr` to project dependencies.
  - Updated runbook/docs in `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md` and `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`.
- 트러블슈팅:
  - 트러블슈팅: 없음.
- 사용 기술/도구:
  - Next.js App Router (client page + route handler)
  - Supabase Postgres
  - `exifr` (browser-side EXIF parsing)
  - ESLint
- 사용 메모/명령어:
  - 적용 SQL: `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0002_add_photo_exif_columns.sql`
  - 실행 lint: `npm run lint`
  - Upload UI: `/admin/upload`
- 다음 액션:
  - 적용 migration `0002` in Supabase SQL Editor, then verify EXIF fields are inserted/nullable as expected on new uploads.

## 2026-02-18 22:20 KST - Vercel Admin Token Mismatch Fix

- 목표: Resolve `Unauthorized` on production admin upload despite local token input.
- 수행 단계:
  - 검증: Vercel env entries existed for `ADMIN_UPLOAD_TOKEN`.
  - Reproduced mismatch with protected API check via `vercel curl` and confirmed `Unauthorized` when posting local token.
  - Re-synced `ADMIN_UPLOAD_TOKEN` in Vercel Development/Preview/Production from local `.env.local`.
  - Triggered new production deployment and confirmed alias moved to `https://photoblog-two.vercel.app`.
  - Re-tested API with local token and confirmed response changed to `file is required` (token accepted).
- 트러블슈팅:
  - 이슈: production `/api/admin/photos` returned `Unauthorized`.
  - 원인: deployed `ADMIN_UPLOAD_TOKEN` value did not match local `.env.local` token.
  - 조치: replaced Vercel env token values and redeployed production.
- 사용 기술/도구:
  - Vercel CLI (`npx vercel env`, `npx vercel --prod`, `npx vercel curl`)
  - Next.js API route auth check (`ADMIN_UPLOAD_TOKEN`)
- 사용 메모/명령어:
  - `npx vercel env rm ADMIN_UPLOAD_TOKEN <environment> -y`
  - `printf '%s' \"$ADMIN_UPLOAD_TOKEN\" | npx vercel env add ADMIN_UPLOAD_TOKEN <environment>`
  - `npx vercel --prod --yes`
  - `npx vercel curl /api/admin/photos --deployment https://photoblog-two.vercel.app -- --request POST --form \"token=...\"`
- 다음 액션:
  - Retry upload in browser on latest production deployment and confirm record insert succeeds.

## 2026-02-18 22:49 KST - Home Intro Copy Update

- 목표: Update home intro sentence to the new Korean copy requested by user.
- 수행 단계:
  - Changed intro text in `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/page.tsx`.
  - Replaced sentence with: `사진들로 기억을 남긴 갤러리입니다.`
- 트러블슈팅:
  - 트러블슈팅: 없음.
- 사용 기술/도구:
  - Next.js App Router
  - TypeScript/TSX text update
- 사용 메모/명령어:
  - Verify locally: `npm run dev` then open `/`
- 다음 액션:
  - Commit and push copy update to trigger Vercel auto deployment.

## 2026-02-18 - Production 배포 via Vercel CLI

- 목표: 배포 latest commit to production.
- 수행 단계:
  - 실행: `npx vercel --prod --yes`.
  - First deploy failed during Next.js prerender due to missing Supabase public env vars in Vercel production.
  - Added production env vars:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
  - Re-ran `npx vercel --prod --yes`.
  - Deployment succeeded and alias connected.
- 트러블슈팅:
  - 이슈: build error on `/` with message about missing Supabase read env vars.
  - 원인: Vercel production had only `ADMIN_UPLOAD_TOKEN` configured.
  - 조치: synced missing Supabase env vars to production and redeployed.
- 사용 기술/도구:
  - Vercel CLI (`npx vercel`)
  - Next.js build logs
- 사용 메모/명령어:
  - `npx vercel env add <NAME> production`
  - `npx vercel --prod --yes`
- 다음 액션:
  - Verify production feed/admin upload behavior at the aliased domain.

## 2026-02-18 - EXIF Change Verification + Production Redeploy

- 목표: 검토 EXIF-related changes and redeploy production.
- 수행 단계:
  - Scanned repository for EXIF changes (admin UI/API, docs, migration `0002`).
  - 검증: local build and lint pass.
  - Checked Supabase schema compatibility by selecting EXIF columns.
  - Redeployed production using `npx vercel --prod --yes` and confirmed alias update.
- 트러블슈팅:
  - 이슈: DB query returned `column photos.exif_make does not exist`.
  - 원인: migration `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0002_add_photo_exif_columns.sql` not applied yet.
  - 조치: pending manual SQL apply in Supabase SQL Editor.
- 사용 기술/도구:
  - Vercel CLI
  - Supabase JS client schema check
  - Next.js build pipeline
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
  - `npx vercel --prod --yes`
- 다음 액션:
  - 적용 migration `0002_add_photo_exif_columns.sql` in Supabase, then test admin upload EXIF save.

## 2026-02-18 - Supabase CLI Migration 적용 (0002)

- 목표: 적용 EXIF schema migration via Supabase CLI.
- 수행 단계:
  - Logged in with `npx supabase login` (user completed auth).
  - Linked project: `npx supabase link --project-ref czecclgcdhfgqzqsdbgj`.
  - Applied migrations: `npx supabase db push`.
  - Re-verified EXIF columns by selecting `exif_make`, `exif_model`, `exif_f_number` via Supabase JS.
- 트러블슈팅:
  - 이슈: initial EXIF column check still failed.
  - 원인: check command ran in parallel with migration apply.
  - 조치: reran check sequentially after push completion.
- 사용 기술/도구:
  - Supabase CLI (`npx supabase`)
  - Supabase JS verification query
- 사용 메모/명령어:
  - `npx supabase link --project-ref czecclgcdhfgqzqsdbgj`
  - `npx supabase db push`
- 다음 액션:
  - 테스트 `/admin/upload` with EXIF-populated image and verify saved EXIF values in DB.

## 2026-02-18 - Admin Upload UX Fix (Slug + TakenAt Optional)

- 목표: Fix admin upload usability issues (slug input friction, takenAt required friction).
- 수행 단계:
  - 수정: `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx`:
    - slug field no longer required
    - slug is sanitized on blur/submit instead of every keystroke
    - takenAt is auto-filled from EXIF date when available
    - added `Taken At 없음 (none)` checkbox
  - 수정: `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts`:
    - slug auto-generation when empty
    - `takenAt` optional parsing (`none` or empty -> null)
    - required fields reduced to title/caption
  - Added DB migration `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0003_make_taken_at_nullable.sql`.
  - Applied migration with `npx supabase db push`.
  - Updated photo type to allow nullable takenAt and fallback rendering in detail view.
  - Redeployed production with `npx vercel --prod --yes`.
- 트러블슈팅:
  - 이슈: `taken_at` previously required by schema.
  - 원인: `public.photos.taken_at` had `NOT NULL` constraint from initial schema.
  - 조치: migration 0003 dropped not-null constraint.
- 사용 기술/도구:
  - Next.js App Router
  - Supabase Postgres + CLI
  - Vercel CLI
- 사용 메모/명령어:
  - `npx supabase db push`
  - `npx vercel --prod --yes`
- 다음 액션:
  - Validate `/admin/upload` with both cases: EXIF date present and `Taken At 없음` checked.

## 2026-02-20 - 이미지 전송 최적화 (Lazy + WebP + 메타데이터 안전 다운로드)

- 일시:
  - 2026-02-20T00:00:00Z
- 목표:
  - 이미지 네트워크 전송량을 줄이고, 다운로드 파일에서 EXIF/메타데이터가 제거되도록 보장한다.
- 수행 단계:
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts`를 수정해 업로드 이미지를 `sharp`로 WebP 변환하고 `rotate()`로 방향 보정 후 Supabase Storage에 저장하도록 반영했다.
  - 신규 `photos` 레코드에 변환 결과 해상도(width/height)가 저장되도록 보장했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/components/photo-card.tsx`에 피드 카드 lazy-loading 힌트(`loading="lazy"`, `decoding="async"`)를 적용했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/photos/[slug]/download/route.ts`를 추가해 서버 재인코딩(WebP) 기반 다운로드 응답을 제공하고 메타데이터 제거 + 첨부 헤더를 적용했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/next.config.ts` 이미지 최적화 포맷에 AVIF/WebP를 포함했다.
  - TypeScript/ESLint 회귀 확인을 위해 lint를 실행했다.
- 트러블슈팅:
  - 이슈: 다운로드 라우트 응답 본문 타입 문제로 `npm run build`가 실패했다.
  - 원인: `NextResponse` 본문에 Node `Buffer`를 직접 전달해 `BodyInit` 타입과 맞지 않았다.
  - 조치: 응답 전에 출력 버퍼를 `Uint8Array`로 변환했다.
- 사용 기술/도구:
  - Next.js App Router route handlers
  - `sharp` image processing
  - Supabase Storage
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 프로덕션 배포 후 피드 카드 lazy-load 동작과 다운로드 버튼 `.webp` 출력(EXIF 제거)을 검증한다.

## 2026-02-20 - 최소 해상도 강제 + 업스케일 백필 도구 추가

- 일시:
  - 2026-02-20T00:00:00Z
- 목표:
  - 업로드/다운로드 경로 전반에 데스크탑 품질 최소 해상도(`short side >= 2000`, `long side >= 3000`)를 강제하고, 필요 시 자동 업스케일 및 기존 데이터 즉시 백필 도구를 추가한다.
- 수행 단계:
  - 공통 해상도 모듈 `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/image-resolution.ts`를 추가했다:
    - 상수(`MIN_SHORT_SIDE`, `MIN_LONG_SIDE`, `WEBP_QUALITY_UPLOAD`, `WEBP_QUALITY_DOWNLOAD`, `UPSCALE_KERNEL`)
    - `normalizeResolution(width, height)`
    - `ensureMinimumResolution(buffer)` (회전 보정 + 조건부 업스케일 + WebP 인코딩)
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts`에서 공통 강제 로직을 사용해 업로드 전 처리와 변환 해상도 저장을 적용했다.
  - 관리자 업로드 API 성공 응답에 `transformed`, `finalWidth`, `finalHeight`를 추가했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/photos/[slug]/download/route.ts`에서 동일 최소 해상도 규칙(기본 on, 쿼리로 토글 가능)을 적용하고 EXIF/메타데이터 제거 유지 + 타임아웃 시 502 응답을 추가했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx` 성공 메시지에 최종 해상도와 자동 업스케일 적용 여부를 표시했다.
  - 전체 백필 스크립트 `/Users/coldbrew/Documents/photo_blog/photo_blog/scripts/supabase/backfill-min-resolution.mjs`를 추가했다:
    - 모드: `replace`, `versioned`
    - 행 단위 fetch/정규화/업스케일/WebP 변환/Storage 업로드/DB `src/storage_path/width/height` 갱신
    - 동시성 제한 및 실패 요약 출력
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/package.json`에 `supabase:backfill:min-resolution` 스크립트를 추가했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`에 정책/백필 명령을 문서화했다.
  - lint/build 및 스크립트 문법 체크를 검증했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - Next.js App Router route handlers
  - Sharp (`rotate`, `resize`, `webp`)
  - Supabase JS client + Storage
  - Node.js script tooling
  - ESLint + Next build
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
  - `node --check scripts/supabase/backfill-min-resolution.mjs`
  - `npm run supabase:backfill:min-resolution`
  - `node --env-file=.env.local scripts/supabase/backfill-min-resolution.mjs --mode=replace`
  - `node --env-file=.env.local scripts/supabase/backfill-min-resolution.mjs --mode=versioned`
- 다음 액션:
  - 프로덕션 백필 실행 후 실패 리포트를 검토하고 랜덤 다운로드 샘플 점검으로 최소 해상도/메타데이터 제거를 확인한다.

## 2026-02-20 - 프로덕션 백필 실행 (최소 해상도)

- 일시:
  - 2026-02-20T00:00:00Z
- 목표:
  - 기존 전체 사진에 최소 해상도 정책을 즉시 적용하기 위해 전체 백필을 실행한다.
- 수행 단계:
  - `npm run supabase:backfill:min-resolution` (`--mode=replace`)를 실행해 `public.photos` 전체 행을 처리했다.
  - 1차 실행 결과 14건 중 13건 성공, 1건 타임아웃 실패를 확인했다.
  - 동일 명령을 재실행해 실패 건을 재시도했고 14/14 성공으로 완료했다.
  - 최종 리포트 `Processed: 14`, `Transformed (upscaled): 0`, `Failed: 0`를 확인했다.
- 트러블슈팅:
  - 이슈: 한 건(`id=p_026`, slug `golden-gate-cargo-ship`)이 원본 fetch 타임아웃으로 실패했다.
  - 원인: 백필 워커의 원본 이미지 fetch 중 일시적 네트워크 타임아웃이 발생했다.
  - 조치: 백필 명령 재실행으로 재시도했고 실패 건이 해소되었다.
- 사용 기술/도구:
  - Node.js CLI
  - Supabase Storage + Postgres updates via service role
  - Sharp image processing pipeline
- 사용 메모/명령어:
  - `npm run supabase:backfill:min-resolution`
- 다음 액션:
  - 프로덕션에서 랜덤 다운로드 응답을 표본 점검해 WebP 첨부 응답과 메타데이터 제거를 확인한다.

## 2026-02-20 - AVIF 다운로드 강제 + 브라우저 차단 이슈 점검

- 일시:
  - 2026-02-20T00:00:00Z
- 목표:
  - 다운로드 API 출력 포맷을 AVIF로 강제하고 브라우저의 비보안 다운로드 차단 이슈를 점검한다.
- 수행 단계:
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/image-resolution.ts`를 수정했다:
    - 인코더 입력을 일반화(`quality`, `outputFormat`)
    - AVIF 다운로드 품질 상수 추가
    - 업로드 WebP 유지 + 다운로드 AVIF 인코딩 경로 활성화
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/photos/[slug]/download/route.ts`를 수정해 AVIF 출력으로 고정했다:
    - `Content-Type: image/avif`
    - `Content-Disposition: attachment; filename="<slug>.avif"`
    - `X-Content-Type-Options: nosniff`
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts` 호출부를 새 공통 옵션(`outputFormat: webp`) 기반으로 정리했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md` 정책 문구를 업로드 WebP/다운로드 AVIF 기준으로 갱신했다.
  - Supabase에서 `public.photos.src` URL 프로토콜을 조회해 혼합 콘텐츠 저장 여부를 점검했고 `https`만 확인했다.
  - lint/build를 검증했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - Next.js route handlers
  - Sharp AVIF/WebP encoding
  - Supabase JS verification query
  - ESLint + Next build
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
  - `node --env-file=.env.local -e "...query photos src protocols..."`
- 다음 액션:
  - 다운로드 버튼 기준 브라우저 동작을 재검증하고 저장 확장자가 `.avif`인지 확인한다.

## 2026-02-20 - 실행 로그 언어 통일 (영문 -> 한글)

- 일시:
  - 2026-02-20T00:00:00Z
- 목표:
  - 기존 실행 로그의 영문 항목을 한글로 통일한다.
- 수행 단계:
  - `docs/execution-log.md`의 공통 섹션 라벨(`Goal`, `Steps taken`, `Troubleshooting`, `Tech stack/tools used`, `Usage notes/commands`, `Next action`)을 한글 라벨로 일괄 변경했다.
  - 최근 영문으로 남아 있던 2026-02-20 로그 블록 본문을 한글 문장으로 번역해 갱신했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - 텍스트 치환 (`perl`)
  - 수동 편집 (`apply_patch`)
- 사용 메모/명령어:
  - `perl -0pi -e '...replace...' docs/execution-log.md`
- 다음 액션:
  - 이후 신규 로그는 한글로만 작성한다.

## 2026-02-20 23:02 KST - 글로벌 룰에 tmux 멀티 에이전트 스플릿 전략 추가

- 일시:
  - 2026-02-20 23:02:01 KST
- 목표:
  - 멀티 에이전트 작업 시 `tmux` 분할 전략을 글로벌 룰로 명시해 실행 표준을 통일한다.
- 수행 단계:
  - 루트 글로벌 룰 파일 `AGENTS.md`를 확인했다.
  - `Global Workflow Rule (tmux Split for Multi-Agent)` 섹션을 추가했다.
  - 기본 3-pane 역할(Orchestrator / Explorer / Worker), 파일 소유 분리, 최종 통합 검증 규칙을 문서화했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Markdown 문서 편집
  - Shell: `cat`, `rg`, `date`
  - `apply_patch`
- 사용 메모/명령어:
  - `date '+%Y-%m-%d %H:%M:%S %Z'`
  - `cat AGENTS.md`
- 다음 액션:
  - 실제 멀티 에이전트 세션 시작 시 `tmux` 3-pane 레이아웃을 기본 템플릿으로 사용한다.

## 2026-02-20 23:08 KST - 관리자 업로드 인증을 Supabase Auth 기반으로 전환

- 일시:
  - 2026-02-20 23:08:13 KST
- 목표:
  - `/admin/upload` 업로드 기능에 로그인 기반 인증을 적용하고, 서버에서 관리자 권한을 이메일 allowlist로 검증한다.
- 수행 단계:
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/api/admin/photos/route.ts` 인증 로직을 확장했다.
  - 기존 `ADMIN_UPLOAD_TOKEN` 검증은 레거시 fallback으로 유지하고, 기본 인증 경로를 Bearer access token + Supabase `auth.getUser()` 검증으로 추가했다.
  - `ADMIN_ALLOWED_EMAILS`(쉼표 구분) allowlist를 도입해 로그인 사용자 이메일을 서버에서 최종 검증하도록 반영했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx`에 Supabase 로그인/로그아웃 UI를 추가했다.
  - 로그인 성공 시 세션 access token을 `/api/admin/photos` 요청 `Authorization: Bearer ...` 헤더로 전달하도록 변경했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/.env.example`와 `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`를 새 인증 흐름 기준으로 업데이트했다.
  - 정적 검증으로 `npm run lint`를 실행했다.
- 트러블슈팅:
  - 이슈: `npm run build` 시 Google Fonts(Geist) 네트워크 fetch 실패로 빌드 에러 발생.
  - 원인: 현재 실행 환경의 외부 네트워크 제한으로 `fonts.googleapis.com` 접근 불가.
  - 조치: 코드 변경 유효성은 `npm run lint`로 확인했고, 빌드는 네트워크 가능한 환경에서 재검증 필요.
- 사용 기술/도구:
  - Next.js App Router
  - Supabase Auth (`@supabase/supabase-js`)
  - ESLint
  - Markdown 문서 편집
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
  - `rg -n "ADMIN_UPLOAD_TOKEN|ADMIN_ALLOWED_EMAILS|Authorization" src README.md .env.example`
- 다음 액션:
  - Supabase Auth에 관리자 계정을 생성하고 `ADMIN_ALLOWED_EMAILS`를 배포 환경에 설정한 뒤 `/admin/upload` 로그인/업로드를 실환경에서 검증한다.

## 2026-02-21 00:09 KST - 관리자 로그인 방식을 GitHub OAuth로 전환

- 일시:
  - 2026-02-21 00:09:49 KST
- 목표:
  - `/admin/upload`에서 이메일/비밀번호 대신 GitHub OAuth 로그인으로 관리자 인증을 수행하도록 전환한다.
- 수행 단계:
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/upload/page.tsx`의 인증 UI를 GitHub OAuth 버튼 기반으로 변경했다.
  - `signInWithPassword` 호출을 제거하고 `signInWithOAuth({ provider: "github" })`를 적용했다.
  - OAuth redirect 경로를 `/admin/upload`로 고정하고, 로그인 상태/오류/진행 메시지를 UI에 반영했다.
  - 업로드 API의 Bearer 토큰 검증 + `ADMIN_ALLOWED_EMAILS` 서버 검증 흐름은 유지했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/README.md`에 GitHub OAuth 설정 가이드를 추가했다.
  - 정적 검증으로 `npm run lint`를 실행해 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Supabase Auth OAuth
  - Next.js App Router client page
  - ESLint
  - Markdown 문서 편집
- 사용 메모/명령어:
  - `npm run lint`
  - `date '+%Y-%m-%d %H:%M:%S %Z'`
- 다음 액션:
  - Supabase/GitHub OAuth provider 설정을 완료하고 실제 관리자 GitHub 계정으로 `/admin/upload` 로그인/업로드를 검증한다.

## 2026-02-21 00:20 KST - 관리자 이메일 allowlist 등록

- 일시:
  - 2026-02-21 00:20:34 KST
- 목표:
  - GitHub OAuth 인증 후 업로드 권한 검증을 위해 관리자 이메일을 `ADMIN_ALLOWED_EMAILS`에 등록한다.
- 수행 단계:
  - 로컬 환경변수 파일 `/Users/coldbrew/Documents/photo_blog/photo_blog/.env.local`에 `ADMIN_ALLOWED_EMAILS` 키 존재 여부를 확인했다.
  - `ADMIN_ALLOWED_EMAILS=shchoi8687@hotmail.com` 값을 추가(또는 동일 키 업데이트)했다.
  - `rg`로 최종 등록 라인을 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Shell (`rg`, `sed`, `printf`)
  - `.env.local` 환경변수 관리
- 사용 메모/명령어:
  - `rg -n "^ADMIN_ALLOWED_EMAILS=" .env.local`
  - `sed -i '' 's/^ADMIN_ALLOWED_EMAILS=.*/ADMIN_ALLOWED_EMAILS=shchoi8687@hotmail.com/' .env.local`
- 다음 액션:
  - `/admin/upload`에서 GitHub 로그인 후 업로드 API가 403 없이 통과되는지 확인한다.

## 2026-02-21 00:21 KST - Vercel 환경변수 ADMIN_ALLOWED_EMAILS 반영

- 일시:
  - 2026-02-21 00:21:40 KST
- 목표:
  - GitHub OAuth 관리자 업로드 권한 검증이 배포 환경에서도 동작하도록 `ADMIN_ALLOWED_EMAILS`를 Vercel 모든 환경에 반영한다.
- 수행 단계:
  - `ADMIN_ALLOWED_EMAILS=shchoi8687@hotmail.com` 값을 Vercel `development`, `preview`, `production`에 추가했다.
  - `npx vercel env ls`로 3개 환경 모두 `ADMIN_ALLOWED_EMAILS`가 등록된 것을 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Vercel CLI (`npx vercel`)
  - Shell loop + stdin 파이프 입력
- 사용 메모/명령어:
  - `printf '%s\n' "$ADMIN_ALLOWED_EMAILS" | npx vercel env add ADMIN_ALLOWED_EMAILS development`
  - `printf '%s\n' "$ADMIN_ALLOWED_EMAILS" | npx vercel env add ADMIN_ALLOWED_EMAILS preview`
  - `printf '%s\n' "$ADMIN_ALLOWED_EMAILS" | npx vercel env add ADMIN_ALLOWED_EMAILS production`
  - `npx vercel env ls`
- 다음 액션:
  - 프로덕션 배포 후 `/admin/upload`에서 GitHub 로그인 및 업로드 성공(401/403 없음)을 확인한다.

## 2026-02-21 00:25 KST - GitHub OAuth 로그인 화면 증빙 이미지 추가

- 일시:
  - 2026-02-21 00:25:16 KST
- 목표:
  - GitHub OAuth 로그인 UI 반영 상태를 기록용 이미지로 저장하고 Git 추적 대상에 포함한다.
- 수행 단계:
  - GitHub OAuth 로그인 UI 스크린샷을 프로젝트 내부 증빙 폴더로 복사했다.
  - 저장 경로를 `docs/evidence/admin-upload-github-login.png`로 고정했다.
  - 파일 존재 및 크기를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Shell (`cp`, `ls`, `mkdir`, `date`)
  - Git 추적 대상 파일 관리
- 사용 메모/명령어:
  - `mkdir -p docs/evidence`
  - `cp "<source-screenshot>" "docs/evidence/admin-upload-github-login.png"`
  - `ls -l docs/evidence/admin-upload-github-login.png`
- 다음 액션:
  - 커밋 시 `docs/evidence/admin-upload-github-login.png`를 함께 포함해 인증 UI 변경 증빙으로 보관한다.

## 2026-02-21 00:27 KST - GitHub OAuth 실행결과 스크린샷 추가 + 로그 경로 표기 정리

- 일시:
  - 2026-02-21 00:27:10 KST
- 목표:
  - GitHub OAuth 실행결과 화면을 추가 증빙으로 등록하고, 로그에 개인 로컬 절대경로를 남기지 않도록 정리한다.
- 수행 단계:
  - 실행결과 스크린샷을 `docs/evidence/admin-upload-github-login-result.png`로 추가했다.
  - `AGENTS.md`에 실행 로그는 리포 상대경로만 기록하도록 규칙을 추가했다.
  - 직전 로그(00:25 KST)에서 개인 로컬 절대경로 표기를 상대경로 중심으로 수정했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Shell (`cp`, `ls`, `date`)
  - Markdown 문서 편집 (`apply_patch`)
- 사용 메모/명령어:
  - `cp "<source-screenshot>" "docs/evidence/admin-upload-github-login-result.png"`
  - `ls -l docs/evidence/admin-upload-github-login-result.png`
- 다음 액션:
  - 이후 실행 로그에는 민감한 개인 경로 없이 리포 상대경로만 사용한다.

## 2026-02-21 00:40 KST - README 멀티에이전트 가이드 및 경로 표기 정리

- 일시:
  - 2026-02-21 00:40:11 KST
- 목표:
  - README에 멀티에이전트(`tmux`) 운영 가이드를 추가하고 경로 표기를 리포 상대경로로 정리한다.
- 수행 단계:
  - `README.md`의 실행 로그 안내 경로를 절대경로에서 상대경로(`docs/execution-log.md`, `AGENTS.md`)로 변경했다.
  - `README.md`에 `Multi-Agent Workflow (tmux)` 섹션을 추가했다.
  - Supabase 문서/마이그레이션 참조 경로를 상대경로(`docs/supabase-phase1.md`, `supabase/migrations/...`)로 정리했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Markdown 문서 편집 (`apply_patch`)
  - 멀티 에이전트 보조 분석 (`explorer`, `researcher`)
- 사용 메모/명령어:
  - `date '+%Y-%m-%d %H:%M:%S %Z'`
  - `git status --short`
- 다음 액션:
  - README 변경을 커밋하고 `main` 브랜치로 푸시한다.

## 2026-02-20 23:25 KST - Delta Install + Git/Lazygit Integration

- Goal: Install `delta` and apply it as the default diff pager for both Git and Lazygit.
- Steps taken:
  - Checked current tools: `delta` was missing, `lazygit` was already installed.
  - Installed `git-delta` via Homebrew.
  - Applied global Git settings for delta pager and improved diff/merge UX.
  - Created Lazygit config and wired pager to `delta --paging=never`.
  - Verified final config files and values.
- Troubleshooting: none
- Tech stack/tools used:
  - Homebrew
  - Git (`git config --global`)
  - Lazygit (`~/.config/lazygit/config.yml`)
  - Shell: `which`, `sed`, `cat`, `mkdir`
- Usage notes or commands:
  - Install: `brew install git-delta`
  - Verify: `delta --version`
  - Git config file: `~/.gitconfig`
  - Lazygit config file: `~/.config/lazygit/config.yml`
- Next action:
  - Open any repo and run `git diff` / `lazygit` to confirm color theme and pager behavior; optionally tune delta theme with `git config --global delta.syntax-theme <theme>`.

## 2026-02-20 23:36 KST - Delta Theme Mode Clarification + Auto Detect Setup

- Goal: Configure delta with non-side-by-side diff and clarify dark/light theme behavior.
- Steps taken:
  - Verified available syntax themes via `delta --list-syntax-themes`.
  - Tested whether delta feature sections with `light=true` / `dark=true` can auto-switch syntax themes.
  - Confirmed conditional per-mode `syntax-theme` switching is not applied as expected in a single static config.
  - Applied stable global config: `detect-dark-light=auto`, `features=line-numbers`, `syntax-theme=Nord` (dark default).
- Troubleshooting:
  - Issue: Theme appeared fixed and user expected dark/light-specific automatic theme mapping.
  - Cause: `syntax-theme` is a single active value in current config flow; feature flags did not conditionally switch it.
  - Fix: Set reliable defaults and provided explicit mode-switch commands for light/dark theme changes.
- Tech stack/tools used:
  - git-delta CLI
  - Git global config
  - Shell: `rg`, `sed`, `mktemp`
- Usage notes or commands:
  - Dark profile: `git config --global delta.syntax-theme Nord`
  - Light profile: `git config --global delta.syntax-theme GitHub`
  - Auto terminal mode detection: `git config --global delta.detect-dark-light auto`
- Next action:
  - If desired, add shell aliases/functions (`delta-dark`, `delta-light`) for one-command switching.

## 2026-02-21 01:29 KST - 관리자 메인 진입/상세 편집삭제/관리 목록 구현

- 일시:
  - 2026-02-21 01:29:01 KST
- 목표:
  - 관리자 사용성이 좋아지도록 메인 화면 로그인/업로드 진입, 상세 편집/삭제, 관리자 목록 화면을 구현한다.
- 수행 단계:
  - `src/lib/admin-auth-server.ts`를 추가해 서버 공통 관리자 인증(`Bearer + ADMIN_ALLOWED_EMAILS`)과 service role client 생성을 공통화했다.
  - `src/lib/admin-auth-client.ts`를 추가해 클라이언트 공통 세션/관리자 상태 훅을 구현했다.
  - `src/components/admin-auth-actions.tsx`를 추가하고 `src/app/page.tsx` 헤더에 연결해 메인 우측 상단 로그인/Upload/Manage/로그아웃 버튼 흐름을 구현했다.
  - `src/app/api/admin/session/route.ts`를 추가해 클라이언트에서 관리자 여부 확인 API를 제공했다.
  - `src/app/api/admin/photos/route.ts`를 리팩터링해 공통 인증 유틸을 사용하고 관리자 목록 `GET`을 추가했다.
  - `src/app/api/admin/photos/[slug]/route.ts`를 추가해 상세에서 사진 메타+slug 수정(`PATCH`)과 즉시 삭제(`DELETE`)를 구현했다.
  - `src/components/photo-detail-shell.tsx`에 관리자 전용 Edit/Delete 버튼, 편집 모달, 삭제 확인 모달(DELETE 입력)을 추가했다.
  - `src/app/admin/photos/page.tsx`를 추가해 관리자 사진 목록과 상세 진입 동선을 구현했다.
  - `src/app/admin/upload/page.tsx` 헤더에 `Manage Photos` 링크를 추가했다.
  - `README.md`에 관리자 네비게이션/상세 편집삭제/관리 목록 기능 섹션을 추가했다.
  - `.env.example`에서 이번 범위와 무관한 AI env 항목을 제거해 현재 구현과 문서 정합성을 맞췄다.
- Troubleshooting:
  - 이슈: `react-hooks/preserve-manual-memoization`, `react-hooks/set-state-in-effect` lint 에러가 발생했다.
  - 원인: 초기 `useAdminSession` 구현에서 의존성/이펙트 구조가 React hooks 규칙과 충돌했다.
  - 조치: 인증 훅을 단순화하여 세션 동기화 루틴 내부에서 관리자 상태를 갱신하도록 재구성했다.
- 사용 기술/도구:
  - Next.js App Router (page + route handlers)
  - Supabase Auth (`@supabase/supabase-js`)
  - ESLint
  - Shell (`rg`, `sed`, `date`)
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
  - `find src/app/api/admin -maxdepth 4 -type f | sort`
- 다음 액션:
  - 관리자 계정으로 메인(`/`) → Upload/Manage 진입, 상세(`/photo/[slug]`) 편집/삭제 흐름을 브라우저에서 E2E로 확인한다.

## 2026-02-21 01:23 KST - 관리자 업로드 AI 메타데이터 추천 기능 구현

- Date/time:
  - 2026-02-21 01:23:32 KST
- Goal:
  - 관리자 업로드 화면에서 이미지 기반 AI 메타데이터(title/caption/tags) 추천 API와 UI 연동을 구현한다.
- Steps taken:
  - 새 worktree `../photo_blog_ai_meta`와 브랜치 `feat/ai-upload-metadata`를 현재 HEAD에서 생성했다.
  - `src/app/api/admin/photos/ai-suggest/route.ts`를 추가해 관리자 Bearer 인증 후 OpenAI Responses API(`fetch`)로 이미지 분석 결과를 받아 JSON(`title`, `caption`, `tags`)을 반환하도록 구현했다.
  - 서버에서 multipart 파일 유효성(이미지 여부/크기 제한), 모델 응답 JSON 파싱/정규화(문자열 정리, 태그 dedupe), 오류 응답 분기를 추가했다.
  - `src/app/admin/upload/page.tsx`에 `AI로 메타데이터 추천` 버튼과 `기존 값 덮어쓰기` 토글을 추가했다.
  - 파일 선택 후 인증된 상태면 AI 추천을 자동 호출하고, 수동 재호출도 가능하게 했다.
  - 추천값은 기본적으로 빈 필드만 채우고, 덮어쓰기 토글이 켜지면 기존 입력값을 갱신하도록 반영했다.
  - `README.md`와 `.env.example`에 `OPENAI_API_KEY`, `OPENAI_VISION_MODEL` 환경변수 문서를 추가했다.
- Troubleshooting (issue, cause, fix):
  - Issue: sandbox 기본 권한으로는 worktree 경로/`.git` refs 쓰기가 차단되어 브랜치 생성 및 파일 생성이 실패했다.
  - Cause: writable root가 기본 저장소 경로로 제한되어 worktree(`../photo_blog_ai_meta`)와 `.git` lock 파일 작성이 허용되지 않았다.
  - Fix: 권한 상승 실행으로 `git worktree add` 및 worktree 내부 파일 생성을 진행했다.
- Tech stack/tools used:
  - Next.js App Router route handler
  - TypeScript, React hooks
  - OpenAI HTTP API (`fetch`, `/v1/responses`)
  - Git worktree/branch
  - Shell (`rg`, `sed`, `date`)
- Usage notes or commands:
  - `git worktree add ../photo_blog_ai_meta -b feat/ai-upload-metadata`
  - `npm run lint`
  - `npm run build`
- Next action:
  - lint/build 결과를 확인한 뒤 해당 worktree 브랜치에서 커밋하고 PR 생성 준비를 진행한다.

## 2026-02-21 01:35 KST - ai-upload-metadata 작업 브랜치/worktree 정리

- 일시:
  - 2026-02-21 01:35:35 KST
- 목표:
  - `feat/ai-upload-metadata` 임시 작업 브랜치와 연결 worktree를 정리해 로컬 작업 트리를 단순화한다.
- 수행 단계:
  - 현재 worktree 목록과 브랜치 목록을 확인했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog_ai_meta` worktree를 제거했다.
  - 로컬 브랜치 `feat/ai-upload-metadata`를 삭제했다.
  - 삭제 후 브랜치/worktree 상태를 재확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Git worktree
  - Git branch
- 사용 메모/명령어:
  - `git worktree list`
  - `git worktree remove /Users/coldbrew/Documents/photo_blog/photo_blog_ai_meta`
  - `git branch -D feat/ai-upload-metadata`
- 다음 액션:
  - 필요 시 `main` 기준으로 새 기능 브랜치를 다시 생성해 작업을 이어간다.

## 2026-02-21 01:39 KST - Lightlog 아이콘 신규 제작 및 메타데이터 연결

- 일시:
  - 2026-02-21 01:39:50 KST
- 목표:
  - 프로젝트 브랜딩에 맞는 새 탭 아이콘을 적용한다.
- 수행 단계:
  - `src/app/icon.svg`를 추가해 Lightlog 콘셉트(빛 + 렌즈)의 신규 아이콘을 제작했다.
  - `src/app/layout.tsx` `metadata.icons`에 `/icon.svg`를 연결해 favicon/shortcut/apple 아이콘으로 사용되도록 설정했다.
  - `npm run lint`로 정적 검증을 수행했다.
- Troubleshooting: none
- 사용 기술/도구:
  - SVG 벡터 아이콘 작성
  - Next.js App Router metadata icons
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 브라우저 강력 새로고침 후 새 탭 아이콘 표시를 확인한다.

## 2026-02-21 01:43 KST - 상단 Upload 버튼 시인성 개선 + favicon.ico 생성

- 일시:
  - 2026-02-21 01:43:54 KST
- 목표:
  - 메인 우측 상단 Upload 버튼의 텍스트 시인성을 높이고, 실제 `.ico` 포맷 favicon 파일을 생성해 연결한다.
- 수행 단계:
  - `src/components/admin-auth-actions.tsx`의 Upload 버튼 스타일을 `font-semibold`, `!text-white`, `shadow-sm`로 조정해 명암 대비를 강화했다.
  - `src/app/icon.svg`를 기반으로 `sharp`로 PNG 렌더 후 `sips` 변환으로 `src/app/favicon.ico`를 생성했다.
  - `src/app/layout.tsx` `metadata.icons`를 `/favicon.ico` 우선 사용으로 변경했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: `sips`로 SVG에서 직접 ICO 변환이 실패했다(`Cannot extract image from file`).
  - 원인: 현재 `sips` 실행 환경에서 SVG 입력을 직접 ICO로 추출하지 못했다.
  - 조치: `sharp`로 PNG(256x256) 중간 산출물을 만든 뒤 `sips`로 ICO 변환해 해결했다.
- 사용 기술/도구:
  - Tailwind CSS 클래스 조정
  - `sharp` (SVG -> PNG)
  - `sips` (PNG -> ICO)
  - ESLint
- 사용 메모/명령어:
  - `node -e \"...sharp('src/app/icon.svg').resize(256,256).png().toFile('/tmp/lightlog-icon-256.png')...\"`
  - `sips -s format ico /tmp/lightlog-icon-256.png --out src/app/favicon.ico`
  - `npm run lint`
- 다음 액션:
  - 브라우저 캐시를 비운 뒤 탭 아이콘(.ico)과 Upload 버튼 가독성을 실브라우저에서 확인한다.

## 2026-02-21 01:45 KST - favicon 아이콘 전략을 SVG 우선으로 전환

- 일시:
  - 2026-02-21 01:45:44 KST
- 목표:
  - 탭 아이콘 적용 방식을 `.ico` 우선에서 `SVG` 우선으로 전환한다.
- 수행 단계:
  - `src/app/layout.tsx` `metadata.icons`에서 `icon`, `shortcut`을 `/icon.svg`로 변경했다.
  - `apple` 아이콘은 기존처럼 `/icon.svg`를 유지했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js App Router metadata icons 설정
- 사용 메모/명령어:
  - `git add src/app/layout.tsx docs/execution-log.md src/app/icon.svg`
- 다음 액션:
  - Vercel 배포 후 브라우저 강력 새로고침으로 새 SVG 탭 아이콘 반영 여부를 확인한다.
