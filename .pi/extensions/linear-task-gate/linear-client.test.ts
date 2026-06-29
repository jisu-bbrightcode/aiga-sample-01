// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLinearProgressComment,
  buildLinearTaskComment,
  extractLinearTokenFromConfig,
  normalizeLinearIssue,
} from "./linear-client";

describe("linear-task-gate Linear client helpers", () => {
  it("extracts a Linear API key from standard MCP config env", () => {
    const token = extractLinearTokenFromConfig({
      mcpServers: {
        linear: {
          command: "npx",
          args: ["-y", "@hatcloud/linear-mcp"],
          env: { LINEAR_API_KEY: "lin_api_test" },
        },
      },
    });

    assert.equal(token, "lin_api_test");
  });

  it("resolves a token from bearerTokenEnv", () => {
    const token = extractLinearTokenFromConfig(
      {
        mcpServers: {
          linear: {
            url: "https://mcp.linear.app/mcp",
            bearerTokenEnv: "LINEAR_API_KEY",
          },
        },
      },
      { LINEAR_API_KEY: "lin_api_env" },
    );

    assert.equal(token, "lin_api_env");
  });

  it("builds a Linear task comment with goal and status", () => {
    assert.equal(buildLinearTaskComment("작업 목표", "start"), "Pi 작업 시작\n\n목표: 작업 목표");
    assert.equal(
      buildLinearTaskComment("작업 목표", "done", "완료 요약"),
      "Pi 작업 완료\n\n목표: 작업 목표\n\n요약: 완료 요약",
    );
  });

  it("builds a concise progress comment with mutation evidence and completion caveat", () => {
    const comment = buildLinearProgressComment({
      goal: "자동 Linear 진행 코멘트",
      issueTitle: "Linear task gate 개선",
      evidence: ["edit .pi/extensions/linear-task-gate/index.ts", "bash pnpm test"],
    });

    assert.match(comment, /Pi 작업 진행/);
    assert.match(comment, /목표: 자동 Linear 진행 코멘트/);
    assert.match(comment, /이슈: Linear task gate 개선/);
    assert.match(comment, /로컬 코드 변경\/mutating tool 실행/);
    assert.match(comment, /edit \.pi\/extensions\/linear-task-gate\/index\.ts, bash pnpm test/);
    assert.match(comment, /최종 완료 처리는 \/task done 또는 push\/review 흐름/);
  });

  it("normalizes Linear issue payloads", () => {
    assert.deepEqual(
      normalizeLinearIssue({
        id: "id-1",
        identifier: "flt-123",
        title: "Task",
        url: "https://linear.app/x",
      }),
      { id: "id-1", identifier: "FLT-123", title: "Task", url: "https://linear.app/x" },
    );
    assert.equal(normalizeLinearIssue(null), null);
  });
});
