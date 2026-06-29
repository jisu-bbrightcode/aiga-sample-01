#!/usr/bin/env node
/**
 * verify-vercel-deploy-gate.mjs
 *
 * Vercel Deployment Checks (GitHub Checks integration) 가 3 production
 * project 에 실제로 켜져 있는지 검사한다.
 *
 * 동작:
 *   1. Vercel CLI 인증 토큰 사용 (~/Library/Application Support/com.vercel.cli/auth.json)
 *   2. 각 project 의 production deployments 중 최근 1개 가져오기
 *   3. /v1/deployments/<id>/checks 호출 → check-runs 확인
 *   4. checks 가 0개 면 ⚠️ — Deployment Checks 가 안 켜진 신호.
 *      checks 가 있는데 모두 success 면 ✓, 일부 fail/pending 이면 ⚠️.
 *
 * 사용:
 *   node scripts/verify-vercel-deploy-gate.mjs
 *
 * 후속 액션:
 *   ⚠️ 가 뜨면 docs/runbooks/vercel-deploy-gate.md 의 Dashboard 셋업 절차
 *   대로 Settings → Git → Deployment Checks → GitHub Checks On.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECTS = [
  { name: "product-builder-app", root: process.cwd() },
  { name: "product-builder-api", root: path.join(process.cwd(), "apps/server") },
];

function loadVercelToken() {
  const candidates = [
    path.join(os.homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
    path.join(os.homedir(), ".local/share/com.vercel.cli/auth.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const { token } = JSON.parse(fs.readFileSync(p, "utf8"));
      if (token) return token;
    }
  }
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  throw new Error("Vercel token not found — run `vercel login` or set VERCEL_TOKEN");
}

async function vercelFetch(token, p) {
  const url = p.startsWith("http") ? p : `https://api.vercel.com${p}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${p}`);
  return r.json();
}

function projectFromLink(root) {
  const link = path.join(root, ".vercel/project.json");
  if (!fs.existsSync(link)) return null;
  return JSON.parse(fs.readFileSync(link, "utf8"));
}

async function checkOne(token, project) {
  const link = projectFromLink(project.root);
  if (!link) return { project: project.name, error: "no .vercel/project.json" };

  const { projectId, orgId } = link;
  const team = `&teamId=${orgId}`;

  // latest production deployment
  const deps = await vercelFetch(
    token,
    `/v6/deployments?projectId=${projectId}&target=production&limit=1${team}`,
  );
  const dep = deps.deployments?.[0];
  if (!dep) return { project: project.name, error: "no production deployments" };

  // checks
  const checksData = await vercelFetch(token, `/v1/deployments/${dep.uid}/checks?${team.slice(1)}`);
  const checks = checksData.checks ?? [];

  const summary = {
    project: project.name,
    deployment: dep.uid,
    deploymentUrl: `https://${dep.url}`,
    state: dep.state,
    checkCount: checks.length,
    checks: checks.map((c) => ({
      name: c.name,
      conclusion: c.conclusion,
      status: c.status,
      blocking: c.blocking,
      integrationId: c.integrationId,
    })),
  };
  return summary;
}

(async () => {
  const token = loadVercelToken();
  console.log("Vercel Deployment Checks 검증\n");

  let allOk = true;
  for (const p of PROJECTS) {
    let s;
    try {
      s = await checkOne(token, p);
    } catch (e) {
      console.log(`[${p.name}] ERROR: ${e.message}`);
      allOk = false;
      continue;
    }
    if (s.error) {
      console.log(`[${s.project}] ⚠️  ${s.error}`);
      allOk = false;
      continue;
    }
    console.log(`[${s.project}]`);
    console.log(`  deployment: ${s.deployment} (${s.state})`);
    console.log(`  ${s.deploymentUrl}`);
    if (s.checkCount === 0) {
      console.log(`  ⚠️  checks: 0개 — Deployment Checks 가 켜져 있지 않음`);
      console.log(`     Settings → Git → Deployment Checks → GitHub Checks On 필요`);
      allOk = false;
    } else {
      console.log(`  ✓  checks: ${s.checkCount}개`);
      for (const c of s.checks) {
        const mark = c.conclusion === "succeeded" ? "✓" : c.status === "running" ? "…" : "✗";
        console.log(
          `     ${mark} ${c.name} (${c.conclusion ?? c.status})${c.blocking ? " [blocking]" : ""}`,
        );
      }
    }
    console.log();
  }

  if (!allOk) {
    console.log("⚠️  일부 project 에 Deployment Checks 가 미설정 또는 실패 — runbook 참고");
    process.exit(1);
  }
  console.log("✓ 모든 project 에 Deployment Checks 정상 작동");
})();
