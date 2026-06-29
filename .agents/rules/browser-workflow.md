---
description: 브라우저 서브에이전트를 활용한 UI 검증 워크플로우. 프론트엔드 작업 시 필수 적용.
activation: always_on
---

# Browser-Based UI Verification

## 핵심 원칙

> **코드를 작성한 후, "완료"라고 하기 전에 반드시 브라우저에서 검증한다. 예외 없음.**

## Dev Server URLs

| App | URL | Description |
|-----|-----|-------------|
| Frontend (User) | http://localhost:3000 | 일반 유저용 앱 |
| Frontend (Admin) | http://localhost:3001 | Admin 앱 |
| Backend API | http://localhost:3002 | Product Builder Server |
| Swagger | http://localhost:3002/api-docs | API 문서 |

## 프론트엔드 검증 절차

### 1. 페이지 접속
- 변경한 페이지 URL로 브라우저 네비게이션
- 예: http://localhost:3000/blog, http://localhost:3001/admin/blog

### 2. 렌더링 확인
- 페이지가 에러 없이 렌더링되는지 확인
- 빈 화면/에러 화면이 아닌 정상 렌더링
- 스크린샷 캡처로 시각적 확인

### 3. 콘솔 에러 확인
- 브라우저 콘솔에 critical 에러가 없는지 확인
- warning은 허용, error는 조사 필요

### 4. UI 요소 확인
- 제목, CTA 버튼, 데이터 목록 등 핵심 요소 표시 여부
- Feature → FeatureHeader → FeatureContents 구조 확인
- 반응형 레이아웃 확인 (필요 시 뷰포트 리사이즈)

### 5. 인터랙션 테스트
- 폼 제출, 버튼 클릭, 네비게이션 등 주요 인터랙션
- 데이터 로딩/에러 상태 전환

## Backend 검증

### API 엔드포인트 테스트
터미널에서 curl로 확인:
```bash
# REST API
curl -s http://localhost:3002/api/{feature}/{endpoint}

# tRPC
curl -s "http://localhost:3002/trpc/{feature}.{procedure}"
```

### Swagger 확인
http://localhost:3002/api-docs 에서 브라우저로 API 문서 확인 가능

## 검증 결과 보고

검증 완료 후 반드시 결과를 보고:

```
### 검증 결과
**빌드**: tsc --noEmit 통과
**브라우저**: /{page} 페이지 정상 렌더링 확인
  - 콘솔 에러 없음
  - 주요 UI 요소 표시 확인
  - [스크린샷 첨부]
**API**: (해당 시)
  - GET /api/{feature} → 200
```

## 테스트 계정

| ID | PW |
|----|------|
| qa@test.com | q1w2e3r4t5 |

로그인이 필요한 페이지 테스트 시 사용
