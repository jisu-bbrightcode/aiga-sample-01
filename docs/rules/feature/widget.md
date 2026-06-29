# Widget Feature Rules

`packages/widgets`는 앱과 admin, 외부 embed에서 재사용되는 connected UI 패키지다.

## 원칙

- Widget은 host가 주입한 API context를 사용한다.
- Widget 내부에서 app-local 모듈(`@/lib/*`, `@/features/*`)을 import하지 않는다.
- 데이터 접근은 generated REST client를 감싼 widget API context/hook을 통한다.
- UI는 `packages/ui`와 widget-local hook으로 구성한다.

## 구조

```
packages/widgets/src/{feature}/
├── {feature}-section.tsx
├── use-{feature}-queries.ts
├── use-{feature}-mutations.ts
└── index.ts
```

## 금지

- Widget 전용 transport client를 새로 생성
- host 인증 헤더를 우회
- 컴포넌트에서 raw `fetch` 호출
- raw `error.message` 렌더링

## 참조

- Frontend REST rules: `docs/rules/frontend/rest-client.md`
- Widget API context: `packages/widgets/src/common/api-context.tsx`
