# Entire CLI — AI 세션 추적 (필수)

> **모든 AI 에이전트 작업은 Entire로 세션이 추적되어야 한다. 예외 없음.**

## Entire이란?

Entire CLI는 AI 에이전트(Claude Code, Gemini CLI) 세션을 git push 시 자동 캡처하는 도구.
프롬프트, 응답, 수정 파일 등 작업 컨텍스트가 `entire/checkpoints/v1` 브랜치에 별도 저장된다.

## 사전 조건 확인 (세션 시작 시 필수)

작업 시작 전 아래 명령어로 entire 상태를 확인한다:

```bash
entire status
```

### entire CLI 미설치 시

```bash
brew tap entireio/tap
brew install entireio/tap/entire
```

### 프로젝트에서 entire 미활성화 시

```bash
entire enable
```

### 정상 상태 확인

```
Enabled (manual-commit)
```

위 메시지가 출력되면 정상. 다른 출력이면 `entire doctor`로 진단한다.

## 설정

- **프로젝트 설정**: `.entire/settings.json` (git 추적됨 — 팀 공유)
- **로컬 설정**: `.entire/settings.local.json` (gitignore — 개인 설정)
- **전략**: `manual-commit` (커밋 시 체크포인트 생성)

## Git 훅 연동

Entire은 `.husky/_/` 에 pre-push 훅을 설치한다.
push 시 세션 메타데이터가 `entire/checkpoints/v1` 브랜치로 자동 전송된다.

### `--no-verify` 절대 금지

```
git commit --no-verify  ← ❌ 체크포인트 트레일러 미삽입 → 체크포인트 미생성
git push --no-verify   ← ❌ 세션 데이터 미전송
```

**`--no-verify`는 commit, push 모두 사용 금지.**
Entire은 `prepare-commit-msg` → `commit-msg` → `post-commit` → `pre-push` 전체 훅 체인에 의존한다.
`--no-verify`를 쓰면 체크포인트가 생성되지 않는다.

commitlint 실패 시 커밋 메시지를 Conventional Commits 형식에 맞추는 것이 정답이다.
`--no-verify`로 우회하지 않는다.

## 핵심 명령어

| 명령어 | 설명 | 사용 시점 |
|--------|------|----------|
| `entire status` | 현재 세션 상태 확인 | 작업 시작 전 |
| `entire enable` | 프로젝트에서 entire 활성화 | 최초 1회 |
| `entire disable` | 프로젝트에서 entire 비활성화 | 필요 시 |
| `entire rewind` | 이전 체크포인트로 되감기 | 작업 복원 시 |
| `entire resume <branch>` | 이전 세션 복원 후 이어서 작업 | 브랜치 전환 후 세션 재개 |
| `entire explain` | 세션/커밋/체크포인트 설명 | 작업 히스토리 파악 |
| `entire doctor` | 세션 문제 진단/복구 | 세션 상태 이상 시 |
| `entire clean` | 고아 데이터 정리 | 정기 정리 |

## 작업 규칙

### 1. 새 브랜치에서 작업 시작 시

```bash
entire status  # 상태 확인
# Enabled (manual-commit) 확인 후 작업 시작
```

### 2. 브랜치 전환 후 이전 세션 이어갈 때

```bash
entire resume <branch-name>  # 세션 메타데이터 복원
```

### 3. 이전 시점으로 되돌리고 싶을 때

```bash
entire rewind  # 체크포인트 목록에서 선택
```

### 4. 세션 상태가 이상할 때

```bash
entire doctor  # 자동 진단 및 복구
```

### 5. push 시

`git push`를 실행하면 pre-push 훅이 자동으로 세션 데이터를 전송한다.
별도 조치 불필요.

## 금지 사항
 **`--no-verify` 사용 절대 금지** (commit, push 모두) — 체크포인트가 생성되지 않음
 `.entire/` 디렉토리 삭제 금지
 `entire/checkpoints/v1` 브랜치 수동 수정 금지