# Photo Blog

Unsplash 스타일의 개인 사진 블로그 MVP입니다. 메인 화면에서 아래로 스크롤할수록 사진이 이어지고, 각 사진을 눌러 상세 페이지를 볼 수 있습니다.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Vercel 배포 최적화 구조
- Supabase (Postgres + Storage) 마이그레이션 준비

## Run

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## Project Structure

- `public/photos`: 실제 사진 파일
- `supabase/migrations/0001_create_photos.sql`: Supabase 스키마/RLS/Storage 정책
- `src/app/api/photos/route.ts`: 무한 스크롤용 페이지네이션 API
- `src/app/page.tsx`: 메인 Masonry 피드
- `src/app/photo/[slug]/page.tsx`: 사진 상세 페이지

## Add Your Photos

1. Supabase Storage `photos` 버킷에 이미지 업로드
2. Supabase `public.photos`에 메타데이터 insert/upsert

## Deploy (Vercel)

1. GitHub에 푸시
2. Vercel에서 저장소 Import
3. Framework Preset `Next.js` 확인 후 Deploy

별도 환경변수 없이 바로 배포됩니다.

## Project Rule: Execution Log

- 모든 실행/작업마다 학습 복습용 기록을 반드시 갱신합니다.
- 기록 파일: `docs/execution-log.md`
- 규칙 원문: `AGENTS.md`

## Multi-Agent Workflow (tmux)

- 멀티 에이전트 작업은 `tmux` 세션에서 시작하는 것을 기본으로 합니다.
- 권장 3분할:
  - Pane 1: Orchestrator (계획/통합/최종 검증)
  - Pane 2: Explorer (코드 탐색/영향 범위 분석)
  - Pane 3: Worker (구현/테스트)
- 에이전트 간 파일 소유 범위를 분리해 충돌을 줄이고, 최종 검증은 Orchestrator pane에서 수행합니다.

## Supabase Phase 1

상세 문서:

- `docs/supabase-phase1.md`

환경변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_ALLOWED_EMAILS` (쉼표 구분 관리자 이메일 allowlist, 예: `admin@site.com,owner@site.com`)
- `ADMIN_UPLOAD_TOKEN` (선택: 레거시 토큰 fallback)

실행 순서:

1. Supabase SQL Editor에서 `supabase/migrations/0001_create_photos.sql` 실행
2. Supabase SQL Editor에서 `supabase/migrations/0002_add_photo_exif_columns.sql` 실행 (EXIF 컬럼)
3. (초기 1회) 메타데이터 import (`data/photos.json`이 있을 때):

```bash
npm run supabase:import:photos
```

4. 스토리지 업로드 + DB `src` URL 동기화:

```bash
npm run supabase:sync:storage
```

## Admin Upload

- 경로: `/admin/upload`
- 동작:
  - 이미지 파일 업로드
  - `photos` 버킷 저장
  - `public.photos` 레코드 자동 생성
  - 최소 해상도 정책 자동 적용: `short side >= 2000` and `long side >= 3000`
  - 기준 미달 이미지는 자동 업스케일 후 WebP로 저장
  - EXIF 자동 추출(가능한 항목) + 수동 수정 입력 후 저장
- 보안:
  - Supabase Auth 로그인 후 업로드 가능
  - API는 Bearer access token 검증 + `ADMIN_ALLOWED_EMAILS` allowlist 검사
  - `ADMIN_UPLOAD_TOKEN`이 설정된 경우 기존 토큰 방식도 fallback으로 허용(점진 이관용)

### Admin Upload - GitHub OAuth 설정

1. Supabase `Authentication > Providers > GitHub`를 활성화한다.
2. GitHub `Settings > Developer settings > OAuth Apps`에서 OAuth App을 만든다.
3. GitHub OAuth App의 Callback URL을 다음으로 설정한다:
   - `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
4. GitHub에서 발급된 `Client ID`, `Client Secret`을 Supabase GitHub Provider에 입력한다.
5. Supabase `Authentication > URL Configuration`에 redirect URL을 추가한다:
   - 로컬: `http://localhost:3000/admin/upload`
   - 프로덕션: `https://<your-domain>/admin/upload`
6. 프로젝트 환경변수 `ADMIN_ALLOWED_EMAILS`에 업로드를 허용할 GitHub 계정 이메일을 등록한다.

## Image Policy

- 업로드 이미지는 WebP로 변환됩니다.
- 다운로드 이미지는 AVIF로 변환됩니다.
- 다운로드 이미지는 서버에서 재인코딩되어 EXIF/메타데이터가 제거됩니다.
- 데스크탑 품질 기준:
  - `short side >= 2000`
  - `long side >= 3000`

기존 데이터 즉시 백필:

```bash
npm run supabase:backfill:min-resolution
```

직접 모드 지정:

```bash
node --env-file=.env.local scripts/supabase/backfill-min-resolution.mjs --mode=replace
node --env-file=.env.local scripts/supabase/backfill-min-resolution.mjs --mode=versioned
```

## Vercel CLI Usage

이 환경에서는 전역 `vercel` 대신 `npx vercel` 사용:

```bash
npx vercel whoami
npx vercel env ls
```

환경변수 추가:

```bash
printf '%s\n' "$ADMIN_ALLOWED_EMAILS" | npx vercel env add ADMIN_ALLOWED_EMAILS development
printf '%s\n' "$ADMIN_ALLOWED_EMAILS" | npx vercel env add ADMIN_ALLOWED_EMAILS preview
printf '%s\n' "$ADMIN_ALLOWED_EMAILS" | npx vercel env add ADMIN_ALLOWED_EMAILS production
```

배포:

```bash
npx vercel --prod
```

## Roadmap

### Phase 1 (Done)

- 로컬 사진 기반 Masonry 피드
- 사진 상세 페이지
- Hover UI(설명, 하트, 다운로드)

### Phase 2 (Planned): EXIF + AI Caption Pipeline

- 사진 업로드/동기화 시 EXIF 메타데이터 추출
  - 촬영 시각, 카메라 정보, 렌즈 정보, GPS 좌표
- GPS 좌표를 장소명(도시/스팟)으로 역지오코딩
- 이미지 자체를 AI 비전 모델로 분석해 장면/피사체 태그 생성
- EXIF/GPS + 비전 분석 결과를 합쳐 캡션/태그 자동 생성
- 생성 결과를 Supabase `public.photos`에 반영하고 수동 수정 가능하게 유지

권장 파이프라인 출력 필드:

- `location`: `country`, `city`, `spot`
- `exif`: `camera`, `lens`, `focalLength`, `aperture`, `shutterSpeed`, `iso`
- `ai`: `captionDraft`, `tagsDraft`, `confidence`
