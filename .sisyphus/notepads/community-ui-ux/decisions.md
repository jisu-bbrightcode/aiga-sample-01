# Community UI/UX Decisions

## Design Decisions

- 프리미엄 포럼 스타일 (Discourse/dev.to)
- 테마 에픽 취소 — 기존 light/dark 유지
- 백엔드 karma API 1건 scope 예외 허용
- Card 박스 → 행 기반 레이아웃 전환
- 기존 @repo/ui TipTap 에디터 재사용, 새 라이브러리 도입 금지
- motion v12만 사용, @formkit/auto-animate 도입 금지

## E1-T4

- 커뮤니티 홈 피드 정렬 컨트롤은 드롭다운보다 즉시 전환 가능한 인라인 탭 UI를 기본으로 채택
- 파일명/컴포넌트명을 `sort-tabs.tsx` / `SortTabs`로 통일해 의도(탭형 정렬)를 명시

## E2-T8

- Post submit content는 `formData` string 대신 `editorContent` JSON state로 관리하고 submit 시 직렬화
- 빈 TipTap 문서(`doc/paragraph` only)는 `extractPlainText` 기반 검증으로 차단

## E3-T13

- depth 3 이상 댓글은 기본 접힘 상태를 채택하고, 헤더 토글은 기존처럼 전체 본문 토글로 유지
- 접힘 상태의 보조 UI는 `답글 X개 접힘` 텍스트 대신 `▼ N개 답글 더 보기` 버튼으로 대체
- 애니메이션은 `motion/react` 직접 사용(AnimatePresence + motion.div), reduced motion 사용자는 duration 0으로 즉시 토글

## E4-T17

- vote 점수 전환은 기존 레이아웃 구조를 유지하면서 `<span>`만 `AnimatePresence + motion.span`으로 교체하는 방식 채택
- 실패 피드백은 버튼 개별이 아닌 vote 컨테이너 단위의 subtle horizontal shake로 적용
- reduced motion 사용자는 진입/퇴장 및 shake 모두 비활성화하여 시각 효과 대신 즉시 상태 반영을 우선
