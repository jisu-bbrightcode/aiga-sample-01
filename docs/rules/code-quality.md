# Code Quality — 구조적 장기 유지를 위한 원칙

> **단기 작동 코드가 아니라 장기 유지되는 코드를 쓴다.**
> if-else 떡칠은 "일단 동작"의 대가로 다음 수정을 3배 느리게 만든다.
> 구조가 무너지기 시작하면 복구 비용은 기하급수로 증가한다.

이 문서는 **원칙 + 실제 Biome 룰 + Product Builder repo 사례**를 엮는다.
자동화(Biome)로 막을 수 있는 것은 전부 막고, 남은 판단은 코드 리뷰에서 걸러낸다.

---

## 왜 이 문서가 있는가

2026-04 시점 Product Builder repo에 대한 Biome 첫 스캔 결과:

- `noExplicitAny`: 689건
- `noNonNullAssertion`: 865건 (`!` 연산자)
- `noNestedTernary`: 285건
- `useMaxParams` (> 4 params): 107건
- `useAwait` (async 인데 await 없음): 507건
- `useConst` (재할당 없는데 `let`): 713건

이들은 대부분 **개별 버그**가 아니라 **구조적 기본기 누락**이다. 한 곳 고쳐도 다른 곳이 같은 패턴. 도구로 차단하지 않으면 돌아온다.

---

## 핵심 원칙

### 1. Make illegal states unrepresentable

타입으로 버그를 컴파일 타임에 막는다. 런타임 `if (x != null)`을 쌓는 대신, 애초에 null이 올 수 없는 타입을 만든다.

```ts
// ❌ 런타임 방어 산개
function send(user: User | null, msg: string | null) {
  if (!user) throw new Error("no user");
  if (!msg) return;
  if (user.banned && !msg.urgent) return;
}

// ✅ 타입으로 제약
interface SendableUser extends User { banned: false }
interface Message { body: string; urgent: boolean }
function send(user: SendableUser, msg: Message) { /* ... */ }
// 호출자가 ban된 user를 전달할 수 없음 — 컴파일 실패
```

핵심 도구: discriminated union, branded type, `never`, `satisfies`.

### 2. Data before control flow

분기 트리를 짜기 전에 **데이터 구조를 먼저** 설계한다. 올바른 데이터 모양은 분기를 반으로 줄인다.

```ts
// ❌ Status 문자열로 직접 분기
function nextActions(status: string): string[] {
  if (status === "draft") return ["edit", "publish", "delete"];
  if (status === "review") return ["approve", "reject", "edit"];
  if (status === "published") return ["unpublish", "archive"];
  if (status === "archived") return ["restore"];
  return [];
}

// ✅ 상태 자체가 데이터를 말하게 한다
const STATE_MACHINE = {
  draft:     { actions: ["edit", "publish", "delete"] as const },
  review:    { actions: ["approve", "reject", "edit"] as const },
  published: { actions: ["unpublish", "archive"] as const },
  archived:  { actions: ["restore"] as const },
} as const;
type Status = keyof typeof STATE_MACHINE;
const nextActions = (s: Status) => STATE_MACHINE[s].actions;
```

### 3. Flat over nested (Early return)

중첩 depth 2 이상 = 리팩토링 신호. Guard clause로 평탄화한다.

```ts
// ❌ 중첩 3단
function handle(req: Req) {
  if (req.user) {
    if (req.user.active) {
      if (req.body) {
        return process(req.user, req.body);
      }
    }
  }
  return null;
}

// ✅ 평탄화
function handle(req: Req) {
  if (!req.user) return null;
  if (!req.user.active) return null;
  if (!req.body) return null;
  return process(req.user, req.body);
}
```

### 4. Polymorphism over switch-on-kind (그러나 exhaustive switch는 OK)

"5개 타입에 따라 같은 함수가 다르게 동작" = lookup 또는 polymorphism. 그러나 **discriminated union + exhaustive switch**는 구조적으로 더 좋다 — 새 타입 추가 시 컴파일 실패로 모든 switch를 찾아줌.

```ts
// ❌ 공통 시그니처 3개가 같은 분기 — 각 호출처마다 복붙
function labelA(node: Node) { switch (node.type) { /* 5 cases */ } }
function labelB(node: Node) { switch (node.type) { /* 5 cases */ } }

// ✅ Lookup map (데이터화)
const LABELS: Record<NodeType, string> = {
  world: "세계", character: "캐릭터", location: "장소",
  faction: "세력", codex: "코덱스",
};
const label = (n: Node) => LABELS[n.type];

// ✅ 각 case가 독립 로직이면: exhaustive switch + assertNever
function render(n: Node): JSX.Element {
  switch (n.type) {
    case "world":     return <WorldCard data={n.data} />;
    case "character": return <CharacterCard data={n.data} />;
    case "location":  return <LocationCard data={n.data} />;
    default: return assertNever(n);
  }
}
function assertNever(x: never): never { throw new Error(`unreachable: ${JSON.stringify(x)}`); }
```

**안 좋은 것:** `switch` 자체가 아니라 *분기 로직이 여러 곳에 중복*되는 것. 한 곳의 exhaustive switch는 장점.

**실제 사례 (repo):** 동일한 도메인 분기 로직이 여러 컴포넌트와 서비스에 복제되면 한 타입 추가가 광범위한 회귀로 번진다.

### 5. Pure by default, effect at the edge

순수 함수를 기본으로 하고, 부수 효과(IO/DOM/DB)는 시스템 경계에서만 발생시킨다 (Functional Core, Imperative Shell).

```ts
// ❌ 중간 레이어에서 DB 접근 — 테스트/재사용 불가
function calculateOrder(userId: string): Money {
  const user = db.users.findById(userId);
  const items = db.cart.findByUser(userId);
  db.logs.write({ userId, total });
  return total;
}

// ✅ 경계에서 I/O, 순수 함수에서 계산
async function processOrder(userId: string) {
  const [user, items] = await Promise.all([
    db.users.findById(userId),
    db.cart.findByUser(userId),
  ]);
  const total = calculateOrder(user, items);
  await db.logs.write({ userId, total });
  return total;
}
function calculateOrder(user: User, items: Item[]): Money { /* 순수 */ }
```

### 6. Explicit over magic

숨은 결합을 만들지 않는다. 매직 넘버/문자열, 암시적 전역 상태, "이 순서로 호출해야 함" 같은 규칙은 모두 코드에 명시한다.

```ts
// ❌ 숫자만 보고 의미 모름
if (user.status === 3) sendEmail();
setTimeout(cleanup, 86400000);

// ✅ 이름이 의미를 말함
const STATUS = { PENDING: 1, ACTIVE: 2, SUSPENDED: 3 } as const;
if (user.status === STATUS.SUSPENDED) sendEmail();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setTimeout(cleanup, ONE_DAY_MS);
```

### 7. Locality of behavior

같이 변경되는 것은 같이 있어야 한다. 한 기능을 수정하려고 5개 파일을 오가야 하면 구조가 잘못된 것 (Shotgun Surgery).

```
❌ "Delete comment" 기능 수정 → 5 파일 수정
  types/comment.ts, api/comments.ts, hooks/useComment.ts,
  components/Comment.tsx, tests/comment.test.ts

✅ 공통 관심사는 한 모듈에
  features/comment/
    ├── schema.ts       (DB + API contract)
    ├── service.ts      (비즈니스 로직)
    ├── ui/Comment.tsx  (UI)
    └── index.ts        (public API)
```

### 8. YAGNI — 지금 필요 없는 추상화는 만들지 않는다

"나중에 쓸 수도 있으니" 만든 추상화는 거의 항상 틀린 모양으로 나중을 맞이한다. **중복 3번이 확인되면** 그때 추출한다 (Rule of Three).

```ts
// ❌ 1번만 쓰이는데 "유연성을 위해" 추상화
interface RenderStrategy<T> {
  canRender(item: T): boolean;
  render(item: T, ctx: RenderContext): Element;
}
class StoryNodeStrategy implements RenderStrategy<Node> { /* ... */ }
// 유일한 구현체 → 인터페이스 삭제, 함수 하나면 충분

// ✅ 중복 3번 이후 추출
// 1st: inline → 2nd: 복붙 → 3rd: "패턴 확인" → 공통 함수
```

---

## TypeScript 도구 상자 (실무 필수)

### `satisfies` 연산자 (TS 4.9+)

타입을 *좁히면서* 범위는 *검증*하고 싶을 때.

```ts
// ❌ 타입 주석 — 리터럴 타입 정보 소실
const routes: Record<string, string> = { home: "/", admin: "/admin" };
routes.whoops;  // 런타임 undefined, 컴파일 통과

// ✅ satisfies — 검증 + 좁은 타입 보존
const routes = {
  home: "/",
  admin: "/admin",
} satisfies Record<string, string>;
routes.whoops;  // 컴파일 에러
```

### `assertNever` 헬퍼

```ts
// packages/shared/src/assert.ts
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}
```

모든 kind 기반 switch의 `default`는 `assertNever`로. 새 kind 추가 → 컴파일 실패.

### `as const`

```ts
const NODE_TYPES = ["world", "character", "location"] as const;
type NodeType = typeof NODE_TYPES[number];  // "world" | "character" | "location"
```

### Branded types (primitive obsession 해소)

```ts
type Brand<T, B> = T & { readonly __brand: B };
export type UserId = Brand<string, "UserId">;
export type ProjectId = Brand<string, "ProjectId">;

// ❌ 인자 뒤바뀌어도 컴파일 통과
function joinProject(userId: string, projectId: string) {}
joinProject(projectId, userId);  // 🐛

// ✅ 뒤바뀌면 컴파일 실패
function joinProject(userId: UserId, projectId: ProjectId) {}
```

### Discriminated unions + Result 타입

```ts
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const r = await fetchUser(id);
if (!r.ok) return notify(r.error);
return render(r.value);
```

---

## 안티패턴 카탈로그

각 항목: **문제 / 대안 / 자동화 도구**. 자동화 열의 Biome 룰은 이 저장소 `biome.json`에 실제로 enable되어 있다.

### A. 제어 흐름

| # | 안티패턴 | 대안 | 자동화 |
|---|---------|------|:------:|
| A1 | 10+ `else if` 체인 (`node-text-pass.ts` 13개) | Lookup map / strategy | 코드리뷰 |
| A2 | 중첩 conditional depth ≥ 4 | Early return / 함수 추출 | Biome `complexity/noExcessiveCognitiveComplexity` (max 15) |
| A3 | 중첩 삼항 (`calendar-timeline.tsx:258` 3단) | if/else 또는 추출 | Biome `style/noNestedTernary` |
| A4 | 불필요한 `else` 뒤 return | Early return | Biome `style/noUselessElse` |
| A5 | switch fallthrough | break 명시 또는 return | Biome `suspicious/noFallthroughSwitchClause` |
| A6 | `!== true` / `=== false` | 긍정 논리 | Biome `style/noNegationElse` |

### B. 함수/인자

| # | 안티패턴 | 대안 | 자동화 |
|---|---------|------|:------:|
| B1 | 파라미터 ≥ 5 (`renderText(ctx,rect,props,value,S)`) | Options 객체 | Biome `complexity/useMaxParams` (max 4) |
| B2 | Boolean flag 파라미터 (`save(data, true)`) | 함수 분리 (`save` / `saveDraft`) | hook |
| B3 | 함수 길이 > 60줄 | 추출 | Biome `complexity/noExcessiveLinesPerFunction` |
| B4 | Cognitive complexity > 15 | 분리 | Biome `complexity/noExcessiveCognitiveComplexity` |
| B5 | Optional 파라미터 3+ | 명시 옵션 객체 | 코드리뷰 |
| B6 | Parameter reassignment | 새 변수 or return | Biome `style/noParameterAssign` |

### C. 타입 시스템

| # | 안티패턴 | 대안 | 자동화 |
|---|---------|------|:------:|
| C1 | `any` (repo 689건) | `unknown` + 타입 가드 | Biome `suspicious/noExplicitAny` |
| C2 | Non-null assertion `!` (repo 865건) | 타입 가드 / 리팩토링 | Biome `style/noNonNullAssertion` |
| C3 | Primitive obsession (`userId: string`) | Branded type | 코드리뷰 |
| C4 | `{}` / `Function` / `Object` 타입 | 구체 타입 | Biome `complexity/noBannedTypes` |
| C5 | `== null` 느슨한 비교 | `=== null` or `??` | Biome `suspicious/noDoubleEquals` |
| C6 | `@ts-ignore` 이유 없이 | 실제 수정 or 상세 주석 | Biome `suspicious/noTsIgnore` |
| C7 | `: number = 0` 추론 가능 | 제거 | Biome `style/noInferrableTypes` |
| C8 | `import { type X }` 값 import에 섞음 | `import type` 분리 | Biome `style/useImportType` |

### D. 데이터·상태

| # | 안티패턴 | 대안 | 자동화 |
|---|---------|------|:------:|
| D1 | 공개 API에서 mutation | 불변 반환 | 코드리뷰 |
| D2 | Magic literal | Named const/enum | 코드리뷰 |
| D3 | 전역 가변 상태 | Store / DI | 코드리뷰 |
| D4 | 중복 진실 원천 (server cache + client state) | TanStack Query 단일 원천 | 코드리뷰 |
| D5 | `let` 재할당 안 함 (repo 713건) | `const` | Biome `style/useConst` |
| D6 | 배열 인덱스를 React key로 | 안정적 id | Biome `suspicious/noArrayIndexKey` |
| D7 | `delete obj.key` | 새 객체 spread | Biome `performance/noDelete` |

### E. 오류 처리

| # | 안티패턴 | 대안 | 자동화 |
|---|---------|------|:------:|
| E1 | Hot path에서 `throw` catch 없음 | Result 타입 | 코드리뷰 |
| E2 | `catch (e) { /* swallow */ }` | 로깅 + rethrow or typed error | Biome `suspicious/noEmptyBlockStatements` |
| E3 | 일어날 수 없는 케이스 방어 | 삭제 (타입이 보증) | 코드리뷰 |
| E4 | `throw "문자열"` | `throw new Error(...)` | 코드리뷰 |
| E5 | 불필요한 try/catch 재throw | 제거 | Biome `complexity/noUselessCatch` |

### F. Async / Promise

| # | 안티패턴 | 대안 | 자동화 |
|---|---------|------|:------:|
| F1 | `async` 인데 `await` 없음 (repo 507건) | async 제거 or await 추가 | Biome `suspicious/useAwait` |
| F2 | Dangling promise | `await` 또는 `void fn()` 명시 | 코드리뷰 |
| F3 | Sequential await (독립 작업) | `Promise.all` | 코드리뷰 |
| F4 | `new Promise((res, rej) => ...)` wrapping | 직접 async | 코드리뷰 |
| F5 | `await` in loop (독립 작업) | `Promise.all(arr.map(...))` | 코드리뷰 |

```ts
// ❌ 순차
const a = await fetchA();
const b = await fetchB();
const c = await fetchC();

// ✅ 병렬
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);

// ❌ loop에서 순차
for (const id of ids) await process(id);

// ✅ 병렬 (순서 상관 없을 때)
await Promise.all(ids.map(process));
```

### G. React 특화

| # | 안티패턴 | 대안 | 자동화 |
|---|---------|------|:------:|
| G1 | `useEffect`로 데이터 fetch | TanStack Query | 코드리뷰 |
| G2 | `useEffect`로 props→state 동기화 | 렌더 중 계산 | 코드리뷰 |
| G3 | `useState` + `useEffect`로 파생값 | `const derived = compute(state)` | 코드리뷰 |
| G4 | 렌더 중 mutation | 순수 반환 | 코드리뷰 |
| G5 | `useMemo/useCallback` 수동 (React Compiler) | 삭제 | 프로젝트 규칙 |
| G6 | `{items.length && <List />}` (0 렌더 버그) | `items.length > 0 && <List />` | 코드리뷰 |
| G7 | Hook을 조건/반복 안에서 호출 | top-level만 | Biome `correctness/useHookAtTopLevel` |
| G8 | Hook dependency 누락 | 전부 포함 | Biome `correctness/useExhaustiveDependencies` |

### H. 모듈/구조

| # | 안티패턴 | 대안 | 자동화 |
|---|---------|------|:------:|
| H1 | Circular import (A→B→A) | 인터페이스 분리 | tsc strict |
| H2 | God file (> 400줄) | 책임 분할 | hook (선택) |
| H3 | 1회만 쓰이는 추상 인터페이스 | 인라인 | 코드리뷰 |
| H4 | Re-export 체인 3+ 단 | 직접 참조 | 코드리뷰 |
| H5 | Shotgun surgery (1기능 = 5+ 파일) | 공통 책임 모듈로 | 코드리뷰 |
| H6 | 미사용 import | 삭제 | Biome `correctness/noUnusedImports` |
| H7 | 미사용 변수 | 삭제 or `_` prefix | Biome `correctness/noUnusedVariables` |

### I. 네이밍

| # | 안티패턴 | 대안 |
|---|---------|------|
| I1 | `data`, `info`, `temp`, `value` (의미 없음) | 구체 (`userList`, `parsedConfig`) |
| I2 | Boolean `hasUser` vs `user` 혼동 | 모든 boolean은 `is/has/can/should` prefix |
| I3 | `getX` (computation) vs `fetchX` (network) 혼용 | `get*` = 빠른 계산, `fetch*` = I/O, `load*` = cache 포함 |
| I4 | 단수 배열 (`user: User[]`) | 복수 (`users: User[]`) |
| I5 | 약어 남발 (`prov`, `cfg`, `usr`) | 풀어 쓰기 — `id` / `url` 관용어는 예외 |

### J. 테스트 친화성

"테스트 작성이 어렵다 = 구조가 나쁘다." 아래가 반복되면 설계를 돌아본다.

| # | 안티패턴 | 대안 |
|---|---------|------|
| J1 | 테스트 setup 50+ 줄 | 의존성 주입 / 순수 함수 분리 |
| J2 | private 메서드 테스트하려고 `as any` | public 인터페이스만 테스트 |
| J3 | 시간에 의존 (`Date.now()`) | Clock 추상화 주입 |
| J4 | 전역 mock이 여러 테스트 간 오염 | `beforeEach` reset or 함수형 테스트 |
| J5 | 네트워크/DB 실제 호출 (unit) | 모의 (integration 레이어에서만 실제) |

---

## Refactoring 경로 (smell → technique)

| Smell | Technique | TS 예시 |
|-------|-----------|---------|
| Long Method | Extract Method → Extract Class | `function f() { /* 80 lines */ }` → 3-4개 함수 |
| Long Parameter List | Introduce Parameter Object | `f(a, b, c, d, e)` → `f(opts: FOpts)` |
| Primitive Obsession | Branded type | `userId: string` → `userId: UserId` |
| Switch Statements (중복) | Replace Conditional with Polymorphism / Map Lookup | 원칙 4 참조 |
| Nested Conditionals | Replace with Guard Clauses | Early return |
| Duplicate Code | Extract Method (after 3rd) | Rule of Three 지킨 뒤 |
| Data Clumps | Extract Class | `(x, y, w, h)` → `Rect` |
| Feature Envy | Move Method | B의 필드만 쓰면 B로 이동 |
| Dead Code | Delete (git 기억함) | |
| Speculative Generality | Inline / Collapse Hierarchy | 1회 쓰는 interface 제거 |

---

## 강제 수준 매트릭스

| 규칙 | Biome (auto) | Hook | 코드 리뷰 |
|------|:------------:|:----:|:---------:|
| `noExplicitAny` | O error | | |
| `noNonNullAssertion` | O error | | |
| `useMaxParams` (max 4) | O error | | |
| `noExcessiveCognitiveComplexity` (15) | O error | | |
| `noExcessiveLinesPerFunction` (60) | O warn | | |
| `noNestedTernary` | O error | | |
| `noFallthroughSwitchClause` | O error | | |
| `noUselessElse` | O error | | |
| `useImportType` | O error | | |
| `useExhaustiveDependencies` | O error | | |
| `useHookAtTopLevel` | O error | | |
| `useAwait` | O error | | |
| `noDoubleEquals` | O error | | |
| `useConst` | O error | | |
| `noUnusedImports` | O error | | |
| `noUnusedVariables` | O error | | |
| Boolean flag param 금지 | | O | |
| God file (> 400줄) | | O | |
| Switch on kind (중복 로직) | | | O |
| Primitive obsession | | | O |
| Shotgun surgery | | | O |
| Dependency direction | | | O |
| 네이밍 컨벤션 | | | O |
| 테스트 친화성 | | | O |

**Biome 룰 상세**: `biome.json` (complexity, style, suspicious, correctness, performance, security + test/bench/engine overrides).

---

## 예외 조항

원칙은 도구지 종교가 아니다. 아래는 허용된 예외:

1. **성능 hot path** — 벤치마크로 증명된 경우 가독성보다 성능 우선 (주석으로 이유 명시 필수)
2. **외부 API 경계** — 타사 라이브러리 타입이 불완전할 때 `unknown` + 한 곳 narrowing 후 전파
3. **프로토타입/spike 코드** — 명시적으로 throw-away인 경우 (2주 내 삭제 or 정리 약속)
4. **레거시 마이그레이션 중간 상태** — 마일스톤 스펙에 명시된 경우

예외를 쓸 때는 **그 파일 상단에 이유 주석**을 남긴다. 주석 없는 예외는 예외가 아니라 부채.

파일/디렉토리 단위 예외는 `biome.json`의 `overrides`에 명시 (test / bench / engine renderer 이미 완화됨).

---

## 이 룰이 작동한다는 신호

- PR diff에서 **1 기능 수정 = 1-3 파일 수정** 유지
- 새 타입/상태 추가 시 **TS가 빠진 호출처를 알려줌**
- 테스트가 **setup 10줄 없이** 핵심 로직만 검증 가능
- 3개월 전 코드를 읽어도 **주석 없이 이해 가능**
- 리뷰에서 "왜 이렇게 짰나요?" 질문 감소
- `pnpm check` 실행 시 **새 PR 기준 위반 증가 0**

하나라도 어그러지면 룰 적용이 느슨해진 것.

---

## 관련 문서

| 문서 | 역할 |
|------|------|
| `CLAUDE.md` (root) | Behavioral meta (think -> simple -> surgical -> verify) |
| `biome.json` (root) | 자동 차단 룰의 진실 공급원 |
| `docs/rules/runtime-verification.md` | 런타임 검증 프로토콜 |
| `docs/rules/frontend/react-component.md` | React Compiler 시대 패턴 |
| `docs/rules/frontend/instant-ui.md` | Loading 0ms Iron Rule |
| `docs/rules/backend/service-impl.md` | NestJS 서비스 패턴 |
| `docs/rules/backend/schema-dev.md` | Drizzle 스키마 컨벤션 |
| `docs/rules/feature/isolation.md` | Feature 격리 원칙 |
