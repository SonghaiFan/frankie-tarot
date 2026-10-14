import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { mkdir } from "node:fs/promises";

const engine = process.env.TAROT_BROWSER ?? "chromium";
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  headless: false,
  ...(engine === "chromium" ? { channel: "chrome" } : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.TAROT_TEST_URL ?? "http://127.0.0.1:3002");
  await page.getByRole("button", { name: "开始抽牌", exact: true }).click();
  await page.getByRole("button", { name: "重新选择", exact: true }).click();
  await page.getByRole("button", { name: "凯尔特十字", exact: true }).click();
  await page.getByRole("button", { name: "确认牌阵", exact: true }).click();
  await page.getByRole("button", { name: "开始抽牌", exact: true }).click();
  await page.locator("[data-cloud-card]").last().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-force-settled="true"]') &&
      document.querySelectorAll("[data-cloud-card]").length === 78,
  );
  const positions = () =>
    page.locator("[data-cloud-card]").evaluateAll((es) =>
      es.map((e) => {
        const r = e.getBoundingClientRect();
        return {
          id: e.dataset.cloudCard,
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
        };
      }),
    );
  const before = await positions();
  const start = before.at(-1);
  const target = {
    x: Math.max(70, Math.min(320, start.x + 120)),
    y: Math.max(180, start.y - 180),
  };
  const cdp = engine === "chromium" ? await context.newCDPSession(page) : null;
  if (cdp) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    window.__frames = [];
    window.__last = 0;
    window.__stop = false;
    const tick = (t) => {
      if (window.__last) window.__frames.push(t - window.__last);
      window.__last = t;
      if (!window.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  if (cdp)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start.x, y: start.y }],
    });
  else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
  }
  for (let i = 1; i <= 25; i++) {
    const point = {
      x: start.x + ((target.x - start.x) * i) / 25,
      y: start.y + ((target.y - start.y) * i) / 25,
    };
    if (cdp)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [point],
      });
    else await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(200);
  const during = await positions();
  assert.ok(
    Math.hypot(during.at(-1).x - start.x, during.at(-1).y - start.y) > 60,
    "dragged card moves",
  );
  assert.ok(
    during
      .slice(0, -1)
      .some((p, i) => Math.hypot(p.x - before[i].x, p.y - before[i].y) > 4),
    "neighbors respond",
  );
  // Drag beyond the screen to exercise rotated-card boundary constraints.
  if (cdp)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 1, y: 1 }],
    });
  else await page.mouse.move(1, 1);
  await page.waitForTimeout(100);
  const checkBounds = () =>
    page.evaluate(() => {
      const stage = document
        .querySelector("[data-force-settled]")
        .getBoundingClientRect();
      return [...document.querySelectorAll("[data-cloud-card]")].every((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.left >= stage.left - 1 &&
          r.right <= stage.right + 1 &&
          r.top >= stage.top - 1 &&
          r.bottom <= stage.bottom + 1
        );
      });
    });
  if (!(await checkBounds()))
    console.log(
      await page.evaluate(() => {
        const stage = document
          .querySelector("[data-force-settled]")
          .getBoundingClientRect()
          .toJSON();
        return {
          stage,
          cards: [...document.querySelectorAll("[data-cloud-card]")]
            .map((e) => ({
              id: e.dataset.cloudCard,
              rect: e.getBoundingClientRect().toJSON(),
              style: e.style.cssText,
              parent: e.parentElement.style.cssText,
            }))
            .filter(
              (c) =>
                c.rect.left < stage.left ||
                c.rect.right > stage.right ||
                c.rect.top < stage.top ||
                c.rect.bottom > stage.bottom,
            )
            .slice(0, 5),
        };
      }),
    );
  assert.ok(
    await checkBounds(),
    "rotated cards remain within stage while dragging",
  );
  if (cdp)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  else await page.mouse.up();
  await page.waitForTimeout(800);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("f-tarot-reading")).pickedCards
          .length,
    ),
    0,
    "drag does not select",
  );
  await page.waitForFunction(() =>
    document.querySelector('[data-force-settled="true"]'),
  );
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForFunction(() =>
    document.querySelector('[data-force-settled="true"]'),
  );
  await page.waitForTimeout(200);
  assert.ok(await checkBounds(), "bounds after resize");
  await page.locator("[data-cloud-card]").last().tap();
  await page.waitForFunction(
    () =>
      JSON.parse(sessionStorage.getItem("f-tarot-reading")).pickedCards
        .length === 1,
  );
  const metrics = await page.evaluate(() => {
    window.__stop = true;
    const a = window.__frames.sort((a, b) => a - b);
    return {
      mean: a.reduce((s, v) => s + v, 0) / a.length,
      p95: a[Math.floor(a.length * 0.95)],
      frames: a.length,
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() =>
    document.querySelector('[data-force-settled="true"]'),
  );
  await page.waitForTimeout(300);
  assert.ok(await checkBounds(), "desktop bounds");
  const desktop = (await positions()).at(-1);
  await page.mouse.move(desktop.x, desktop.y);
  await page.mouse.down();
  await page.mouse.move(desktop.x - 120, desktop.y + 30, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(750);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("f-tarot-reading")).pickedCards
          .length,
    ),
    1,
    "desktop drag does not pick",
  );
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForFunction(() =>
    document.querySelector('[data-force-settled="true"]'),
  );
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({
    path: `output/playwright/${engine}-force-graph.png`,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        engine,
        input: cdp ? "native touch" : "mouse",
        checks:
          "drag, neighbor forces, boundaries, resize, no accidental pick, tap",
        metrics,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
