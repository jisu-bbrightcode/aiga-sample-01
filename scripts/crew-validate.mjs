#!/usr/bin/env node
/**
 * .crew/ 설정 정합성 검사.
 *
 * - 모든 team.defaultWorkflow 가 실제 workflow 파일에 매핑되는가
 * - workflow 의 모든 step.role 이 builtin 또는 .crew/agents 에 존재하는가
 * - dependsOn 이 같은 workflow 의 step 이름을 참조하는가
 * - 순환 의존성이 없는가
 *
 * builtin agents: pi-crew 패키지의 ~/.pi/agent/npm/node_modules/pi-crew/agents/*.md
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const REPO = process.cwd();
const CREW = join(REPO, ".crew");
const BUILTIN_DIR = join(homedir(), ".pi/agent/npm/node_modules/pi-crew/agents");

function readMarkdownFront(path) {
  const text = readFileSync(path, "utf8");
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("---", 3);
  if (end < 0) return { meta: {}, body: text };
  const front = text.slice(3, end);
  const body = text.slice(end + 3).trim();
  const meta = {};
  for (const line of front.split("\n")) {
    const m = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body };
}

function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ name: f, path: join(dir, f) }));
}

const issues = [];

// 1. agents (builtin + project)
const builtinAgents = new Set();
for (const f of listMd(BUILTIN_DIR)) {
  const { meta } = readMarkdownFront(f.path);
  if (meta.name) builtinAgents.add(meta.name);
}
const projectAgents = new Set();
for (const f of listMd(join(CREW, "agents"))) {
  const { meta } = readMarkdownFront(f.path);
  if (!meta.name) {
    issues.push(`agent ${f.path} 에 name 없음`);
    continue;
  }
  projectAgents.add(meta.name);
}
const allAgents = new Set([...builtinAgents, ...projectAgents]);

// 2. workflows
const builtinWorkflowDir = join(homedir(), ".pi/agent/npm/node_modules/pi-crew/workflows");
const workflows = new Map();
for (const dir of [builtinWorkflowDir, join(CREW, "workflows")]) {
  for (const f of listMd(dir)) {
    if (!f.name.endsWith(".workflow.md")) continue;
    const { meta, body } = readMarkdownFront(f.path);
    if (!meta.name) {
      issues.push(`workflow ${f.path} 에 name 없음`);
      continue;
    }
    workflows.set(meta.name, { meta, body, path: f.path });
  }
}

// 3. teams
for (const f of listMd(join(CREW, "teams"))) {
  if (!f.name.endsWith(".team.md")) continue;
  const { meta } = readMarkdownFront(f.path);
  if (!meta.name) {
    issues.push(`team ${f.path} 에 name 없음`);
    continue;
  }
  if (!meta.defaultWorkflow) {
    issues.push(`team ${meta.name} (${f.path}) 에 defaultWorkflow 없음`);
    continue;
  }
  if (!workflows.has(meta.defaultWorkflow)) {
    issues.push(`team ${meta.name} 의 defaultWorkflow=${meta.defaultWorkflow} 가 workflow 에 없음`);
  }
}

// 4. workflow step graph
function parseSteps(body) {
  const steps = [];
  const re = /^##\s+(\S+)\s*$/gm;
  let m;
  const matches = [];
  while ((m = re.exec(body))) matches.push({ name: m[1], idx: m.index });
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i + 1 < matches.length ? matches[i + 1].idx : body.length;
    const block = body.slice(start, end);
    const role = block.match(/^role:\s*(\S+)/m)?.[1];
    const dependsRaw = block.match(/^dependsOn:\s*(.+)$/m)?.[1]?.trim();
    const dependsOn = dependsRaw
      ? dependsRaw
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    steps.push({ name: matches[i].name, role, dependsOn });
  }
  return steps;
}

for (const [wfName, wf] of workflows) {
  const steps = parseSteps(wf.body);
  const stepNames = new Set(steps.map((s) => s.name));
  for (const s of steps) {
    if (!s.role) {
      issues.push(`workflow ${wfName} step ${s.name}: role 누락`);
      continue;
    }
    if (!allAgents.has(s.role)) {
      issues.push(`workflow ${wfName} step ${s.name}: role=${s.role} 가 agent 목록에 없음`);
    }
    for (const dep of s.dependsOn) {
      if (!stepNames.has(dep)) {
        issues.push(`workflow ${wfName} step ${s.name}: dependsOn=${dep} 미존재`);
      }
    }
  }
  // cycle detection (Kahn)
  const indeg = new Map(steps.map((s) => [s.name, 0]));
  const adj = new Map(steps.map((s) => [s.name, []]));
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      if (indeg.has(dep)) {
        adj.get(dep).push(s.name);
        indeg.set(s.name, indeg.get(s.name) + 1);
      }
    }
  }
  const q = steps.filter((s) => indeg.get(s.name) === 0).map((s) => s.name);
  let visited = 0;
  while (q.length) {
    const n = q.shift();
    visited += 1;
    for (const m of adj.get(n)) {
      indeg.set(m, indeg.get(m) - 1);
      if (indeg.get(m) === 0) q.push(m);
    }
  }
  if (visited !== steps.length) {
    issues.push(`workflow ${wfName}: 순환 의존성 감지`);
  }
}

if (issues.length === 0) {
  console.log("crew config OK");
  console.log(
    `  agents: ${allAgents.size} (builtin ${builtinAgents.size}, project ${projectAgents.size})`,
  );
  console.log(`  workflows: ${workflows.size}`);
} else {
  for (const i of issues) console.error(`  ✗ ${i}`);
  process.exit(1);
}
