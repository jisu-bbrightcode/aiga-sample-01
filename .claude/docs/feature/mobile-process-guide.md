# Mobile Process Screen Guide

> 모바일 환경에서 이어지는 프로세스 화면(wizard/step flow)을 만들 때 참조하는 가이드.
> **참조 예시**: `apps/app/src/features/mobile-registration/`

---

## Scaffold 컴포넌트

`@repo/ui/mobile/scaffold`에서 import.

```
Scaffold (h-dvh, variant: default|secondary)
├── ScaffoldHeader (h-14, onBack/onClose, leftActions/rightActions)
├── ScaffoldContent (flex-1, PullToRefresh 내장)
└── ScaffoldFooter (px-5 py-3)
    └── ScaffoldCTAButton (h-14 full-width Button)
```

### Scaffold

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `variant` | `"default" \| "secondary"` | `"default"` | 배경색: default=`bg-background`, secondary=`bg-muted` |
| `className` | `string?` | - | 추가 클래스 |

### ScaffoldHeader

| Prop | 타입 | 설명 |
|------|------|------|
| `title` | `string?` | 헤더 타이틀 |
| `onBack` | `() => void` | 뒤로가기 (chevron-left 아이콘 자동 표시) |
| `onClose` | `() => void` | 닫기 (x 아이콘 자동 표시) |
| `leftActions` | `Action[]` | 좌측 추가 액션 버튼 |
| `rightActions` | `Action[]` | 우측 추가 액션 버튼 |

```typescript
interface Action {
  icon: IconName; // lucide-react icon name
  label: string;  // sr-only 라벨
  onClick?: () => void;
}
```

### ScaffoldContent

- `flex-1`로 남은 공간을 채움
- **PullToRefresh** 내장 — 모바일에서 아래로 당기면 `router.invalidate()` 호출
- `className`으로 스크롤 영역 커스텀 가능

### ScaffoldFooter

- 하단 고정 영역 (`shrink-0`)
- `px-5 py-3` 패딩, `gap-y-2`로 버튼 수직 배치

### ScaffoldCTAButton

- `@repo/ui/mobile/scaffold-cta-button`에서 import
- `h-14` 높이의 풀폭 버튼
- `variant` prop으로 Button variant 변경 가능
- `disabled` prop으로 비활성 상태 관리

---

## 프로세스 라우트 패턴

### 별도 라우트 방식 (권장)

각 단계를 별도 URL로 분리. 브라우저 뒤로가기/앞으로가기가 자연스럽게 동작.

```
/register           → Step 1: 정보 입력
/register/terms     → Step 2: 약관 동의
/register/confirm   → Step 3: 확인
/register/complete  → Step 4: 완료
```

```typescript
// routes/index.ts
export function createMobileRegistrationRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createRegistrationInfoRoute(parentRoute),
    createRegistrationTermsRoute(parentRoute),
    createRegistrationConfirmRoute(parentRoute),
    createRegistrationCompleteRoute(parentRoute),
  ];
}
```

### 단일 페이지 방식 (대안)

`useState`로 step 관리. URL이 변하지 않음. 간단한 플로우에 적합.

```typescript
const [step, setStep] = useState(1);
// step === 1 && <StepInfo />
// step === 2 && <StepTerms />
```

> 참고: `apps/app/src/features/booking/pages/create-booking.tsx`가 단일 페이지 방식 예시.

---

## 프로세스 상태 관리

### Jotai atom (권장 — 별도 라우트 방식)

라우트 간 폼 데이터를 공유하려면 Jotai atom 사용.

```typescript
// hooks/use-registration-store.ts
const registrationAtom = atom<RegistrationData>({ ... });

export function useRegistrationStore() {
  const [data, setData] = useAtom(registrationAtom);

  const updateField = <K extends keyof RegistrationData>(
    key: K,
    value: RegistrationData[K],
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => { setData(initialData); };

  return { data, updateField, reset };
}
```

### 완료 시 상태 초기화

마지막 화면(Complete)의 `useEffect` cleanup에서 `reset()` 호출.

```typescript
useEffect(() => {
  return () => { reset(); };
}, [reset]);
```

---

## Step Indicator 패턴

각 페이지에서 동일한 `StepIndicator` 컴포넌트 사용. `currentStep` prop으로 현재 단계 표시.

```typescript
<StepIndicator currentStep={2} />
```

- 현재 단계: `bg-primary text-primary-foreground`
- 완료 단계: `bg-primary/20 text-primary`
- 미완료 단계: `bg-muted text-muted-foreground`

> `StepIndicator`는 첫 번째 페이지에서 정의하고 다른 페이지에서 import.

---

## 페이지 구조 템플릿

```typescript
import { useNavigate } from "@tanstack/react-router";
import {
  Scaffold,
  ScaffoldHeader,
  ScaffoldContent,
  ScaffoldFooter,
} from "@repo/ui/mobile/scaffold";
import { ScaffoldCTAButton } from "@repo/ui/mobile/scaffold-cta-button";

export function StepPage() {
  const navigate = useNavigate();

  const handleNext = () => {
    navigate({ to: "/next-step" });
  };

  const handleBack = () => {
    navigate({ to: "/prev-step" });
  };

  return (
    <Scaffold variant="secondary">
      <ScaffoldHeader title="프로세스 제목" onBack={handleBack} />
      <ScaffoldContent>
        <div className="flex flex-col gap-8 px-5 py-6">
          <StepIndicator currentStep={N} />
          {/* 콘텐츠 */}
        </div>
      </ScaffoldContent>
      <ScaffoldFooter>
        <ScaffoldCTAButton disabled={!isValid} onClick={handleNext}>
          다음
        </ScaffoldCTAButton>
      </ScaffoldFooter>
    </Scaffold>
  );
}
```

---

## 체크리스트

새 모바일 프로세스 feature 생성 시:

1. **Jotai store 생성** — 프로세스 전체에서 공유할 폼 상태 정의
2. **페이지 생성** — 각 단계별 페이지 컴포넌트 (Scaffold 레이아웃)
3. **StepIndicator** — 첫 페이지에서 정의, 나머지에서 import
4. **routes/index.ts** — `create{Feature}Routes()` 함수로 라우트 묶기
5. **router.tsx** — `...create{Feature}Routes(rootRoute)` 등록
6. **Complete 페이지** — `useEffect` cleanup에서 store reset
