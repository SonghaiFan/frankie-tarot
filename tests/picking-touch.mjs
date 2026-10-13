import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { webkit, chromium } from "playwright";

// Real touch events, live catalog, real shaders. This is browser-engine coverage,
// not a claim of physical iPhone performance. Run against a local dev/preview URL.
const base = process.env.TAROT_TEST_URL ?? "http://127.0.0.1:3002";
const engine = process.env.TAROT_BROWSER ?? "webkit";
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  headless: process.env.TAROT_HEADLESS === "1",
  ...(engine === "chromium" ? { channel: "chrome" } : {}),
});
await mkdir("output/playwright", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
  });
  const fallback = process.env.TAROT_DISABLE_WEBGL === "1";
  if (fallback)
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === "webgl" ? null : getContext.call(this, kind, ...args);
      };
    });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      /INVALID_OPERATION|INVALID_VALUE|shader failed|GL_INVALID/.test(m.text())
    )
      errors.push(m.text());
  });
  await page.goto(base);
  await page.getByRole("button", { name: "开始抽牌", exact: true }).click();
  await page.getByRole("button", { name: "重新选择", exact: true }).click();
  await page.getByRole("button", { name: "凯尔特十字", exact: true }).click();
  await page.getByRole("button", { name: "确认牌阵", exact: true }).click();
  await page.getByRole("button", { name: "开始抽牌", exact: true }).click();
  const tiles = page.locator("[data-cloud-card]");
  await tiles.last().waitFor();
  await page.waitForFunction(
    (fallback) =>
      document.querySelectorAll("[data-cloud-card]").length === 78 &&
      document.querySelectorAll(".tarot-card-cloud canvas").length ===
        (fallback ? 78 : 0),
    fallback,
  );
  const saved = () =>
    page.evaluate(() => JSON.parse(sessionStorage.getItem("f-tarot-reading")));
  const initial = await saved();
  const response = [];
  await page.evaluate(() => {
    window.__touchEvents = [];
    for (const type of [
      "pointerdown",
      "pointerup",
      "pointercancel",
      "click",
      "touchstart",
      "touchend",
    ])
      document.addEventListener(
        type,
        (e) =>
          window.__touchEvents.push({
            type,
            pointerType: e.pointerType,
            isPrimary: e.isPrimary,
            target: e.target.closest("[data-cloud-card]")?.dataset.cloudCard,
          }),
        true,
      );
  });
  for (let count = 1; count <= 10; count++) {
    const start = Date.now();
    // Native WebKit touchscreen input exercises pointerup + compatibility click.
    await tiles.last().tap();
    try {
      await page.waitForFunction(
        (n) =>
          JSON.parse(sessionStorage.getItem("f-tarot-reading")).pickedCards
            .length === n,
        count,
        { timeout: 5000 },
      );
    } catch (error) {
      await page.screenshot({
        path: `output/playwright/${engine}-touch-failure.png`,
      });
      console.log(
        await page.evaluate(() => ({
          state: JSON.parse(sessionStorage.getItem("f-tarot-reading"))
            .pickedCards.length,
          events: window.__touchEvents,
        })),
      );
      throw error;
    }
    response.push(Date.now() - start);
    const state = await saved();
    assert.equal(
      state.pickedCards.length,
      count,
      "one physical tap must select exactly one card",
    );
    assert.equal(new Set(state.pickedCards.map((c) => c.image)).size, count);
    assert.deepEqual(
      state.dealtCards,
      initial.dealtCards,
      "picking never reshuffles the table",
    );
    if (count === 9) {
      await page.screenshot({
        path: `output/playwright/${engine}-nine-picked.png`,
      });
      await page.reload();
      await page.waitForFunction(
        (fallback) =>
          document.querySelectorAll("[data-cloud-card]").length === 69 &&
          document.querySelectorAll(".tarot-card-cloud canvas").length ===
            (fallback ? 69 : 0),
        fallback,
      );
      assert.deepEqual(
        (await saved()).pickedCards,
        state.pickedCards,
        "refresh preserves the nine selections",
      );
      await page.setViewportSize({ width: 430, height: 932 });
      await page.waitForTimeout(250);
    }
  }
  await page.waitForFunction(
    () =>
      JSON.parse(sessionStorage.getItem("f-tarot-reading")).stage === "READING",
  );
  await page.waitForTimeout(700);
  assert.equal(
    await tiles.count(),
    0,
    "deck unmounts after the tenth selection",
  );
  assert.equal(
    await page.locator("[data-picking-gpu]").count(),
    0,
    "GPU surface cleans up after picking",
  );
  const backs = page.locator(
    '[data-tarot-stage="cards"] .cursor-pointer.group',
  );
  assert.equal(await backs.count(), 10);
  for (let i = 0; i < 10; i++) await backs.nth(i).tap();
  await page.waitForFunction(
    () =>
      JSON.parse(sessionStorage.getItem("f-tarot-reading")).revealedCardIds
        .length === 10,
  );
  assert.equal((await saved()).pickedCards.length, 10);
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: `output/playwright/${engine}-ten-revealed.png`,
  });
  console.log(
    JSON.stringify(
      {
        engine,
        fallback,
        taps: 10,
        revealed: 10,
        responseMs: response,
        shaderErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
