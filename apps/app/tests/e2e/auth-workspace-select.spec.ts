/**
 * Workspace select E2E — 워크스페이스 목록 화면.
 * 모든 `/auth/**` 는 mock — 외부 인프라 의존 없음.
 *
 * 시나리오:
 * 1. 워크스페이스 목록 표시 + 기본 선택
 * 2. 워크스페이스 선택 후 계속 → next 경로로 이동
 * 3. setActive 실패 시 에러 메시지 표시
 * 4. 워크스페이스 없을 때 continue 비활성화
 * 5. 새 워크스페이스 만들기 → /create-workspace 이동
 * 6. 미인증 상태 → /sign-in 리다이렉트
 */
import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "./_lib/env";
import { fulfillJson } from "./_lib/network";


const MOCK_USER = {
  id: "user-1",
  email: "e2e@studio.com",
  name: "E2E User",
  image: null,
  createdAt: new Date("2024-01-01").toISOString(),
  updatedAt: new Date("2024-01-01").toISOString(),
  emailVerified: true,
};

const MOCK_WORKSPACES = [
  {
    id: "ws-1",
    name: "Product Builder Studio",
    slug: "product-builder-studio",
    logo: null,
    metadata: { memberCount: 3, plan: "Pro", role: "Owner", storyCount: 12 },
  },
  {
    id: "ws-2",
    name: "Side Project",
    slug: "side-project",
    logo: null,
    metadata: { memberCount: 1, plan: "Free", role: "Member", storyCount: 2 },
  },
];


type SetActiveScenario = "success" | "error";

async function installMock(
  page: Page,
  {
    authenticated = true,
    workspaces = MOCK_WORKSPACES,
    activeOrgId = "ws-1",
    setActiveScenario = "success" as SetActiveScenario,
  } = {},
) {
  await page.route("**/auth/**", async (route) => {
    const url = route.request().url();

    if (url.includes("get-session")) {
      if (!authenticated) {
        await fulfillJson(route, null);
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: { id: "sess-1", activeOrganizationId: activeOrgId },
          user: MOCK_USER,
        }),
      });
      return;
    }

    if (url.includes("organization/list")) {
      await fulfillJson(route, workspaces);
      return;
    }

    if (url.includes("organization/get-full-organization")) {
      const active = workspaces.find((w) => w.id === activeOrgId) ?? null;
      await fulfillJson(route, active);
      return;
    }

    if (url.includes("organization/set-active")) {
      if (setActiveScenario === "error") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal error", code: "INTERNAL_AUTH_ERROR" }),
        });
        return;
      }
      await fulfillJson(route, { id: activeOrgId });
      return;
    }

    await fulfillJson(route, null);
  });
}

test.describe("Workspace select @critical @auth", () => {
  test("워크스페이스 목록이 표시되고 로그인 이메일이 보인다", async ({ page }) => {
    await installMock(page);

    await page.goto(appUrl("/workspace-select"), { waitUntil: "networkidle" });

    await expect(page.locator('[data-el="workspace.form-card"]')).toBeVisible();
    await expect(page.locator('[data-el="workspace.signed-in-email"]')).toHaveText(MOCK_USER.email);
    await expect(page.locator('[data-el="workspace.list"]')).toBeVisible();
    // 워크스페이스 2개 + 만들기 버튼
    await expect(page.locator('[data-el="workspace.row"]')).toHaveCount(2);
    await expect(page.locator('[data-el="workspace.create"]')).toBeVisible();
  });

  test("활성 워크스페이스가 기본 선택된다", async ({ page }) => {
    await installMock(page, { activeOrgId: "ws-1" });

    await page.goto(appUrl("/workspace-select"), { waitUntil: "networkidle" });

    // 첫 번째 row가 aria-pressed="true"
    const rows = page.locator('[data-el="workspace.row"]');
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
    await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "false");
  });

  test("워크스페이스 선택 후 계속 클릭 → next 경로로 이동", async ({ page }) => {
    await installMock(page);

    await page.goto(appUrl("/workspace-select?next=/projects"), { waitUntil: "networkidle" });

    // 두 번째 워크스페이스 선택
    await page.locator('[data-el="workspace.row"]').nth(1).click();
    await expect(page.locator('[data-el="workspace.row"]').nth(1)).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.locator('[data-el="workspace.continue"]').click();

    await expect(page).toHaveURL(/\/projects/, { timeout: 5_000 });
  });

  test("setActive 실패 시 에러 메시지 표시 + 페이지 유지", async ({ page }) => {
    await installMock(page, { setActiveScenario: "error" });

    await page.goto(appUrl("/workspace-select"), { waitUntil: "networkidle" });

    await page.locator('[data-el="workspace.continue"]').click();

    await expect(page.locator('[data-el="workspace.error-message"]')).toBeVisible();
    await expect(page).toHaveURL(/\/workspace-select/);
  });

  test("워크스페이스 없을 때 continue 비활성화", async ({ page }) => {
    await installMock(page, { workspaces: [], activeOrgId: "" });

    await page.goto(appUrl("/workspace-select"), { waitUntil: "networkidle" });

    await expect(page.locator('[data-el="workspace.continue"]')).toBeDisabled();
  });

  test("새 워크스페이스 만들기 클릭 → /create-workspace 이동", async ({ page }) => {
    await installMock(page);

    await page.goto(appUrl("/workspace-select"), { waitUntil: "networkidle" });

    await page.locator('[data-el="workspace.create"]').click();

    await expect(page).toHaveURL(/\/create-workspace/, { timeout: 5_000 });
  });

  test("미인증 상태 → /sign-in 리다이렉트", async ({ page }) => {
    await installMock(page, { authenticated: false });

    await page.goto(appUrl("/workspace-select"), { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5_000 });
  });
});
