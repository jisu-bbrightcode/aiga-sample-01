# PB-COMM-001 — 커뮤니티 feature 재사용/확장 범위

- Issue: `BBR-585` `[PB-COMM-001]`
- Product Builder build: `bp-0b891299-66b7-438f-a3a4-7a63fbf8632b`
- Blueprint: `온라인 서비스` (online-service-standard)
- Role: Solution Architect
- Decision(board): **EXTEND** (`community.capability-scope`)
- Status 선행: PB-REUSE-001(BBR-487) ✅ done · PB-DECIDE-001(BBR-488) ✅ done · PB-WEB-002(BBR-580) ✅ done · PB-BASE-001(BBR-496) ✅ done
- 작성일: 2026-06-30

> 이 문서는 커뮤니티를 **선택형 재사용 feature**로 고정하고, 그 구현 작업을 이미 board에 고정 생성된
> 하위 issue 묶음(PB-COMM-DATA-001 ~ PB-COMM-QA-001, BBR-586~624·699·700·703)에 전달하기 위한
> **범위·판정·UGC 안전 정책의 확정과 핸드오프 게이트** 문서다. 본 issue는 코드 구현이 아니라 범위/정책 확정이 deliverable이다.
> (선례: `doc/plans/PB-FILE-001-vercel-blob-file-upload-scope.md`)

---

## 1. 결정 요약 (locked)

| 항목 | 결정값 | 근거 |
|---|---|---|
| 분류 | **선택 가능한 재사용 feature** (프로젝트별 도메인 기능 카드 아님) | 워크플로 룰: 커뮤니티 = 선택형 재사용 capability (AC#1) |
| 선택 여부(이 빌드) | **선택됨 → EXTEND 실행** | board Decision=EXTEND + PB-COMM 묶음 42개 고정 생성됨 |
| feature-level 판정 | **EXTEND** (base 플랫폼 + Flotter reference 위에 확장) | 워크플로 룰 |
| capability-level 판정 | **REUSE(cross-cutting) + NEW(커뮤니티 도메인)** | base에 community capability **부재** (§2), PB-BASE-001 GAP→NEW 선례 |
| Source of truth | base 플랫폼 = `product-builder-base@111d7721` (auth/file/admin/email/search) · 커뮤니티 도메인 = **NEW** · Flotter = **reference-only** | PB-BASE-001 검증 |
| 데이터/배포 | Neon + Vercel · Drizzle · NestJS(apps/server) · tRPC 제외 | 워크플로 룰 / PB-BASE-001 stack |
| 공개/보호 경계 | 공개 탐색 비로그인 허용 + 보호 액션(가입/작성/투표/신고/차단)은 로그인 모달 게이트 | 워크플로 룰 / PB-WEB-002 패턴 |
| UGC 안전 | Apple 1.2 + Google Play UGC 5요건 = **구현 task로 추적**(§5) | AC#3 |

### 핵심 SA 판정 (가장 중요)

board의 feature-level `EXTEND`는 capability-level에서 다음으로 분해된다 (AC: REUSE/EXTEND vs NEW 명시 분리):

- **커뮤니티 도메인 자체(spaces/멤버십/게시글/댓글/리액션/투표/karma/피드/모더레이션)는 base에 존재하지 않는다 → NEW 구현.**
  PB-BASE-001 capability registry(§2)에 community 항목이 **없다**. `EXTEND`를 base community capability에 대한 REUSE로 오해하면 안 된다.
- **확장의 의미 = 횡단(cross-cutting) base/기납품 capability를 재사용**하고 그 위에 커뮤니티 도메인 delta를 **NEW**로 올린다.
  이는 PB-BASE-001이 `admin/user-management` GAP을 NEW/EXTEND로 전환한 것과 동일한 원칙이다.

> 이 판정은 board 결정을 **부정하지 않고 정련**한다: feature는 선택되어 실행(EXTEND)하되, 구현 task의 실제 결정값은
> "횡단 REUSE + 도메인 NEW"다. Flotter는 복사 대상이 아니라 도메인 모델/모더레이션 흐름의 **reference**로만 추적한다.

---

## 2. base 현황과 재사용 가능한 횡단 capability

PB-BASE-001(BBR-496) capability registry 기준 (pin `product-builder-base:<path>@111d7721`). **community feature는 registry에 없음.**

### 2.1 재사용(REUSE/EXTEND) 대상 = 횡단 capability

| capability | 출처 | 커뮤니티에서의 재사용 | 판정 |
|---|---|---|---|
| auth/session-core | base `packages/core/auth`, `core/nestjs/auth`, `apps/server/src/auth` (better-auth 1.5.5) | 작성자/멤버 신원, 보호 액션 가드(BetterAuthGuard) | ✅ REUSE |
| auth/public-action-modal | base `packages/ui/.../auth/auth-form.tsx` | 비로그인 탐색 + 가입/작성/투표/신고 시 로그인 모달 | 🟡 EXTEND (return-to-action) |
| admin/shell·RBAC·audit | 기납품 `OrgAdminGuard` + `admin_audit_log` + `AdminAuditService` (PB-ADMIN-001, main) | 모더레이션/통계 관리자 게이트 + 모든 운영 조치 감사 | ✅ REUSE/EXTEND |
| file-upload (Vercel Blob) | 기납품 `@repo/features/file-upload` + `@repo/ui/file-upload` (PB-FILE-*, main) | 게시글/댓글 첨부 이미지·파일 | ✅ REUSE |
| email/notification (Resend) | 기납품 email registry + Resend (PB-NOTI-EMAIL-*, main) | 신고 접수/모더레이션 결과/제재·이의제기 알림 | ✅ REUSE/EXTEND |
| search (FTS) | 기납품 `@repo/features/service-search` tsvector + `pg_trgm` (PB-FEAT-FR003, main) | 게시글/커뮤니티 검색 패턴 재사용 | 🟡 EXTEND (패턴 재사용) |
| personalization | 기납품 `@repo/features/personalization` (PB-FEAT-FR002, main) | 저장/구독/피드 개인화 연계 패턴 | 🟡 EXTEND |

### 2.2 base에 없는 것 = NEW delta (커뮤니티 도메인, 구현 대상)

- ❌ **커뮤니티(space) 데이터/정책 모델**: space·membership·post·comment·reaction·poll·karma·rule/flair·report·block·hide·filter·sanction·appeal·moderation 테이블 전무.
- ❌ **커뮤니티 REST API**: 위 모든 도메인의 CRUD/운영/모더레이션 엔드포인트.
- ❌ **피드 랭킹 / karma 산식**: 커뮤니티 고유 정렬·점수 로직.
- ❌ **UGC 안전 레이어**: 신고·차단·숨김·금칙어 필터·모더레이션 큐·제재/이의제기 워크플로.
- ❌ **사용자 UI / 관리자 모더레이션·통계 UI**.

> EXTEND 원칙: §2.1 횡단 capability는 그대로 재사용하고, §2.2 커뮤니티 도메인 delta만 NEW로 구현한다. 횡단 capability를 다시 만들지 않는다.

---

## 3. 커뮤니티 feature 범위 (포함/제외 명시 — AC#2)

선택 시 다음 도메인을 **모두 포함**(EXTEND 실행). 각 항목은 board 묶음 issue로 추적된다(§6).

| 도메인 | 포함 여부 | 비고 |
|---|---|---|
| 커뮤니티 생성/수정/삭제(archive) (CRUD) | ✅ 포함 | SPACE-API-* |
| 가입/탈퇴/구독 (membership) | ✅ 포함 | MEMBERSHIP-API |
| 멤버/모더레이터 조회·권한 | ✅ 포함 | MEMBER-API, MODERATOR-API |
| 게시글 CRUD + 운영 액션 | ✅ 포함 | POST-API-*, POST-OPS-API |
| 댓글 CRUD + 운영 액션 | ✅ 포함 | COMMENT-API-*, COMMENT-OPS-API |
| 리액션(생성/변경/삭제/조회) | ✅ 포함 | REACTION-API-* |
| 투표(poll) | ✅ 포함 | POLL-API |
| 피드 랭킹 | ✅ 포함 | FEED-RANKING-API |
| karma | ✅ 포함 | KARMA-API |
| 규칙/flair/금칙어 | ✅ 포함 | RULES-FLAIR-API |
| 티어/onboarding | ✅ 포함 | TIER-ONBOARDING-API |
| 신고(콘텐츠/작성자) | ✅ 포함 | REPORT-API-CREATE |
| 작성자 차단/해제 | ✅ 포함 | BLOCK-API-CREATE/DELETE |
| 콘텐츠 숨김/해제 | ✅ 포함 | HIDE-API-CREATE/DELETE |
| 정책 필터 | ✅ 포함 | FILTER-API |
| 제재/이의제기 | ✅ 포함 | SANCTION-APPEAL-API |
| 관리자 모더레이션(큐/조치) | ✅ 포함 | MODERATION-API-LIST/ACTION, ADMIN-001 |
| 관리자 운영 통계 | ✅ 포함 | ADMIN-STATS-001 |
| 사용자 UI | ✅ 포함 | UI-001 |
| 안전 정책 / QA | ✅ 포함 | SAFETY-001, QA-001 |
| 실시간 채팅/DM | ❌ 제외 | 본 커뮤니티 범위 아님 (별도 feature 필요 시 신규 issue) |
| 외부 SNS 연동/크로스포스팅 | ❌ 제외 | 범위 외 |

---

## 4. 공개/보호 경계 & 데이터 정책 (구현 전 확정)

- **공개 탐색(비로그인)**: 게시판/게시글/댓글 읽기는 공개 가능(공개 커뮤니티 한정). 비공개 커뮤니티/멤버 전용 콘텐츠는 멤버십 검증.
- **보호 액션(로그인 모달 게이트)**: 가입/탈퇴, 게시글·댓글 작성/수정/삭제, 리액션, 투표, 신고, 차단, 구독 = `auth/public-action-modal`(return-to-action) 패턴(PB-WEB-002).
- **권한 모델**: author(본인 콘텐츠), member(커뮤니티 참여), moderator(해당 커뮤니티 모더레이션), admin(전역 모더레이션/통계, `OrgAdminGuard`).
- **소프트 삭제/숨김 분리**: 삭제(작성자/모더레이터)와 숨김(모더레이션)·차단(사용자별 뷰 필터)은 별도 상태로 모델링 — 복구/감사 가능.
- **감사**: 모든 모더레이션/제재/숨김/차단 조치는 `admin_audit_log` 패턴으로 기록(누가/언제/무엇을/사유).
- **에러 표면**: 사용자 노출 에러는 stable code → i18n(ko/en/ja/zh) 매핑만 사용(원문 leak 금지, CLAUDE.md §5).

---

## 5. UGC 안전 요구 체크리스트 (Apple App Store + Google Play) — AC#3

사용자 생성 콘텐츠가 있는 커뮤니티는 스토어 심사 요건을 충족해야 한다. 각 요건을 **구현 task로 추적**한다.

### 5.1 Apple App Store Review Guideline 1.2 (User-Generated Content)

| Apple 1.2 요건 | 충족 task |
|---|---|
| 게시 전/후 objectionable material 필터링 방법 | FILTER-API(BBR-619) 금칙어/정책 필터 + RULES-FLAIR-API(BBR-608) |
| 불쾌 콘텐츠 **신고** 메커니즘 + 적시 대응 | REPORT-API-CREATE(BBR-614) + MODERATION-API-LIST/ACTION(BBR-620/621) |
| 학대 사용자 **차단** 기능 | BLOCK-API-CREATE/DELETE(BBR-615/616) |
| 게시된 연락처(앱 내 신고/문의 경로) | ADMIN-001(BBR-699) 모더레이션 + SAFETY-001(BBR-623) 정책 공개/연락 경로 |

### 5.2 Google Play — User Generated Content 정책

| Google Play UGC 요건 | 충족 task |
|---|---|
| 앱 내 UGC **모더레이션 시스템** | MODERATION-API-LIST/ACTION(BBR-620/621) + ADMIN-001(BBR-699) |
| 앱 내 **신고/플래그**(콘텐츠·사용자) | REPORT-API-CREATE(BBR-614) |
| 앱 내 **사용자 차단** | BLOCK-API-CREATE/DELETE(BBR-615/616) |
| objectionable 콘텐츠/사용자 **제거·차단** 조치 | HIDE-API-CREATE/DELETE(BBR-617/618) + SANCTION-APPEAL-API(BBR-609) + MODERATION-API-ACTION(BBR-621) |
| 게시 정책/커뮤니티 가이드라인 공개 | RULES-FLAIR-API(BBR-608) + SAFETY-001(BBR-623) |

### 5.3 공통 안전 보강 (정책으로 고정)

- **신고 → 큐 → 조치 → 제재 → 이의제기** 닫힌 루프(REPORT → MODERATION → SANCTION-APPEAL)로 "적시 대응" 증빙.
- **사용자별 차단/숨김 뷰 필터**: 차단한 작성자/숨긴 콘텐츠는 신고자 뷰에서 제외(FILTER-API).
- **모더레이션 조치 감사 로그** + 관리자 통계(ADMIN-STATS-001)로 심사 대응 자료 확보.
- 안전 요건 **E2E 검증** = QA-001(BBR-703): 신고/차단/숨김/필터/모더레이션 플로우.

---

## 6. 구현 전달 issue 묶음 (handoff bundle — board 고정 생성됨)

본 PB-COMM-001은 이 묶음의 **scope/정책 게이트**다. done 시 하위 묶음(현재 all `todo`)이 순차 진행 대상이 된다.

| Stage | Issue(BBR) | PB id | capability 판정 |
|---|---|---|---|
| Scope (this) | 585 | PB-COMM-001 | gate |
| Data/정책 모델 | 586 | PB-COMM-DATA-001 | **NEW** |
| Space CRUD | 587/588/589/590 | SPACE-API-LIST/CREATE/UPDATE/DELETE | **NEW** |
| 멤버십 | 591/592/593 | MEMBERSHIP / MEMBER / MODERATOR-API | **NEW** (auth REUSE) |
| 게시글 | 594/595/596/597/598/603 | POST-API-LIST/READ/CREATE/UPDATE/DELETE + POST-OPS | **NEW** (file/search REUSE) |
| 댓글 | 599/600/601/602/604 | COMMENT-API-LIST/CREATE/UPDATE/DELETE + COMMENT-OPS | **NEW** |
| 참여(engagement) | 605/606/607/610/611/612/613 | POLL / FEED-RANKING / KARMA / TIER-ONBOARDING / REACTION-LIST/SET/DELETE | **NEW** |
| 규칙/정책 | 608 | RULES-FLAIR-API | **NEW** |
| UGC 안전 | 614/615/616/617/618/619/609 | REPORT / BLOCK± / HIDE± / FILTER / SANCTION-APPEAL | **NEW** |
| 모더레이션 | 620/621 | MODERATION-API-LIST/ACTION | **NEW** (admin/audit REUSE) |
| 통합 검수 | 622 | PB-COMM-API-001 | gate |
| 안전 정책 | 623 | PB-COMM-SAFETY-001 | **NEW**(정책 문서) |
| 사용자 UI | 624 | PB-COMM-UI-001 | **NEW** (ui/auth-modal REUSE) |
| 관리자 | 699/700 | ADMIN-001 / ADMIN-STATS-001 | **NEW** (admin shell REUSE) |
| QA | 703 | PB-COMM-QA-001 | gate |

### 각 하위 issue가 본 문서에서 받는 입력

- **DATA(586)**: §2.2 도메인 모델 + §4 권한/소프트삭제/숨김·차단 분리 + §5 안전 상태 컬럼(report/sanction/appeal status).
- **API 전반(587–621)**: §4 공개/보호 경계, 횡단 REUSE(§2.1) — auth 가드, file 첨부, search 패턴, audit.
- **안전(609,614–621,623)**: §5 Apple/Google 요건 매핑 = 구현 task의 1차 acceptance.
- **UI(624)**: §2.1 `auth-form` 모달 재사용 + §4 비로그인 탐색/보호 액션 게이트.
- **ADMIN(699,700)**: §2.1 `OrgAdminGuard`+`admin_audit_log` 재사용 + §5.3 통계/감사.
- **QA(703)**: §5 안전 플로우 E2E + 공개/보호 경계 + Vercel 배포 검증(워크플로 룰).

---

## 7. 미선택 시 N/A 처리 (AC#4)

커뮤니티가 빌드에서 **선택되지 않을 경우**의 표준 처리(이 빌드에는 적용 안 됨 — 선택됨):

- PB-COMM-* 묶음 issue를 **삭제하지 않는다.** 각 issue를 결정값 `N/A`로 두고 **N/A 완료 issue로 남긴다.**
- N/A 사유 = "이 빌드의 제품 범위에 커뮤니티(UGC) feature가 선택되지 않음. 선택 시 본 문서 §3 범위 + §5 UGC 안전 요건으로 EXTEND 실행."
- feature 선택은 task 삭제가 아니라 결정값 전환(NEW/EXTEND/REUSE/N/A)으로 반영(워크플로 룰).
- 본 빌드는 board Decision=EXTEND + 묶음 고정 생성 → **선택됨**으로 확정. 따라서 N/A는 적용하지 않는다.

---

## 8. Acceptance Criteria 매핑

| AC | 충족 위치 |
|---|---|
| 커뮤니티 = 선택 가능한 재사용 feature(도메인 카드 아님) | §1 분류 |
| CRUD/멤버십/게시글·댓글/리액션/투표/신고/차단/숨김/필터/관리자 모더레이션 포함 명시 | §3 범위 표 |
| Apple/Google UGC 안전 요건이 구현 task로 추적 | §5 체크리스트(요건↔BBR 매핑) |
| 미선택 시 삭제 아닌 N/A 완료 issue 유지 | §7 |
| REUSE/EXTEND vs NEW 명시 분리 | §1 핵심 판정 + §2 + §6 판정 열 |

---

## 9. 미해결/후속 (구현 게이트)

- **커뮤니티 도메인 = NEW**: base community capability 부재 확정(§2). DATA(586)부터 NEW 구현 — base에 대한 REUSE task로 done 처리 금지(PB-BASE-001 GAP 선례).
- **Flotter reference 추적**: 도메인 모델/karma 산식/모더레이션 흐름 설계 시 Flotter를 reference로 참조(복사 금지). 구체 reference 경로는 DATA(586)에서 PB-REUSE-001 감사 자료와 연결.
- **배포 검증**: 실제 납품 완료는 Vercel 배포 URL에서 공개 탐색/로그인 모달/가입/보호 액션 진입 = QA-001(703) + 운영 creds 단계에서 캡처.
- **스토어 정책 문서 최신화**: Apple 1.2 / Google Play UGC 정책은 심사 시점 기준 재확인(SAFETY-001/623). 본 문서는 2026-06-30 기준 요건으로 매핑.
