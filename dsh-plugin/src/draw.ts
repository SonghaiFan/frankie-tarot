/**
 * Pure tarot draw + spread logic for the DSH plugin host half.
 * Framework-free: no React, no Vite `import.meta`, no Node I/O.
 * Card/spread data is vendored from the canonical ground-truth.json.
 */

import groundTruth from "../data/ground-truth.json";

export type Locale = "zh-CN" | "en";

export type SpreadType =
  | "SINGLE"
  | "THREE"
  | "FOUR"
  | "TIMELINE"
  | "DIMENSION"
  | "FIVE"
  | "RELATION"
  | "CELTIC"
  | "COURT"
  | "GOALS"
  | "YEARLY";

export type CardPoolType =
  | "MAJOR"
  | "MINOR_PIP"
  | "COURT"
  | "FULL"
  | "SUIT_CUPS"
  | "SUIT_PENTACLES"
  | "SUIT_SWORDS"
  | "SUIT_WANDS";

export interface TarotCard {
  id: number;
  nameEn: string;
  nameCn: string;
  descriptionEn?: string;
  descriptionCn?: string;
  keywordsEn: string[];
  keywordsCn: string[];
  /** Source image key (e.g. "maj00.png"); the client resolves style + extension. */
  image: string;
  uprightEn?: string;
  uprightCn?: string;
  reversedEn?: string;
  reversedCn?: string;
}

export interface PickedCard extends TarotCard {
  isReversed: boolean;
}

export interface SpreadDefinition {
  id: SpreadType;
  name: string;
  description: string;
  cardCount: number;
  /** Position labels in draw order (1:1 with the drawn card list). */
  labels: string[];
  cardPools?: CardPoolType[];
}

// --- Vendored data shapes (canonical ground-truth.json) ---

type Localized<T> = { en: T; "zh-CN": T };

type SourceCard = {
  id: string;
  numericId: number;
  image: string;
  name: Localized<string>;
  keywords: Localized<string[]>;
  description: Partial<Localized<string>>;
  meanings: {
    upright: Partial<Localized<string>>;
    reversed: Partial<Localized<string>>;
  };
};

type SourceSpread = {
  id: SpreadType;
  name: Localized<string>;
  description: Localized<string>;
  cardCount: number;
  layout: {
    type: "flex" | "absolute";
    labels?: Partial<Localized<string[] | null>> | null;
    positionLabels?: Partial<Localized<string[] | null>> | null;
  };
  cardPools?: CardPoolType[] | null;
};

type GroundTruth = {
  cards: {
    byId: Record<string, SourceCard>;
    groups: { majorArcana: string[]; minorArcana: string[]; fullDeck: string[] };
  };
  spreads: { allIds: string[]; byId: Record<string, SourceSpread> };
};

const data = groundTruth as GroundTruth;

function toCard(source: SourceCard): TarotCard {
  return {
    id: source.numericId,
    nameEn: source.name.en,
    nameCn: source.name["zh-CN"],
    descriptionEn: source.description.en,
    descriptionCn: source.description["zh-CN"],
    keywordsEn: source.keywords.en,
    keywordsCn: source.keywords["zh-CN"],
    image: source.image,
    uprightEn: source.meanings.upright.en,
    uprightCn: source.meanings.upright["zh-CN"],
    reversedEn: source.meanings.reversed.en,
    reversedCn: source.meanings.reversed["zh-CN"],
  };
}

const MAJOR_ARCANA: TarotCard[] = data.cards.groups.majorArcana.map((id) =>
  toCard(data.cards.byId[id]),
);
const MINOR_ARCANA: TarotCard[] = data.cards.groups.minorArcana.map((id) =>
  toCard(data.cards.byId[id]),
);
const FULL_DECK: TarotCard[] = data.cards.groups.fullDeck.map((id) =>
  toCard(data.cards.byId[id]),
);

const COURT_PREFIXES = ["Page", "Knight", "Queen", "King"];
const isCourt = (card: TarotCard): boolean =>
  COURT_PREFIXES.some((prefix) => card.nameEn.startsWith(prefix));

/** Card pools mirror the website's `getDeckForPool`, read from the one canonical deck. */
export function getDeckForPool(pool: CardPoolType = "FULL"): TarotCard[] {
  switch (pool) {
    case "MAJOR":
      return MAJOR_ARCANA;
    case "MINOR_PIP":
      return MINOR_ARCANA.filter((card) => !isCourt(card));
    case "COURT":
      return MINOR_ARCANA.filter(isCourt);
    case "SUIT_CUPS":
      return MINOR_ARCANA.filter((card) => card.nameEn.includes("Cups"));
    case "SUIT_PENTACLES":
      return MINOR_ARCANA.filter((card) => card.nameEn.includes("Pentacles"));
    case "SUIT_SWORDS":
      return MINOR_ARCANA.filter((card) => card.nameEn.includes("Swords"));
    case "SUIT_WANDS":
      return MINOR_ARCANA.filter((card) => card.nameEn.includes("Wands"));
    case "FULL":
    default:
      return FULL_DECK;
  }
}

/** Real spreads only; AUTO is a caller-resolved pseudo-spread, not a drawable layout. */
export const SPREAD_IDS = data.spreads.allIds.filter(
  (id) => id !== "AUTO",
) as SpreadType[];

function spreadSource(id: SpreadType): SourceSpread {
  return data.spreads.byId[id];
}

export function getLocalizedSpread(id: SpreadType, locale: Locale): SpreadDefinition {
  const spread = spreadSource(id);
  const rawLabels =
    spread.layout.type === "absolute"
      ? spread.layout.positionLabels?.[locale]
      : spread.layout.labels?.[locale];
  const labels = (rawLabels ?? []).filter(
    (label): label is string => typeof label === "string",
  );
  return {
    id: spread.id,
    name: spread.name[locale],
    description: spread.description[locale],
    cardCount: spread.cardCount,
    labels,
    cardPools: spread.cardPools ?? undefined,
  };
}

export function listSpreads(locale: Locale): SpreadDefinition[] {
  return SPREAD_IDS.map((id) => getLocalizedSpread(id, locale));
}

export function drawCards(
  spread: SpreadType,
  options: { reversedProbability?: number } = {},
): PickedCard[] {
  const reversedProbability = options.reversedProbability ?? 0.4;
  const definition = spreadSource(spread);
  const picked: PickedCard[] = [];

  for (let position = 0; position < definition.cardCount; position++) {
    const pool = (definition.cardPools?.[position] ?? "FULL") as CardPoolType;
    const sourceDeck = getDeckForPool(pool);
    const availableDeck = sourceDeck.filter(
      (card) => !picked.some((p) => p.id === card.id),
    );

    let chosen: TarotCard;
    if (availableDeck.length === 0) {
      // Extreme fallback: draw any not-yet-picked card from the full deck.
      const fallbackDeck = FULL_DECK.filter(
        (card) => !picked.some((p) => p.id === card.id),
      );
      chosen =
        fallbackDeck[Math.floor(Math.random() * fallbackDeck.length)] || sourceDeck[0];
    } else {
      chosen = availableDeck[Math.floor(Math.random() * availableDeck.length)];
    }

    picked.push({ ...chosen, isReversed: Math.random() < reversedProbability });
  }

  return picked;
}
