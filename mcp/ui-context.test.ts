import assert from 'node:assert/strict';
import test from 'node:test';
import { FULL_DECK } from '../src/features/tarot/constants/cards';
import { GameState } from '../src/features/tarot/types';
import { cardContext, completeReadingContext, restoreSnapshot, applyReadingSummary } from './ui/readingContext';
import type { TarotAppSnapshot, TarotReadingRequest } from '../src/host/tarotHost';

const cards=FULL_DECK.slice(0,3).map((card,i)=>({...card,isReversed:i===1,visualId:70+i}));
const reading:TarotReadingRequest={question:'我的工作方向？',spread:'THREE',cards,revealedCardIds:cards.map(c=>c.id),locale:'zh-CN'};

test('card context contains only the clicked card and its actual spread position',()=>{
  const context=cardContext({...reading,card:cards[1],position:2});
  assert.equal(context.card.name,cards[1].nameCn);
  assert.equal(context.card.position,2);
  assert.equal(context.card.isReversed,true);
  assert.ok(context.card.positionLabel);
  for(const field of ['cards','revealed','revealedCardIds','pickedCount','nextReveal','stage']) assert.ok(!(field in context));
  assert.ok(!JSON.stringify(context).includes(cards[0].nameCn));
  assert.ok(!JSON.stringify(context).includes(cards[2].nameCn));
});

test('full interpretation requires a complete, unique, entirely revealed spread',()=>{
  const context=completeReadingContext(reading);
  assert.equal(context.question,reading.question);
  assert.deepEqual(context.cards.map(card=>card.name),cards.map(card=>card.nameCn));
  assert.deepEqual(context.cards.map(card=>card.position),[1,2,3]);
  assert.deepEqual(context.cards.map(card=>card.isReversed),[false,true,false]);
  assert.throws(()=>completeReadingContext({...reading,revealedCardIds:[cards[0].id,cards[1].id]}));
  assert.throws(()=>completeReadingContext({...reading,cards:[cards[0]]}));
  assert.throws(()=>completeReadingContext({...reading,cards:[cards[0],cards[0],cards[2]]}));
  assert.throws(()=>completeReadingContext({...reading,spread:'AUTO'}));
});

const snapshot:TarotAppSnapshot={version:1,readingId:'local-reading',stage:GameState.PICKING,question:reading.question,spread:'THREE',
  pickedCards:cards.slice(0,1),drawTargets:cards,revealedCardIds:[],cardFaceStyle:'dreamy'};
test('private recovery preserves remaining draw, selected cards and orientation',()=>{
  const restored=restoreSnapshot(JSON.parse(JSON.stringify(snapshot)))!;
  assert.ok(restored);
  assert.deepEqual(restored.drawTargets.map(c=>c.id),cards.map(c=>c.id));
  assert.deepEqual(restored.drawTargets.map(c=>c.isReversed),[false,true,false]);
  assert.equal(restored.pickedCards[0].visualId,70);
  const partial=restoreSnapshot({...snapshot,stage:GameState.READING,pickedCards:cards,revealedCardIds:[cards[1].id]})!;
  assert.deepEqual(partial.revealedCardIds,[cards[1].id]);
  assert.equal(restoreSnapshot({...snapshot,pickedCards:[cards[2]]}),undefined);
  assert.equal(restoreSnapshot({...snapshot,revealedCardIds:[999]}),undefined);
  assert.equal(restoreSnapshot({...snapshot,drawTargets:[]}),undefined);
  assert.equal(restoreSnapshot({...snapshot,stage:GameState.READING}),undefined);
  assert.equal(restoreSnapshot({...snapshot,version:99}),undefined);
});

test('summary updates only the matching completed reading and preserves the exact cards',()=>{
  const complete={...snapshot,stage:GameState.READING,pickedCards:cards,revealedCardIds:cards.map(c=>c.id)};
  const summary={readingId:complete.readingId!,text:'  风穿过旧门，光照见下一步。  '};
  const updated=applyReadingSummary(complete,summary);
  assert.equal(updated.readingText,'风穿过旧门，光照见下一步。');
  assert.equal(updated.summaryRequested,true);
  assert.deepEqual(updated.pickedCards,complete.pickedCards);
  assert.deepEqual(updated.drawTargets,complete.drawTargets);
  assert.throws(()=>applyReadingSummary(complete,{...summary,readingId:'another-draw'}));
  assert.throws(()=>applyReadingSummary(snapshot,summary));
  assert.throws(()=>applyReadingSummary(undefined,summary));
  assert.throws(()=>applyReadingSummary(complete,{...summary,text:'x'.repeat(801)}));
  assert.equal(restoreSnapshot(JSON.parse(JSON.stringify(updated)))?.readingText,updated.readingText);
});
