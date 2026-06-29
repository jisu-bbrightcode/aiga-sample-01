# Commit & Release Rules

> Conventional Commits + semantic-release 자동 릴리스

## Commit 형식 (필수)

commitlint + husky hook이 강제합니다. 규칙 위반 시 커밋이 거부됩니다.

```
<type>(<scope>): <subject>

[body]

[BREAKING CHANGE: ...]
```

### Type

| Type | 설명 | 버전 범프 |
|------|------|----------|
| `feat` | 새 기능 | **minor** |
| `fix` | 버그 수정 | **patch** |
| `perf` | 성능 개선 | **patch** |
| `refactor` | 리팩토링 | **patch** |
| `docs` | 문서 | 릴리스 안 함 |
| `style` | 포맷/스타일 | 릴리스 안 함 |
| `chore` | 빌드/도구 | 릴리스 안 함 |
| `test` | 테스트 | 릴리스 안 함 |
| `ci` | CI 설정 | 릴리스 안 함 |

### Scope (선택)

Feature 이름 사용:
`auth`, `profile`, `role-permission`, `board`, `community`, `content-studio`, `marketing`, `payment`, `ai`, `comment`, `reaction`, `review`, `notification`, `file`, `email`, `analytics`, `audit`, `schedule`, `landing`, `hello-world`, `deps`, `release`

### Breaking Change

`feat!:` 또는 footer에 `BREAKING CHANGE:` → **major** 버전 범프

### 예시

```bash
feat: 결제 시스템 추가
feat(content-studio): 리퍼포징 기능 추가
fix(auth): 토큰 갱신 오류 수정
refactor(payment): 서비스 로직 분리
chore(deps): drizzle-orm 업데이트
feat!: API 응답 형식 변경
```

## 릴리스 파이프라인

```
main push → GitHub Actions auth-deploy-gate → semantic-release
  → CHANGELOG.md 업데이트
  → package.json version 범프
  → GitHub Release + 태그 생성
```

- **릴리스 브랜치**: `main`
- **npm publish**: 안 함 (private 프로젝트)
- **설정 파일**: `.releaserc.json`
- **CI**: `.github/workflows/release.yml`

## 로컬 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm test:auth` | 인증 core sender, 이메일 서비스/템플릿, 앱 auth 호출 계약 검증 |
| `pnpm deploy:check` | 배포 전 Auth 게이트 + app/server 빌드 검증 |
| `pnpm release:dry` | 다음 릴리스 미리보기 |
| `pnpm release` | 로컬 릴리스 실행 |

## 주의사항

- `chore(release):` 커밋은 semantic-release가 자동 생성 — 수동으로 만들지 않는다
- `[skip ci]`가 릴리스 커밋에 자동 포함 — CI 재트리거 방지
- pre-commit hook에서 `pnpm build` 실행됨 — 타입 체크 + 실제 빌드 모두 통과해야 커밋 가능
 **`--no-verify` 사용 금지** — Entire CLI 체크포인트가 생성되지 않음. commitlint 실패 시 메시지 형식을 수정하는 것이 정답
