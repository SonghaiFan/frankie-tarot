import type { CardPoolType, TarotCard } from "@/features/tarot/types";

/** Game setting: how often a picked card lands reversed. */
export const REVERSED_PROBABILITY = 0.4;

/** Pool membership from the card's suit and rank, as the API's spreads define it. */
export function isInPool(card: TarotCard, pool: CardPoolType) {
  switch (pool) {
    case "MAJOR": return card.suit === null;
    case "MINOR_PIP": return card.suit !== null && card.rank <= 10;
    case "COURT": return card.suit !== null && card.rank >= 11;
    case "SUIT_WANDS": return card.suit === "WANDS";
    case "SUIT_CUPS": return card.suit === "CUPS";
    case "SUIT_SWORDS": return card.suit === "SWORDS";
    case "SUIT_PENTACLES": return card.suit === "PENTACLES";
    default: return true;
  }
}

/**
 * Hides a shuffled card behind each face-down tile. Tiles keep their place on
 * the table (it is laid out by tile ID), so the shuffle is what makes the
 * user's pick random.
 */
export function dealTiles(deck: TarotCard[], random: () => number = Math.random) {
  const cards = [...deck];
  for (let index = cards.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  return new Map(deck.map((tile, index) => [tile.id, cards[index]]));
}
