/**
 * @repo/data/react — Story domain React hooks (mutation + query + domain metadata).
 *
 * apps/app/src/features/story/hooks 에서 이전. Phase E (cycle-26 packages/data
 * 분리). hook 의 자체 inter-dep 은 같은 디렉토리 안 relative import 유지.
 *
 * remote 변형 (use-story-mutations-remote, use-story-queries-remote) 의 일부
 * symbol 이 use-story-mutations / use-story-queries 와 이름 충돌 (useEntityTags,
 * useRelations 등). 명시적 re-export 로 ambiguity 해소 — 호출자는
 * DataBackend 기반 use-story-{mutations,queries} 를 사용한다.
 */
export * from "./use-story-domains";
export * from "./use-story-mutations";
export * from "./use-story-queries";
// remote 변형 — 같은 이름 대체 export 만 별도 namespace 로:
export * as remoteMutations from "./use-story-mutations-remote";
export * as remoteQueries from "./use-story-queries-remote";
