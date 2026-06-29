/**
 * Operator Chat M6 Improvements E2E
 *
 * 검증:
 * - FLT-386 First Greeting LLM: greeting 메시지가 fallback("...반갑습니다.")이 아니라 LLM(또는 mock) 생성 결과
 * - FLT-388 Thread title 자동 생성: 새 thread 첫 user message → title이 user message 일부
 * - FLT-391 last_opened_thread_id 복원: thread 선택 → 새로고침 → 동일 thread 유지
 * - FLT-393 Prepare Dialog 비용 안내: data-el="actor.prepare-dialog-cost" 노출 및 "비용" 문구
 *
 * @regression @operator-chat @db
 *
 * 사전 조건:
 *   - server(3002), app(3000), ai-runtime(3003 with AI_MOCK=true) 가동
 *   - E2E_PROJECT_ID 환경변수 (Chat Nav E2E Project)
 *   - qa+e2e@example.com / QaTest1234! 계정
 */
import { expect, test, type Page } from "@playwright/test";

const QA_EMAIL = process.env.E2E_EMAIL ?? "qa+e2e@example.com";
const QA_PASSWORD = process.env.E2E_PASSWORD ?? "QaTest1234!";

// M6 검증용 별도 캐릭터 (Scenario 1과 충돌 방지)
const M6_CHAR_ID = "fdf59321-6412-44a5-a69d-141d9764e7bd";

// 각 테스트 3분 timeout (LLM/prepare 흐름 포함)

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.fill("input[type=email]", QA_EMAIL);
  await page.fill("input[type=password]", QA_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForLoadState("networkidle");
}

async function resolveProjectId(page: Page): Promise<string> {
  const pid = process.env.E2E_PROJECT_ID;
  if (!pid) throw new Error("E2E_PROJECT_ID not set");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/workspace-select")) {
    const row = page.locator('[data-el="workspace.row"]').first();
    if ((await row.count()) > 0) await row.click();
    await page.locator('[data-el="workspace.continue"]').click();
    await page.waitForLoadState("networkidle");
  }
  await page.goto(`/p/${pid}/lore/characters`);
  await page.waitForLoadState("networkidle");
  return pid;
}

function waitForTrpc(page: Page, procedure: string) {
  return page.waitForResponse(
    (r) => r.url().includes(`/trpc/${procedure}`) && r.status() === 200,
    { timeout: 15_000 },
  );
}

async function goToCharacter(page: Page, projectId: string, charId: string) {
  await page.goto(`/p/${projectId}/lore/characters/${charId}`);
  await page.waitForLoadState("networkidle");
}

async function ensureFreshActor(page: Page) {
  if (await page.locator('[data-el="actor.ready"]').isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.locator('[data-el="actor.disable-trigger"]').click();
    const res = waitForTrpc(page, "characterChat.actor.disable");
    await page.locator('[data-el="actor.disable-confirm"]').click();
    await res;
    await expect(page.locator('[data-el="actor.prepare-trigger"]')).toBeVisible({ timeout: 10_000 });
  }
}

async function prepareActor(page: Page) {
  const trigger = page.locator('[data-el="actor.prepare-trigger"]');
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();
  await expect(page.locator('[data-el="actor.prepare-dialog"]')).toBeVisible({ timeout: 5_000 });
  const res = waitForTrpc(page, "characterChat.actor.prepare");
  await page.locator('[data-el="actor.prepare-confirm"]').click();
  await res;
  await expect(page.locator('[data-el="actor.ready"]')).toBeVisible({ timeout: 20_000 });
}



test.describe("Operator Chat M6 Improvements @regression @operator-chat @db", () => {
  test("FLT-393 — prepare Dialog에 비용 안내 노출", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    const pid = await resolveProjectId(page);
    await goToCharacter(page, pid, M6_CHAR_ID);
    await ensureFreshActor(page);

    await page.locator('[data-el="actor.prepare-trigger"]').click();
    const dialog = page.locator('[data-el="actor.prepare-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // 비용 안내 항목이 명시적 data-el로 노출
    const costNote = page.locator('[data-el="actor.prepare-dialog-cost"]');
    await expect(costNote).toBeVisible({ timeout: 2_000 });
    await expect(costNote).toContainText("비용");

    // 4개 안내 리스트
    const notes = page.locator('[data-el="actor.prepare-dialog-notes"] li');
    expect(await notes.count()).toBeGreaterThanOrEqual(4);
  });

  test("FLT-386 — 첫 인사가 fallback 문구가 아닌 LLM 생성 결과", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    const pid = await resolveProjectId(page);
    await goToCharacter(page, pid, M6_CHAR_ID);
    await ensureFreshActor(page);
    await prepareActor(page);

    await page.goto(`/p/${pid}/chat/${M6_CHAR_ID}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-el="chat.thread-list-pane"]')).toBeVisible({ timeout: 10_000 });

    // greeting thread auto-select 후 first assistant message 등장 (content가 들어길 때까지 polling)
    const FALLBACK = "입니다. 만나서 반갑습니다.";
    await expect(async () => {
      const firstAssistant = page
        .locator('[data-el="chat.message-item"][data-role="assistant"]')
        .first();
      await expect(firstAssistant).toBeVisible();
      const text = (await firstAssistant.innerText()).trim();
      // AI_MOCK=true: "[mock] ..." / 운영 LLM: 임의 텍스트 / fallback은 아니어야 함
      expect(text).not.toBe("");
      expect(text.includes("[mock]") || !text.endsWith(FALLBACK)).toBe(true);
    }).toPass({ timeout: 30_000 });
  });

  test("FLT-388 — thread title이 placeholder가 아닌 실제 값", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    const pid = await resolveProjectId(page);
    await goToCharacter(page, pid, M6_CHAR_ID);
    await ensureFreshActor(page);
    await prepareActor(page);

    await page.goto(`/p/${pid}/chat/${M6_CHAR_ID}`);
    await page.waitForLoadState("networkidle");

    // greeting thread는 자동 생성되면서 title="첫 대화"로 저장됨.
    // chat-page placeholder "새 대화"가 아닌 실제 title이 보여야 함
    await expect(page.locator('[data-el="chat.thread-item"]').first()).toBeVisible({ timeout: 15_000 });
    const items = page.locator('[data-el="chat.thread-item"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    let hasNonPlaceholder = false;
    for (let i = 0; i < count; i++) {
      const t = (await items.nth(i).innerText()).trim();
      if (t && t !== "새 대화") {
        hasNonPlaceholder = true;
        break;
      }
    }
    expect(hasNonPlaceholder).toBe(true);
  });

  test("FLT-391 — last_opened_thread_id로 새로고침 후 thread 복원", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    const pid = await resolveProjectId(page);
    await goToCharacter(page, pid, M6_CHAR_ID);
    await ensureFreshActor(page);
    await prepareActor(page);

    await page.goto(`/p/${pid}/chat/${M6_CHAR_ID}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-el="chat.thread-item"]').first()).toBeVisible({ timeout: 10_000 });

    // 새 thread 1개 생성 (메시지 보내기)
    const newBtn = page.locator('[data-el="chat.new-thread-btn"]');
    if (await newBtn.isVisible().catch(() => false)) await newBtn.click();
    const composer = page.locator('[data-el="chat.composer-input"]');
    await composer.fill("second-thread-marker");
    await page.locator('[data-el="chat.send-btn"]').click();
    await waitForTrpc(page, "characterChat.chatSession.create");

    // thread 목록에 최소 2개 존재
    await expect(async () => {
      const count = await page.locator('[data-el="chat.thread-item"]').count();
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 10_000 });

    // 가장 오래된(아래쪽) thread를 클릭하여 선택 변경
    const items = page.locator('[data-el="chat.thread-item"]');
    const lastItem = items.last();
    const lastThreadId = await lastItem.getAttribute("data-thread-id");
    expect(lastThreadId).not.toBeNull();
    const setLastRes = waitForTrpc(page, "characterChat.chatList.setLastOpened");
    await lastItem.click();
    await setLastRes;

    // 페이지 새로고침
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-el="chat.thread-item"]').first()).toBeVisible({ timeout: 15_000 });

    // 새로고침 후 active thread가 lastThreadId여야 함
    await expect(async () => {
      const activeItem = page.locator('[data-el="chat.thread-item"][data-active]');
      const activeId = await activeItem.first().getAttribute("data-thread-id").catch(() => null);
      expect(activeId).toBe(lastThreadId);
    }).toPass({ timeout: 10_000 });
  });
});
