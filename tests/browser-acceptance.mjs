import assert from "node:assert/strict";
import { chromium } from "playwright";

// Run against mcp:dev with the real Franklin API. No visual components or
// catalog responses are mocked. This is an MCP Apps host, not ChatGPT itself.
const previewUrl =
  process.env.TAROT_PREVIEW_URL ?? "http://127.0.0.1:8787/preview?locale=en";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TAROT_CHROMIUM_PATH
    ? { executablePath: process.env.TAROT_CHROMIUM_PATH }
    : {}),
  args: process.env.TAROT_CHROMIUM_ARGS
    ? JSON.parse(process.env.TAROT_CHROMIUM_ARGS)
    : [],
});
const browserContext = await browser.newContext();
try {
  for (const viewport of [
    { width: 1280, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const page = await browserContext.newPage();
    await page.setViewportSize(viewport);
    const requests = [];
    const errors = [];
    page.on("request", (r) => requests.push(r.url()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(previewUrl);
    await page
      .locator("#preview-status[data-connected=true]")
      .waitFor({ timeout: 30000 });

    await page
      .frameLocator("#tarot-app")
      .getByRole("button", { name: "START DRAWING", exact: true })
      .waitFor();
    const ui = page.frameLocator("#tarot-app");
    await ui
      .getByRole("button", { name: "START DRAWING", exact: true })
      .click();
    await ui.locator("input").waitFor();
    await ui.getByRole("button", { name: "RESELECT SPREAD" }).click();
    await ui.locator("button[aria-pressed]").first().waitFor();
    await ui
      .getByRole("button", { name: "Classic Trinity", exact: true })
      .click();
    await ui
      .getByRole("button", { name: "CONFIRM SPREAD", exact: true })
      .click();
    await ui.locator("input").fill("Browser acceptance test");
    await ui
      .getByRole("button", { name: "START DRAWING", exact: true })
      .dblclick();
    const url = new URL(previewUrl);
    const key = `f-tarot-preview:${url.pathname}${url.search}`;
    const saved = () =>
      page.evaluate(
        (key) =>
          JSON.parse(sessionStorage.getItem(key) ?? "null")?.privateContent
            ?.snapshot,
        key,
      );
    async function until(check) {
      for (let i = 0; i < 100; i++) {
        const value = await saved();
        if (value && check(value)) return value;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw Error("State timeout");
    }
    const dealt = await until(
      (s) => s.stage === "PICKING" && s.dealtCards?.length === 78,
    );
    assert.equal(dealt.pickedCards.length, 0);
    const tiles = ui.locator("[data-cloud-card]");
    await tiles.last().waitFor();
    await tiles.last().evaluate((el) => {
      el.click();
      el.click();
    });
    const one = await until((s) => s.pickedCards.length === 1);
    assert.deepEqual(one.dealtCards, dealt.dealtCards);
    assert.equal(
      await page.locator("#preview-message").innerText(),
      "No interpretation requested.",
    );
    await page.reload();
    await page.locator("#preview-status[data-connected=true]").waitFor();
    await ui.locator(".tarot-card-cloud").waitFor({ state: "attached" });
    const restored = await until(
      (s) => s.stage === "PICKING" && s.pickedCards.length === 1,
    );
    assert.deepEqual(restored, one);
    await tiles.last().click();
    await tiles.last().click();
    const picked = await until(
      (s) => s.stage === "READING" && s.pickedCards.length === 3,
    );
    assert.equal(new Set(picked.pickedCards.map((c) => c.image)).size, 3);
    const backs = ui.locator(
      '[data-tarot-stage="cards"] div.cursor-pointer.group',
    );
    assert.equal(await backs.count(), 3);
    for (let i = 0; i < 3; i++) await backs.nth(i).click();
    const final = await until((s) => s.revealedCardIds.length === 3);
    assert.equal(
      await page.locator("#preview-message").innerText(),
      "No interpretation requested.",
    );
    assert.equal(final.summaryRequested, false);
    const revealContext = JSON.parse(
      await page.locator("#preview-context").textContent(),
    ).structuredContent;
    assert.equal(revealContext.requestedAction, undefined);
    assert.equal(revealContext.cards, undefined);
    assert.equal(revealContext.dealtCards, undefined);
    await ui
      .getByRole("button", { name: "Brief reading", exact: true })
      .click();
    await until((s) => s.summaryRequested === true);
    await page
      .getByText(
        "Please write a short reflection on the cards I just revealed and add it to the table.",
        { exact: true },
      )
      .waitFor();
    const context = JSON.parse(
      await page.locator("#preview-context").textContent(),
    );
    assert.deepEqual(
      context.structuredContent.cards.map((c) => c.position),
      [1, 2, 3],
    );
    assert.equal(context.structuredContent.dealtCards, undefined);
    assert.equal((await saved()).pickedCards.length, 3);
    await page.locator("#preview-summary").click();
    await until((s) => s.readingText?.length > 0);
    await ui
      .getByRole("button", { name: "Interpret here", exact: true })
      .click();
    await page
      .getByText(
        "Please explore the connections between these cards more deeply and suggest practical next steps.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      JSON.parse(await page.locator("#preview-context").textContent())
        .structuredContent.requestedAction,
      "interpret",
    );
    const end = await saved();
    assert.deepEqual(end.pickedCards, final.pickedCards);
    await page.reload();
    await page.locator("#preview-status[data-connected=true]").waitFor();
    await ui
      .getByRole("button", { name: "Interpret here", exact: true })
      .waitFor();
    const after = await until((s) => s.readingText === end.readingText);
    assert.deepEqual(after.pickedCards, end.pickedCards);
    assert.equal(
      await page.locator("#preview-message").innerText(),
      "No interpretation requested.",
    );
    assert.ok(
      requests.every(
        (u) => !u.includes("/draw") && !u.includes("/cards/random"),
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${viewport.width}px iframe: manual selection, duplicate tile guard, exact recovery, last reveal, explicit brief/deep messages, zero draw endpoints`,
    );
    if (process.env.TAROT_SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.TAROT_SCREENSHOT_DIR}/iframe-${viewport.width}.png`,
      });
    await ui.locator("header button").first().click();
    await ui
      .getByRole("button", { name: "START DRAWING", exact: true })
      .click();
    await ui.locator("input").waitFor();
    await ui
      .getByRole("button", { name: "START DRAWING", exact: true })
      .click();
    const restarted = await until(
      (s) => s.stage === "PICKING" && s.readingId !== end.readingId,
    );
    assert.equal(restarted.pickedCards.length, 0);
    console.log("PASS Home starts a new reading");
    await page.close();
  }
  if (process.env.TAROT_WEB_URL) {
    const page = await browserContext.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.addInitScript(() =>
      localStorage.setItem("mystic-tarot-locale", "en"),
    );
    await page.goto(process.env.TAROT_WEB_URL);
    await page
      .getByRole("button", { name: "START DRAWING", exact: true })
      .click();
    await page.locator("input").waitFor();
    await page.getByRole("button", { name: "RESELECT SPREAD" }).click();
    await page
      .getByRole("button", { name: "Classic Trinity", exact: true })
      .click();
    await page
      .getByRole("button", { name: "CONFIRM SPREAD", exact: true })
      .click();
    await page.locator("input").fill("Standalone recovery acceptance");
    await page
      .getByRole("button", { name: "START DRAWING", exact: true })
      .dblclick();
    const saved = () =>
      page.evaluate(() =>
        JSON.parse(sessionStorage.getItem("f-tarot-reading") ?? "null"),
      );
    async function until(check) {
      for (let i = 0; i < 100; i++) {
        const state = await saved();
        if (state && check(state)) return state;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw Error("Standalone state timeout");
    }
    const tiles = page.locator(".tarot-card-cloud div.cursor-pointer.group");
    await tiles.last().click();
    const partial = await until((state) => state.pickedCards.length === 1);
    await page.reload();
    await tiles.last().waitFor();
    assert.deepEqual(await saved(), partial);
    await tiles.last().click();
    await tiles.last().click();
    const picked = await until(
      (state) => state.stage === "READING" && state.pickedCards.length === 3,
    );
    const backs = page.locator(
      '[data-tarot-stage="cards"] div.cursor-pointer.group',
    );
    for (let i = 0; i < 3; i++) await backs.nth(i).click();
    const final = await until((state) => state.revealedCardIds.length === 3);
    assert.equal(final.summaryRequested, false);
    assert.equal(final.readingText, "");
    assert.deepEqual(final.pickedCards, picked.pickedCards);
    await page.reload();
    await page
      .getByRole("button", { name: "OPEN IN AI", exact: true })
      .waitFor();
    assert.deepEqual(await saved(), final);
    assert.ok(
      requests.every(
        (url) => !url.includes("/draw") && !url.includes("/cards/random"),
      ),
    );
    console.log(
      "PASS mobile standalone: partial/final sessionStorage recovery and zero draw endpoints",
    );
    await page.close();
  }
} finally {
  await browser.close();
}
