import assert from "node:assert/strict";
import test from "node:test";
import {
  SPREAD_IDS,
  drawCards,
  getDeckForPool,
  getLocalizedSpread,
  listSpreads,
} from "../src/draw";
import type { CardPoolType, SpreadType } from "../src/draw";

test("SPREAD_IDS lists the 11 real spreads and excludes AUTO", () => {
  assert.equal(SPREAD_IDS.length, 11);
  assert.ok(!SPREAD_IDS.includes("AUTO" as SpreadType));
});

test("every spread localizes with a name, description, count and matching labels", () => {
  for (const locale of ["en", "zh-CN"] as const) {
    const spreads = listSpreads(locale);
    assert.equal(spreads.length, 11);
    for (const spread of spreads) {
      assert.ok(spread.name.length > 0, `${spread.id} name`);
      assert.ok(spread.description.length > 0, `${spread.id} description`);
      assert.ok(spread.cardCount >= 1 && spread.cardCount <= 15, `${spread.id} count`);
      assert.equal(
        spread.labels.length,
        spread.cardCount,
        `${spread.id} labels must match its card count`,
      );
    }
  }
});

test("drawCards returns the spread's card count with no repeats", () => {
  for (const spread of SPREAD_IDS) {
    const cards = drawCards(spread);
    const expected = getLocalizedSpread(spread, "en").cardCount;
    assert.equal(cards.length, expected, spread);
    const ids = cards.map((card) => card.id);
    assert.equal(new Set(ids).size, ids.length, `${spread} must not repeat a card`);
  }
});

test("reversedProbability pins orientation at the extremes", () => {
  const upright = drawCards("THREE", { reversedProbability: 0 });
  assert.ok(upright.every((card) => !card.isReversed));
  const reversed = drawCards("THREE", { reversedProbability: 1 });
  assert.ok(reversed.every((card) => card.isReversed));
});

test("restricted spreads draw each slot from its own pool", () => {
  const cases: Array<{ spread: SpreadType; pools: CardPoolType[] }> = [
    { spread: "COURT", pools: ["MINOR_PIP", "COURT", "MAJOR"] },
    {
      spread: "DIMENSION",
      pools: ["SUIT_CUPS", "SUIT_PENTACLES", "SUIT_SWORDS", "SUIT_WANDS", "MAJOR"],
    },
  ];
  for (const { spread, pools } of cases) {
    for (let i = 0; i < 20; i++) {
      const cards = drawCards(spread);
      cards.forEach((card, index) => {
        const poolDeck = getDeckForPool(pools[index]);
        assert.ok(
          poolDeck.some((c) => c.id === card.id),
          `${spread} slot ${index}: ${card.nameEn} must come from ${pools[index]}`,
        );
      });
    }
  }
});

test("cards carry both locales, keywords, meanings and an image key", () => {
  const [card] = drawCards("SINGLE");
  assert.equal(typeof card.nameEn, "string");
  assert.equal(typeof card.nameCn, "string");
  assert.ok(card.keywordsEn.length > 0);
  assert.ok(card.keywordsCn.length > 0);
  assert.ok(card.image.length > 0);
  assert.equal(typeof card.uprightEn, "string");
  assert.equal(typeof card.reversedCn, "string");
});
