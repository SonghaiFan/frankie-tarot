import assert from 'node:assert/strict';
import test from 'node:test';
import { dealTiles, isInPool, REVERSED_PROBABILITY } from '../src/features/tarot/utils/cardPools';
import type { CardPoolType, TarotCard, TarotSuit } from '../src/features/tarot/types';

const suits: Array<[TarotSuit, string]> = [['WANDS','wands'],['CUPS','cups'],['SWORDS','swords'],['PENTACLES','pents']];
const deck: TarotCard[] = [
  ...Array.from({length:22},(_,rank)=>({suit:null,rank,image:`maj${String(rank).padStart(2,'0')}`})),
  ...suits.flatMap(([suit,prefix])=>Array.from({length:14},(_,i)=>({suit,rank:i+1,image:`${prefix}${String(i+1).padStart(2,'0')}`}))),
].map((card,id)=>({...card,id,nameEn:card.image,nameCn:card.image,keywords:[]}));
const members = (pool: CardPoolType) => deck.filter(card=>isInPool(card,pool)).map(card=>card.image);

test('pools follow each card suit and rank', () => {
  assert.equal(members('FULL').length, 78);
  assert.equal(members('MAJOR').length, 22);
  assert.equal(members('MINOR_PIP').length, 40);
  assert.deepEqual(members('COURT').filter(key=>key.startsWith('cups')), ['cups11','cups12','cups13','cups14']);
  assert.equal(members('SUIT_PENTACLES').length, 14);
  assert.ok(members('SUIT_PENTACLES').every(key=>key.startsWith('pents')));
});

test('each reading hides a shuffled deck behind the same tiles', () => {
  const tiles = dealTiles(deck);
  assert.deepEqual([...tiles.keys()].sort((a,b)=>a-b), deck.map(card=>card.id));
  assert.equal(new Set([...tiles.values()].map(card=>card.id)).size, 78);
  const orders = new Set(Array.from({length:5},()=>[...dealTiles(deck).values()].map(card=>card.id).join()));
  assert.ok(orders.size > 1, 'the deal changes between readings');
  assert.ok(REVERSED_PROBABILITY > 0 && REVERSED_PROBABILITY < 1);
});
