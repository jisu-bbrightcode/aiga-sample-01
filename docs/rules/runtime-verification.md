---
description: Runtime verification before reporting completion
globs: ""
alwaysApply: true
---

# Runtime Verification (작업 완료 전 필수)

> **코드를 작성한 후, "완료했습니다"라고 말하기 전에 반드시 런타임 검증을 통과해야 한다. 예외 없음.**

## 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **tsc ≠ 빌드** | `tsc --noEmit`은 타입만 검증한다. **반드시 `pnpm build`로 실제 빌드를 통과**해야 한다 |
| **빌드 통과 ≠ 동작 확인** | 빌드가 성공해도 런타임 동작은 별도 확인 필수 |
| **서버 → API 200** | 백엔드 변경 시 관련 API 엔드포인트가 200 응답을 반환하는지 확인 |
| **프론트엔드 → 브라우저 렌더링** | UI 변경 시 브라우저에서 페이지가 정상 렌더링되는지 확인 |
| **자기 검증 후 보고** | 검증 결과를 사용자에게 보고할 때 증거(스크린샷, 응답 코드)를 포함 |

---

## 실제 빌드 검증 (모든 변경에 필수)

> **`tsc --noEmit`만으로는 부족하다. `pnpm build`가 통과해야 빌드 완료다.**
> tsc는 타입만 확인하고, 실제 번들링(Vite/NestJS)은 import 경로, 환경변수, 런타임 의존성까지 검증한다.
> Vercel 배포는 `pnpm build`를 실행한다. 로컬에서 빌드 안 되면 배포도 안 된다.

### 필수 빌드 명령

```bash
# 변경 범위에 따라 해당 앱 빌드 (최소 1개 필수)
cd apps/app && pnpm build              # FE 변경 시
cd apps/server && pnpm build           # BE 변경 시
cd apps/admin && pnpm build     # Admin 변경 시

# 공유 패키지 변경 시 (drizzle, core, features, ui, widgets)
# → 해당 패키지를 사용하는 모든 앱 빌드
pnpm build                             # 루트에서 전체 빌드 (가장 확실)
```

### 빌드 실패 시

1. **에러 메시지를 읽고 수정한다** — import 누락, 환경변수 미설정, 타입 불일치 등
2. **수정 후 다시 빌드한다**
3. **빌드 통과 전 "완료" 선언 금지**

### 금지

| 금지 | 이유 |
|------|------|
| `tsc --noEmit`만 하고 "빌드 통과" 보고 | tsc는 빌드가 아니다. 번들링 에러를 잡지 못한다 |
| 빌드 실패를 무시하고 커밋 | Vercel 배포가 깨진다 (현재 20건 연속 ERROR의 원인) |
| "로컬에서는 되는데" | `pnpm build`가 통과해야 CI/Vercel에서도 된다 |

---

## 서버 (Backend) 검증

### 적용 시점

백엔드 코드를 변경한 경우 (Service, Controller, Schema, DTO 등)

### 검증 절차

1. **서버 실행 확인**: 서버가 실행 중인지 확인. 실행 중이 아니면 사용자에게 서버 시작을 요청
2. **API 엔드포인트 테스트**: 변경한 API를 `curl`로 호출하여 status 200(또는 적절한 성공 코드) 확인

```bash
# REST API 테스트 예시
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/{feature}/{endpoint}

# 인증이 필요한 API
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer {token}" http://localhost:3002/api/{feature}/{endpoint}
```

3. **응답 내용 확인**: status code뿐 아니라 응답 body가 예상대로인지도 확인

```bash
# 응답 body 포함 확인
curl -s http://localhost:3002/api/{feature}/{endpoint} | head -c 500
```

### 검증 기준

| 항목 | 기준 |
|------|------|
| Health check | `GET /api/health` → 200 |
| 목록 조회 (list) | 200 + 배열/페이지네이션 응답 |
| 상세 조회 (detail) | 200 + 단일 객체 응답 |
| 생성 (create) | 201 또는 200 |
| 수정 (update) | 200 |
| 삭제 (delete) | 200 |
| 없는 리소스 | 404 (정상적인 에러 처리 확인) |

---

## 프론트엔드 (Frontend) 검증

### 적용 시점

프론트엔드 코드를 변경한 경우 (페이지, 컴포넌트, 라우트, 훅 등)

### 검증 절차

1. **dev 서버 실행 확인**: Vite dev 서버가 실행 중인지 확인
2. **브라우저 테스트**: 변경한 페이지를 브라우저에서 열어 렌더링 확인. 기본은 chrome-devtools-mcp, 실패 시 Playwright fallback 사용.

```
- chrome-devtools-mcp navigate_page / select_page → 해당 페이지 URL 접속
- chrome-devtools-mcp take_snapshot               → 접근성 스냅샷 (스크린샷보다 우선)
- chrome-devtools-mcp take_screenshot             → 시각 확인 필요 시
- chrome-devtools-mcp list_console_messages        → 콘솔 에러 확인
```

3. **확인 항목**:
   - 페이지가 에러 없이 렌더링되는가
   - 콘솔에 critical 에러가 없는가 (`list_console_messages`)
   - 주요 UI 요소가 표시되는가
   - 라우팅이 정상 동작하는가

### 브라우저 직접 검증 도구 — chrome-devtools-mcp 우선, Playwright fallback

> **Hana/Kai/Critic 이 직접 수행하는 Product Builder 브라우저/디자인 검증은 [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) 를 1순위로 사용한다. chrome-devtools-mcp 가 `Transport closed`, 도구 미노출, 세션 비활성, 설치 누락 등으로 실패하면 Playwright fallback 을 사용한다.**

**이유**:
- 실제 Chrome DevTools Protocol 기반 → DevTools Performance/Network/Console 와 동일 프리미티브
- Performance trace, network throttling, CPU throttling, geolocation 등 정밀 진단 가능
- Lighthouse audit, heap snapshot 같은 진짜 Chrome 기능 접근
- headless Chromium 대체 자동화로는 놓치기 쉬운 production 동작 (디바이스 픽셀 비율, 실제 폰트, 실제 GPU) 검증 가능

**필수 도구**: Codex 설정의 `mcp_servers.chrome-devtools` 가 노출하는 chrome-devtools-mcp 도구. 환경에 따라 `mcp__chrome_devtools__*`, `mcp__chrome-devtools__*`, 또는 기존 Claude plugin prefix `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*` 로 보일 수 있다.

**Fallback 도구/명령**: `mcp__playwright__*`, `mcp__plugin_playwright_playwright__*`, `@playwright/test`, `pnpm ... playwright test` 를 사용할 수 있다. 단, chrome-devtools-mcp 를 먼저 시도하고 실패 사유를 기록해야 한다.

**Playwright 사용 범위**: fallback 브라우저 검증, CI/CD, E2E 자동화 구축/유지보수, 파이프라인 검증 목적에 사용한다. fallback 으로 임시 spec/script 를 만들었다면 유지할지 제거할지 완료 보고에 명시한다.

**chrome-devtools-mcp 실패 시 동작**:

1. chrome-devtools-mcp 의 `list_pages` 또는 동등한 첫 호출을 시도한다.
2. `Transport closed`, 도구 미노출, 세션 비활성, 설치 누락 등으로 실패하면 한 줄로 사유를 기록한다.
3. Playwright fallback 으로 동일 시나리오를 검증한다.
4. 완료 보고에 다음 형식으로 남긴다:
   ```
   Browser QA: chrome-devtools-mcp 실패(<사유>) → Playwright fallback 통과/실패
   Scenario: <URL / 클릭 / 입력 / 네트워크 / 콘솔 확인 요약>
   ```

**제한**: 프로덕션 URL 직접 검증은 별도 승인 없이는 금지한다. chrome-devtools-mcp 와 Playwright fallback 모두 brief 가 제공한 로컬/스테이징 URL 을 우선한다.

### 검증 기준

| 항목 | 기준 |
|------|------|
| 페이지 로드 | 빈 화면/에러 화면 아닌 정상 렌더링 |
| 콘솔 에러 | Critical error 없음 (warning은 허용) |
| 주요 UI | 제목, CTA 버튼, 데이터 목록 등 핵심 요소 표시 |
| 네비게이션 | 링크/버튼 클릭 시 올바른 페이지 이동 |

---

## 검증 불가 시 대처

서버가 실행되지 않거나 환경 문제로 런타임 검증이 불가한 경우:

1. **사용자에게 명시적으로 알린다**: "런타임 검증을 수행할 수 없습니다. 서버를 시작해주세요."
2. **정적 검증은 완료한다**: `pnpm build` (실제 빌드), lint 등
3. **"완료"라고 하지 않는다**: 런타임 검증 없이는 "구현 완료"가 아닌 "코드 작성 완료, 런타임 검증 필요"로 보고

---

## 완료 보고 형식

검증을 마친 후 사용자에게 보고할 때 아래 형식을 포함한다:

```
### 검증 결과

**빌드**: pnpm build 통과 (앱: app/server/admin 중 해당 항목)
**타입**: tsc --noEmit 통과
**서버 API**: (해당 시)
  - GET /api/{feature}/{endpoint} → 200
  - POST /api/{feature}/{endpoint} → 201
**브라우저**: (해당 시)
  - /{page} 페이지 정상 렌더링 확인
  - 콘솔 에러 없음
```

---

## 금지 사항

| 금지 | 이유 |
|------|------|
| 런타임 검증 없이 "완료" 선언 | 빌드 통과해도 런타임에 실패할 수 있음 |
| 검증 실패 시 무시하고 진행 | 실패 원인을 파악하고 수정해야 함 |
| 검증 증거 없이 "확인했습니다" | 실제 curl 결과/스크린샷을 포함해야 함 |
