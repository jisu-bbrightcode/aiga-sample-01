---
description: Product Builder UI Feature를 처음부터 끝까지 구현하는 워크플로우. 폴더 생성, Hook, 컴포넌트, 라우트, 앱 등록, 브라우저 검증까지 포함.
---

# UI Feature Implementation

Product Builder 프론트엔드 UI Feature를 구현하는 전체 워크플로우입니다.

## Step 1: 사전 조사

1. `docs/reference/features-frontend.md` 읽고 기존 Feature 목록 확인
2. 비슷한 기능의 기존 Feature 코드 구조 확인 (예: `apps/app/src/features/blog/`)
3. 해당 Feature의 Server 코드 확인 (`packages/features/{name}/`)
4. tRPC Router에서 사용 가능한 procedure 목록 확인

## Step 2: 폴더 구조 생성

`apps/app/src/features/{name}/` 디렉토리 생성:
- `index.ts` — Public exports
- `routes/index.ts` — Route 묶음 함수
- `hooks/` — tRPC Hook 파일
- `pages/` — 페이지 컴포넌트 (필요 시)

## Step 3: tRPC Hook 구현

`hooks/use-{name}-queries.ts`와 `hooks/use-{name}-mutations.ts` 생성.
반드시 `useTRPC()`를 커스텀 Hook으로 래핑. 컴포넌트에서 직접 호출 금지.
Mutation 후 관련 쿼리 `invalidateQueries` 필수.

## Step 4: 페이지 컴포넌트 구현

모든 페이지에 Feature → FeatureHeader → FeatureContents 3단 구조 적용.
shadcn/ui 컴포넌트 사용. Semantic Token만 사용 (하드코딩 색상 금지).

## Step 5: 라우트 생성

`routes/{page}.tsx`에 `createRoute()` + `createXxxRoutes()` 함수 생성.
`routes/index.ts`에서 묶음 함수 export.

## Step 6: App 등록

`apps/app/src/router.tsx`에서 `...create{Name}Routes(rootRoute)` 추가.
Admin이 있으면 `apps/admin/src/router.tsx`에도 추가.
i18n이 있으면 `apps/app/src/i18n/resources.ts`에도 추가.

## Step 7: TypeScript 빌드 확인

터미널에서 `cd apps/app && npx tsc --noEmit` 실행하여 타입 에러 없음 확인.

## Step 8: 브라우저 검증 (필수!)

1. http://localhost:3000/{name} 접속
2. 페이지 정상 렌더링 확인 + 스크린샷 캡처
3. 콘솔 에러 없음 확인
4. 주요 인터랙션 테스트
5. 결과 보고

## Step 9: 레퍼런스 문서 업데이트

`docs/reference/features-frontend.md`에 새 Feature 정보 추가.
