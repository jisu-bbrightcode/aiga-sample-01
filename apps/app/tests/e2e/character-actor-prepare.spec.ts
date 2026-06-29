/**
 * Character Actor E2E — M2
 *
 * 1. 로그인 → 프로젝트 진입
 * 2. 세계관 > 캐릭터 생성
 * 3. 캐릭터 상세에서 "대화 가능한 캐릭터로 준비" 버튼 클릭
 * 4. Dialog에서 "준비하기" 클릭
 * 5. ready 상태로 전환 확인 (채팅하기 버튼 노출)
 * 6. Actor 삭제 → not_enabled 상태 복원 확인
 *
 * @smoke @character-chat
 *
 * 실행:
 *   pnpm --filter server dev
 *   pnpm --filter app dev
 *   pnpm --filter app exec playwright test e2e/character-actor-prepare.spec.ts --config playwright.config.ts --project chromium
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

test.describe("Character Actor prepare/disable @smoke @character-chat @db", () => {
  test("prepares an actor and then disables it", async ({ page }) => {
    test.setTimeout(180_000);

    await signIn(page);
    const projectId = await resolveProjectId(page);

    const browserErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") browserErrors.push(msg.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    // 1. Navigate to characters list
    await page.goto(`/p/${projectId}/lore/characters`);
    await page.waitForLoadState("networkidle");

    // 2. create character — entity-table에 이이 캐릭터가 있으면 첫 번째 row 선택
    await expect(page.locator('[data-el="entity-table"]')).toBeVisible({ timeout: 15_000 });
    const existingRow = page.locator('[data-el="entity-table.row"]').first();
    if (await existingRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // 이미 캐릭터 있음 — 첫 번째 row 클릭
      await existingRow.click();
      await page.waitForLoadState("networkidle");
    } else {
      await expect(page.locator('[data-el="entity-table.add-row"]')).toBeVisible({
        timeout: 10_000,
      });
      await page.locator('[data-el="entity-table.add-row"]').click();
      // CreateEntityDialog
      await expect(page.locator('[data-el="entity-dialog.footer"]')).toBeVisible({
        timeout: 5_000,
      });
      const dialogInput = page.locator('[role="dialog"] input').first();
      await dialogInput.pressSequentially(`Actor E2E Char ${RUN_SUFFIX}`, { delay: 30 });
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

    // 3. 이미 ready 상태면 먼저 disable
    const readyEl = page.locator('[data-el="actor.ready"]');
    if (await readyEl.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page.locator('[data-el="actor.disable-trigger"]').click();
      const preDisable = waitForTrpc(page, "characterChat.actor.disable");
      await page.locator('[data-el="actor.disable-confirm"]').click();
      await preDisable;
      await expect(page.locator('[data-el="actor.prepare-trigger"]')).toBeVisible({
        timeout: 10_000,
      });
    }

    // actor prepare-trigger visible on character detail
    const prepareTrigger = page.locator('[data-el="actor.prepare-trigger"]');
    await expect(prepareTrigger).toBeVisible({ timeout: 10_000 });

    // 4. open prepare dialog
    await prepareTrigger.click();
    await expect(page.locator('[data-el="actor.prepare-dialog"]')).toBeVisible({ timeout: 5_000 });

    // 5. confirm prepare
    const prepareRes = waitForTrpc(page, "characterChat.actor.prepare");
    await page.locator('[data-el="actor.prepare-confirm"]').click();
    await prepareRes;

    // 6. ready state
    await expect(page.locator('[data-el="actor.ready"]')).toBeVisible({ timeout: 20_000 });

    // 7. disable
    await page.locator('[data-el="actor.disable-trigger"]').click();
    const disableRes = waitForTrpc(page, "characterChat.actor.disable");
    await page.locator('[data-el="actor.disable-confirm"]').click();
    await disableRes;

    // 8. not_enabled restored
    await expect(page.locator('[data-el="actor.prepare-trigger"]')).toBeVisible({
      timeout: 10_000,
    });

    const errors = browserErrors.filter(
      (m) =>
        !m.includes("liquid-splats.lottie") &&
        !m.includes("Base UI: A component that acts as a button"),
    );
    expect(errors).toEqual([]);
  });
});
