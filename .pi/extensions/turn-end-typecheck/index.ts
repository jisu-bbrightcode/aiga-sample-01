// @ts-nocheck
/**
 * turn-end-typecheck
 *
 * 한 turn 안에서 LLM 이 write/edit/multi_edit 으로 파일을 바꿨으면, turn_end 시점에
 * `pnpm typecheck` (혹은 `tsc --noEmit`) 를 돌려서 결과를 확인한다.
 *
 * 실패하면:
 *   - ctx.ui.notify 로 에러 표시
 *   - `pi.sendUserMessage` 로 다음 turn 시작 시 LLM 에 강제 입력 — 무시 못 함.
 *
 * 동작 규칙:
 *   - mutating tool (write/edit/multi_edit) 이 한 번이라도 발생한 turn 만 검사.
 *   - `TYPECHECK_CMD` env 로 명령 교체 가능 (기본: `pnpm -w typecheck`).
 *   - `TYPECHECK_TIMEOUT_MS` env 로 timeout 조정 (기본: 120000).
 *   - 직전 검사 후 일정 시간 안에는 다시 안 돌림 (`TYPECHECK_DEBOUNCE_MS`, 기본 5000).
 *
 * 단일 책임: typecheck. 다른 검사 (lint, test, build) 는 별 extension 으로.
 */

import type { ExtensionAPI, ExtensionContext, TurnEndEvent } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "turn-end-typecheck";
const MUTATING = new Set(["write", "edit", "multi_edit"]);

const DEFAULT_CMD = "node scripts/check-types-app.mjs";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_DEBOUNCE_MS = 5_000;

interface RunState {
  mutated: boolean;
  lastRunAt: number;
  inFlight: boolean;
}

export default function turnEndTypecheck(pi: ExtensionAPI) {
  const state: RunState = { mutated: false, lastRunAt: 0, inFlight: false };

  pi.on("tool_call", (event) => {
    if (MUTATING.has(event.toolName)) state.mutated = true;
  });

  pi.on("turn_end", async (_event: TurnEndEvent, ctx: ExtensionContext) => {
    if (!state.mutated) return;
    state.mutated = false;

    if (state.inFlight) return;
    const now = Date.now();
    if (now - state.lastRunAt < debounceMs()) return;

    state.inFlight = true;
    state.lastRunAt = now;
    const cmd = process.env.TYPECHECK_CMD || DEFAULT_CMD;

    ctx.ui.setStatus(STATUS_KEY, "typecheck…");
    try {
      const started = Date.now();
      const result = await pi.exec("bash", ["-lc", cmd], {
        cwd: ctx.cwd,
        timeout: timeoutMs(),
        signal: ctx.signal,
      });
      const took = ((Date.now() - started) / 1000).toFixed(1);
      const code = (result as { code?: number }).code ?? -1;

      if (code === 0) {
        ctx.ui.setStatus(STATUS_KEY, `typecheck ✓ (${took}s)`);
        return;
      }

      const stderr = ((result as { stderr?: string }).stderr ?? "").toString();
      const stdout = ((result as { stdout?: string }).stdout ?? "").toString();
      const tail = (stderr + "\n" + stdout).trim().split("\n").slice(-40).join("\n");

      ctx.ui.setStatus(STATUS_KEY, `typecheck ✗ (exit ${code})`);
      ctx.ui.notify(
        [`🚫 turn-end typecheck failed (exit ${code}, ${took}s)`, `cmd: ${cmd}`, "", tail].join(
          "\n",
        ),
        "error",
      );

      pi.sendUserMessage(
        [
          "[turn-end-typecheck] 직전 turn 의 변경 후 typecheck 실패. 다음 작업 전에 반드시 해결.",
          `command: ${cmd}`,
          `exit: ${code}`,
          "",
          "----- output (tail) -----",
          tail,
        ].join("\n"),
        { deliverAs: "followUp" },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.ui.setStatus(STATUS_KEY, "typecheck error");
      ctx.ui.notify(`turn-end typecheck 실행 실패: ${msg}`, "error");
    } finally {
      state.inFlight = false;
    }
  });
}

function timeoutMs(): number {
  const v = Number(process.env.TYPECHECK_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MS;
}

function debounceMs(): number {
  const v = Number(process.env.TYPECHECK_DEBOUNCE_MS);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_DEBOUNCE_MS;
}
