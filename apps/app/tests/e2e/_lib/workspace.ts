/**
 * Workspace + first project 부트스트랩 헬퍼 (apps/app).
 *
 * 새 organization 첫 진입 시 강제로 등장하는 3-step 마법사(
 * Name your workspace → Bring your team(skip) → Create your first project) 를
 * `prefix` 만 바꾸어 spec 간 충돌 없이 재사용.
 */

import { expect, type Page } from "@playwright/test";

export interface CreateWorkspaceOptions {
  /** workspace / project 이름 prefix. Date.now suffix 와 함께 사용. */
  prefix: string;
  /** 충돌 회피용 suffix (보통 `Date.now().toString(36)`). */
  suffix: string;
}

export async function createWorkspaceAndProject(
  page: Page,
  { prefix, suffix }: CreateWorkspaceOptions,
): Promise<void> {
  await page.locator('[data-el="workspace.create"]').click();
  await expect(page.getByRole("heading", { name: "Name your workspace" })).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("#workspace-name").fill(`${prefix} E2E ${suffix}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Bring your team" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Skip for now" }).click();

  await expect(page.getByRole("heading", { name: "Create your first project" })).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("#project-name").fill(`${prefix} E2E Project ${suffix}`);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForLoadState("networkidle");
}
