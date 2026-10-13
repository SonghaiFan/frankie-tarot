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

// These helpers are also used by App's click handler and private recovery path.
import { dealReadingTable, selectLocalCard } from '../src/features/tarot/utils/localDraw';
import { restoreSnapshot } from '../src/host/readingSnapshot';
import { GameState } from '../src/features/tarot/types';

test('manual clicks respect position pools, ignore repeats and survive private recovery', () => {
  const dealt = dealReadingTable(deck, () => 0.25);
  const table = new Map(dealt.map(card => [card.visualId!, card]));
  const pools: CardPoolType[] = ['MINOR_PIP','COURT','MAJOR'];
  let picked: typeof dealt = [];
  const wrong = dealt.find(card => isInPool(card,'MAJOR'))!;
  assert.strictEqual(selectLocalCard(table,picked,wrong.visualId!,pools),picked);
  for (const pool of pools) {
    const tile = dealt.find(card => isInPool(card,pool))!;
    picked = selectLocalCard(table,picked,tile.visualId!,pools);
    assert.strictEqual(selectLocalCard(table,picked,tile.visualId!,pools),picked);
    const saved = {version:1,readingId:'local-reading',stage:GameState.PICKING,question:'test',spread:'COURT',pickedCards:picked,dealtCards:dealt,revealedCardIds:[],cardFaceStyle:'dreamy'};
    const restored = restoreSnapshot(JSON.parse(JSON.stringify(saved)))!;
    assert.ok(restored);
    assert.deepEqual(restored.dealtCards,dealt);
    assert.deepEqual(restored.pickedCards,picked);
    const resumed = new Map(restored.dealtCards!.map(card => [card.visualId!,card]));
    assert.deepEqual(selectLocalCard(resumed,restored.pickedCards,wrong.visualId!,pools), selectLocalCard(table,picked,wrong.visualId!,pools));
    assert.equal(restoreSnapshot({...saved,dealtCards:[dealt[0],dealt[0]]}),undefined);
    assert.equal(restoreSnapshot({...saved,pickedCards:picked.map(card=>({...card,isReversed:!card.isReversed}))}),undefined);
  }
  assert.equal(picked.length,3);
  assert.deepEqual(picked.map(card=>card.isReversed),[true,true,true]);
  assert.strictEqual(selectLocalCard(table,picked,dealt[0].visualId!,pools),picked);
});
