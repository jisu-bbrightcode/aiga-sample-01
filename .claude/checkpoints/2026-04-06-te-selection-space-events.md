# Checkpoint: TE.1 Selection + Space + Events (2026-04-06)

## 브랜치
`cyrus/feat/text-editor-te1` @ `938a2a1`

## 완료된 작업

### 1. TextEditorTheme 인터페이스 (`15c4764`)
- 12개 시각 속성을 `TextEditorTheme` 인터페이스로 통합
- `setTheme()` 런타임 테마 변경 API
- Selection: 노란색(`rgba(255,200,0,0.35)`), roundRect(5px), 좌우 여백(3px)
- 클리핑 영역 확장으로 좌측 라운드 잘림 수정

### 2. 공백 렌더링 + IME phantom guard (`9ce35e7`)
- **근본 원인**: pretext가 연속/trailing 공백을 collapse/strip
- **수정**: 단일 라인은 원본 segment 텍스트 직접 사용
- `computeXOffsetsFromPretext`: `indexOf` 기반 segment-to-character 매핑
- `measureSpaceWidth`: pretext로 실제 공백 너비 측정
- IME phantom guard: 시간 기반(50ms) → macrotask 기반(`setTimeout(0)`)

### 3. 더블클릭 단어 선택 (`afd98a6`)
- `PointerEvent.detail`이 0이므로 자체 타이밍 기반 감지 (400ms)
- `findWordBoundaryLeft/Right` 재활용

### 4. React 이벤트 컨벤션 정렬 (`938a2a1`)
- `docChange` → `change`, `focusChange` → `focus`/`blur`, `scrollChange` → `scroll`
- 신규: `wordSelect`, `paste`, `copy`, `ready`, `destroy`
- 총 10개 이벤트

## 다음 작업: Entity Mention 시스템
- entity 마크 커스텀 렌더링 (도트 + 배경)
- `insertEntity` 원자적 커맨드
- entity 마크 원자적 삭제 보호 (부분 삭제 → 전체 삭제)
- 마크 렌더 확장 포인트 (하드코딩 → 훅)

## 남은 기존 버그
- edge-path 테스트 flaky (1개, 무관)
