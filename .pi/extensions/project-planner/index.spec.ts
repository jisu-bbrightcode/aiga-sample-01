// @ts-nocheck
import assert from "node:assert/strict";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ISSUE_PREFIXES } from "./plan";

interface RegisteredTool {
  execute: (...args: unknown[]) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
  parameters: {
    properties: {
      teamKey: { anyOf?: unknown; enum?: string[] };
      phases: {
        items: {
          properties: {
            issues: {
              items: {
                properties: {
                  prefix: { anyOf?: unknown; enum?: readonly string[] };
                };
              };
            };
          };
        };
      };
    };
  };
}

process.env.NODE_PATH = [
  process.env.NODE_PATH,
  path.join(os.homedir(), ".pi/agent/npm/node_modules"),
]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

async function createRegisteredTool() {
  const projectPlanner = (await import("./index")).default;
  let registeredTool: RegisteredTool | null = null;
  const pi = {
    registerCommand() {
      return undefined;
    },
    registerTool(tool: RegisteredTool) {
      registeredTool = tool;
    },
    sendUserMessage() {
      return undefined;
    },
  };

  projectPlanner(pi as never);
  assert.ok(registeredTool, "expected projectPlanner to register a tool");
  return registeredTool;
}

function createContext() {
  return {
    signal: new AbortController().signal,
    ui: {
      notify() {
        return undefined;
      },
      setStatus() {
        return undefined;
      },
    },
  };
}

describe("project-planner register_project_plan tool", () => {
  it("returns Pi content blocks on execution errors", async () => {
    const tool = await createRegisteredTool();

    const result = await tool.execute(
      "tool-call-id",
      { projectName: "", phases: [] },
      undefined,
      undefined,
      createContext(),
    );

    assert.equal(result.isError, true);
    assert.ok(Array.isArray(result.content));
    assert.equal(result.content[0]?.type, "text");
    assert.match(result.content[0]?.text, /프로젝트 등록 실패/);
  });

  it("uses Google-compatible string enum schemas", async () => {
    const tool = await createRegisteredTool();

    const teamKey = tool.parameters.properties.teamKey;
    assert.equal(teamKey.anyOf, undefined);
    assert.deepEqual(teamKey.enum, ["FLT", "FLE", "FLP"]);

    const prefix =
      tool.parameters.properties.phases.items.properties.issues.items.properties.prefix;
    assert.equal(prefix.anyOf, undefined);
    assert.deepEqual(prefix.enum, ISSUE_PREFIXES);
  });
});
