import type { CardPoolType, PickedCard, TarotCard } from '../types';
import { dealTiles, isInPool, REVERSED_PROBABILITY } from './cardPools';

/** Private table only: assigning a hidden card is not selecting it for a spread. */
export function dealReadingTable(deck: TarotCard[], random: () => number = Math.random): PickedCard[] {
  return [...dealTiles(deck, random)].map(([visualId, card]) => ({
    ...card, visualId, isReversed: random() < REVERSED_PROBABILITY,
  }));
}

/** A click consumes one tile; rejected or repeated clicks return the same state. */
export function selectLocalCard(table: Map<number, PickedCard>, picked: PickedCard[], visualId: number, pools: CardPoolType[]): PickedCard[] {
  if (picked.length >= pools.length || picked.some(card => card.visualId === visualId)) return picked;
  const card = table.get(visualId);
  if (!card || picked.some(value => value.image === card.image) || !isInPool(card, pools[picked.length])) return picked;
  return [...picked, card];
}
