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
- 기록 파일: `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/execution-log.md`
- 규칙 원문: `/Users/coldbrew/Documents/photo_blog/photo_blog/AGENTS.md`

## Supabase Phase 1

상세 문서:

- `/Users/coldbrew/Documents/photo_blog/photo_blog/docs/supabase-phase1.md`

환경변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

실행 순서:

1. Supabase SQL Editor에서 `/Users/coldbrew/Documents/photo_blog/photo_blog/supabase/migrations/0001_create_photos.sql` 실행
2. 메타데이터 import:

```bash
npm run supabase:import:photos
```

3. `/Users/coldbrew/Documents/photo_blog/photo_blog/public/photos` 이미지 파일을 `photos` 버킷으로 업로드

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
- 생성 결과를 `data/photos.json`에 반영하고 수동 수정 가능하게 유지

권장 파이프라인 출력 필드:

- `location`: `country`, `city`, `spot`
- `exif`: `camera`, `lens`, `focalLength`, `aperture`, `shutterSpeed`, `iso`
- `ai`: `captionDraft`, `tagsDraft`, `confidence`
