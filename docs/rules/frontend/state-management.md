---
description: 상태 관리 규칙 (Jotai, React Hook Form, TanStack Query)
globs: "apps/app/**/*.ts, apps/app/**/*.tsx, apps/admin/**/*.ts, apps/admin/**/*.tsx"
alwaysApply: false
---

# State Management Rules

> Jotai (Client State) / TanStack Query (Server State) / React Hook Form + Zod (Form State)

---

## 1. 상태 분류

| 분류 | 도구 | 용도 | 예시 |
|------|------|------|------|
| **Server State** | TanStack Query + generated REST client | 서버 데이터 캐시 | 게시물 목록, 사용자 프로필 |
| **Client State** | Jotai | 전역 UI 상태 | 모달 열림, 사이드바 토글, 테마 |
| **Form State** | React Hook Form + Zod | 폼 입력/검증 | 회원가입, 게시물 작성 |
| **URL State** | TanStack Router | URL 파라미터/검색 | 페이지, 필터, 정렬 |
| **Ephemeral Component State** | useState | 저장/공유되지 않는 단일 컴포넌트 내부 상태 | 드롭다운 열림, 임시 입력 focus |

### 판단 기준

| 질문 | 서버에서 오는가? | 여러 컴포넌트가 공유? | URL에 반영? |
|------|:---:|:---:|:---:|
| **TanStack Query** | O | - | - |
| **Jotai** | X | O | X |
| **Router** | X | O | O |
| **useState** | X | X | X |

---

## 2. Jotai 규칙

### 사용 시점

| 사용 O | 사용 X |
|--------|--------|
| Props Drilling 3단계 이상 | 서버 데이터 캐시 (→ TanStack Query) |
| 전역 모달/토스트/사이드바 제어 | URL에 반영해야 하는 상태 (→ Router) |
| 멀티 스텝 폼 공유 상태 | 저장/공유/복원 필요 없는 단일 컴포넌트 내부 상태 (→ useState) |
| Feature 내 크로스 컴포넌트 상태 | 파생 가능한 값 (→ 렌더링 중 계산) |

### Atom 정의 규칙

| 규칙 | 설명 |
|------|------|
| **최소 상태** | 파생 가능한 값은 atom으로 만들지 않는다 |
| **타입 명시** | `atom<Type>(initialValue)` — 타입 추론이 불충분할 때 명시 |
| **파일 위치** | `features/{name}/store/{name}.atoms.ts` 또는 `features/{name}/hooks/use-{name}-store.ts` |
| **네이밍** | `{목적}Atom` — `sidebarOpenAtom`, `currentThreadIdAtom` |
| **Hook 래핑 권장** | atom 직접 export 대신 `useXxxStore()` Hook으로 래핑하여 업데이트 로직 캡슐화 |

### Atom Hook 패턴

| Hook | 용도 |
|------|------|
| `useAtom(atom)` | 읽기 + 쓰기 |
| `useAtomValue(atom)` | 읽기 전용 |
| `useSetAtom(atom)` | 쓰기 전용 (리렌더링 방지) |

### 멀티 스텝 폼 상태

| 규칙 | 설명 |
|------|------|
| **단일 atom** | 폼 전체 데이터를 하나의 atom에 저장 |
| **부분 업데이트** | `updateField(key, value)` 헬퍼로 특정 필드만 갱신 |
| **완료 시 리셋** | 마지막 페이지의 `useEffect` cleanup에서 `reset()` 호출 |

---

## 3. React Hook Form + Zod 규칙

### 기본 규칙

| 규칙 | 설명 |
|------|------|
| **zodResolver 사용** | `resolver: zodResolver(schema)` — Zod 스키마로 검증 |
| **스키마 위치** | 컴포넌트 파일 상단 또는 별도 `schema.ts` 파일 |
| **타입 추론** | `z.infer<typeof schema>`로 타입 자동 추론. 수동 타입 정의 금지 |
| **서버 DTO 공유** | 가능하면 서버 DTO의 Zod 스키마를 재사용 |

### shadcn Form 컴포넌트 사용

| 컴포넌트 | 용도 |
|----------|------|
| `<Form>` | form context provider (`{...form}` spread) |
| `<FormField>` | 개별 필드 래퍼 (`control`, `name`, `render` prop) |
| `<FormItem>` | 필드 레이아웃 컨테이너 |
| `<FormLabel>` | 라벨 (에러 시 자동 색상 변경) |
| `<FormControl>` | Input 래퍼 (aria 속성 자동 연결) |
| `<FormMessage>` | 에러 메시지 자동 표시 |

### 검증 모드

| 모드 | 용도 |
|------|------|
| `mode: "onSubmit"` (기본) | 제출 시 검증. 일반 폼에 적합 |
| `mode: "onChange"` | 입력할 때마다 검증. 비밀번호 등 즉시 피드백 필요 시 |
| `mode: "onBlur"` | 포커스 해제 시 검증. 이메일 등 완성된 입력 검증 시 |

### Zod 패턴

| 패턴 | 용도 |
|------|------|
| `z.string().min(1)` | 필수 입력 |
| `z.coerce.number()` | 문자열 → 숫자 자동 변환 |
| `z.object({}).refine()` | 필드 간 교차 검증 (비밀번호 확인 등) |
| `schema.pick({})` | 기존 스키마에서 일부 필드만 선택 |
| `schema.extend({})` | 기존 스키마에 필드 추가 |

---

## 4. 상태 관리 금지 사항

| 금지 | 대안 |
|------|------|
| 서버 데이터를 Jotai에 저장 | TanStack Query + generated REST client 사용 |
| URL 상태를 Jotai에 저장 | TanStack Router search params 사용 |
| 브라우저 feature state 에 Zustand/Redux/MobX/Recoil/XState 등 추가 | Jotai 사용 |
| persisted feature state 에 `localStorage` / `sessionStorage` 직접 호출 | `jotai/utils` 의 `atomWithStorage` + `createJSONStorage` 사용 |
| 파생값을 별도 state로 관리 | 렌더링 중 직접 계산 |
| useEffect로 state 동기화 | 이벤트 핸들러에서 직접 업데이트 |
| 전역 상태 남용 | 컴포넌트 로컬 state 우선 검토 |
| 폼에서 useState로 각 필드 관리 | React Hook Form 사용 |
| Zod 없이 수동 검증 | zodResolver + Zod 스키마 사용 |
