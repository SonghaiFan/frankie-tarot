import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import groundTruth from "../../src/features/tarot/data/ground-truth.json";
import {
  createTarotEngine,
  drawInputSchema,
  getPoolIds,
  listSpreads,
  payloadSchema,
  SPREAD_IDS,
} from "./engine";
import type { TarotPayload, TarotReading } from "./shared";

const PUBLIC_BASE_URL = "http://127.0.0.1:8787";
const SIGNING_KEY = "a".repeat(32);
const CREATED_AT = Date.UTC(2026, 9, 5, 3, 35, 37);
const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const sourceCards = groundTruth.cards.byId as Record<
  string,
  (typeof groundTruth.cards.byId)["0"]
>;

function makeEngine(now: () => number = () => CREATED_AT, signingKey = SIGNING_KEY) {
  return createTarotEngine({ publicBaseUrl: PUBLIC_BASE_URL, signingKey, now });
}

function requireReading(payload: TarotPayload): TarotReading {
  assert.ok(payload.reading, "The draw must return a reading.");
  assert.ok(payload.readingToken, "The draw must return a restore token.");
  assert.equal(payloadSchema.safeParse(payload).success, true);
  return payload.reading;
}

function assertCanonicalCards(reading: TarotReading) {
  assert.equal(reading.cards.length, reading.spread.cardCount);
  assert.equal(new Set(reading.cards.map((card) => card.id)).size, reading.cards.length);
  for (const [index, card] of reading.cards.entries()) {
    const source = sourceCards[String(card.id)];
    assert.ok(source, `Card ${card.id} must exist in the canonical deck.`);
    const filename = source.image.replace(/\.[^.]+$/, ".webp");
    assert.equal(card.id, source.numericId);
    assert.equal(card.name, source.name[reading.locale]);
    assert.equal(card.nameEn, source.name.en);
    assert.equal(card.nameCn, source.name["zh-CN"]);
    assert.equal(card.position, index + 1);
    assert.equal(card.positionLabel, reading.spread.labels[index]);
    assert.deepEqual(card.keywords, source.keywords[reading.locale]);
    assert.equal(card.description, source.description[reading.locale]);
    assert.equal(
      card.meaning,
      source.meanings[card.isReversed ? "reversed" : "upright"][reading.locale],
    );
    assert.equal(card.imageUrl, `${PUBLIC_BASE_URL}/assets/redraw/${filename}`);
    assert.equal(card.originalImageUrl, `${PUBLIC_BASE_URL}/assets/original/${filename}`);
  }
}

function cardSelections(reading: TarotReading) {
  return reading.cards.map(({ id, position, isReversed, imageUrl, originalImageUrl }) => ({
    id, position, isReversed, imageUrl, originalImageUrl,
  }));
}

test("the canonical contract exposes 78 cards and 11 real bilingual spreads", () => {
  const fullDeck = getPoolIds("FULL");
  assert.equal(fullDeck.length, 78);
  assert.equal(new Set(fullDeck).size, 78);
  assert.deepEqual(new Set(fullDeck), new Set(Object.keys(sourceCards)));
  assert.equal(getPoolIds("MAJOR").length, 22);
  assert.equal(getPoolIds("MINOR_PIP").length, 40);
  assert.equal(getPoolIds("COURT").length, 16);
  for (const pool of ["SUIT_CUPS", "SUIT_PENTACLES", "SUIT_SWORDS", "SUIT_WANDS"]) {
    assert.equal(getPoolIds(pool).length, 14);
  }
  assert.throws(() => getPoolIds("UNKNOWN_POOL"));

  assert.equal(SPREAD_IDS.length, 11);
  assert.equal(SPREAD_IDS.includes("AUTO"), false);
  assert.deepEqual(SPREAD_IDS, groundTruth.spreads.allIds.filter((id) => id !== "AUTO"));
  for (const locale of ["en", "zh-CN"] as const) {
    const spreads = listSpreads(locale);
    assert.equal(spreads.length, 11);
    for (const spread of spreads) {
      assert.equal(spread.labels.length, spread.cardCount);
      assert.ok(spread.name.trim());
      assert.ok(spread.description.trim());
      assert.ok(spread.labels.every((label) => label.trim().length > 0));
    }
    const setup = makeEngine().setup(locale);
    assert.deepEqual(setup, { locale, spreads });
    assert.equal(payloadSchema.safeParse(setup).success, true);
  }

  for (const id of fullDeck) {
    const card = sourceCards[id];
    assert.equal(String(card.numericId), id);
    const filename = card.image.replace(/\.[^.]+$/, ".webp");
    for (const directory of ["cards", "cards_rws_original"]) {
      assert.ok(
        existsSync(new URL(`../../public/images/${directory}/${filename}`, import.meta.url)),
        `${directory}/${filename} must be available for card ${id}.`,
      );
    }
    for (const locale of ["en", "zh-CN"] as const) {
      assert.ok(card.name[locale]);
      assert.ok(card.keywords[locale].length);
      assert.ok(card.meanings.upright[locale]);
      assert.ok(card.meanings.reversed[locale]);
    }
  }
});

for (const locale of ["en", "zh-CN"] as const) {
  for (const spread of SPREAD_IDS) {
    test(`${spread} returns the exact canonical count, identities, positions, and artwork in ${locale}`, () => {
      const reading = requireReading(makeEngine().draw({ spread, locale }));
      assert.equal(reading.spread.id, spread);
      assert.equal(reading.locale, locale);
      assertCanonicalCards(reading);
    });
  }
}

test("COURT and DIMENSION respect every slot's restricted pool on every draw", () => {
  const cases = [
    { spread: "COURT", pools: ["MINOR_PIP", "COURT", "MAJOR"] },
    { spread: "DIMENSION", pools: ["SUIT_CUPS", "SUIT_PENTACLES", "SUIT_SWORDS", "SUIT_WANDS", "MAJOR"] },
  ];
  const engine = makeEngine();
  for (const { spread, pools } of cases) {
    const allowedIds = pools.map((pool) => new Set(getPoolIds(pool).map(Number)));
    // Membership is invariant for every possible random choice; no frequency expectations.
    for (let draw = 0; draw < 16; draw++) {
      const reading = requireReading(engine.draw({ spread }));
      assertCanonicalCards(reading);
      reading.cards.forEach((card, position) => {
        assert.ok(allowedIds[position].has(card.id), `${spread} slot ${position + 1} must use ${pools[position]}.`);
      });
    }
  }
});

for (const locale of ["en", "zh-CN"] as const) {
  for (const reversedProbability of [0, 1]) {
    test(`probability ${reversedProbability} selects the correct orientation and ${locale} meaning`, () => {
      const reading = requireReading(makeEngine().draw({ spread: "YEARLY", locale, reversedProbability }));
      assert.ok(reading.cards.every((card) => card.isReversed === (reversedProbability === 1)));
      assertCanonicalCards(reading);
    });
  }
}

test("draw input defaults are explicit and unsupported/provider-controlled inputs are rejected", () => {
  assert.deepEqual(drawInputSchema.parse({}), {
    question: "", spread: "SINGLE", locale: "zh-CN", reversedProbability: 0.4,
  });
  const invalidInputs: Array<[string, unknown]> = [
    ["unknown spread", { spread: "NOT_A_SPREAD" }],
    ["AUTO pseudo-spread", { spread: "AUTO" }],
    ["unsupported locale", { locale: "fr" }],
    ["probability above one", { reversedProbability: 1.1 }],
    ["negative probability", { reversedProbability: -0.1 }],
    ["NaN probability", { reversedProbability: Number.NaN }],
    ["infinite probability", { reversedProbability: Number.POSITIVE_INFINITY }],
    ["oversized question", { question: "x".repeat(2001) }],
    ["caller-selected cards", { customCards: [{ id: 0, isReversed: false }] }],
    ["custom API key", { apiKey: "must-not-be-accepted" }],
    ["API_KEY field", { API_KEY: "must-not-be-accepted" }],
    ["GEMINI_API_KEY field", { GEMINI_API_KEY: "must-not-be-accepted" }],
    ["legacy generation option", { generateReading: false }],
  ];
  const engine = makeEngine();
  for (const [label, input] of invalidInputs) {
    assert.equal(drawInputSchema.safeParse(input).success, false, label);
    assert.throws(() => engine.draw(input), label);
  }
});

test("signed restoration preserves a reading, including across a server restart with the same key", () => {
  const original = makeEngine().draw({ question: "  What should I reflect on?  ", spread: "CELTIC", locale: "en" });
  const reading = requireReading(original);
  assert.equal(reading.question, "What should I reflect on?");
  assert.equal(reading.createdAt, new Date(CREATED_AT).toISOString());

  const restored = makeEngine(() => CREATED_AT + 1000).restore(original.readingToken!);
  assert.deepEqual(restored, original);
  assert.equal(requireReading(restored).id, reading.id);
});

test("language conversion preserves cards, order, orientations, and reading identity", () => {
  const engine = makeEngine();
  const original = engine.draw({ question: "这个项目能带给我什么启示？", spread: "RELATION", locale: "zh-CN" });
  const originalReading = requireReading(original);
  const translated = engine.restore(original.readingToken!, "en");
  const translatedReading = requireReading(translated);
  assert.equal(translated.locale, "en");
  assert.equal(translatedReading.locale, "en");
  assert.equal(translatedReading.id, originalReading.id);
  assert.equal(translatedReading.createdAt, originalReading.createdAt);
  assert.equal(translatedReading.question, originalReading.question);
  assert.equal(translatedReading.spread.id, originalReading.spread.id);
  assert.deepEqual(cardSelections(translatedReading), cardSelections(originalReading));
  assertCanonicalCards(translatedReading);
  assert.deepEqual(engine.restore(translated.readingToken!), translated);
  assert.deepEqual(engine.restore(translated.readingToken!, "zh-CN"), original);
});

test("token payload changes, signature changes, malformed tokens, and signing-key rotation are rejected", () => {
  const engine = makeEngine();
  const original = engine.draw({ spread: "THREE" });
  requireReading(original);
  const [body, signature] = original.readingToken!.split(".");
  const snapshot = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  snapshot.question = "A different question inserted after the draw";
  const changedBody = Buffer.from(JSON.stringify(snapshot)).toString("base64url");
  const changedSignature = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  const invalidTokens = [
    `${changedBody}.${signature}`,
    `${body}.${changedSignature}`,
    `${body}.YQ`,
    "",
    "not-a-token",
    `${original.readingToken}.extra`,
    "a".repeat(24_001),
  ];
  for (const token of invalidTokens) {
    assert.throws(() => engine.restore(token), /cannot be restored/);
  }
  assert.throws(
    () => makeEngine(() => CREATED_AT, "b".repeat(32)).restore(original.readingToken!),
    /cannot be restored/,
  );
});

test("restore accepts the seven-day boundary and rejects expired or implausibly future tokens", () => {
  let currentTime = CREATED_AT;
  const engine = makeEngine(() => currentTime);
  const original = engine.draw({ spread: "SINGLE" });
  requireReading(original);
  currentTime = CREATED_AT + TOKEN_LIFETIME_MS;
  assert.deepEqual(engine.restore(original.readingToken!), original);
  currentTime += 1;
  assert.throws(() => engine.restore(original.readingToken!), /cannot be restored/);
  currentTime = CREATED_AT - 60_001;
  assert.throws(() => engine.restore(original.readingToken!), /cannot be restored/);
});

test("existing API_KEY and GEMINI_API_KEY environment values cannot trigger provider requests", () => {
  const previousApiKey = process.env.API_KEY;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  try {
    process.env.API_KEY = "test-sentinel-no-provider-use";
    process.env.GEMINI_API_KEY = "test-sentinel-no-provider-use";
    globalThis.fetch = async () => {
      networkCalls += 1;
      throw new Error("The tarot draw engine must not perform network requests.");
    };
    const engine = makeEngine();
    const setup = engine.setup("en");
    assert.equal(setup.spreads.length, 11);
    // Omitted spread must stay SINGLE even with a question and legacy environment keys.
    const drawn = engine.draw({ question: "How can I reflect on my next step?", locale: "en" });
    const reading = requireReading(drawn);
    assert.equal(reading.spread.id, "SINGLE");
    assert.equal(reading.cards.length, 1);
    assert.deepEqual(engine.restore(drawn.readingToken!), drawn);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = previousApiKey;
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
  }
});
