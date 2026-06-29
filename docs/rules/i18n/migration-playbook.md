# i18n Migration Playbook

기존 한글 하드코딩 → i18n key 로 점진 마이그. Tier 단위 진척 추적.

## Tier 분류

| Tier | 영역 | 디렉토리 |
|---|---|---|
| **0** | 완료됨 | `apps/app/src/pages/auth` |
| **1** | 설정/공통 — 가장 자주 보임 | `apps/app/src/pages/settings`, `apps/app/src/pages/gallery`, `apps/app/src/features/common`, `packages/widgets/src/common`, `packages/ui/*` |
| **2** | 메인 워크플로우 | `apps/app/src/features/{project, workspace, onboarding, notification, community, payment}`, `packages/widgets/src/{notification, onboarding, comment, reaction}` |
| **3** | 문서/스토리 워크플로우 | `apps/app/src/features/{story, document, agent-desk, localization, feature-catalog, email}` |

## feature 1개 마이그레이션 절차

```
1. 스캔
   pnpm i18n:detect --feature {name}        → 한글 리터럴 목록
2. 키 설계
   파일별 키 = "{component}.{slot}" 규약 (camelCase, dot-separated)
3. ko.json 작성
   features/{name}/locales/ko.json 에 누락 키 전부 한글로 추가
4. 자동 번역
   pnpm i18n:translate --feature {name}     → en/ja/zh.json 자동 채움
5. 코드 치환
   각 tsx 파일에 useFeatureTranslation("{namespace}") 추가
   한글 리터럴 → t("...") 치환
6. resources 등록
   apps/app/src/lib/feature-i18n.ts 의 resources 객체에 namespace import 추가
7. 검증
   pnpm i18n:verify                         # 키 동기화
   pnpm i18n:detect --feature {name}        # 0 hits
   pnpm --filter app run test:auth          # 기존 regression
   4언어 수동 토글 — LocaleSection 에서 ko ↔ en ↔ ja ↔ zh
8. 커밋
   feat(i18n): migrate {feature} to i18n (Tier N)
   migration-playbook.md 체크리스트 갱신
```

## 진척 체크리스트

작업할 때 `[ ]` → `[x]` 로 갱신. 부분 완료는 ratio 적기.

### Tier 0 (완료)
- [x] `apps/app/src/pages/auth`

### Tier 1
- [x] `apps/app/src/pages/settings` — 전체 마이그 완료 (214 hits → 0). chrome + placeholder + profile + organization + projects + billing 모든 섹션 `page.settings` namespace, 226 키 × 4언어.
- [ ] `apps/app/src/pages/gallery`
- [ ] `apps/app/src/features/common`

### Tier 2
- [ ] `apps/app/src/features/project`
- [ ] `apps/app/src/features/workspace`
- [ ] `apps/app/src/features/onboarding`
- [ ] `apps/app/src/features/notification`
- [ ] `apps/app/src/features/community`
- [ ] `apps/app/src/features/payment`
- [ ] `packages/widgets/src/notification`
- [ ] `packages/widgets/src/onboarding`
- [ ] `packages/widgets/src/comment`
- [ ] `packages/widgets/src/reaction`

### Tier 3
- [x] `apps/app/src/features/story` — 690 hits → 1 의도적 예외 ("#고정" user-input matcher). 33 files, ko.json 43 → 725 keys (+682). 4 locale parity 검증.
- [ ] `apps/app/src/features/document`
- [ ] `apps/app/src/features/localization`
- [ ] `apps/app/src/features/email`

## 커밋 메시지 컨벤션

```
feat(i18n): migrate {feature} to i18n (Tier N)

- {feature} 의 한글 리터럴 N건 → t() 치환
- ko.json: 신규 키 N개
- en/ja/zh.json: 자동 번역
- migration-playbook.md 체크리스트 [x]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## PR 본문 강제 체크 (스킬이 적용)

```
- [ ] pnpm i18n:verify pass
- [ ] pnpm i18n:detect --feature {name} → 0 hits
- [ ] 4언어 수동 토글 스크린샷 첨부 (Tier 1/2 핵심 화면)
- [ ] migration-playbook.md 체크리스트 갱신
```
