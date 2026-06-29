# Task Kanban Board Design

> 2026-03-01 | Task 관리 칸반 보드 확장

## 개요

기존 Task 관리 리스트 뷰에 칸반 보드 뷰를 추가한다. 상태(TaskStatus) 컬럼별로 태스크 카드를 배치하고, 드래그&드롭으로 상태 변경 및 순서 조정이 가능하다.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 칸반 컬럼 | 기존 TaskStatus enum 7개 그대로 사용 (스키마 변경 없음) |
| D&D 라이브러리 | @dnd-kit/core + @dnd-kit/sortable |
| 카드 보기 | Compact / Full 2단계 토글 |
| 완료 처리 | done 컬럼으로 D&D (별도 버튼 없음) |
| 뷰 전환 | 탭 방식 [리스트 \| 칸반], URL search param `?view=board` |
| 필터링 | 기존 FilterBar 공유 (뷰 전환 시 필터 유지) |
| 접근 방식 | 방식 B — bulkUpdateOrder API 추가 + TanStack Query 낙관적 업데이트 |

---

## 아키텍처

### 전체 구조

```
TaskListPage
├── FeatureHeader (title + actions)
├── ViewTab  [리스트 | 칸반]
├── FilterBar (공유)
│
├── [리스트 뷰] TaskList (기존)
│
└── [칸반 뷰] TaskBoard
    ├── BoardColumn (status별 7개, canceled/duplicate 접기)
    │   ├── ColumnHeader (상태아이콘 + 이름 + 카운트)
    │   └── BoardCard[] (D&D sortable)
    │       ├── CompactCard (identifier + priority + title)
    │       └── FullCard (+ labels + description + assignee + dueDate)
    └── DndContext (@dnd-kit)
```

### 데이터 흐름

```
1. useTasks(filters) → 기존 쿼리로 전체 태스크 로드
2. 프론트엔드에서 status별 그룹핑 → 컬럼 데이터 생성
3. D&D 이벤트 발생:
   a. 같은 컬럼 내 순서 변경 → bulkUpdateOrder([{id, sortOrder}])
   b. 다른 컬럼으로 이동 → bulkUpdateOrder([{id, status, sortOrder}])
4. TanStack Query onMutate로 낙관적 업데이트 (즉시 UI 반영)
5. 서버 응답 후 캐시 무효화
```

### sortOrder 계산 전략

기존 `sortOrder` 컬럼 (float)을 활용:
- 두 카드 사이에 놓으면: `(prevOrder + nextOrder) / 2`
- 맨 위에 놓으면: `firstOrder - 1024`
- 맨 아래 놓으면: `lastOrder + 1024`
- 정밀도 한계 도달 시 (간격 < 0.001): 해당 컬럼 전체 재번호 매김 (서버에서 처리)

---

## 컴포넌트 설계

### 새로 생성할 파일

```
apps/app/src/features/task/
├── pages/
│   └── task-list.tsx              ← MODIFY (탭 전환 추가)
├── components/
│   ├── task-board.tsx             ← NEW (칸반 보드 메인)
│   ├── board-column.tsx           ← NEW (상태별 컬럼)
│   ├── board-card.tsx             ← NEW (칸반 카드 — Compact/Full)
│   └── view-toggle.tsx            ← NEW (리스트/칸반 탭)
├── hooks/
│   ├── use-task-mutations.ts      ← MODIFY (bulkUpdateOrder 추가)
│   └── use-board-dnd.ts           ← NEW (D&D 로직 커스텀 훅)
└── constants.ts                   ← MODIFY (BOARD_COLUMNS 추가)
```

### 서버 변경

```
packages/features/task/
├── service/
│   └── task.service.ts            ← MODIFY (bulkUpdateOrder 메서드)
├── task.router.ts                 ← MODIFY (bulkUpdateOrder procedure)
├── controller/
│   └── task.controller.ts         ← MODIFY (PATCH /tasks/bulk-order)
└── dto/
    └── bulk-update-order.dto.ts   ← NEW
```

### 핵심 컴포넌트 상세

**TaskBoard** (`task-board.tsx`)
- `@dnd-kit/core`의 `DndContext` + `@dnd-kit/sortable`의 `SortableContext` 사용
- `useSensors`로 마우스/터치/키보드 센서 등록
- `onDragEnd` 핸들러에서 상태 변경 + sortOrder 계산
- `collisionDetection: closestCorners` (컬럼 간 이동에 최적)

**BoardColumn** (`board-column.tsx`)
- `SortableContext`로 감싸서 내부 카드 정렬 가능
- `useDroppable`로 빈 컬럼에도 드롭 가능
- 헤더: 상태 아이콘 + 이름 + 카드 수 + 접기/펼치기 버튼
- canceled/duplicate 컬럼은 기본 접힌 상태

**BoardCard** (`board-card.tsx`)
- `useSortable`으로 D&D 가능한 카드
- Compact/Full 모드 토글 (ViewToggle에서 전역 제어)
- 클릭 시 태스크 상세 페이지로 이동
- 드래그 중 시각적 피드백 (opacity, shadow)

---

## 카드 보기 모드

### Compact Mode
```
┌───────────────────────┐
│ ● TASK-42  ⚡ API 수정 │
└───────────────────────┘
```
- identifier + 우선순위 아이콘 + 제목 (1줄)

### Full Mode
```
┌───────────────────────┐
│ ● TASK-42  ⚡ API 수정 │
│ [bug] [frontend]       │
│ API 응답 포맷 변경...   │
│ 👤 김철수    📅 3/5    │
└───────────────────────┘
```
- identifier + 우선순위 아이콘 + 제목
- 라벨 뱃지 (최대 3개)
- 설명 미리보기 (1줄 truncate)
- 담당자 아바타 + 마감일

### 전환
- `cardSize` 상태: `"compact" | "full"` — localStorage에 저장
- 칸반 뷰 상단 토글 버튼으로 전환

---

## 뷰 전환

- `view` 상태: `"list" | "board"` — URL search param `?view=board`로 관리
- 뷰 전환 시 필터 상태 유지
- 기본값: `"list"` (기존 동작 유지)

---

## D&D 인터랙션

### @dnd-kit 구성

```typescript
useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)
```

### 시나리오별 동작

| 시나리오 | 동작 |
|---------|------|
| 같은 컬럼 내 이동 | sortOrder만 변경 |
| 다른 컬럼으로 이동 | status + sortOrder 변경 |
| 빈 컬럼에 드롭 | status 변경 + sortOrder = 1024 |
| 드래그 취소 (ESC) | 원래 위치로 복원 |
| 접힌 컬럼 위에 드롭 | 컬럼 자동 펼침 + 맨 위에 배치 |

### 드래그 시각 피드백

| 상태 | 시각 효과 |
|------|----------|
| 드래그 시작 | 원래 카드 `opacity-50`, 드래그 오버레이 `shadow-lg scale-105` |
| 컬럼 위 호버 | 컬럼 배경색 하이라이트 (`bg-primary/5`) |
| 드롭 위치 표시 | 카드 사이에 라인 인디케이터 |
| 드롭 완료 | 부드러운 위치 전환 애니메이션 |

---

## 낙관적 업데이트

```typescript
useMutation({
  ...trpc.task.bulkUpdateOrder.mutationOptions(),
  onMutate: async (updates) => {
    await queryClient.cancelQueries({ queryKey: trpc.task.list.queryKey() });
    const previous = queryClient.getQueryData(trpc.task.list.queryKey(filters));
    queryClient.setQueryData(trpc.task.list.queryKey(filters), (old) => {
      // updates 적용하여 UI 즉시 반영
    });
    return { previous };
  },
  onError: (err, updates, context) => {
    queryClient.setQueryData(trpc.task.list.queryKey(filters), context.previous);
    toast.error("이동에 실패했습니다");
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: trpc.task.list.queryKey() });
  },
});
```

---

## 서버 API

### bulkUpdateOrder

```typescript
// tRPC procedure
bulkUpdateOrder: protectedProcedure
  .input(z.object({
    updates: z.array(z.object({
      id: z.string().uuid(),
      status: taskStatusEnum.optional(),
      sortOrder: z.number(),
    })).min(1).max(50),
  }))
  .mutation(...)

// REST endpoint
PATCH /api/task/tasks/bulk-order
```

- 최대 50개 태스크 동시 업데이트
- 트랜잭션으로 원자적 처리
- status 변경 시 activity 로그 자동 생성

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| 서버 응답 실패 | 낙관적 업데이트 롤백 + toast 에러 |
| 네트워크 끊김 | 드래그 비활성화 (isOnline 감지) |
| 동시 편집 충돌 | onSettled에서 서버 데이터로 자동 갱신 |

---

## 테스팅

| 영역 | 테스트 범위 |
|------|-----------|
| Service | `bulkUpdateOrder` 메서드 유닛 테스트 (정상/빈 배열/권한) |
| D&D Hook | sortOrder 계산 로직 (중간값, 맨 위, 맨 아래, 재번호) |
| 런타임 | API curl 테스트 + 브라우저 렌더링 확인 |

---

## 비기능 요구사항

| 항목 | 기준 |
|------|------|
| D&D 반응성 | 드래그 시작 ~ UI 반영 < 16ms (60fps) |
| API 응답 | bulkUpdateOrder < 200ms |
| 대량 카드 | 컬럼당 50+ 카드에서도 스크롤 가상화 없이 성능 유지 |
