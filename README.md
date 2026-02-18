# Photo Blog

Unsplash 스타일의 개인 사진 블로그 MVP입니다. 메인 화면에서 아래로 스크롤할수록 사진이 이어지고, 각 사진을 눌러 상세 페이지를 볼 수 있습니다.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Vercel 배포 최적화 구조

## Run

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## Project Structure

- `data/photos.json`: 사진 메타데이터
- `public/photos`: 실제 사진 파일
- `src/app/api/photos/route.ts`: 무한 스크롤용 페이지네이션 API
- `src/app/page.tsx`: 메인 Masonry 피드
- `src/app/photo/[slug]/page.tsx`: 사진 상세 페이지

## Add Your Photos

1. 사진 파일을 `public/photos`에 넣습니다.
2. `data/photos.json`에 항목을 추가합니다.

필수 필드:

- `id`, `slug`, `src`
- `width`, `height`
- `title`, `caption`, `tags`
- `takenAt`, `createdAt`

예시:

```json
{
  "id": "p_019",
  "slug": "my-new-photo",
  "src": "/photos/my-new-photo.jpg",
  "width": 3000,
  "height": 2000,
  "title": "My New Photo",
  "caption": "설명",
  "tags": ["travel", "night"],
  "takenAt": "2026-02-18",
  "createdAt": "2026-02-18T12:00:00Z"
}
```

## Deploy (Vercel)

1. GitHub에 푸시
2. Vercel에서 저장소 Import
3. Framework Preset `Next.js` 확인 후 Deploy

별도 환경변수 없이 바로 배포됩니다.

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
