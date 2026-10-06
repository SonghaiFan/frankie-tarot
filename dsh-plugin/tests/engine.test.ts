// Draw rules, pools and token security are covered by mcp/engine.test.ts.
// These tests pin the contract the DSH tool result and toolview rely on.
import assert from "node:assert/strict";
import test from "node:test";
import { createTarotEngine, listSpreads, SPREAD_IDS } from "../src/engine";

const engine = createTarotEngine({
  publicBaseUrl: "https://tarot.songhai.site",
  signingKey: "dsh-plugin-test-signing-key-0123456789",
});

test("tarot_spreads data: 11 real spreads per locale with labels for every position", () => {
  for (const locale of ["en", "zh-CN"] as const) {
    const spreads = listSpreads(locale);
    assert.deepEqual(spreads.map((spread) => spread.id), [...SPREAD_IDS]);
    for (const spread of spreads) assert.equal(spread.labels.length, spread.cardCount, spread.id);
  }
});

test("tarot_draw result is self-contained for the toolview: labels, meanings and image URLs", () => {
  for (const spread of SPREAD_IDS) {
    const { reading, readingToken } = engine.draw({ spread, locale: "en", question: "What helps my work?" });
    assert.ok(reading && readingToken, spread);
    assert.equal(reading.cards.length, reading.spread.cardCount, spread);
    reading.cards.forEach((card, index) => {
      assert.equal(card.position, index + 1);
      assert.ok(card.positionLabel && card.meaning && card.keywords.length, `${spread} #${card.position}`);
      assert.match(card.imageUrl, /^https:\/\/tarot\.songhai\.site\/assets\/redraw\/.+\.webp$/);
    });
  }
});

test("readingToken replays the same draw, and can switch locale", () => {
  const drawn = engine.draw({ spread: "THREE", locale: "zh-CN" });
  const replayed = engine.restore(drawn.readingToken!);
  assert.deepEqual(replayed.reading, drawn.reading);
  const english = engine.restore(drawn.readingToken!, "en");
  assert.deepEqual(
    english.reading!.cards.map(({ id, isReversed }) => ({ id, isReversed })),
    drawn.reading!.cards.map(({ id, isReversed }) => ({ id, isReversed })),
  );
});
