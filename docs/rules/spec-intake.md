# 비즈니스 스펙 수용 절차

## 스펙 위치

- `docs/specs/` 에 배치된 문서를 비즈니스 스펙으로 인식한다.

## 구현 전 재정렬 (필수)

스펙을 받으면 바로 코딩하지 않는다. 먼저 다음을 수행:

### 1. 스펙 분석

- 스펙에서 요구하는 엔티티, API, 화면 목록 추출

### 2. 프로젝트 룰 매핑

- DB → Drizzle 스키마 규칙(`backend/schema-dev.md`)에 맞게 테이블 설계
- API → REST/OpenAPI 패턴(`backend/api-strategy.md`, `backend/openapi-codegen.md`)에 맞게 controller/DTO 설계
- Auth → Core Auth 계약(`backend/core-schema.md`) 활용, 커스텀 auth 금지
- UI → shadcn 컴포넌트 우선(`frontend/react-component.md`), 설치된 feature의 위젯 재사용
- 구조 → `feature/definition.md` 패턴으로 폴더 배치

### 3. 기존 자산 활용

- 설치된 feature의 API를 확인하고 중복 구현 방지
- CLAUDE.md의 "설치된 Feature" 테이블 참조
- `docs/reference/` 레퍼런스 문서에서 기존 서비스/모듈 확인

### 4. 구현 계획 작성

- `docs/specs/{name}/implementation-plan.md` 에 재정렬 결과 저장
- 사람에게 리뷰 요청 후 승인되면 구현 시작
