/**
 * Operator Chat Navigation E2E — M3
 *
 * 1. 로그인 → 프로젝트 진입
 * 2. 세계관 > 캐릭터 목록 이동
 * 3. ready actor가 있는 캐릭터가 없으면 생성 후 actor prepare
 * 4. Sidebar [data-el="shell.chat-item"] 클릭
 * 5. [data-el="chat-page"] visible 확인
 * 6. [data-el="chat.thread-list-pane"] visible 확인
 *
 * @smoke @operator-chat @db
 *
 * 실행:
 *   pnpm --filter server dev
 *   pnpm --filter app dev
 *   pnpm --filter app exec playwright test e2e/character-chat-navigation.spec.ts --config playwright.config.ts --project chromium
 */
import { expect, test, type Page } from "@playwright/test";

const QA_EMAIL = process.env.E2E_EMAIL ?? "qa+e2e@example.com";
const QA_PASSWORD = process.env.E2E_PASSWORD ?? "QaTest1234!";
const RUN_SUFFIX = Date.now().toString(36);

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.fill("input[type=email]", QA_EMAIL);
  await page.fill("input[type=password]", QA_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/sign-in")) {
    const formText = await page
      .locator('[data-el="login.form-card"]')
      .innerText()
      .catch(() => "");
    throw new Error(`sign-in failed for ${QA_EMAIL}: ${formText}`);
  }
}

async function resolveProjectId(page: Page): Promise<string> {
  const targetProjectId = process.env.E2E_PROJECT_ID;
  const fromUrl = () => page.url().match(/\/p\/([0-9a-f-]{36})/i)?.[1] ?? null;

  const current = fromUrl();
  if (current) return current;

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // workspace-select 화면이면 첫 번째 workspace 선택 후 계속
  if (page.url().includes("/workspace-select")) {
    const firstRow = page.locator('[data-el="workspace.row"]').first();
    if ((await firstRow.count()) > 0) await firstRow.click();
    await page.locator('[data-el="workspace.continue"]').click();
    await page.waitForLoadState("networkidle");
  }

  if (targetProjectId) {
    await page.goto(`/p/${targetProjectId}/lore/characters`);
    await page.waitForLoadState("networkidle");
    // 여전히 workspace-select이면 같은 흐름 재시도
    if (page.url().includes("/workspace-select")) {
      const firstRow = page.locator('[data-el="workspace.row"]').first();
      if ((await firstRow.count()) > 0) await firstRow.click();
      await page.locator('[data-el="workspace.continue"]').click();
      await page.waitForLoadState("networkidle");
      await page.goto(`/p/${targetProjectId}/lore/characters`);
      await page.waitForLoadState("networkidle");
    }
    return targetProjectId;
  }

  const redirected = fromUrl();
  if (redirected) return redirected;

  const firstCard = page.locator('main div[role="button"]:visible').first();
  if ((await firstCard.count()) > 0 && (await firstCard.isVisible())) {
    await firstCard.click();
    await page.waitForURL(/\/p\/[0-9a-f-]{36}\//i, { timeout: 15_000 });
    const opened = fromUrl();
    if (opened) return opened;
  }

  throw new Error(`projectId 추출 실패 - 현재 URL: ${page.url()}`);
}

async function waitForTrpc(page: Page, procedure: string) {
  return page.waitForResponse(
    (response) => response.url().includes(`/trpc/${procedure}`) && response.status() === 200,
    { timeout: 15_000 },
  );
}

/**
 * Ensure at least one ready actor exists.
 * Returns without error if a chat-item is already visible in the sidebar.
 * Otherwise creates a character and prepares an actor.
 */
async function ensureReadyActor(page: Page, projectId: string) {
  await page.goto(`/p/${projectId}/lore/characters`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[data-el="entity-table"]')).toBeVisible({ timeout: 15_000 });

  // 기존 캐릭터가 있으면 첫 번째 row, 없으면 생성
  const existingRow = page.locator('[data-el="entity-table.row"]').first();
  if (await existingRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await existingRow.click();
    await page.waitForLoadState("networkidle");
  } else {
    await page.locator('[data-el="entity-table.add-row"]').click();
    await expect(page.locator('[data-el="entity-dialog.footer"]')).toBeVisible({ timeout: 5_000 });
    const dialogInput = page.locator('[role="dialog"] input').first();
    await dialogInput.pressSequentially(`Chat Nav Char ${RUN_SUFFIX}`, { delay: 30 });
    const submitBtn = page.locator('[data-el="entity-dialog.footer"] button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 8_000 });
    const createRes = waitForTrpc(page, "story.character.create");
    await submitBtn.click();
    await createRes;
    await expect(page.locator('[data-el="entity-dialog.footer"]')).not.toBeVisible({
      timeout: 10_000,
    });
    await page.waitForLoadState("networkidle");
  }

  // 이미 ready면 완료
  if (
    await page
      .locator('[data-el="actor.ready"]')
      .isVisible({ timeout: 3_000 })
      .catch(() => false)
  ) {
    return;
  }

  const prepareTrigger = page.locator('[data-el="actor.prepare-trigger"]');
  await expect(prepareTrigger).toBeVisible({ timeout: 10_000 });
  await prepareTrigger.click();
  await expect(page.locator('[data-el="actor.prepare-dialog"]')).toBeVisible({ timeout: 5_000 });
  const prepareRes = waitForTrpc(page, "characterChat.actor.prepare");
  await page.locator('[data-el="actor.prepare-confirm"]').click();
  await prepareRes;
  await expect(page.locator('[data-el="actor.ready"]')).toBeVisible({ timeout: 20_000 });
}

test.describe("Operator Chat Navigation @smoke @operator-chat @db", () => {
  test("navigates to chat page via sidebar chat item", async ({ page }) => {
    test.setTimeout(180_000);

    await signIn(page);
    const projectId = await resolveProjectId(page);

    const browserErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") browserErrors.push(msg.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    // Ensure at least one ready actor exists (creates one if needed)
    await ensureReadyActor(page, projectId);

    // Navigate to a known project page so sidebar is visible
    await page.goto(`/p/${projectId}/lore/characters`);
    await page.waitForLoadState("networkidle");

    // Wait for the chat sidebar item to appear
    const chatItem = page.locator('[data-el="shell.chat-item"]').first();
    await expect(chatItem).toBeVisible({ timeout: 15_000 });

    // Click the chat item
    await chatItem.click();
    await page.waitForLoadState("networkidle");

    // Verify chat page is rendered
    await expect(page.locator('[data-el="chat-page"]')).toBeVisible({ timeout: 10_000 });

    // Verify thread list pane is visible
    await expect(page.locator('[data-el="chat.thread-list-pane"]')).toBeVisible({
      timeout: 5_000,
    });

    const errors = browserErrors.filter(
      (m) =>
        !m.includes("liquid-splats.lottie") &&
        !m.includes("Base UI: A component that acts as a button"),
    );
    expect(errors).toEqual([]);
  });
});
