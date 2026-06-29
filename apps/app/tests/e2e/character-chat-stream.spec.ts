/**
 * Operator Chat Stream E2E — M4
 *
 * 1. 로그인 → 프로젝트 진입
 * 2. ready Actor가 있는 캐릭터로 /p/${projectId}/chat/${characterId} 직접 이동
 * 3. [data-el="chat.composer-input"] 클릭 → 메시지 입력
 * 4. [data-el="chat.send-btn"] 클릭
 * 5. [data-el="chat.message-item"] 2개 이상 visible (user + assistant)
 * 6. [data-el="chat.message-list"] 에 assistant 메시지 visible
 *
 * 전제: ai-runtime을 AI_MOCK=true로 실행해야 함
 *   AI_MOCK=true pnpm --filter ai-runtime dev
 *
 * @smoke @operator-chat @streaming @db
 *
 * 실행:
 *   pnpm --filter server dev
 *   AI_MOCK=true pnpm --filter ai-runtime dev
 *   pnpm --filter app dev
 *   pnpm --filter app exec playwright test e2e/character-chat-stream.spec.ts --config playwright.config.ts --project chromium
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
    { timeout: 20_000 },
  );
}

/**
 * Ensure at least one ready actor exists.
 * Returns the characterId of a ready actor.
 */
async function ensureReadyActorAndGetCharacterId(
  page: Page,
  projectId: string,
): Promise<string> {
  // Check if sidebar already has a ready chat item
  const existingChatItem = page.locator('[data-el="shell.chat-item"]').first();
  if (await existingChatItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
    // Click it to navigate and grab characterId from URL
    await existingChatItem.click();
    await page.waitForLoadState("networkidle");
    const urlMatch = page.url().match(/\/chat\/([0-9a-f-]{36})/i);
    if (urlMatch?.[1]) return urlMatch[1];
  }

  // Navigate to character list and create a character with ready actor
  await page.goto(`/p/${projectId}/lore/characters`);
  await page.waitForLoadState("networkidle");

  await expect(page.locator('[data-el="entity-table"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-el="entity-table.add-row"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-el="entity-table.add-row"]').click();
  await page.waitForLoadState("networkidle");

  // Fill character name
  const titleInput = page.locator('[data-el="ed-title"]');
  if (await titleInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await titleInput.fill(`Stream E2E Char ${RUN_SUFFIX}`);
    await titleInput.press("Enter");
  } else {
    await expect(page.locator('[data-el="entity-dialog.footer"]')).toBeVisible({ timeout: 5_000 });
    const dialogInput = page.locator('[role="dialog"] input').first();
    await dialogInput.click();
    await dialogInput.pressSequentially(`Stream E2E Char ${RUN_SUFFIX}`);
    const submitBtn = page.locator('[data-el="entity-dialog.footer"] button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();
    await page.waitForLoadState("networkidle");
  }

  // Grab characterId from URL
  const characterIdFromUrl = page.url().match(/\/characters\/([0-9a-f-]{36})/i)?.[1];

  // Prepare actor
  const prepareTrigger = page.locator('[data-el="actor.prepare-trigger"]');
  await expect(prepareTrigger).toBeVisible({ timeout: 10_000 });
  await prepareTrigger.click();

  await expect(page.locator('[data-el="actor.prepare-dialog"]')).toBeVisible({ timeout: 5_000 });

  const prepareRes = waitForTrpc(page, "characterChat.actor.prepare");
  await page.locator('[data-el="actor.prepare-confirm"]').click();
  await prepareRes;

  // Wait for ready state
  await expect(page.locator('[data-el="actor.ready"]')).toBeVisible({ timeout: 20_000 });

  if (characterIdFromUrl) return characterIdFromUrl;

  // Fallback: navigate via chat item
  await page.goto(`/p/${projectId}/lore/characters`);
  await page.waitForLoadState("networkidle");
  const chatItem = page.locator('[data-el="shell.chat-item"]').first();
  await expect(chatItem).toBeVisible({ timeout: 10_000 });
  await chatItem.click();
  await page.waitForLoadState("networkidle");
  const urlMatch = page.url().match(/\/chat\/([0-9a-f-]{36})/i);
  if (!urlMatch?.[1]) throw new Error("Could not determine characterId");
  return urlMatch[1];
}

test.describe("Operator Chat Stream @smoke @operator-chat @streaming @db", () => {
  test("sends a message and receives streaming response", async ({ page }) => {
    test.setTimeout(180_000);

    await signIn(page);
    const projectId = await resolveProjectId(page);

    const browserErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") browserErrors.push(msg.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    // Ensure a ready actor exists and get its characterId
    const characterId = await ensureReadyActorAndGetCharacterId(page, projectId);

    // Navigate directly to chat page
    await page.goto(`/p/${projectId}/chat/${characterId}`);
    await page.waitForLoadState("networkidle");

    // Verify chat page loaded
    await expect(page.locator('[data-el="chat-page"]')).toBeVisible({ timeout: 10_000 });

    // Verify composer is visible
    const composerInput = page.locator('[data-el="chat.composer-input"]');
    await expect(composerInput).toBeVisible({ timeout: 10_000 });

    // Type a message
    await composerInput.click();
    await composerInput.pressSequentially("hello");

    // Send
    const sendBtn = page.locator('[data-el="chat.send-btn"]');
    await expect(sendBtn).toBeEnabled({ timeout: 5_000 });

    const sessionCreateRes = waitForTrpc(page, "characterChat.chatSession.create");
    await sendBtn.click();
    await sessionCreateRes;

    // Wait for at least 2 message items (user + assistant)
    await expect(page.locator('[data-el="chat.message-item"]')).toHaveCount(2, {
      timeout: 30_000,
    });

    // Verify both are visible
    const messageItems = page.locator('[data-el="chat.message-item"]');
    await expect(messageItems.nth(0)).toBeVisible({ timeout: 5_000 });
    await expect(messageItems.nth(1)).toBeVisible({ timeout: 5_000 });

    // Verify assistant message in message-list
    const assistantMessage = page
      .locator('[data-el="chat.message-list"] [data-el="chat.message-item"][data-role="assistant"]')
      .first();
    await expect(assistantMessage).toBeVisible({ timeout: 30_000 });

    // Wait for streaming to complete (stop-btn disappears, send-btn reappears)
    await expect(page.locator('[data-el="chat.send-btn"]')).toBeVisible({ timeout: 30_000 });

    const errors = browserErrors.filter(
      (m) =>
        !m.includes("liquid-splats.lottie") &&
        !m.includes("Base UI: A component that acts as a button"),
    );
    expect(errors).toEqual([]);
  });
});
