import { expect, test, type Page } from "@playwright/test";

import { createAuthFixture } from "./_lib/auth-fixture";
import { appUrl } from "./_lib/env";
import { fulfillJson } from "./_lib/network";

const PROJECT_ID = "77000000-0000-4000-8000-000000000001";
const PROJECT_NAME = "삭제 QA 프로젝트";
const ORG_ID = "org-playwright";

type CallCounts = Record<string, number>;

const { user, session, member, organization } = createAuthFixture({
  slug: "playwright",
  email: "qa@product-builder.local",
  name: "Playwright QA",
  organizationName: "Playwright Workspace",
  organizationId: ORG_ID,
  embedMemberInOrganization: true,
});

function project() {
  return {
    id: PROJECT_ID,
    name: PROJECT_NAME,
    description: "Playwright archive/permanent delete smoke target",
    ownerId: user.id,
    orgId: ORG_ID,
    handle: "delete-qa",
    visibility: "private",
    starred: false,
    coverImage: null,
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    archivedAt: null,
    memberCount: 1,
    storyCount: 0,
    languageCount: 0,
    viewerRole: "owner",
    members: [],
    languages: [],
    tags: [],
  };
}

function payloadForOperation(operation: string) {
  switch (operation) {
    case "project.list":
      return [project()];
    case "project.getById":
    case "project.updateLastOpened":
      return project();
    case "project.archive":
    case "project.permanentlyDelete":
      return { success: true };
    case "settingsProjects.list":
      return [project()];
    case "settingsProjects.byId":
      return project();
    default:
      return null;
  }
}



async function installBrowserMocks(page: Page, counts: CallCounts) {
  await page.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/auth/, "");
    if (path === "/get-session") return fulfillJson(route, session);
    if (path === "/organization/list") return fulfillJson(route, [organization]);
    if (path === "/organization/get-full-organization") return fulfillJson(route, organization);
    if (path === "/organization/get-active-member") return fulfillJson(route, member);
    if (path === "/organization/get-active-member-role") return fulfillJson(route, { role: "owner" });
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
    for (const operation of operations) counts[operation] = (counts[operation] ?? 0) + 1;

    await fulfillJson(
      route,
      operations.map((operation) => ({
        result: { data: payloadForOperation(operation) },
      })),
    );
  });
}

function collectRuntimeErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return () => {
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  };
}

test.describe("project archive and permanent delete wiring @critical @project", () => {
  test("archives a project from the home card menu", async ({ page }) => {
    const counts: CallCounts = {};
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, counts);

    await page.goto(appUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.getByText(PROJECT_NAME)).toBeVisible({ timeout: 15_000 });

    await page.getByText(PROJECT_NAME).hover();
    await page.getByLabel("더 보기").first().click();
    await expect(page.getByRole("menuitem", { name: "보관" })).toBeVisible();
    await page.getByRole("menuitem", { name: "보관" }).click();

    await expect.poll(() => counts["project.archive"] ?? 0).toBe(1);
    expect(counts["project.delete"] ?? 0).toBe(0);
    assertNoRuntimeErrors();
  });

  test("permanently deletes a project from settings detail", async ({ page }) => {
    const counts: CallCounts = {};
    const assertNoRuntimeErrors = collectRuntimeErrors(page);
    await installBrowserMocks(page, counts);

    await page.goto(appUrl(`/settings/projects/${PROJECT_ID}`), { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: PROJECT_NAME })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("프로젝트 영구 삭제")).toBeVisible();

    await page.getByRole("button", { name: "프로젝트 삭제" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByLabel(/DELETE-/).fill(`DELETE-${PROJECT_NAME}`);
    await page.getByRole("button", { name: "삭제" }).click();

    await expect.poll(() => counts["project.permanentlyDelete"] ?? 0).toBe(1);
    expect(counts["project.archive"] ?? 0).toBe(0);
    await expect(page).toHaveURL(/\/settings\/projects$/);
    assertNoRuntimeErrors();
  });
});
