# Execution Log

## 2026-03-01 15:14 KST - 업로드 페이지 JSON 파싱 오류(Unexpected token 'R') 대응

- Date/time: 2026-03-01 15:14 KST
- Goal: 관리자 업로드 페이지에서 `Unexpected token 'R', "Request En"... is not valid JSON` 오류를 사용자 친화적으로 처리하고 업로드 실패 원인을 명확히 안내.
- Steps taken:
  - `src/app/admin/upload/page.tsx` 수정:
    - 응답 본문을 안전하게 읽는 `parseResponseBodySafely` 유틸 추가(텍스트/JSON 모두 처리).
    - 업로드/AI 추천 요청에서 `response.json()` 직접 호출 제거.
    - HTTP 413 응답 시 명시적 메시지 처리:
      - 업로드: `업로드 요청이 너무 큽니다(413)...`
      - AI 추천: `AI 추천 요청이 너무 큽니다(413)...`
    - 업로드 제출 전 파일 크기 사전 체크 추가(`4.5MB` 초과 시 즉시 안내).
  - 검증 실행:
    - `npm run lint` 통과.
- Troubleshooting:
  - Issue: 업로드 실패 시 JSON 파싱 예외(`Unexpected token 'R'...`) 노출.
  - Cause: Vercel이 413에서 plain text(`Request Entity Too Large`)를 반환했는데 프론트가 JSON으로 강제 파싱.
  - Fix: 안전 파싱 + 413 전용 에러 메시지 + 사전 파일 크기 체크.
- Tech stack/tools used:
  - Next.js client page (`admin/upload`)
  - Fetch response parsing (text/json fallback)
  - ESLint
- Usage notes or commands:
  - `npm run lint`
- Next action:
  - 배포 후 `/admin/upload`에서 4.5MB 초과/미만 파일 각각 테스트해 사용자 메시지와 성공 동작 확인.

## 2026-03-01 15:04 KST - Vercel 배포 실패(TypeScript) 원인 확인 및 수정

- Date/time: 2026-03-01 15:04 KST
- Goal: Vercel production 배포 실패 원인을 CLI로 확인하고 빌드 실패를 재발 없이 해결.
- Steps taken:
  - Vercel CLI로 실패 배포 확인:
    - `npx vercel ls photo_blog --yes`
    - 최신 실패 배포 URL: `photoblog-6uhw4803j-coldbrews-projects-fc2159b4.vercel.app`
  - 실패 배포 빌드 로그 조회:
    - `npx vercel inspect <deployment-url> --logs`
    - 오류 확인: `src/app/admin/upload/page.tsx`에서 `img.src = sourceUrl` 타입 불일치(`string | null` → `string`)로 TypeScript 컴파일 실패.
  - 코드 수정:
    - `src/app/admin/upload/page.tsx`에서 `sourceUrl`을 지역 상수(`objectUrl`)로 고정 후 `img.src`에 할당.
    - 동일 패턴 예방을 위해 `src/components/photo-detail-shell.tsx`도 동일 수정.
  - 로컬 빌드 검증:
    - `npm run build` 실행, Next.js 빌드 + TypeScript 단계 통과 확인.
- Troubleshooting:
  - Issue: Vercel 배포가 TypeScript 에러로 실패.
  - Cause: nullable 타입(`string | null`) 값을 `HTMLImageElement.src`에 직접 할당.
  - Fix: non-null 값으로 좁혀진 지역 상수를 사용해 타입 안정성 확보.
- Tech stack/tools used:
  - Vercel CLI (`vercel ls`, `vercel inspect --logs`)
  - Next.js build (`next build`)
  - TypeScript
- Usage notes or commands:
  - `npx vercel ls photo_blog --yes`
  - `npx vercel inspect https://photoblog-6uhw4803j-coldbrews-projects-fc2159b4.vercel.app --logs`
  - `npm run build`
- Next action:
  - 수정 커밋 후 push하여 Vercel 재배포 실행, 최신 deployment status가 `Ready`인지 확인.

## 2026-03-01 14:57 KST - 업로드/AI 추천 중 브라우저 URL 패턴 예외 방어

- Date/time: 2026-03-01 14:57 KST
- Goal: 업로드 플로우에서 `The string did not match the expected pattern.`가 발생해 AI 추천이 중단되는 케이스를 방어.
- Steps taken:
  - Vercel CLI로 운영 로그 확인:
    - `npx vercel logs ... --json` 조회
    - `POST /api/admin/photos/ai-suggest`는 200 확인
    - `GET /api/admin/photos`의 413 현상은 별도 이슈로 확인
  - `src/app/admin/upload/page.tsx` 수정:
    - `createAiSuggestionImage`에서 `URL.createObjectURL`/이미지 디코딩 실패 시 예외를 던지지 않고 원본 파일로 폴백.
    - blob URL revoke를 null-safe로 정리.
  - `src/components/photo-detail-shell.tsx` 수정:
    - 동일한 `createAiSuggestionImage` 폴백 처리 적용.
  - 보안 정리:
    - 점검용으로 pull한 `.env.vercel.production` 파일 삭제.
  - 검증 실행:
    - `npm run lint`
    - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
- Troubleshooting:
  - Issue: 브라우저에서 `The string did not match the expected pattern.` 예외로 AI 추천 동작 중단.
  - Cause: 이미지 전처리 단계(Blob URL 생성/디코딩)에서 브라우저 환경별 예외 발생 가능.
  - Fix: 전처리 실패 시 요청 자체를 실패시키지 않고 원본 파일 업로드 경로로 자동 폴백.
- Tech stack/tools used:
  - Vercel CLI (`vercel logs`, `vercel inspect`, `vercel env pull`)
  - Next.js client components
  - Vitest
  - ESLint
- Usage notes or commands:
  - `npx vercel logs coldbrew-log.vercel.app --since 2h --no-follow --json`
  - `npm run lint`
  - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
- Next action:
  - 운영에서 동일 업로드 시나리오 재시도 후, 동일 문구 재발 시 시각(분 단위) 기준으로 serverless function log를 추가 추적.

## 2026-03-01 14:48 KST - Vercel 빌드 실패(TypeScript + Vitest config) 수정

- Date/time: 2026-03-01 14:48 KST
- Goal: Vercel 배포 빌드에서 `vitest.config.ts` 타입 에러(`environmentMatchGlobs` 미지원)로 실패하는 문제 해결.
- Steps taken:
  - `vitest.config.ts`에서 `test.environmentMatchGlobs` 옵션 제거.
  - 이미 각 컴포넌트 테스트 파일에 `@vitest-environment jsdom` 지시자가 있어 환경 분기 동작은 유지됨을 확인.
  - 로컬 빌드 검증 실행: `npm run build`.
- Troubleshooting:
  - Issue: Next.js TypeScript 단계에서 `InlineConfig` 타입에 `environmentMatchGlobs` 속성이 없다는 컴파일 에러 발생.
  - Cause: 현재 설치된 Vitest 버전/타입 정의에서 해당 옵션이 지원되지 않음.
  - Fix: 비필수 옵션 제거 후 파일 단위 환경 지시자 방식으로 유지.
- Tech stack/tools used:
  - Next.js 16 build
  - Vitest config
  - TypeScript
- Usage notes or commands:
  - `npm run build`
- Next action:
  - 동일 커밋 재배포 후 Vercel 빌드 로그에서 TypeScript 단계 통과 여부 확인.

## 2026-03-01 14:40 KST - AI 추천 `reasoning-only incomplete` 재발 대응 (compact rescue)

- Date/time: 2026-03-01 14:40 KST
- Goal: `Empty model response (status=incomplete, output_types=reasoning, content_types=none)` 재발 시에도 AI 메타데이터 추천이 성공하도록 안정성 강화.
- Steps taken:
  - `src/app/api/admin/photos/ai-suggest/route.ts` 수정:
    - 사용자 추가 프롬프트 최대 길이를 600자→240자로 축소.
    - 프롬프트 빌더를 `full`/`compact` 모드로 분리.
    - 일반 재시도(기존 토큰 budget) 실패 후, `compact` 지시 + reasoning 미포함 요청으로 1회 rescue 재시도 경로 추가.
    - 마지막 budget 실패 시 즉시 throw하지 않고 rescue 분기로 진입하도록 제어 흐름 수정.
  - `src/app/api/admin/photos/ai-suggest/route.test.ts` 보강:
    - 3회 연속 `incomplete/reasoning-only` 후 compact rescue 호출로 성공하는 시나리오 테스트 추가.
  - 검증 실행:
    - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
    - `npm run lint`
- Troubleshooting:
  - Issue: 재시도 로직이 있어도 마지막 시도에서 throw되어 rescue 경로가 실행되지 않음.
  - Cause: 마지막 토큰 budget에서 `throw`로 함수가 즉시 종료되는 제어 흐름.
  - Fix: 마지막 시도 실패 시 `break` 후 rescue 분기 실행으로 변경.
- Tech stack/tools used:
  - Next.js Route Handler
  - OpenAI Responses API (`gpt-5-nano`)
  - Vitest
  - ESLint
- Usage notes or commands:
  - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
  - `npm run lint`
- Next action:
  - 운영에서 동일 이미지 + 추가 프롬프트로 재시도해 502 재발 여부 확인, 재발 시 요청/응답 `openaiRequestId` 기반 샘플 축적.

## 2026-03-01 14:34 KST - AI 추천에 사용자 추가 프롬프트 입력 기능 추가

- Date/time: 2026-03-01 14:34 KST
- Goal: 이미지 기반 AI 메타데이터 추천 시 사용자가 추가 지시(prompt)를 직접 입력해 결과를 제어할 수 있도록 개선.
- Steps taken:
  - `src/app/api/admin/photos/ai-suggest/route.ts` 수정:
    - FormData에서 `prompt` 필드 수신.
    - `sanitizeUserPrompt` 추가(최대 600자, trim)로 안전한 입력만 모델 프롬프트에 반영.
    - 모델 입력 텍스트에 `Additional user guidance: ...` 문구로 사용자 지시 병합.
  - `src/app/admin/upload/page.tsx` 수정:
    - `AI 추가 프롬프트 (선택)` 텍스트영역 UI 추가.
    - AI 추천 요청 시 `formData.set("prompt", aiPrompt.trim())` 전송.
  - `src/components/photo-detail-shell.tsx` 수정:
    - 편집 모달 내 `AI 추가 프롬프트 (선택)` 입력 UI 추가.
    - AI 재추천 요청 시 `prompt` 값 포함 전송.
  - 테스트 보강:
    - `src/app/api/admin/photos/ai-suggest/route.test.ts`에 사용자 prompt가 실제 모델 instruction에 포함되는지 검증 케이스 추가.
  - 검증 실행:
    - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
    - `npm run lint`
- Troubleshooting:
  - Troubleshooting: none.
- Tech stack/tools used:
  - Next.js App Router (route handler + client components)
  - OpenAI Responses API prompt composition
  - Vitest
  - ESLint
- Usage notes or commands:
  - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
  - `npm run lint`
- Next action:
  - 운영에서 실제 이미지로 추가 프롬프트 적용 결과를 확인하고, 필요 시 프롬프트 템플릿(예: 톤/태그 우선순위) 예시를 UI 도움말로 확장.

## 2026-03-01 14:01 KST - Admin Photos 목록 413(payload too large) 대응

- Date/time: 2026-03-01 14:01 KST
- Goal: `/api/admin/photos` 호출 시 Vercel `FUNCTION_PAYLOAD_TOO_LARGE (413)`로 인해 관리자 목록 로딩이 실패하는 문제 해결.
- Steps taken:
  - `src/app/api/admin/photos/route.ts` GET 응답 경량화:
    - 선택 컬럼을 목록 화면에 필요한 최소 필드(`id, slug, title, taken_at`)로 축소.
    - `limit` 쿼리 파라미터 처리 추가(기본 300, 최대 1000).
    - 응답에 `meta.limit`, `meta.truncated` 포함.
  - `src/app/admin/photos/page.tsx` 에러 처리 보강:
    - JSON이 아닌 에러 본문(예: Vercel plain-text 413)도 안전 처리하는 `parseJsonSafely` 추가.
    - 요청 URL을 `/api/admin/photos?limit=300`으로 변경.
    - 목록 타입을 페이지 전용 `AdminPhotoListItem`으로 분리해 실제 사용 필드만 처리.
  - `src/app/api/admin/photos/route.test.ts` 업데이트:
    - GET 응답 기대값을 경량 목록 구조에 맞게 수정.
    - `limit` 호출 검증 추가.
  - 검증 실행:
    - `npm test -- src/app/api/admin/photos/route.test.ts`
    - `npm test`
    - `npm run lint`
- Troubleshooting:
  - Issue: 관리자 화면에서 `Unexpected token 'R'... is not valid JSON` 발생.
  - Cause: 서버가 413 텍스트 응답을 반환했는데, 클라이언트가 무조건 `response.json()`으로 파싱.
  - Fix: 서버 응답 크기 자체를 줄이고, 클라이언트에 비-JSON 에러 파싱 안전장치 추가.
- Tech stack/tools used:
  - Next.js Route Handler / Client Page
  - Supabase query chaining (`select`, `order`, `limit`)
  - Vitest, ESLint
- Usage notes or commands:
  - `npm test -- src/app/api/admin/photos/route.test.ts`
  - `npm test`
  - `npm run lint`
- Next action:
  - 운영에서 `/admin/photos` 재진입 테스트 후, 데이터가 300개를 초과하는 경우 페이지네이션(Load more) UI 추가 검토.

## 2026-03-01 13:50 KST - AI 추천 라우트 fallback 제거 및 gpt-5-nano 실호출 검증

- Date/time: 2026-03-01 13:50 KST
- Goal: AI 메타데이터 추천 경로에서 모델 fallback을 제거하고 `gpt-5-nano` 이미지 입력이 실제로 정상 동작하는지 직접 검증.
- Steps taken:
  - `src/app/api/admin/photos/ai-suggest/route.ts` 수정:
    - fallback 관련 로직(`buildModelCandidates`, `shouldFallbackModel`) 제거.
    - 단일 모델(`getSuggestionModel`)만 사용하도록 호출 경로 단순화.
    - 기본 모델 값을 `gpt-5-nano`로 변경.
  - `src/app/api/admin/photos/ai-suggest/route.test.ts` 수정:
    - fallback 검증 테스트 삭제.
    - 동일 모델 재시도(첫 응답 `incomplete/reasoning-only`, 두 번째 응답 성공) 검증 테스트로 교체.
  - 임시 이미지 생성 후 OpenAI Responses API 실호출 테스트 수행:
    - 최초 1x1 PNG 요청 실패 원인 확인.
    - `sharp`로 JPEG 생성 후 `model=gpt-5-nano`로 재호출.
    - HTTP 200 / `status=completed` / 메시지 텍스트(JSON) 수신 확인.
  - 검증 실행:
    - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
    - `npm test`
    - `npm run lint`
- Troubleshooting:
  - Issue: 실호출 첫 시도에서 `invalid_request_error`와 함께 이미지 유효성 오류 발생.
  - Cause: 테스트용 1x1 PNG 데이터가 API에서 유효 이미지로 인정되지 않음.
  - Fix: `sharp`로 256x256 JPEG를 생성해 동일 요청 재실행, 정상 응답 확인.
- Tech stack/tools used:
  - Next.js Route Handler
  - OpenAI Responses API (`gpt-5-nano`)
  - Node.js (`fetch`), `sharp`
  - Vitest, ESLint
- Usage notes or commands:
  - `node --env-file=.env.local -e '...'` (Responses API 직접 호출)
  - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
  - `npm test`
  - `npm run lint`
- Next action:
  - 관리자 업로드 화면에서 동일 이미지로 `AI로 메타데이터 추천` 재시도 후 운영 로그의 실패 빈도(특히 `incomplete` 재발) 추적.

## 2026-03-01 13:46 KST - AI 메타데이터 추천 `reasoning-only incomplete` 오류 대응

- Date/time: 2026-03-01 13:46 KST
- Goal: `/api/admin/photos/ai-suggest`에서 `Empty model response (status=incomplete, output_types=reasoning, content_types=none)` 오류가 발생할 때 자동 복구되도록 안정화.
- Steps taken:
  - `src/app/api/admin/photos/ai-suggest/route.ts` 분석 후 재시도/파싱 로직 점검.
  - 모델별 토큰 예산 함수(`getTokenBudgets`) 추가:
    - `gpt-5` 계열: `[800, 2400, 6000]`
    - 그 외 모델: `[320, 960, 2400]`
  - 모델 후보 체인(`buildModelCandidates`) 추가:
    - 우선 `OPENAI_VISION_MODEL` 사용
    - 실패 시 자동으로 기본 모델 `gpt-4.1-mini` 폴백
  - `callVisionModelWithModel` / `callVisionModel` 분리로 요청 재시도와 모델 폴백을 독립 처리.
  - 치명적 인증 에러(401/403)는 폴백하지 않도록 `shouldFallbackModel` 조건 추가.
  - 회귀 테스트 추가: `src/app/api/admin/photos/ai-suggest/route.test.ts`
    - `gpt-5-mini`가 반복적으로 `incomplete + reasoning`만 반환하는 상황을 모킹
    - `gpt-4.1-mini` 폴백 후 정상 JSON 추천값 반환 검증
  - 검증 실행:
    - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
    - `npm test`
    - `npm run lint`
- Troubleshooting:
  - Issue: AI 추천 시 모델이 텍스트 출력 없이 reasoning만 반환하며 `incomplete` 상태로 종료.
  - Cause: 특정 모델(`gpt-5` 계열 설정 시)에서 토큰 한도 내 최종 텍스트 출력이 생성되지 않는 케이스 발생.
  - Fix: 모델별 재시도 토큰 상향 + 기본 모델 폴백 경로 추가로 자동 복구.
- Tech stack/tools used:
  - Next.js Route Handler
  - OpenAI Responses API
  - Vitest
  - ESLint
- Usage notes or commands:
  - `npm test -- src/app/api/admin/photos/ai-suggest/route.test.ts`
  - `npm test`
  - `npm run lint`
- Next action:
  - 운영 환경에서 `OPENAI_VISION_MODEL` 값 확인 후 필요 시 `gpt-4.1-mini` 고정 또는 `gpt-5` 유지 + 모니터링 정책 결정.

## 2026-03-01 13:41 KST - 테스트 스위트 전면 구축 (Vitest)

- Date/time: 2026-03-01 13:41 KST
- Goal: 프로젝트 주요 로직/라우트/클라이언트 컴포넌트에 대한 실행 가능한 테스트 코드를 일괄 추가하고 CI 수준으로 검증 가능하게 구성.
- Steps taken:
  - 테스트 러너 및 라이브러리 설치: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.
  - `package.json`에 테스트 스크립트 추가: `test`, `test:watch`, `test:coverage`.
  - 테스트 설정 파일 추가: `vitest.config.ts`, `vitest.setup.ts`.
  - 테스트 fixture 추가: `src/test/fixtures.ts`.
  - 테스트 파일 추가:
    - `src/lib/image-resolution.test.ts`
    - `src/lib/photos.test.ts`
    - `src/lib/admin-auth-server.test.ts`
    - `src/app/api/photos/route.test.ts`
    - `src/app/api/photos/graph/route.test.ts`
    - `src/app/api/photos/[slug]/download/route.test.ts`
    - `src/app/api/admin/session/route.test.ts`
    - `src/app/api/admin/photos/route.test.ts`
    - `src/app/api/admin/photos/[slug]/route.test.ts`
    - `src/app/api/admin/photos/ai-suggest/route.test.ts`
    - `src/components/photo-card.test.tsx`
    - `src/components/masonry-feed.test.tsx`
    - `src/components/home-nav-drawer.test.tsx`
    - `src/components/admin-auth-actions.test.tsx`
  - `vi.mock` 호이스팅 이슈를 `vi.hoisted` 패턴으로 정리해 안정적으로 모듈 목(mock) 동작하도록 수정.
  - 컴포넌트 테스트에 `// @vitest-environment jsdom` 지정 및 `localStorage` mock 보완.
  - 검증 실행: `npm test`, `npm run lint` 통과.
- Troubleshooting:
  - Issue: 초기 테스트 실행 시 다수 파일에서 `Cannot access '<mock>' before initialization` 에러 발생.
  - Cause: `vi.mock`가 호이스팅되며 top-level `const` mock 참조 시 초기화 순서 충돌.
  - Fix: 목 객체를 `vi.hoisted`로 선언하고 해당 참조를 모듈 팩토리에 주입.
  - Issue: 컴포넌트 테스트에서 `window/document/localStorage` 관련 실패 발생.
  - Cause: 테스트 환경이 Node로 잡히거나 환경별 `localStorage` 구현 차이 존재.
  - Fix: 각 컴포넌트 테스트 파일에 `jsdom` 환경을 명시하고 `localStorage`를 테스트용 mock으로 주입.
- Tech stack/tools used:
  - Next.js + TypeScript
  - Vitest (v4), Testing Library, jsdom
  - ESLint
  - Shell: `npm`, `date`
- Usage notes or commands:
  - `npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`
  - `npm test`
  - `npm run lint`
- Next action:
  - PR/CI 파이프라인에 `npm test`를 필수 체크로 연결하고, 필요 시 `test:coverage` 기준(예: line/branch threshold) 설정.

## 2026-02-22 - AGENTS.md에 글로벌 에이전트 규칙 추가

- 목표: Workflow Orchestration, Task Management, Core Principles를 AGENTS.md에 반영.
- 수행 단계:
  - AGENTS.md 하단에 다음 섹션 추가: Workflow Orchestration (Plan Mode, Subagent Strategy, Self-Improvement Loop, Verification Before Done, Demand Elegance, Autonomous Bug Fixing), Task Management (tasks/todo.md, tasks/lessons.md), Core Principles (Simplicity First, No Laziness, Minimal Impact).
- 트러블슈팅: none.
- 사용 기술/도구: 편집기.
- 사용 메모/명령어: 없음.
- 다음 액션: 필요 시 tasks/todo.md, tasks/lessons.md 디렉터리/파일 생성.

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

## 2026-02-21 - Vercel 환경변수 동기화 + 프로덕션 재배포

- 일시:
  - 2026-02-21T00:00:00Z
- 목표:
  - 로컬 `.env.local`에 추가된 `OPENAI_API_KEY`, `OPENAI_VISION_MODEL` 값을 Vercel 환경(`development/preview/production`)에 반영하고 프로덕션 배포에 적용한다.
- 수행 단계:
  - Vercel 로그인 상태를 확인했다(`npx vercel whoami`).
  - `.env.local` 값을 터미널 내부에서만 로드해 값 출력 없이 `OPENAI_API_KEY`, `OPENAI_VISION_MODEL`을 `development`, `preview`, `production`에 추가했다.
  - `npx vercel --prod --yes`로 프로덕션 재배포를 실행했다.
  - 배포 완료 후 프로덕션 URL과 alias 연결을 확인했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - Vercel CLI (`npx vercel`)
  - 쉘 환경변수 로드(`source .env.local`)
- 사용 메모/명령어:
  - `npx vercel whoami`
  - `npx vercel env add OPENAI_API_KEY <development|preview|production>`
  - `npx vercel env add OPENAI_VISION_MODEL <development|preview|production>`
  - `npx vercel --prod --yes`
- 다음 액션:
  - 프로덕션에서 OAuth 로그인/리다이렉트와 AI 제안 API 동작을 실제 계정으로 검증한다.

## 2026-02-21 - 관리자 권한 불일치 대응 (Allowlist 재동기화)

- 일시:
  - 2026-02-21T00:00:00Z
- 목표:
  - 프로덕션에서 관리자 편집 시 권한 부족으로 차단되는 문제를 완화하기 위해 `ADMIN_ALLOWED_EMAILS`를 Vercel 환경과 재동기화하고 재배포한다.
- 수행 단계:
  - 로컬 `.env.local`의 `ADMIN_ALLOWED_EMAILS` 값을 출력 없이 로드했다.
  - Vercel `development`, `preview`, `production` 환경의 `ADMIN_ALLOWED_EMAILS`를 교체 추가했다.
  - `npx vercel --prod --yes`로 프로덕션 재배포를 실행하고 alias 반영을 확인했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - Vercel CLI (`npx vercel`)
  - 쉘 환경변수 로드 (`source .env.local`)
- 사용 메모/명령어:
  - `npx vercel env add ADMIN_ALLOWED_EMAILS <development|preview|production>`
  - `npx vercel --prod --yes`
- 다음 액션:
  - 대상 GitHub 계정으로 재로그인 후 `/photo/sushi`에서 상세 편집 모달 저장(PATCH) 동작을 검증한다.

## 2026-02-21 - 상세 편집 권한 상태 불일치 완화

- 일시:
  - 2026-02-21T00:00:00Z
- 목표:
  - `/admin/photos`에서 상세 페이지로 이동한 뒤 편집/삭제 시 관리자 권한 오류가 발생하는 상태 불일치를 완화한다.
- 수행 단계:
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/admin-auth-client.ts`의 관리자 세션 조회 요청에 `cache: "no-store"`를 추가해 stale 권한 응답 사용을 줄였다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/app/admin/photos/page.tsx` 목록 조회 요청에 `cache: "no-store"`를 추가했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/components/photo-detail-shell.tsx`에 `verifyAdminSession`을 추가하고 저장/삭제 직전에 서버 권한을 재검증하도록 반영했다.
  - 상세 저장/삭제 API 응답이 401/403일 때 사용자에게 재로그인 안내 메시지를 명시적으로 표시하도록 에러 처리 메시지를 보강했다.
  - lint/build 검증을 수행했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - Next.js App Router
  - Fetch 캐시 제어 (`cache: no-store`)
  - ESLint / Next build
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
- 다음 액션:
  - 프로덕션에서 `/admin/photos -> /photo/<slug>` 경로로 이동해 편집 저장이 정상 동작하는지 재검증한다.

## 2026-02-21 - 상세 편집 토큰 최신화 적용

- 일시:
  - 2026-02-21T00:00:00Z
- 목표:
  - `/admin/photos -> /photo/[slug]` 경로에서 상세 편집 시 권한 오류가 발생하는 문제를 완화하기 위해 수정 요청 시 최신 access token을 사용한다.
- 수행 단계:
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/admin-auth-client.ts`에 `getCurrentAccessToken()` 헬퍼를 추가해 클라이언트에서 최신 세션 토큰을 직접 조회할 수 있게 했다.
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/components/photo-detail-shell.tsx`에서 저장/삭제 요청 직전에 `getCurrentAccessToken()`으로 토큰을 다시 가져오도록 수정했다.
  - 상세 페이지의 사전 `/api/admin/session` 재검증 호출을 제거해 false negative 가능성을 줄였다.
  - lint/build 검증 후 프로덕션 재배포를 수행했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - Supabase 클라이언트 세션 조회
  - Next.js App Router
  - ESLint / Next build
  - Vercel CLI
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
  - `npx vercel --prod --yes`
- 다음 액션:
  - 프로덕션에서 동일 경로로 상세 편집 저장을 재검증하고, 실패 시 PATCH 응답의 상태코드/본문 에러를 확인한다.

## 2026-02-21 - 관리자 세션 상태 레이스 방지

- 일시:
  - 2026-02-21T00:00:00Z
- 목표:
  - 관리자 페이지/상세 페이지 전환 중 `isAdmin` 상태가 잘못 false로 덮이는 비동기 레이스를 방지한다.
- 수행 단계:
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/lib/admin-auth-client.ts`에 요청 시퀀스(`syncRequestIdRef`)를 추가했다.
  - `onAuthStateChange` 동기화와 `refreshAdminStatus`에서 최신 요청 결과만 반영하도록 가드 조건을 추가했다.
  - lint/build 검증 후 프로덕션 재배포를 수행했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - React `useRef` 기반 비동기 레이스 가드
  - ESLint / Next build
  - Vercel CLI
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
  - `npx vercel --prod --yes`
- 다음 액션:
  - `/admin/photos -> 상세/수정` 흐름에서 편집 저장 권한 오류 재발 여부를 확인한다.

## 2026-02-21 - 상세 Edit 클릭 시 뒤로 이동되는 버그 수정

- 일시:
  - 2026-02-21T00:00:00Z
- 목표:
  - 상세 페이지의 `Edit/Delete` 클릭이 배경 클릭으로 오인되어 이전 페이지(`/admin/photos`)로 돌아가는 동작을 수정한다.
- 수행 단계:
  - `/Users/coldbrew/Documents/photo_blog/photo_blog/src/components/photo-detail-shell.tsx`의 배경 클릭 핸들러를 수정했다.
  - 편집/삭제 모달이 열린 상태에서는 배경 닫기 로직이 실행되지 않도록 가드했다.
  - 상단 액션 영역과 모달 컨테이너에 `data-prevent-detail-close="true"`를 추가하고, 해당 영역 클릭은 상세 닫기 로직에서 제외했다.
  - lint/build 검증 후 프로덕션 재배포를 수행했다.
- 트러블슈팅: 없음
- 사용 기술/도구:
  - React 이벤트 처리
  - Next.js App Router
  - ESLint / Next build
  - Vercel CLI
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
  - `npx vercel --prod --yes`
- 다음 액션:
  - `/admin/photos -> 상세/수정 -> Edit` 클릭 시 더 이상 목록으로 돌아가지 않는지 확인한다.

## 2026-02-21 - AI 메타데이터 추천 payload 초과 완화

- 일시:
  - 2026-02-21T15:48:43Z
- 목표:
  - 관리자 업로드에서 AI 메타데이터 추천 호출 시 `FUNCTION_PAYLOAD_TOO_LARGE` 오류를 줄이기 위해 AI 요청 이미지 크기를 축소한다.
- 수행 단계:
  - `src/app/admin/upload/page.tsx`에 AI 추천 전용 이미지 변환 로직(`createAiSuggestionImage`)을 추가했다.
  - AI 추천 요청 파일을 원본 대신 축소/압축본으로 교체했다.
  - 장축 기준을 1000px로 적용해 AI 요청 payload를 안정적으로 낮췄다.
  - `src/app/api/admin/photos/ai-suggest/route.ts`의 파일 제한값을 4MB로 조정해 서버 검증 기준을 현실화했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: AI 추천 호출 시 `Request Entity Too Large` / `FUNCTION_PAYLOAD_TOO_LARGE` 발생.
  - 원인: 원본 고해상도 이미지를 multipart로 그대로 전달해 함수 요청 본문 제한을 초과.
  - 해결: 클라이언트에서 AI 전송용 이미지를 장축 1000px로 리사이즈 + JPEG 압축 후 전송.
- 사용 기술/도구:
  - Next.js App Router
  - 브라우저 Canvas API (`canvas.toBlob`)
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 프로덕션에서 `/admin/upload` AI 추천 버튼으로 대용량 이미지 테스트 후 오류 재발 여부를 확인한다.

## 2026-02-21 - 파일 선택 시 AI 자동 추천 비활성화

- 일시:
  - 2026-02-21T15:51:43Z
- 목표:
  - 이미지 선택 직후 자동으로 AI 메타데이터 추천이 실행되지 않도록 하고, 버튼 클릭 시에만 추천을 시작한다.
- 수행 단계:
  - `src/app/admin/upload/page.tsx`의 `onFileChange`에서 `requestAiSuggestion` 자동 호출 구문을 제거했다.
  - 파일 선택 시에는 EXIF/해상도 추출만 수행하고, 추천은 `AI로 메타데이터 추천` 버튼에서만 실행되도록 유지했다.
  - `npm run lint`로 정적 검증을 수행했다.
- Troubleshooting: none
- 사용 기술/도구:
  - React (Next.js App Router, Client Component state/event handling)
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/admin/upload`에서 파일 선택 직후 네트워크 요청이 발생하지 않는지 확인하고, 버튼 클릭 시에만 `/api/admin/photos/ai-suggest`가 호출되는지 검증한다.

## 2026-02-21 - 업로드 이미지 장기 캐시 헤더 적용

- 일시:
  - 2026-02-21T15:53:44Z
- 목표:
  - 페이지 재방문 시 이미지 로딩 속도를 높이기 위해 브라우저 캐시 재사용률을 높인다.
- 수행 단계:
  - `src/app/api/admin/photos/route.ts`의 Supabase Storage 업로드 옵션에 `cacheControl: "31536000"`을 추가했다.
  - 타임스탬프 포함 파일명과 결합되어 immutable 성격의 장기 캐시 운용이 가능하도록 정리했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Supabase Storage upload options (`cacheControl`)
  - Next.js API Route
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 신규 업로드 이미지에 대해 브라우저 DevTools 네트워크에서 `Cache-Control` 응답/재방문시 캐시 히트 여부를 확인한다.

## 2026-02-21 - AI 추천 모델 이미지 미지원 시 자동 fallback 추가

- 일시:
  - 2026-02-21T16:00:52Z
- 목표:
  - `OPENAI_VISION_MODEL`이 이미지 입력 미지원 모델로 설정된 경우에도 AI 메타데이터 추천이 동작하도록 안정성을 높인다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`에 `shouldRetryWithDefaultModel` 헬퍼를 추가했다.
  - OpenAI Responses 호출을 내부 함수(`requestSuggestion`)로 분리하고, 1차 호출 실패 시 에러 메시지를 검사해 이미지 미지원 패턴일 때 `gpt-4.1-mini`로 자동 재시도하도록 변경했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: `/api/admin/photos/ai-suggest` 호출 시 502 응답으로 추천 실패.
  - 원인: 이미지 입력 미지원 모델(예: `gpt-5-nano`)이 `OPENAI_VISION_MODEL`로 설정되면 OpenAI API 에러가 발생.
  - 해결: 이미지 미지원 에러 시 기본 비전 모델(`gpt-4.1-mini`)로 자동 fallback 재시도.
- 사용 기술/도구:
  - Next.js Route Handler
  - OpenAI Responses API
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/admin/upload`에서 `AI로 메타데이터 추천` 버튼 테스트로 fallback 동작 여부를 확인하고, 필요하면 UI에 "fallback 사용" 안내 문구를 추가한다.

## 2026-02-21 - AI 추천 fallback 로직 제거

- 일시:
  - 2026-02-21T16:06:05Z
- 목표:
  - `OPENAI_VISION_MODEL` 단일 설정값만 사용하도록 AI 추천 라우트를 단순화한다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`에서 fallback 판별 헬퍼(`shouldRetryWithDefaultModel`)를 제거했다.
  - OpenAI 호출 흐름을 단일 모델 호출 방식으로 되돌리고, 실패 시 기존처럼 에러를 그대로 반환하도록 정리했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: fallback 로직 도입 후 운영 의도(지정 모델 고정)와 동작이 달라질 수 있음.
  - 원인: 이미지 미지원 에러 시 자동으로 다른 모델로 재시도하도록 구현됨.
  - 해결: fallback 재시도 제거, `OPENAI_VISION_MODEL`만 사용.
- 사용 기술/도구:
  - Next.js Route Handler
  - OpenAI Responses API
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/api/admin/photos/ai-suggest` 실패 시 응답 본문의 `error` 메시지를 기준으로 모델/권한/요청 포맷을 직접 점검한다.

## 2026-02-21 - AI 추천 502 원인 추적용 진단 정보 확장

- 일시:
  - 2026-02-21T16:07:28Z
- 목표:
  - `/api/admin/photos/ai-suggest`의 502 실패 시 OpenAI 업스트림 원인을 즉시 파악할 수 있도록 오류 가시성을 높인다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`에 `OpenAiRequestError` 및 payload 타입을 추가했다.
  - OpenAI 비정상 응답 시 `status`, `type`, `code`, `param`, `x-request-id`, `model`을 수집해 커스텀 에러로 throw하도록 변경했다.
  - 라우트 catch에서 해당 진단 정보를 JSON 응답(`openaiStatus`, `openaiType`, `openaiCode` 등)으로 반환하고 서버 로그에 구조화 출력하도록 추가했다.
  - 모델 출력이 JSON이 아닐 때 원문 일부를 포함해 파싱 실패 원인을 확인할 수 있도록 `extractJsonFromText` 오류 메시지를 개선했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: 클라이언트 콘솔에서 502만 확인되어 실제 실패 원인 식별이 어려움.
  - 원인: 서버가 OpenAI 업스트림 에러를 단순 메시지로 래핑해 반환.
  - 해결: 업스트림 에러의 구조화 필드와 요청 ID를 응답/로그에 포함하도록 확장.
- 사용 기술/도구:
  - Next.js Route Handler
  - OpenAI Responses API
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 브라우저 DevTools 네트워크에서 `/api/admin/photos/ai-suggest` 응답 JSON의 `openaiStatus/openaiType/openaiCode/openaiRequestId` 값을 확인해 실패 원인을 확정한다.

## 2026-02-21 - 업로드 UI에 AI 실패 상세 표시 추가

- 일시:
  - 2026-02-21T16:14:32Z
- 목표:
  - AI 추천 실패 시 브라우저 네트워크 탭을 열지 않아도 원인 필드를 즉시 확인할 수 있게 한다.
- 수행 단계:
  - `src/app/admin/upload/page.tsx`에 `AiSuggestErrorResponse` 타입을 추가했다.
  - `/api/admin/photos/ai-suggest` 비정상 응답 처리에서 `openaiType/openaiCode/openaiStatus/model/openaiRequestId`를 에러 메시지에 결합해 표시하도록 변경했다.
  - 동일 payload를 `console.error`로 출력해 디버깅 가시성을 높였다.
  - `npm run lint`로 정적 검증을 수행했다.
- Troubleshooting: none
- 사용 기술/도구:
  - React (error handling/UI status messaging)
  - TypeScript 타입 확장
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/admin/upload`에서 추천 버튼 클릭 후 에러 메시지에 노출되는 `type/code/status/model/request_id`로 OpenAI 업스트림 실패 사유를 확정한다.

## 2026-02-21 - Empty model response 진단 및 JSON 출력 강제

- 일시:
  - 2026-02-21T16:16:48Z
- 목표:
  - `Empty model response` 발생 시 원인 필드를 더 정확히 확인하고, 모델 출력이 안정적으로 JSON으로 오도록 호출 포맷을 강화한다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`의 `readOutputText`를 확장해 `refusal`, `output type`, `content type`, `status`를 수집하도록 수정했다.
  - 텍스트가 비어 있을 때 기존 고정 메시지 대신 구조화된 진단 문자열(`status`, `output_types`, `content_types`)로 에러를 발생시키도록 변경했다.
  - OpenAI Responses 요청에 `text.format.type = "json_object"`를 추가해 JSON 출력 형식을 강제했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: `/api/admin/photos/ai-suggest`에서 `{"error":"Empty model response"}` 반환.
  - 원인: 모델 응답에 텍스트가 비어 있을 때 원인 정보가 손실되어 상세 분류가 불가능.
  - 해결: 빈 응답의 내부 구조를 에러 메시지로 노출하고 JSON 출력 포맷을 명시해 안정성 개선.
- 사용 기술/도구:
  - OpenAI Responses API (`text.format`)
  - Next.js Route Handler
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/admin/upload`에서 재시도 후 에러 메시지의 `status/output_types/content_types` 또는 성공 응답 여부를 확인한다.

## 2026-02-21 - reasoning-only incomplete 응답 자동 재시도 추가

- 일시:
  - 2026-02-21T16:17:49Z
- 목표:
  - `status=incomplete` + `output_types=reasoning`로 종료되는 케이스에서 최종 JSON 출력 획득률을 높인다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`에 `isReasoningOnlyIncomplete` 판별 함수를 추가했다.
  - OpenAI 호출을 `requestOnce(maxOutputTokens)`로 분리해 1차 `300` 토큰 호출 후 reasoning-only incomplete면 `900` 토큰으로 1회 자동 재시도하도록 변경했다.
  - 기존 단일 호출 에러 처리(`OpenAiRequestError`)는 유지하면서 재시도 흐름과 결합했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: 응답이 `{"error":"Empty model response (status=incomplete, output_types=reasoning, content_types=none)"}`로 실패.
  - 원인: 모델이 추론 단계에서 토큰 한도에 도달해 최종 메시지(JSON)를 생성하지 못하고 중단.
  - 해결: 해당 패턴 탐지 시 `max_output_tokens`를 확장해 1회 재시도.
- 사용 기술/도구:
  - OpenAI Responses API
  - Next.js Route Handler
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/admin/upload`에서 동일 이미지로 재시도해 성공률을 확인하고, 필요 시 기본 `max_output_tokens` 상향 또는 reasoning 설정 추가를 검토한다.

## 2026-02-21 - AI 추천 언어 정책 조정 (한글 제목/태그, 캡션 선택)

- 일시:
  - 2026-02-21T16:19:47Z
- 목표:
  - AI 메타데이터 추천 결과를 한글 중심으로 맞추고, 캡션 자동 생성 의존도를 낮춘다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts` 프롬프트를 조정해 제목은 한글 위주, 태그는 한글 3~8개로 요청하도록 변경했다.
  - 같은 프롬프트에 캡션은 선택 항목이며 필요 없으면 빈 문자열을 반환하도록 명시했다.
  - `parseSuggestion` 검증을 변경해 제목만 필수로 두고 캡션은 빈 문자열도 허용하도록 수정했다.
  - `npm run lint`로 정적 검증을 수행했다.
- Troubleshooting: none
- 사용 기술/도구:
  - OpenAI Responses API prompt tuning
  - Next.js Route Handler
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/admin/upload`에서 AI 추천 실행 후 제목/태그의 한글 출력 품질을 확인하고, 필요 시 태그 표기 규칙(공백/하이픈) 정규화를 추가 검토한다.

## 2026-02-21 - AI 추천에서 캡션 생성 제거

- 일시:
  - 2026-02-21T16:22:44Z
- 목표:
  - AI 추천은 제목/태그만 생성하고 캡션은 생성·반영하지 않도록 한다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`의 응답 스키마를 `title`, `tags`로 축소했다.
  - 같은 파일의 프롬프트에서 `caption` 키 요청 문구를 제거하고 JSON 키를 `title`, `tags`로 변경했다.
  - `parseSuggestion`에서 캡션 파싱을 제거했다.
  - `src/app/admin/upload/page.tsx`에서 AI 추천 결과 적용 시 캡션 값을 건드리지 않도록 `applyAiSuggestion` 로직을 수정했다.
  - 미사용 함수(`sanitizeCaption`)를 제거하고 `npm run lint`로 검증했다.
- Troubleshooting: none
- 사용 기술/도구:
  - OpenAI Responses API prompt/schema tuning
  - React state update logic
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/admin/upload`에서 추천 실행 시 Title/Tags만 자동 채워지고 Caption은 그대로 유지되는지 확인한다.

## 2026-02-21 - 관리자 화면 홈 아이콘 버튼 추가

- 일시:
  - 2026-02-21T16:26:02Z
- 목표:
  - 관리자 화면에서 메인 홈(`/`)으로 빠르게 이동할 수 있는 UI를 제공한다.
- 수행 단계:
  - `src/app/admin/upload/page.tsx` 헤더 우측 액션 영역에 집 모양 아이콘 버튼(`href="/"`)을 추가했다.
  - `src/app/admin/photos/page.tsx` 헤더 우측 액션 영역에도 동일한 홈 아이콘 버튼을 추가했다.
  - 두 버튼에 `aria-label="홈으로 이동"`을 적용해 접근성을 확보했다.
  - `npm run lint`로 정적 검증을 수행했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js `Link`
  - Inline SVG icon
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - `/admin/upload`, `/admin/photos`에서 홈 아이콘 버튼 클릭 시 `/`로 즉시 이동하는지 확인한다.

## 2026-02-21 - 상세 페이지 EXIF 촬영 정보 표시 확장

- 일시:
  - 2026-02-21T16:38:14Z
- 목표:
  - 사진 상세 페이지에서 태그 위에 EXIF 기반 촬영 정보(브랜드/모델/렌즈/ISO/초점거리/조리개/셔터속도)를 표시한다.
- 수행 단계:
  - `supabase/migrations/0004_add_photo_exif_lens_iso_columns.sql`를 추가해 `exif_lens_model`, `exif_iso` 컬럼을 확장했다.
  - `src/app/admin/upload/page.tsx`의 EXIF 폼 상태/자동 추출 로직에 `lensModel`, `iso`를 추가하고 업로드 `FormData`에 포함했다.
  - `src/app/admin/photos/route.ts`에서 `exifLensModel`, `exifIso`를 파싱해 DB insert 및 응답 select에 반영했다.
  - `src/lib/photos.ts`와 `src/types/photo.ts`에 EXIF 필드를 추가해 상세 페이지 데이터 경로를 확장했다.
  - `src/app/api/admin/photos/[slug]/route.ts`의 PATCH 응답 select에 EXIF 필드를 포함해 상세 수정 후 상태 일관성을 맞췄다.
  - `src/components/photo-detail-shell.tsx`에 EXIF 요약 문자열 빌더를 추가하고 태그 리스트 위에 표시하도록 렌더링을 추가했다.
  - `README.md`의 Supabase 마이그레이션 실행 순서를 최신 파일 기준으로 업데이트했다.
  - `npm run lint`로 정적 검증을 수행했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js App Router / React
  - Supabase Postgres migrations
  - Supabase Storage + Admin API routes
  - exifr
  - ESLint
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - Supabase SQL Editor에서 `supabase/migrations/0004_add_photo_exif_lens_iso_columns.sql`를 적용한 뒤 신규 업로드 이미지 상세 화면에서 EXIF 요약 표시를 확인한다.

## 2026-02-22 - Cursor 터미널 폰트 설정 적용

- 일시:
  - 2026-02-22T07:44:30Z
- 목표:
  - Antigravity에서 사용 중인 폰트와 동일하게 Cursor 터미널 폰트를 맞추고, GPU 관련 설정은 변경하지 않는다.
- 수행 단계:
  - Antigravity 사용자 설정에서 사용 중인 폰트 값을 확인했다 (`JetBrainsMonoNL Nerd Font Mono`).
  - Cursor 사용자 설정에 `terminal.integrated.fontFamily`를 추가했다.
  - 설정 파일을 다시 읽어 폰트 키가 반영되었는지 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Cursor settings.json 편집
  - `perl` one-liner
- 사용 메모/명령어:
  - `perl -0pi -e '...terminal.integrated.fontFamily...' <cursor-user-settings>`
  - `cat <cursor-user-settings>`
- 다음 액션:
  - Cursor를 재시작한 뒤 통합 터미널에서 한글/아이콘 글리프가 정상 표시되는지 확인한다.

## 2026-02-22 - Cursor 에디터 폰트 Antigravity와 동기화

- 일시:
  - 2026-02-22T07:47:00Z
- 목표:
  - Cursor 에디터 폰트를 Antigravity와 동일한 값으로 맞춘다.
- 수행 단계:
  - Antigravity 사용자 설정에서 `editor.fontFamily` 값을 재확인했다.
  - Cursor 사용자 설정에 동일한 `editor.fontFamily`를 추가했다.
  - 설정 파일을 재확인해 `editor.fontFamily`와 기존 `terminal.integrated.fontFamily`가 함께 유지되는지 검증했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Cursor settings.json 편집
  - `perl` one-liner
- 사용 메모/명령어:
  - `perl -0pi -e '...editor.fontFamily...' <cursor-user-settings>`
  - `cat <cursor-user-settings>`
- 다음 액션:
  - Cursor 재시작 후 에디터/터미널 모두 동일한 폰트로 렌더링되는지 확인한다.

## 2026-02-22 - VS Code 터미널 Nerd Font 동기화 (Antigravity 기준)

- 일시:
  - 2026-02-22T08:02:32Z
- 목표:
  - Antigravity에서 사용 중인 폰트 값을 VS Code 프로젝트 설정으로 그대로 가져와 통합 터미널에 Nerd Font가 적용되도록 맞춘다.
- 수행 단계:
  - Antigravity 사용자 설정 파일에서 폰트 문자열을 확인했다.
  - `.vscode/settings.json` 파일을 생성했다.
  - `editor.fontFamily`와 `terminal.integrated.fontFamily`에 동일한 폰트 문자열(`'JetBrainsMonoNL Nerd Font Mono', Menlo, Monaco, 'Courier New', monospace`)을 적용했다.
- Troubleshooting: none
- 사용 기술/도구:
  - VS Code workspace settings (`.vscode/settings.json`)
  - shell (`cat`, `mkdir`)
- 사용 메모/명령어:
  - `cat "$HOME/Library/Application Support/Antigravity/User/settings.json"`
  - `mkdir -p .vscode`
  - `cat > .vscode/settings.json <<'EOF' ... EOF`
- 다음 액션:
  - VS Code에서 해당 워크스페이스를 다시 열거나 통합 터미널을 새로 생성해 Nerd Font 아이콘 글리프가 정상 표시되는지 확인한다.

## 2026-02-22 - VS Code/Cursor 사용자 폰트 동시 동기화

- 일시:
  - 2026-02-22T08:04:27Z
- 목표:
  - VS Code와 Cursor 모두 Antigravity 기준 Nerd Font 값을 동일하게 적용해 에디터/통합 터미널 폰트를 일치시킨다.
- 수행 단계:
  - Cursor 사용자 설정과 VS Code 사용자 설정의 현재 폰트 상태를 확인했다.
  - 두 설정 파일의 `editor.fontFamily`, `terminal.integrated.fontFamily`를 동일한 값으로 갱신했다.
  - 저장 후 두 파일을 다시 읽어 값이 반영되었는지 검증했다.
- Troubleshooting:
  - issue: 샌드박스 권한으로 사용자 설정 파일 쓰기가 거부되었다.
  - cause: 사용자 설정 파일 경로가 워크스페이스 쓰기 허용 범위 밖이었다.
  - fix: 승인된 권한 상승 모드로 동일 명령을 재실행해 변경을 완료했다.
- 사용 기술/도구:
  - VS Code/Cursor 사용자 설정 (`settings.json`)
  - shell (`cat`, here-doc)
- 사용 메모/명령어:
  - `cat "$HOME/Library/Application Support/Cursor/User/settings.json"`
  - `cat "$HOME/Library/Application Support/Code/User/settings.json"`
  - `cat > ".../User/settings.json" <<'EOF' ... EOF`
- 다음 액션:
  - VS Code와 Cursor를 각각 재시작하거나 통합 터미널을 새로 열어 Nerd Font 아이콘 글리프 표시 상태를 최종 확인한다.

## 2026-02-22 - 프로젝트 로컬 VS Code 폰트 설정 제거

- 일시:
  - 2026-02-22T08:06:21Z
- 목표:
  - 사용자 전역 설정과 중복되는 프로젝트 로컬 VS Code 폰트 설정을 정리한다.
- 수행 단계:
  - `.vscode/settings.json`을 삭제했다.
  - `.vscode` 디렉터리가 비어 있어 함께 정리했다.
- Troubleshooting: none
- 사용 기술/도구:
  - shell (`rm`, `rmdir`)
- 사용 메모/명령어:
  - `rm -f .vscode/settings.json`
  - `rmdir .vscode`
- 다음 액션:
  - VS Code/Cursor에서 전역 사용자 설정만으로 폰트가 동일하게 유지되는지 확인한다.

## 2026-02-22 - 보안 패치 브랜치 검증 및 main 안전 통합

- 일시:
  - 2026-02-22T08:10:20Z
- 목표:
  - `security-audit-patch-20260220` 브랜치의 보안 변경을 검증하고, 회귀 없이 `main`에 통합한다.
- 수행 단계:
  - `main..security-audit-patch-20260220` 커밋/파일 diff를 확인해 변경 범위를 검증했다.
  - 브랜치가 `main`의 최신 기능 커밋들 이전에서 분기되어 직접 머지 시 대규모 롤백 위험이 있음을 확인했다.
  - 보안 핵심 변경을 `main` 코드 구조에 맞게 반영했다:
    - `src/lib/admin-auth-server.ts`: 레거시 토큰 fallback 환경변수 게이트(`ADMIN_UPLOAD_LEGACY_TOKEN_ENABLED`) 추가, 토큰 비교를 `timingSafeEqual` 기반 상수시간 비교로 변경.
    - `src/app/api/admin/photos/route.ts`: 업로드 요청의 최대 크기(`ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES`, 기본 25MB) 및 MIME allowlist 검증 추가.
    - `src/app/api/photos/[slug]/download/route.ts`: 다운로드 소스 URL을 Supabase `photos` public 경로로 제한하고, `Content-Disposition` 파일명을 안전 문자열로 정제.
    - `.env.example`, `README.md`: 신규 보안 설정/동작 문서화.
  - `npm run lint`, `npm run build`로 검증했다.
- Troubleshooting:
  - issue: 보안 브랜치를 그대로 머지하면 최신 기능이 광범위하게 제거될 수 있었다.
  - cause: 보안 브랜치가 `7720825`에서 분기된 뒤 `main`에 누적된 다수 기능 커밋을 포함하지 못한 상태였다.
  - fix: 보안 변경만 `main`에 수동 이식 후 정적검사/빌드 검증으로 안전 통합했다.
- 사용 기술/도구:
  - Git (`log`, `diff`, `merge-base`)
  - Next.js Route Handlers
  - Node crypto (`timingSafeEqual`)
  - ESLint / Next build
- 사용 메모/명령어:
  - `git log --oneline main..security-audit-patch-20260220`
  - `git diff --stat main..security-audit-patch-20260220`
  - `npm run lint`
  - `npm run build`
- 다음 액션:
  - 보안 통합 커밋 후, 필요 시 `security-audit-patch-20260220`를 최신 `main` 기준으로 정리(또는 병합 완료 처리)한다.

## 2026-02-22 - 보안 브랜치 병합 완료 및 원격 반영

- 일시:
  - 2026-02-22T08:12:18Z
- 목표:
  - 보안 패치 통합 결과를 `main`에 확정하고 원격 저장소까지 반영한다.
- 수행 단계:
  - 보안 통합 커밋(`be8d439`)을 생성했다.
  - 구형 분기였던 `security-audit-patch-20260220`는 회귀 방지를 위해 `ours` 전략으로 병합 커밋(`0f47eb6`) 처리했다.
  - `git push origin main`으로 원격 `main`에 반영했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Git (`commit`, `merge -s ours`, `push`)
- 사용 메모/명령어:
  - `git commit -m "security: harden admin upload auth and download source validation"`
  - `git merge --no-ff -s ours security-audit-patch-20260220 -m "merge: integrate security-audit-patch-20260220 without regressions"`
  - `git push origin main`
- 다음 액션:
  - 프로덕션/프리뷰 환경에서 관리자 업로드(허용 MIME/파일크기), 다운로드(비신뢰 URL 차단) 동작을 실제 요청으로 확인한다.

## 2026-02-27 - 피드 카드 호버 가독성 개선 (텍스트 박스 적용)

- 일시:
  - 2026-02-27T22:29:59+0900 (KST)
- 목표:
  - 사진 카드 호버 시 배경을 과도하게 어둡게 하는 대신, 제목/캡션/액션 버튼 영역을 박스화해 밝은 사진에서도 가독성을 확보한다.
- 수행 단계:
  - `src/components/photo-card.tsx`의 호버 오버레이를 `from-black/80` 중심 구조에서 `from-black/55` 기반으로 완화했다.
  - 상단 좋아요/다운로드 버튼을 반투명 다크 박스(`bg-black/45`, blur, border, shadow) 안에 배치해 버튼 대비를 높였다.
  - 하단 제목/캡션을 반투명 다크 텍스트 박스(`bg-black/60`, border, blur, shadow)로 감싸 밝은 이미지 위에서도 문구가 안정적으로 읽히도록 조정했다.
  - `npm run lint`를 실행해 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js/React 컴포넌트
  - Tailwind CSS (`bg-black/*`, `backdrop-blur`, `shadow`)
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 실제 피드 화면에서 밝은 톤/역광 사진을 기준으로 텍스트 박스 불투명도와 패딩을 최종 미세조정한다.

## 2026-02-27 - 피드 카드 글래스 박스 미세조정 (버튼 원복 + 타이틀/캡션 분리)

- 일시:
  - 2026-02-27T22:32:06+0900 (KST)
- 목표:
  - 사진을 가리는 면적을 줄이기 위해 상단 액션 버튼은 기존 형태로 되돌리고, 하단 제목/설명은 각각 분리된 글로시(리퀴드 글라스 느낌) 박스로 조정한다.
- 수행 단계:
  - `src/components/photo-card.tsx`에서 상단 좋아요/다운로드 버튼을 감싸던 컨테이너를 제거해 버튼 스타일을 기존(`bg-white/20`, `border-white/30`)으로 원복했다.
  - 호버 오버레이를 `from-black/45 via-black/10`으로 완화해 이미지 가림을 줄였다.
  - 하단 텍스트 영역을 단일 박스에서 분리해 제목/캡션 각각 독립된 글래스 박스(`bg-white/12`, `bg-white/10`, `backdrop-blur-xl`, inset highlight shadow`)로 변경했다.
  - `npm run lint`로 정적 검사를 통과했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js/React 컴포넌트
  - Tailwind CSS (`backdrop-blur`, glass-like border/shadow 조합)
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 실제 화면에서 모바일/데스크톱 각각 글래스 박스의 blur 강도와 border 밝기를 확인하고 필요 시 단계별(`bg-white/8~14`)로 추가 미세조정한다.

## 2026-02-27 - 글래스 텍스트 박스 정렬 보정 및 크기 축소

- 일시:
  - 2026-02-27T22:33:59+0900 (KST)
- 목표:
  - 제목/설명 글래스 박스가 가로로 어긋나 보이는 문제를 해소하고, 전체 박스 크기를 줄여 사진 가림을 최소화한다.
- 수행 단계:
  - `src/components/photo-card.tsx` 하단 텍스트 영역을 `inline-block` 기반에서 `flex flex-col items-start` 구조로 변경해 세로 정렬을 고정했다.
  - 제목/설명 박스의 패딩과 라운딩을 축소(`rounded-2xl` → `rounded-xl`, `px/py` 축소)해 시각적 점유 면적을 줄였다.
  - 최대 너비를 축소(`title: 72%`, `caption: 84%`)해 카드 이미지 노출 면적을 확대했다.
  - `npm run lint`를 실행해 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js/React 컴포넌트
  - Tailwind CSS (`flex`, `max-w`, glass shadow/border)
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 피드 실화면에서 긴 제목/긴 캡션 사례를 확인하고, 필요 시 `max-w` 비율을 카드 폭 기준으로 추가 보정한다.

## 2026-02-27 - 글래스 텍스트 박스 폰트 다운스케일

- 일시:
  - 2026-02-27T22:35:16+0900 (KST)
- 목표:
  - 텍스트 박스 자체 크기 변경 없이 제목/설명 폰트만 줄여 시각적 밀도를 낮춘다.
- 수행 단계:
  - `src/components/photo-card.tsx`에서 제목 폰트를 `text-base`에서 `text-sm`으로 조정했다.
  - 설명(캡션) 폰트를 `text-sm`에서 `text-xs`로 조정했다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js/React 컴포넌트
  - Tailwind CSS 타이포그래피 유틸리티
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 실제 카드에서 텍스트 길이가 긴 항목의 가독성을 확인하고 필요 시 `leading` 값을 추가 조정한다.

## 2026-02-27 - Next.js Turbopack panic 대응 (dev 스크립트 우회)

- 일시:
  - 2026-02-27T22:44:41+0900 (KST)
- 목표:
  - `next dev` 실행 시 발생한 Turbopack 내부 panic(`static_sorted_file.rs`)으로 개발 서버가 시작되지 않는 문제를 우회해 즉시 개발을 재개한다.
- 수행 단계:
  - 사용자 제공 panic 로그를 확인해 앱 코드가 아닌 Turbopack 내부 오류(`range start index ... out of range`)임을 확인했다.
  - `package.json`의 `dev` 스크립트를 `next dev --webpack`으로 변경해 기본 개발 서버를 webpack 경로로 고정했다.
  - 필요 시 Turbopack을 선택적으로 실행할 수 있도록 `dev:turbo` 스크립트(`next dev --turbopack`)를 추가했다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting:
  - issue: 이 실행 환경에서는 포트 바인딩 권한 제한으로 실제 dev 서버 기동 상태를 직접 검증할 수 없었다.
  - cause: 샌드박스 실행 정책상 `0.0.0.0:3000` listen이 차단되었다.
  - fix: 정적 변경(스크립트/린트) 중심으로 안정 우회 구성을 적용하고, 로컬 환경에서 `npm run dev` 재실행 검증을 후속 액션으로 분리했다.
- 사용 기술/도구:
  - Next.js CLI (`--webpack`, `--turbopack`)
  - npm scripts
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run dev`
  - `npm run dev:turbo`
  - `npm run lint`
- 다음 액션:
  - 로컬 터미널에서 `npm run dev`로 정상 기동 확인 후, Turbopack 수정 릴리스 확인 시 `npm run dev:turbo`로 재검증한다.

## 2026-02-27 - dev 스크립트 원복 (사용자 요청)

- 일시:
  - 2026-02-27T22:46:52+0900 (KST)
- 목표:
  - 캐시 삭제 후 Turbopack 재시도를 전제로, `package.json`의 개발 스크립트를 원래 상태로 되돌린다.
- 수행 단계:
  - `package.json`의 `scripts.dev`를 `next dev --webpack`에서 `next dev`로 원복했다.
  - 임시로 추가했던 `dev:turbo` 스크립트를 제거해 원래 구성과 동일하게 맞췄다.
  - `npm run lint`를 실행해 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - npm scripts (`package.json`)
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 로컬에서 `rm -rf .next && npm run dev -- --turbopack` 또는 `npm run dev`로 실제 기동을 확인한다.

## 2026-02-27 - 호버 글래스 오버레이 전환 부드럽게 개선

- 일시:
  - 2026-02-27T22:53:50+0900 (KST)
- 목표:
  - 마우스 오버 시 글래스 텍스트 박스가 갑자기 바뀌어 보이던(렉처럼 느껴지는) 전환을 완화한다.
- 수행 단계:
  - `src/components/photo-card.tsx`에서 오버레이를 배경 레이어와 콘텐츠 레이어로 분리했다.
  - 배경 그라디언트 강도를 완화(`from-black/35`, `via-black/8`)하고 페이드 시간을 늘려 변화량을 줄였다.
  - 제목/설명 글래스 박스에 개별 `opacity + translate` 트랜지션을 적용하고, 캡션에 짧은 지연을 추가해 동시 점멸 느낌을 줄였다.
  - `backdrop-blur-xl`을 `backdrop-blur-md`로 낮춰 렌더링 부담과 순간적인 “팝” 체감을 완화했다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js/React 컴포넌트
  - Tailwind CSS transition/blur 유틸리티
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 실제 브라우저에서 hover in/out 반복 시 전환 잔상/버벅임이 남는지 확인하고, 필요 시 duration/delay를 20~40ms 단위로 추가 미세조정한다.

## 2026-02-27 - 잔여 로컬 변경 일괄 커밋 정리

- 일시:
  - 2026-02-27T22:56:48+0900 (KST)
- 목표:
  - 워크트리에 남아 있던 수정/신규 파일을 사용자 요청에 따라 전부 커밋해 작업 상태를 정리한다.
- 수행 단계:
  - `git status --short`로 잔여 변경 파일을 확인했다.
  - `git add -A`로 수정/신규 파일 전체를 스테이징했다.
  - `git commit -m "chore: commit all remaining local changes"`로 일괄 커밋했다.
  - 커밋에 포함된 파일: `src/app/globals.css`, `src/app/page.tsx`, `src/lib/photos.ts`, `.vscode/settings.json`, `next`, `photo_blog@0.1.0`, `tasks/lessons.md`, `tasks/todo.md`.
- Troubleshooting: none
- 사용 기술/도구:
  - Git (`status`, `add`, `commit`)
- 사용 메모/명령어:
  - `git status --short`
  - `git add -A`
  - `git commit -m "chore: commit all remaining local changes"`
- 다음 액션:
  - 필요 시 원격 반영을 위해 `git push origin main`을 실행한다.

## 2026-02-27 - 피드 카드 정렬/매칭 체감 이슈 완화 (Masonry -> Grid)

- 일시:
  - 2026-02-27T23:01:56+0900 (KST)
- 목표:
  - 피드에서 카드 높이/정렬이 어긋나 보이고, 호버 시 제목·설명이 다른 카드와 섞여 보이는 체감을 줄인다.
- 수행 단계:
  - `src/components/masonry-feed.tsx`의 레이아웃을 CSS `columns`에서 `grid`(`grid-cols-1/sm:2/xl:3`)로 전환해 시각 순서를 고정했다.
  - `src/components/photo-card.tsx`에서 `mb-4`, `break-inside-avoid`를 제거해 Grid 간격 체계와 맞췄다.
  - 제목/설명 글래스 박스 트랜지션에서 `translate`와 지연을 제거하고, `opacity` 중심의 짧은 전환(`duration-180`)으로 조정해 카드 간 잔상 체감을 줄였다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - React/Next.js 컴포넌트
  - Tailwind CSS (`grid`, transition)
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 실제 화면에서 카드 순서/정렬 체감이 개선되었는지 확인하고, 필요 시 `gap`과 breakpoint별 칼럼 수를 추가 조정한다.

## 2026-02-27 - 상세 편집창 AI 재추천 + 태그 수정 UX 보강

- 일시:
  - 2026-02-27T23:07:33+0900 (KST)
- 목표:
  - 상세 사진 편집 모달에서 제목/태그를 다시 추천받을 수 있게 하고, 태그 수동 수정이 더 확실히 반영되도록 입력 파싱 UX를 개선한다.
- 수행 단계:
  - `src/components/photo-detail-shell.tsx`에 `AI로 제목/태그 재추천` 버튼과 상태 메시지(로딩/성공/실패)를 추가했다.
  - 현재 사진 `src`를 클라이언트에서 가져와 축소 JPEG로 변환한 뒤 `/api/admin/photos/ai-suggest`로 보내도록 상세 편집 전용 추천 요청 로직을 구현했다.
  - 추천 성공 시 편집 폼의 `title`, `tags` 입력값을 즉시 갱신하도록 연결했다.
  - 태그 파서를 개선해 `쉼표`와 `줄바꿈` 모두 태그 구분자로 허용하고, 중복 태그를 제거하도록 수정했다.
  - `Tags` 입력란 placeholder/help 텍스트를 보강해 사용자가 직접 수정하는 방법을 명확히 안내했다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - React/Next.js 클라이언트 컴포넌트
  - Fetch/FormData, Canvas 이미지 축소 처리
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 상세 페이지 편집 모달에서 AI 재추천 후 수동 태그 수정(쉼표/줄바꿈) 저장이 기대대로 반영되는지 실브라우저에서 확인한다.

## 2026-02-27 - 상세 편집창 AI 재추천 런타임 오류 수정

- 일시:
  - 2026-02-27T23:08:27+0900 (KST)
- 목표:
  - `AI로 제목/태그 재추천` 클릭 시 발생한 `Object is not a constructor` 런타임 오류를 해결한다.
- 수행 단계:
  - 원인을 확인했다: `src/components/photo-detail-shell.tsx`에서 `next/image`의 `Image` 컴포넌트 이름이 브라우저 `Image` 생성자 사용(`new Image()`)과 충돌했다.
  - `next/image` import 별칭을 `NextImage`로 변경했다.
  - 이미지 축소 로직에서 생성자를 `new window.Image()`로 명시해 전역 브라우저 생성자를 확실히 사용하도록 수정했다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting:
  - issue: AI 재추천 버튼 클릭 시 `Object is not a constructor` 에러로 추천 흐름이 중단되었다.
  - cause: 동일 스코프에서 `Image` 심볼이 React 컴포넌트로 바인딩되어 전역 생성자 호출이 덮어써졌다.
  - fix: 컴포넌트/전역 생성자 심볼을 분리(`NextImage`, `window.Image`)해 충돌을 제거했다.
- 사용 기술/도구:
  - Next.js client component
  - 브라우저 이미지 API (`window.Image`)
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 상세 편집 모달에서 AI 재추천 버튼을 재실행해 제목/태그 자동 채움이 정상 동작하는지 확인한다.

## 2026-02-27 - AI 재추천 메타데이터 확장 및 비용 최적화

- 일시:
  - 2026-02-27T23:13:26+0900 (KST)
- 목표:
  - 상세/업로드 편집에서 AI 재추천 결과에 slug/caption까지 포함하고, 태그를 영어로 통일하면서 응답 비용 증가를 억제한다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts` 응답 스키마를 `title`, `slug`, `caption`, `tags`로 확장했다.
  - 같은 파일의 프롬프트를 갱신해:
    - 제목: 한국어(짧게)
    - slug: 영어 kebab-case
    - caption: 한국어 한 문장
    - tags: 영어 lowercase kebab-case
    를 명시했다.
  - 서버 정제 로직에서 `slug`/`caption` 검증을 추가하고, 태그는 영문자/숫자/하이픈만 허용하도록 강화했다.
  - 비용 절감을 위해 `max_output_tokens` 재시도 예산을 `300/900/1800`에서 `180/360/720`으로 축소했다.
  - `src/app/admin/upload/page.tsx`에서 AI 추천 결과를 `title/slug/caption/tags` 모두 폼에 반영하도록 수정했다.
  - `src/components/photo-detail-shell.tsx`의 AI 재추천도 `title/slug/caption/tags` 모두 업데이트하도록 연결했다.
  - 태그 수동 편집 파서를 보강해 쉼표/줄바꿈 구분 및 중복 제거를 적용했다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js Route Handler / Client Component
  - OpenAI Responses API 프롬프트/출력 정제
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 편집 모달에서 AI 재추천 실행 후 slug/caption/tags 반영 결과와 응답 지연/품질의 균형을 실사용 기준으로 점검한다.

## 2026-02-27 - AI 추천 incomplete 응답 회귀 수정

- 일시:
  - 2026-02-27T23:16:03+0900 (KST)
- 목표:
  - 업로드 편집에서 `Empty model response (status=incomplete, output_types=reasoning...)` 오류가 발생하는 회귀를 해소한다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`의 재시도 토큰 예산을 `180/360/720`에서 `240/640/1400`으로 상향 조정했다.
  - 재시도 조건에 `Empty model response` 오류를 명시적으로 포함해 비어 있는 불완전 응답도 다음 예산으로 재시도되도록 보강했다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting:
  - issue: AI 추천이 `incomplete` 상태에서 reasoning-only 응답으로 끝나 title/slug/caption/tags를 만들지 못했다.
  - cause: 비용 절감 과정에서 `max_output_tokens` 예산이 스키마 확장(title+slug+caption+tags)에 비해 과도하게 낮아졌다.
  - fix: 1차 예산은 저비용으로 유지하되, 2/3차 재시도 예산을 현실적인 범위로 상향해 성공률을 회복했다.
- 사용 기술/도구:
  - Next.js Route Handler
  - OpenAI Responses API 재시도 제어
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 업로드 화면에서 동일 이미지로 AI 추천을 재실행해 `title/slug/caption/tags`가 정상 채워지는지 확인한다.

## 2026-02-27 - AI 추천 전 이미지 리사이즈 최대 변 256으로 축소

- 일시:
  - 2026-02-27T23:21:45+0900 (KST)
- 목표:
  - AI 메타데이터 추천 요청 비용/지연을 더 낮추기 위해 전송 이미지 최대 변을 256px로 제한한다.
- 수행 단계:
  - `src/app/admin/upload/page.tsx`의 `AI_IMAGE_MAX_DIMENSION` 값을 `1000`에서 `256`으로 변경했다.
  - `src/components/photo-detail-shell.tsx`의 동일 상수도 `256`으로 맞춰 업로드/상세 재추천 경로를 일관화했다.
  - `npm run lint`로 정적 검사 통과를 확인했다.
- Troubleshooting: none
- 사용 기술/도구:
  - Next.js client components
  - Canvas 기반 이미지 축소 파이프라인
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 실제 업로드/상세 편집에서 AI 추천 품질 저하 여부를 확인하고 필요 시 320px 또는 384px로 재조정한다.

## 2026-02-27 - 피드 카드 빈 영역/오버레이 위치 보정

- 일시: 2026-02-27T23:23:36+0900 (KST)
- 목표: 그리드 카드가 세로로 늘어나며 생긴 회색 빈 영역과 오버레이 하단 밀림을 제거.
- 수행 단계:
  - `src/components/masonry-feed.tsx`: 그리드 컨테이너에 `items-start` 추가.
  - `src/components/photo-card.tsx`: 카드 루트에 `self-start` 추가.
  - `npm run lint` 통과 확인.
- Troubleshooting:
  - issue: 특정 카드에서 이미지 아래 회색 빈칸이 생기고 오버레이 텍스트가 하단으로 밀려 보임.
  - cause: CSS grid 기본 `align-self: stretch`로 카드 높이가 같은 행의 최대 높이로 늘어남.
  - fix: 카드/그리드 정렬을 `start`로 고정해 콘텐츠 높이만큼만 렌더링.
- 사용 기술/도구: Tailwind CSS(grid 정렬), ESLint
- 사용 메모/명령어: `npm run lint`
- 다음 액션: 실제 피드에서 hover 시 제목/캡션 박스가 이미지 하단에 정확히 붙는지 확인.

## 2026-02-28 - 태그 그래프 뷰 1차 구현
- 일시/목표: 2026-02-28T00:28:00+0900 (KST), 홈 햄버거→사이드바→`/graph` 진입 + 태그 기반 2D 그래프 읽기전용 제공.
- 수행/Troubleshooting: `src/components/home-nav-drawer.tsx`, `src/app/graph/page.tsx`, `src/components/photo-graph-view.tsx`, `src/app/api/photos/graph/route.ts`, `src/types/graph.ts` 추가 및 `src/app/page.tsx` 연결; 외부 패키지 설치는 네트워크 제한으로 실패해 내장 force 레이아웃으로 대체.
- 기술/명령어: Next.js App Router, SVG, custom force simulation, `npm run lint`.
- 다음 액션: 실브라우저에서 그래프 성능(노드 밀집/줌/팬) 확인 후 필요 시 force 파라미터와 태그 컷오프 상한을 조정.

## 2026-02-28 - 그래프 렉/사이드바 UI 2차 보정
- 일시/목표: 2026-02-28T00:56:51+0900 (KST), 그래프 렉 완화와 햄버거/드로어 UI 정렬 개선.
- 수행/Troubleshooting: `src/components/photo-graph-view.tsx`를 무거운 물리 시뮬레이션+팬드래그에서 태그 앵커 기반 정적 레이아웃으로 교체하고 링크 렌더 상한을 적용; `src/components/home-nav-drawer.tsx` 드로어 폭/오버레이/닫기 버튼 스타일을 정리.
- 기술/명령어: SVG 정적 레이아웃, React state 최소화, `npm run lint`.
- 다음 액션: 실제 데이터에서 노드 과밀 시 태그 라벨 가독성(폰트/표시 개수) 추가 튜닝.

## 2026-02-28 - 햄버거 드로어 UI 리디자인
- 일시/목표: 2026-02-28T00:59:06+0900 (KST), 햄버거 클릭 시 드로어 디자인 품질 개선.
- 수행/Troubleshooting: `src/components/home-nav-drawer.tsx`를 카드형 메뉴/상단 헤더/아이콘 닫기 버튼/반투명 블러 오버레이/슬라이드 애니메이션 구조로 교체; Troubleshooting: none.
- 기술/명령어: Tailwind UI 스타일링, transition, `npm run lint`.
- 다음 액션: 실브라우저에서 모바일/데스크톱 드로어 폭과 버튼 hit-area 체감 확인.

## 2026-02-28 - 그래프 확대/드래그 인터랙션 추가
- 일시/목표: 2026-02-28T01:24:15+0900 (KST), 그래프에서 확대/축소 및 터치 드래그 이동 지원.
- 수행/Troubleshooting: `src/components/photo-graph-view.tsx`에 viewport transform(`translate/scale`), wheel zoom, pointer drag(터치 포함), `+/-/reset` 컨트롤 추가; Troubleshooting: none.
- 기술/명령어: SVG transform, Pointer Events, React state, `npm run lint`.
- 다음 액션: 모바일 실기기에서 터치 드래그 감도와 최대/최소 배율 체감을 확인해 scale 범위를 미세조정.

## 2026-03-01 - Vercel 관리자 업로드 AI 추천 빈 응답 자동 복구

- 일시:
  - 2026-03-01T13:16:12+0900 (KST)
- 목표:
  - 프로덕션 `/admin/upload`에서 `Empty model response (status=incomplete, output_types=reasoning, content_types=none)`로 AI 메타데이터 추천이 실패하는 문제를 완화한다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`에 `isReasoningOnlyIncomplete` 판별 함수를 추가해 `incomplete + reasoning-only + text 없음` 상태를 명시적으로 감지했다.
  - 같은 파일의 모델 호출 흐름을 확장해, `OPENAI_VISION_MODEL` 1차 시도 실패 시(위 조건) 기본 모델 `gpt-4.1-mini`로 자동 fallback 재시도하도록 변경했다.
  - 기존 재시도 토큰 예산(`240/640/1400`)은 유지하면서, 각 예산 내 파싱/빈응답 재시도 후 최종 실패 시에만 fallback되도록 제어했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: Vercel 배포판 관리자 업로드 AI 추천에서 `status=incomplete`, `output_types=reasoning`, `content_types=none` 오류로 결과 JSON이 비어 실패.
  - 원인: 설정 모델이 reasoning-only 불완전 응답을 반환할 때 최종 텍스트(JSON)가 생성되지 않아 파싱 단계에서 실패.
  - 조치: reasoning-only 불완전 응답을 fallback 트리거로 정의하고, 기본 비전 모델로 자동 재시도해 성공 경로를 확보.
- 사용 기술/도구:
  - Next.js Route Handler
  - OpenAI Responses API
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - 프로덕션 `/admin/upload`에서 동일 이미지로 `AI로 메타데이터 추천`을 재실행해 fallback 후 title/slug/caption/tags가 채워지는지 확인하고, 필요 시 Vercel 환경변수 `OPENAI_VISION_MODEL`을 `gpt-4.1-mini`로 고정한다.

## 2026-03-01 - GPT-5 Nano 단일 모델 유지로 AI 추천 안정화

- 일시:
  - 2026-03-01T13:19:53+0900 (KST)
- 목표:
  - `gpt-5-nano` 단일 모델 정책을 유지하면서 `/admin/upload` AI 추천의 `status=incomplete` 실패율을 낮춘다.
- 수행 단계:
  - `src/app/api/admin/photos/ai-suggest/route.ts`에서 직전 추가했던 모델 fallback 루프를 제거했다.
  - 같은 파일에 `getIncompleteReason`을 추가해 `incomplete_details.reason`을 읽고, `max_output_tokens` 계열 불완전 응답에만 재시도하도록 조정했다.
  - `gpt-5*` 계열 모델 호출 시 `reasoning.effort: "minimal"`을 설정하도록 `supportsReasoningEffort` 분기 로직을 추가했다.
  - 재시도 토큰 예산을 `320/960/2400`으로 조정해 1차 비용은 낮게 유지하되 불완전 응답 복구 여지를 확보했다.
  - `npm run lint`로 정적 검증을 수행했다.
- 트러블슈팅:
  - 이슈: 모델이 이미지 입력을 지원함에도 fallback 도입이 운영 의도(단일 모델 사용)와 맞지 않는다는 피드백 발생.
  - 원인: 실패 원인을 모델 미지원으로 간주한 대응이었고, 실제 핵심은 reasoning 토큰 소진 기반의 incomplete 응답 가능성이 더 큼.
  - 조치: fallback 제거 후 단일 모델 유지, reasoning effort 및 재시도 조건을 정교화.
- 사용 기술/도구:
  - Next.js Route Handler
  - OpenAI Responses API (`reasoning.effort`, `incomplete_details`)
  - ESLint (`npm run lint`)
- 사용 메모/명령어:
  - `npm run lint`
- 다음 액션:
  - Vercel 배포 후 `/admin/upload`에서 동일 이미지로 추천을 실행해 `title/slug/caption/tags` 정상 반환 여부와 지연 시간을 확인하고, 필요 시 `tokenBudgets`를 소폭 재조정한다.

## 2026-03-01 - 관리자 업로드 전송 전 자동 압축 도입 (Vercel 413 회피)

- 일시:
  - 2026-03-01T15:18:40+0900 (KST)
- 목표:
  - 관리자 업로드에서 대용량 이미지가 Vercel 요청 본문 제한에 걸려 API 진입 전 413으로 차단되는 문제를 줄인다.
- 수행 단계:
  - `src/app/admin/upload/page.tsx`에 전송 용량 목표(`UPLOAD_TRANSPORT_TARGET_BYTES=4,000,000`)와 최대 변(`UPLOAD_TRANSPORT_MAX_DIMENSION=4096`) 상수를 추가했다.
  - 같은 파일에 `compressFileForUploadTransport`를 추가해 업로드 직전 이미지를 canvas 기반으로 webp 압축(스케일/품질 단계 탐색)하도록 구현했다.
  - 업로드 제출 시 4.5MB 초과 파일은 자동 압축을 먼저 시도하고, 압축 후에도 제한 초과면 사용자에게 명확한 실패 메시지를 노출하도록 변경했다.
  - 업로드 성공 메시지에 전송 전 압축 크기 변화(`원본 -> 압축본`)를 함께 표시해 사용자 피드백을 강화했다.
  - `npm run lint`, `npm run build`로 정적/빌드 검증을 완료했다.
- 트러블슈팅:
  - 이슈: 업로드 시 `Unexpected token 'R', "Request En"... is not valid JSON` 및 413(`FUNCTION_PAYLOAD_TOO_LARGE`)가 발생.
  - 원인: Vercel 플랫폼에서 요청 본문 크기가 초과되면 API 라우트 실행 전에 차단되어 백엔드 압축 로직이 동작할 수 없음.
  - 조치: 백엔드 압축과 별도로 클라이언트 전송 전 압축 단계를 추가해 플랫폼 제한 이전에 요청 크기를 낮춤.
- 사용 기술/도구:
  - Next.js App Router (Client Component)
  - Browser Canvas API, WebP 인코딩
  - ESLint, Next.js build
- 사용 메모/명령어:
  - `npm run lint`
  - `npm run build`
- 다음 액션:
  - 프로덕션 관리자 업로드에서 5MB 이상 이미지로 업로드 재검증 후, 필요 시 압축 품질/해상도 탐색 범위를 조정한다.

## 2026-03-01 - 홈 피드 최신 업로드 미노출 문제 수정 (정적 최적화 해제)

- 일시:
  - 2026-03-01T15:36:40+0900 (KST)
- 목표:
  - 업로드 완료 후 Supabase에는 저장됐지만 배포 홈 피드에서 최신 이미지가 보이지 않는 문제를 해결한다.
- 수행 단계:
  - 배포 API를 점검해 `blue-sky-and-building` 슬러그가 `/api/photos` 응답에 포함되는 것을 확인했다.
  - 배포 브라우저 재현에서 홈 피드가 과거 15개 정적 목록으로 유지되는 패턴을 확인했다.
  - `src/app/page.tsx`에 `export const dynamic = "force-dynamic";`를 추가해 홈 피드를 서버 동적 렌더링으로 전환했다.
  - `npm run lint`, `npm run build`로 검증했고, 빌드 출력에서 `/` 경로가 `ƒ (Dynamic)`으로 전환된 것을 확인했다.
- 트러블슈팅:
  - 이슈: 업로드 성공/Storage 존재에도 홈 배포 페이지에서 최신 이미지가 보이지 않음.
  - 원인: 홈 페이지가 정적 최적화되어 빌드 시점 데이터가 고정되고, 초기 목록/hasMore 상태가 최신 DB와 불일치.
  - 조치: 홈 페이지를 동적 렌더링으로 변경해 요청 시점 최신 목록을 반영하도록 수정.
- 사용 기술/도구:
  - Next.js App Router (`dynamic = "force-dynamic"`)
  - Vercel 배포 API 확인(curl)
  - ESLint, Next.js build
- 사용 메모/명령어:
  - `curl -sS 'https://coldbrew-log.vercel.app/api/photos?limit=50' | jq -r '.items[].slug'`
  - `npm run lint`
  - `npm run build`
- 다음 액션:
  - 배포 반영 후 홈에서 `blue-sky-and-building` 카드 노출 여부와 상세 페이지 렌더를 확인한다.
