/**
 * Draft page design E2E.
 *
 * Verifies the production app route renders the Drafts.html-inspired page:
 * quick capture, status tabs, index-card grid, and detail route.
 *
 * 실행:
 *   pnpm --filter server dev
 *   pnpm --filter app dev
 *   pnpm --filter app exec playwright test e2e/draft-page-common-list.spec.ts --config playwright.config.ts --project chromium
 */
import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./_lib/auth";
import { createWorkspaceAndProject } from "./_lib/workspace";

const QA_EMAIL = process.env.E2E_EMAIL ?? "qa+draft-page@product-builder.local";
const QA_PASSWORD = process.env.E2E_PASSWORD ?? "QaTest1234!";
const RUN_SUFFIX = Date.now().toString(36);

async function resolveProjectId(page: Page): Promise<string> {
  const envProjectId = process.env.E2E_PROJECT_ID;
  if (envProjectId) return envProjectId;

  const fromUrl = () => page.url().match(/\/p\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const currentProjectId = fromUrl();
  if (currentProjectId) return currentProjectId;

  if (page.url().includes("/workspace-select")) {
    await createWorkspaceAndProject(page, { prefix: "Draft", suffix: RUN_SUFFIX });
  }

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const homeProjectId = fromUrl();
  if (homeProjectId) return homeProjectId;

  const firstProjectCard = page.locator('main div[role="button"]:visible').first();
  if ((await firstProjectCard.count()) > 0 && (await firstProjectCard.isVisible())) {
    await firstProjectCard.click();
    await page.waitForURL(/\/p\/[0-9a-f-]{36}\//i, { timeout: 15_000 });
    const openedProjectId = fromUrl();
    if (openedProjectId) return openedProjectId;
  }

  throw new Error(`projectId 추출 실패 - 현재 URL: ${page.url()}`);
}

test.describe("Draft page design @regression @story @db", () => {
  test("renders Drafts.html design and opens a captured draft in a real browser", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    await signIn(page, { email: QA_EMAIL, password: QA_PASSWORD });
    const projectId = await resolveProjectId(page);

    const browserErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        browserErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto(`/p/${projectId}/drafts`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator('[data-el="page.header"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-el="draft-subbar"]')).toBeVisible();
    await expect(page.locator('[data-el="draft-capture"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "새 초안" })).toBeVisible();

    const noteTitle = `Draft browser card ${RUN_SUFFIX}`;
    await page.locator('[data-el="draft-capture.input"]').fill(`${noteTitle}\n#qa visual check`);
    await page.locator('[data-el="draft-capture.save"]').click();

    const card = page.locator('[data-el="draft-card"]').filter({ hasText: noteTitle }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        const draftId = await card.getAttribute("data-draft-id");
        return Boolean(draftId && !draftId.startsWith("temp-"));
      })
      .toBe(true);
    await expect(card.locator('[data-el="draft-card.paper"]')).toBeVisible();
    await expect(card.locator('[data-el="draft-card.meta"]')).toContainText("qa");
    await expect(page.locator('[data-el="entity-table"]')).toHaveCount(0);

    const paperBox = await card.locator('[data-el="draft-card.paper"]').boundingBox();
    expect(paperBox).not.toBeNull();
    if (paperBox) {
      expect(Math.abs(paperBox.width / paperBox.height - 5 / 3)).toBeLessThan(0.08);
    }

    await card.click();
    await expect(page).toHaveURL(/\/drafts\/[^/?#]+$/);
    await expect(page.locator('[data-el="draft-detail.editor"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-el="draft-expanded-card.paper"]')).toBeVisible();
    await expect(page.locator('[data-el="draft-subbar"]')).toHaveCount(0);
    await expect(page.locator('[data-el="draft-capture"]')).toHaveCount(0);
    await expect(page.locator('[data-el="draft-card"]')).toHaveCount(0);
    await expect(page.locator('[data-el="draft-detail.toolbar"]')).toBeVisible();
    await expect(page.locator('[data-el="draft-detail.title"]')).toHaveAttribute(
      "autocomplete",
      "off",
    );
    await expect(page.locator('[data-el="draft-detail.title"]')).toHaveAttribute(
      "spellcheck",
      "false",
    );

    await page.locator('[data-el="draft-expanded-card.paper"]').hover();
    await page.locator('[data-el="draft-detail.more"]').click();
    await expect(page.locator('[data-el="draft-detail.delete"]')).toBeVisible();
    await page.keyboard.press("Escape");

    const editedBody = "#qa visual check\ninline card edit";
    await page.locator('[data-el="draft-detail.description"]').fill(editedBody);
    await page.waitForTimeout(900);
    await expect(page.locator('[data-el="draft-detail.description"]')).toHaveValue(editedBody);
    await page.reload();
    await expect(page.locator('[data-el="draft-detail.editor"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-el="draft-detail.description"]')).toHaveValue(editedBody);

    await page.screenshot({
      path: "test-results/draft-page-design.png",
      fullPage: true,
    });

    const actionableBrowserErrors = browserErrors.filter(
      (message) =>
        !message.includes("Failed to load animation data from URL: /loading/liquid-splats.lottie"),
    );
    expect(actionableBrowserErrors).toEqual([]);
  });
});
