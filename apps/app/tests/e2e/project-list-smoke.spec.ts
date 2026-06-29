/**
 * 프로젝트 목록화면 E2E 스모크 테스트 (FLT-348).
 *
 * 브라우저 mock 방식으로 홈(/) 렌더링 → 그리드·검색·정렬·스코프·빈 상태·무결과
 * 시나리오를 실서버 없이 검증한다.
 *
 * 실행:
 *   pnpm --filter app exec playwright test e2e/project-list-smoke.spec.ts \
 *     --config playwright.config.ts --project chromium
 */

import { expect, test, type Page } from "@playwright/test";

import { createAuthFixture } from "./_lib/auth-fixture";
import { appUrl } from "./_lib/env";
import { fulfillJson } from "./_lib/network";

const ORG_ID = "org-project-list-smoke";

const now = () => new Date().toISOString();

const { user, session, member, organization } = createAuthFixture({
  slug: "project-list-smoke",
  email: "qa-project-list@product-builder.local",
  name: "Project List QA",
  organizationName: "Project List QA Workspace",
  organizationId: ORG_ID,
  embedMemberInOrganization: true,
});

function makeProject(
  seed: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: `77000000-0000-4000-8000-${seed}`,
    name: `Project ${seed}`,
    description: `Description ${seed}`,
    ownerId: user.id,
    orgId: ORG_ID,
    handle: `project-${seed}`,
    visibility: "private",
    starred: false,
    coverImage: null,
    createdAt: now(),
    updatedAt: now(),
    archivedAt: null,
    memberCount: 1,
    storyCount: 0,
    languageCount: 0,
    viewerRole: "owner",
    members: [],
    languages: [],
    tags: [],
    genre: null,
    aiMode: "ai_powered",
    lastOpenedAt: now(),
    ...overrides,
  };
}

const PROJECT_ALPHA = makeProject("000000000001", {
  name: "Alpha Project",
  updatedAt: "2026-05-01T00:00:00.000Z",
});
const PROJECT_BETA = makeProject("000000000002", {
  name: "Beta Project",
  updatedAt: "2026-05-20T00:00:00.000Z",
});
const PROJECT_GAMMA = makeProject("000000000003", {
  name: "Gamma Work",
  updatedAt: "2026-04-10T00:00:00.000Z",
});



async function installBrowserMocks(
  page: Page,
  projectList: unknown[],
  counts?: Record<string, number>,
) {
  await page.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/auth/, "");
    if (path === "/get-session") return fulfillJson(route, session);
    if (path === "/organization/list") return fulfillJson(route, [organization]);
    if (path === "/organization/get-full-organization") return fulfillJson(route, organization);
    if (path === "/organization/get-active-member") return fulfillJson(route, member);
    if (path === "/organization/get-active-member-role")
      return fulfillJson(route, { role: "owner" });
    if (path === "/organization/set-active") return fulfillJson(route, organization);
    return fulfillJson(route, null);
  });

  await page.route("**/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/trpc/")) {
      await route.continue();
      return;
    }

    const rawOperations = decodeURIComponent(url.pathname.split("/trpc/")[1] ?? "");
    const operations = rawOperations.split(",").filter(Boolean);

    if (counts) {
      for (const op of operations) counts[op] = (counts[op] ?? 0) + 1;
    }

    await fulfillJson(
      route,
      operations.map((operation) => {
        let data: unknown = null;
        if (operation === "project.list") data = projectList;
        else if (operation === "project.updateLastOpened") data = projectList[0] ?? null;
        else if (operation === "project.archive") data = { success: true };
        return { result: { data } };
      }),
    );
  });
}

function collectRuntimeErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  return () => {
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  };
}

test.describe("project list home screen @smoke @project", () => {
  test("renders project cards in the grid", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA, PROJECT_BETA, PROJECT_GAMMA]);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });
    expect(await page.locator('[data-el="project-card.surface"]').count()).toBe(3);
    assertNoRuntimeErrors();
  });

  test("filters cards by search query", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA, PROJECT_BETA, PROJECT_GAMMA]);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('[data-el="project-list.search-open-btn"]').click();
    await page.locator('[data-el="project-list.search-input"]').fill("Alpha");

    await expect(page.locator('[data-el="project-card.surface"]')).toHaveCount(1);
    assertNoRuntimeErrors();
  });

  test("shows no-results state for an unmatched query", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA, PROJECT_BETA]);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('[data-el="project-list.search-open-btn"]').click();
    await page.locator('[data-el="project-list.search-input"]').fill("xyzxyz-no-match");

    await expect(page.locator('[data-el="project-list.no-results-clear-btn"]')).toBeVisible();
    expect(await page.locator('[data-el="project-card.surface"]').count()).toBe(0);
    assertNoRuntimeErrors();
  });

  test("clearing the no-results filter restores all cards", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA, PROJECT_BETA]);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('[data-el="project-list.search-open-btn"]').click();
    await page.locator('[data-el="project-list.search-input"]').fill("xyzxyz-no-match");
    await expect(page.locator('[data-el="project-list.no-results-clear-btn"]')).toBeVisible();

    await page.locator('[data-el="project-list.no-results-clear-btn"]').click();

    await expect(page.locator('[data-el="project-card.surface"]')).toHaveCount(2);
    assertNoRuntimeErrors();
  });

  test("shows the empty state with create button when there are no projects", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, []);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-el="project-list.empty-state"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-el="project-list.empty-create-btn"]')).toBeVisible();
    assertNoRuntimeErrors();
  });

  test("new-project button is visible in the topbar", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA]);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('[data-el="project-list.new-project-btn"]')).toBeVisible();
    assertNoRuntimeErrors();
  });

  test("sort dropdown is reachable and contains expected options", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA, PROJECT_BETA]);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('[data-el="project-list.sort-trigger"]').click();

    await expect(page.locator('[data-el="project-list.sort-option-modified"]')).toBeVisible();
    await expect(page.locator('[data-el="project-list.sort-option-name"]')).toBeVisible();
    await expect(page.locator('[data-el="project-list.sort-option-created"]')).toBeVisible();
    assertNoRuntimeErrors();
  });

  test("scope tabs are rendered for all/owned/starred", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA]);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('[data-el="project-list.scope-tab-all"]')).toBeVisible();
    await expect(page.locator('[data-el="project-list.scope-tab-owned"]')).toBeVisible();
    await expect(page.locator('[data-el="project-list.scope-tab-starred"]')).toBeVisible();
    assertNoRuntimeErrors();
  });

  test("card more-options menu has an archive item", async ({ page }) => {
    const counts: Record<string, number> = {};
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA], counts);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('[data-el="project-card.surface"]').first().hover();
    await page.locator('[data-el="project-card.more-btn"]').first().click();

    await expect(page.locator('[data-el="project-card.archive-item"]').first()).toBeVisible();
    assertNoRuntimeErrors();
  });

  test("pin button is visible on card hover", async ({ page }) => {
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA]);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('[data-el="project-card.surface"]').first().hover();

    await expect(page.locator('[data-el="project-card.pin-btn"]').first()).toBeVisible();
    assertNoRuntimeErrors();
  });

  test("clicking a card calls updateLastOpened", async ({ page }) => {
    const counts: Record<string, number> = {};
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, [PROJECT_ALPHA], counts);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="project-card.surface"]').first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('[data-el="project-card.surface"]').first().click();

    await expect.poll(() => counts["project.updateLastOpened"] ?? 0, { timeout: 5_000 }).toBe(1);
    assertNoRuntimeErrors();
  });
});
