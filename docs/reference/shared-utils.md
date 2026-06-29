# Shared Utilities Reference

패키지: `@repo/shared` (`packages/shared/`)

## Errors (`@repo/shared/errors`)

경로: `packages/shared/errors/`

| 이름 | 경로 | 설명 |
|------|------|------|
| `AppError` | `errors/app-error.ts` | 기본 에러 클래스 (code, message, statusCode) |
| Domain errors | `errors/domain-errors.ts` | 도메인 특화 에러 클래스들 |
| Error codes | `errors/error-codes.ts` | 에러 코드 상수 |
| HTTP status | `errors/http-status.ts` | HTTP 상태코드 매핑 |

## Hooks (`@repo/shared/hooks`)

경로: `packages/shared/hooks/`

| 이름 | 경로 | 설명 |
|------|------|------|
| `useAsync` | `hooks/use-async.ts` | 비동기 작업 상태 관리 (loading, error, data) |
| `useEffectOnce` | `hooks/use-effect-once.ts` | 한 번만 실행되는 useEffect |
| `useMounted` | `hooks/use-mounted.ts` | 마운트 상태 확인 |

## Store (`@repo/shared/store/*`)

경로: `packages/shared/store/`

| 이름 | 경로 | 설명 |
|------|------|------|
| `auth.ts` | `store/auth.ts` | Jotai auth atoms (shared level) |

## Types (`@repo/shared/types`)

경로: `packages/shared/types/`

| 이름 | 경로 | 설명 |
|------|------|------|
| Error types | `types/errors.ts` | 에러 관련 타입 |
| Pagination types | `types/pagination.ts` | `PaginationInput`, `PaginatedResult<T>`, `SuccessResult` |
| Route types | `types/routes.ts` | 라우트 관련 타입 |

## Components (`@repo/shared/components`)

경로: `packages/shared/components/`

| 이름 | 경로 | 설명 |
|------|------|------|
| `QRCode` | `components/qr-code.tsx` | QR 코드 SVG 컴포넌트 (`qrcode.react` 래퍼) |

### QRCode Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `value` | `string` | — | QR 코드에 인코딩할 문자열 |
| `size` | `number` | `128` | QR 코드 크기 (px) |
| `...rest` | `SVGAttributes` | — | `<svg>` 속성 모두 지원 |

## Utils

경로: `packages/shared/utils/`

| 이름 | 경로 | 설명 |
|------|------|------|
| `pagination` | `utils/pagination.ts` | 커서 기반 페이지네이션 유틸리티 |
| `offset-pagination` | `utils/offset-pagination.ts` | 오프셋 기반 페이지네이션 (`buildPaginatedResult`, `toOffset`) |
| `slug` | `utils/slug.ts` | URL-safe slug 생성 (한글/영문 지원) |
| `ui` | `utils/ui.ts` | UI 유틸리티 |
| `print` | `utils/print.ts` | DOM 요소 인쇄 (iframe 격리) |
| `pdf` | `utils/pdf.ts` | DOM 요소 PDF 다운로드 (iframe 격리) |
| String validators | `utils/validators/strings.ts` | 문자열 검증 함수 |

### buildPaginatedResult

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `buildPaginatedResult` | `(data, total, page, limit) → PaginatedResult` | 데이터 + 총 개수로 `{ data, total, page, limit, totalPages }` 생성 |
| `toOffset` | `(page, limit) → number` | `(page - 1) * limit` 오프셋 계산 헬퍼 |

### generateSlug

`generateSlug(title: string) → string` — 한글/영문/숫자 지원, 특수문자는 `-`로 치환, 고유성을 위해 타임스탬프(base36) 자동 추가 (예: `"Hello World!"` → `"hello-world-m1abc2d"`)

### printElement

`printElement(element: HTMLElement, options?) → void` — DOM 요소를 격리된 iframe에 복제 후 브라우저 인쇄 다이얼로그 실행. iframe 격리를 통해 앱 CSS(oklch 등)의 영향을 받지 않음.

| 옵션 | 타입 | 설명 |
|------|------|------|
| `styles` | `string?` | 커스텀 CSS |
| `width` | `string?` | iframe 너비 |

### downloadPdf

`downloadPdf(element: HTMLElement, options) → Promise<void>` — DOM 요소를 iframe 격리 → html2canvas → jsPDF로 PDF 생성 후 다운로드. oklch 색상 미지원 문제를 iframe 격리로 해결.

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `filename` | `string` | — | 필수: 파일명 |
| `format` | `string` | `"a4"` | 페이지 포맷 |
| `orientation` | `string` | `"portrait"` | 방향 |
| `scale` | `number` | `2` | 렌더링 스케일 |
| `styles` | `string?` | — | 커스텀 CSS |
| `width` | `string?` | — | iframe 너비 |
