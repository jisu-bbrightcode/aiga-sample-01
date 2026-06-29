# Tooling Reference

## Source of Truth

Product Builder uses Biome as the single lint and format tool for the monorepo.

- Config: `biome.json`
- Package manager: `pnpm`
- Lockfile: `pnpm-lock.yaml`

ESLint and Prettier configs are not part of the active toolchain. Do not add package-local
`eslint.config.*`, `.eslintrc*`, `.prettierrc*`, or shared `@repo/eslint-config` packages for new
work. If a lint or format rule is needed, add it to `biome.json`.

## Commands

Run these from the repository root. They check or format working-tree changes (`HEAD` diff plus
untracked files), matching the current staged/changed-file quality gate while the older
repository-wide baseline is paid down.

```sh
pnpm lint
pnpm check
pnpm format
pnpm check:ci
```

Package-local `lint` scripts also call Biome with the same changed-file scope, so filtered checks
keep the same rule source:

```sh
pnpm --filter app lint
pnpm --filter @repo/ui lint
```

## Pi Local Extensions

Project-local Pi extensions live under `.pi/extensions/`.

- `danger-gate.ts`: gates high-risk bash commands before execution. Git force-push variants
  (`--force`, `-f`, `--force-with-lease`, and leading `+` refspecs) are hard-blocked and cannot be
  bypassed with UI approval or `DANGER_GATE_AUTOAPPROVE`.
- `linear-task-gate/`: gates the first mutating coding action behind a Linear task binding, with a
  `기타 작업` path for environment/tooling work that does not belong in Linear. For issue-bound
  sessions, allowed mutating turns also add one concise Linear progress comment at turn end; final
  completion remains `/task done` or the push/review flow.
- `rules/jotai-state-policy.ts`: makes Jotai the default for browser React local/feature state.
  The write-time rule blocks new alternative state-manager imports and direct
  `localStorage`/`sessionStorage` persisted-state method calls in browser React source; persisted
  browser state should use `atomWithStorage`, `createJSONStorage`, and `RESET` from `jotai/utils`.
- `vibeproxy-provider.ts`: registers VibeProxy-backed Pi model providers:
  - `vibeproxy-openai` uses `http://localhost:8317/v1` for Codex/OpenAI-compatible, Gemini,
    Copilot, Antigravity, Qwen, and GLM-style models.
  - `vibeproxy-anthropic` uses `http://localhost:8317` for Claude CLI / Anthropic-compatible
    models.

After changing extensions, run `/reload` in Pi. Use `pi --list-models` to verify provider/model
registration.

## Pi Project Skills

Project-local Pi skills were removed from this Product Builder workspace. Keep future guidance in
tracked docs or executable policy rules instead of adding `.pi/skills/` back.

## Lockfile Policy

The workspace is pnpm-only. `package-lock.json`, `bun.lock`, and `yarn.lock` are ignored and should
not be committed. Dependency changes must update `pnpm-lock.yaml`.
