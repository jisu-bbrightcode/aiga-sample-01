# App Loading Strategy

적용 범위: `apps/app`

이 문서는 Product Builder 앱의 로딩 UX 기준이다. 목표는 로딩 컴포넌트를 예쁘게 통일하는 것이 아니라, 로딩이 거의 보이지 않는 제품 경험을 만드는 것이다. 사용자가 `auth -> workspace -> projects` 같은 내부 단계를 연속 로딩으로 느끼면, 시스템이 느리다고 판단한다.

## North Star

Product Builder는 가능한 한 loading-free design을 지향한다. 좋은 로딩 화면을 많이 만드는 것이 아니라, 로딩 화면이 필요 없을 정도로 빠르게 준비하고 반응하는 것이 기준이다.

- 로딩 UI는 기본값이 아니라 마지막 수단이다.
- 화면 전환은 이미 준비된 서버 데이터, route preloading, query cache, optimistic state로 처리한다.
- 사용자가 기다려야 하는 구간은 제품 성능 문제로 보고, 먼저 데이터 경로와 runtime bootstrap을 줄인다.
- Product Builder의 데이터 기준은 서버 권위 경로다.
- 캐시는 허용되더라도 서버 데이터를 빠르게 다시 보여주는 보조 수단이다.
- Lottie, spinner, skeleton은 제품의 주인공이 아니다. 사용자가 보는 것은 작업 공간과 콘텐츠여야 한다.

## Principles

1. 먼저 로딩을 없앨 수 있는지 검토한다.
   - 새 로딩 컴포넌트를 추가하기 전에 prefetch, query cache, stale-while-revalidate, route chunk preload, optimistic render로 대체할 수 있는지 확인한다.
   - 서버 데이터 요청은 화면 진입 전에 가능한 범위까지 준비하고, 이미 표시된 데이터는 background refresh 중에도 유지한다.
   - 이미 표시된 콘텐츠가 있으면 지우고 로딩으로 바꾸지 않는다.

2. 앱 진입 로딩은 한 번만 보인다.
   - `/` 새로고침에서는 인증 확인, active workspace 확인, 홈 프로젝트 목록 prefetch를 하나의 bootstrap 단계로 취급한다.
   - `/p/:projectId/*` 새로고침에서는 인증 확인, active workspace 확인, app shell chunk load, 현재 page chunk preload, project data prefetch를 하나의 project entry 단계로 취급한다.
   - 사용자에게는 fullscreen Lottie만 보인다. `앱 준비 중`, `프로젝트 준비 중` 같은 상태명은 접근성 라벨로만 유지하고 화면 텍스트로 렌더링하지 않는다.

3. shell이 뜬 뒤에는 전체 로딩을 다시 띄우지 않는다.
   - 사이드바, topbar, workspace crumb이 보인 뒤에는 큰 Lottie를 다시 표시하지 않는다.
   - 이후 데이터 갱신은 기존 콘텐츠 유지, 작은 상태 표시, 또는 영역 placeholder를 사용한다.

4. 부분 로딩은 조용하게 처리한다.
   - 목록, 패널, 모달 내부, 저장/동기화 상태는 `AppQuietLoadingState` 또는 `QuietLoadingIndicator`를 사용한다.
   - 버튼 내부 로딩은 Lottie 적용 대상이 아니다. 버튼은 기존 텍스트 또는 버튼 전용 작은 spinner 패턴을 유지한다.

5. 가능한 경우 로딩 화면 대신 데이터를 미리 준비한다.
   - 홈 진입 전 `project.list`를 prefetch한다.
   - 캐시된 데이터가 있으면 목록을 유지하고 refetch 상태만 작게 표시한다.

## Loading Types

| Type                 | Component                                                            | Usage                                                                             |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Blocking app loading | `AppAuthLoadingState`, `AppWorkspaceLoadingState`, `AppLoadingState` | 인증/워크스페이스 확인, 앱 bootstrap, 프로젝트 open처럼 화면 조작이 불가능한 상태 |
| Quiet area loading   | `AppQuietLoadingState`                                               | route chunk, 목록, 패널, 설정/결제/이메일 영역 등 화면 일부만 기다리는 상태       |
| Inline loading       | `QuietLoadingIndicator`                                              | 저장 중, 동기화 중, 모달 진행 상태 등 작은 진행 상태                              |
| Button loading       | 기존 버튼 패턴                                                       | 버튼 내부 spinner/text. Lottie 금지                                               |

## Home Bootstrap Flow

`/` 진입은 `DashboardLayout`에서 관리한다.

```text
authenticatedAtom === null
  -> AuthGuard loadingFallback: AppAuthLoadingState(loaderLabel="세션 확인 중")

authenticated === true
  -> useRequireActiveWorkspace(true)
  -> session activeOrganizationId 확인

workspace ready
  -> queryClient.prefetchQuery(trpc.project.list.queryOptions())
  -> project.list cache 준비

prefetch done
  -> Dashboard shell + UserHome render
  -> ProjectListPage는 cache hit로 즉시 grid 렌더
```

워크스페이스 전환 시에는 이전 workspace의 프로젝트 캐시를 제거한 뒤 새 `project.list`를 prefetch하고 `/`로 이동한다.

## Implementation Entry Points

| Area                      | File                                                         | Responsibility                                                               |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Shared loading components | `apps/app/src/components/app-loading.tsx`                    | Lottie loading, quiet loading, inline loading primitives                     |
| Home bootstrap            | `apps/app/src/layouts/dashboard-layout.tsx`                  | `project.list` prefetch, single fullscreen bootstrap loading                 |
| Workspace guard           | `apps/app/src/pages/auth/use-require-active-workspace.ts`    | active workspace check and `/workspace-select` redirect                      |
| Story project entry       | `apps/app/src/features/story/pages/workspace-page.tsx`       | auth/workspace guard, Story app shell lazy load, current route chunk preload |
| Story route preload       | `apps/app/src/features/story/routes/story-route-modules.ts`  | current `/p/:projectId/*` page chunk preload before shell/content render     |
| Home grid fallback        | `apps/app/src/features/project/pages/project-list-page.tsx`  | rare no-cache project fallback as card-ratio placeholder grid                |
| Project queries           | `apps/app/src/features/project/hooks/use-project-queries.ts` | `trpc.project.list` query consumer                                           |

## Do / Do Not

Do:

- Use one fullscreen loading for app bootstrap.
- Prefetch route-critical data before rendering a shell that depends on it.
- Keep existing content visible during background refetch when possible.
- Use card/table/panel-shaped placeholders only when there is no cached data.
- Respect `motion-safe:*` for subtle placeholder animation.
- Keep fullscreen loading visually textless. Use `loaderLabel` for accessibility instead of visible copy.

Do not:

- Show `AuthGuard` spinner, then workspace loading, then project loading as separate visible phases.
- Put Lottie inside buttons.
- Use large Lottie for table rows, cards, modal progress, save state, or sync state.
- Show a placeholder for very short transitions if cached content can remain visible.
- Reintroduce loading changes in community pages unless explicitly requested.

## Current Decisions

- Lottie asset: `apps/app/public/loading/liquid-splats.lottie`
- Lottie color: black monotone
- Lottie size tokens: doubled from the original common loading implementation
- `/` hard refresh: single textless fullscreen Lottie until auth/workspace/project list bootstrap is ready
- `/p/:projectId/lore` hard refresh: no visible `페이지 로딩... -> 프로젝트 로딩... -> 페이지 로딩...` chain. The current Story route chunk is preloaded while the app shows the single textless fullscreen Lottie.
- Project list fallback: card-ratio placeholder grid, only when `ProjectListPage` has no data yet
- Workspace picker list: quiet loading, not Lottie
- Buttons: excluded
- Community feature: excluded

## Verification

When changing loading behavior, run:

```sh
pnpm --filter app exec vitest run src/components/app-loading.test.tsx src/features/project/pages/project-list-page.test.tsx src/pages/auth-signup-flow.test.tsx
pnpm exec biome check apps/app/src/components/app-loading.tsx apps/app/src/layouts/dashboard-layout.tsx apps/app/src/features/project/pages/project-list-page.tsx
pnpm --filter app exec vite build
git diff --check
```

For browser QA, try chrome-devtools MCP first. If it is unavailable or fails with issues such as `Transport closed`, use Playwright as the fallback and report the fallback reason plus the tested scenario.

## References

- Material Design progress/activity: use a single visual indicator per operation and choose determinate/indeterminate by task type. https://m1.material.io/components/progress-activity.html
- MDN perceived performance: perceived speed is shaped by visual stability and responsiveness, not only actual network time. https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Perceived_performance
- TanStack Query prefetching: route-critical data can be fetched before rendering the target experience. https://tanstack.com/query/latest/docs/framework/react/guides/prefetching
- TanStack Router preloading: upcoming route assets/data can be prepared before navigation. https://tanstack.com/router/latest/docs/guide/preloading
