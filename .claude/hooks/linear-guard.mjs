#!/usr/bin/env node
// Linear 로드맵 권한 가드
// 실행 에이전트(Felix/Cyrus)는 Initiative/Milestone/StatusUpdate 생성 금지.
// Project 생성은 허용하되 CLAUDE.md 규칙으로 Initiative 연결 강제.
//
// 계약: stderr 메시지 + exit 2 로 차단 (decision JSON 아님).
// tool 이름은 stdin JSON tool_name 우선, CLAUDE_TOOL_NAME env fallback.
import { readHookInput } from "./_hook-io.mjs";

const { toolName } = await readHookInput();
const tool = toolName || process.env.CLAUDE_TOOL_NAME || "";

const DENY = {
  mcp__linear__save_initiative:
    "❌ Initiative 생성/수정은 Sophia(Product Strategist)만 가능합니다. cos-hq에 요청하세요.",
  mcp__linear__save_milestone:
    "❌ Milestone 생성/수정은 Sophia(Product Strategist)만 가능합니다. cos-hq에 요청하세요.",
  mcp__linear__save_status_update:
    "❌ Project Update 작성은 Sophia(Product Strategist)만 가능합니다.",
};

if (DENY[tool]) {
  process.stderr.write(`${DENY[tool]}\n`);
  process.exit(2);
}

process.exit(0);
