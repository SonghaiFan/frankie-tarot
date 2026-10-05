import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import groundTruth from "../../src/features/tarot/data/ground-truth.json";
import type { Locale, TarotPayload, TarotReading, TarotSpread } from "./shared";

type Localized<T> = Record<Locale, T>;
type SourceCard = {
  id: string;
  numericId: number;
  image: string;
  name: Localized<string>;
  keywords: Localized<string[]>;
  description: Localized<string>;
  meanings: { upright: Localized<string>; reversed: Localized<string> };
};
type SourceSpread = {
  id: string;
  name: Localized<string>;
  description: Localized<string>;
  cardCount: number;
  layout: {
    type: string;
    labels: Localized<string[] | null>;
    positionLabels: Localized<string[] | null>;
  };
  cardPools?: string[] | null;
};

const cards = groundTruth.cards.byId as Record<string, SourceCard>;
const sourceSpreads = groundTruth.spreads.byId as Record<string, SourceSpread>;
export const SPREAD_IDS = groundTruth.spreads.allIds.filter((id) => id !== "AUTO") as [string, ...string[]];
export const localeSchema = z.enum(["en", "zh-CN"]);
export const drawInputSchema = z.object({
  question: z.string().max(2000).default("").describe("Optional question for personal reflection."),
  spread: z.enum(SPREAD_IDS).default("SINGLE").describe("Use an actual spread ID returned by list_tarot_spreads. Never AUTO."),
  locale: localeSchema.default("zh-CN"),
  reversedProbability: z.number().min(0).max(1).default(0.4),
}).strict();

export const spreadSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(),
  cardCount: z.number().int().positive(), labels: z.array(z.string()),
});
export const readingSchema = z.object({
  id: z.string().uuid(), createdAt: z.string(), question: z.string(),
  locale: localeSchema, spread: spreadSchema,
  cards: z.array(z.object({
    id: z.number().int(), name: z.string(), nameEn: z.string(), nameCn: z.string(),
    position: z.number().int().positive(), positionLabel: z.string(), isReversed: z.boolean(),
    imageUrl: z.string().url(), originalImageUrl: z.string().url(),
    keywords: z.array(z.string()), meaning: z.string(), description: z.string(),
  })),
});
export const payloadSchema = z.object({
  locale: localeSchema, spreads: z.array(spreadSchema),
  reading: readingSchema.optional(), readingToken: z.string().optional(),
});

const snapshotSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), createdAt: z.number().int(),
  locale: localeSchema, question: z.string().max(2000), spread: z.enum(SPREAD_IDS),
  cards: z.array(z.object({ id: z.number().int(), reversed: z.boolean() }).strict()).max(15),
}).strict();
type Snapshot = z.infer<typeof snapshotSchema>;
const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function listSpreads(locale: Locale): TarotSpread[] {
  return SPREAD_IDS.map((id) => {
    const spread = sourceSpreads[id];
    const labels = (spread.layout.type === "absolute"
      ? spread.layout.positionLabels[locale]
      : spread.layout.labels[locale]) ?? [];
    return { id, name: spread.name[locale], description: spread.description[locale],
      cardCount: spread.cardCount, labels: [...labels] };
  });
}

/** Same pool rules as the website, read from the one canonical deck. No UI/provider imports. */
export function getPoolIds(pool = "FULL"): string[] {
  const groups = groundTruth.cards.groups;
  const isCourt = (id: string) => /^(Page|Knight|Queen|King)\b/.test(cards[id].name.en);
  if (pool === "MAJOR") return [...groups.majorArcana];
  if (pool === "COURT") return groups.minorArcana.filter(isCourt);
  if (pool === "MINOR_PIP") return groups.minorArcana.filter((id) => !isCourt(id));
  const suit = { SUIT_CUPS: "Cups", SUIT_PENTACLES: "Pentacles", SUIT_SWORDS: "Swords", SUIT_WANDS: "Wands" }[pool];
  if (suit) return groups.minorArcana.filter((id) => cards[id].name.en.includes(suit));
  if (pool !== "FULL") throw new Error("Unknown card pool in canonical spread data.");
  return [...groups.fullDeck];
}

export function createTarotEngine(options: {
  publicBaseUrl: string;
  signingKey?: string;
  now?: () => number;
}) {
  const publicOrigin = new URL(options.publicBaseUrl).origin;
  if (options.signingKey && options.signingKey.length < 32) {
    throw new Error("TAROT_SIGNING_KEY must contain at least 32 characters.");
  }
  const secret = options.signingKey || randomBytes(32).toString("base64url");
  const now = options.now ?? Date.now;
  const sign = (body: string) => createHmac("sha256", secret).update(body).digest();
  const encode = (snapshot: Snapshot) => {
    const body = Buffer.from(JSON.stringify(snapshot)).toString("base64url");
    return `${body}.${sign(body).toString("base64url")}`;
  };

  const render = (snapshot: Snapshot): TarotPayload => {
    const spreads = listSpreads(snapshot.locale);
    const spread = spreads.find((item) => item.id === snapshot.spread)!;
    const reading: TarotReading = {
      id: snapshot.id, createdAt: new Date(snapshot.createdAt).toISOString(),
      question: snapshot.question, locale: snapshot.locale, spread,
      cards: snapshot.cards.map((selection, index) => {
        const card = cards[String(selection.id)];
        const key = card.image.replace(/\.[^.]+$/, "");
        return {
          id: card.numericId, name: card.name[snapshot.locale], nameEn: card.name.en,
          nameCn: card.name["zh-CN"], position: index + 1,
          positionLabel: spread.labels[index] || String(index + 1),
          isReversed: selection.reversed,
          imageUrl: `${publicOrigin}/assets/redraw/${key}.webp`,
          originalImageUrl: `${publicOrigin}/assets/original/${key}.webp`,
          keywords: [...card.keywords[snapshot.locale]],
          meaning: card.meanings[selection.reversed ? "reversed" : "upright"][snapshot.locale],
          description: card.description[snapshot.locale],
        };
      }),
    };
    return { locale: snapshot.locale, spreads, reading, readingToken: encode(snapshot) };
  };

  return {
    setup(locale: Locale = "zh-CN"): TarotPayload {
      return { locale, spreads: listSpreads(locale) };
    },
    draw(input: unknown): TarotPayload {
      const request = drawInputSchema.parse(input);
      const definition = sourceSpreads[request.spread];
      const chosen: Snapshot["cards"] = [];
      for (let position = 0; position < definition.cardCount; position++) {
        const available = getPoolIds(definition.cardPools?.[position]).filter(
          (id) => !chosen.some((card) => card.id === cards[id].numericId),
        );
        if (!available.length) throw new Error("The canonical spread has exhausted its card pool.");
        const id = available[randomInt(available.length)];
        chosen.push({ id: cards[id].numericId,
          reversed: randomInt(1_000_000_000) < request.reversedProbability * 1_000_000_000 });
      }
      return render({ version: 1, id: randomUUID(), createdAt: now(), locale: request.locale,
        question: request.question.trim(), spread: request.spread, cards: chosen });
    },
    restore(token: string, locale?: Locale): TarotPayload {
      const fail = () => new Error("This reading cannot be restored. Its token is invalid, expired, or was created with a different server signing key.");
      if (token.length > 24_000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw fail();
      const [body, signature] = token.split(".");
      const received = Buffer.from(signature, "base64url");
      const expected = sign(body);
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw fail();
      let snapshot: Snapshot;
      try { snapshot = snapshotSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8"))); }
      catch { throw fail(); }
      const age = now() - snapshot.createdAt;
      if (age < -60_000 || age > TOKEN_LIFETIME_MS) throw fail();
      if (snapshot.cards.length !== sourceSpreads[snapshot.spread].cardCount ||
        new Set(snapshot.cards.map((card) => card.id)).size !== snapshot.cards.length ||
        snapshot.cards.some((card) => !cards[String(card.id)])) throw fail();
      return render({ ...snapshot, locale: locale ?? snapshot.locale });
    },
  };
}

export type TarotEngine = ReturnType<typeof createTarotEngine>;
