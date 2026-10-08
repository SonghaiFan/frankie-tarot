import assert from 'node:assert/strict';
import test from 'node:test';
import { GameState } from '../src/features/tarot/types';
import { registerRemoteSpreads, SPREADS } from '../src/features/tarot/constants/spreads';
import { cardContext, completeReadingContext, restoreSnapshot, applyReadingSummary } from './ui/readingContext';
import type { TarotAppSnapshot, TarotReadingRequest } from '../src/host/tarotHost';

const cards=[
  {id:1,nameEn:'The Magician',nameCn:'魔术师',image:'maj01',keywords:['创造'],positive:'开始',negative:'停滞'},
  {id:2,nameEn:'The High Priestess',nameCn:'女祭司',image:'maj02',keywords:['直觉'],positive:'倾听',negative:'封闭'},
  {id:3,nameEn:'The Empress',nameCn:'皇后',image:'maj03',keywords:['丰饶'],positive:'滋养',negative:'匮乏'},
].map((card,i)=>({...card,isReversed:i===1,visualId:70+i}));
const fixtureSpread = {id:'THREE',names:{en:'Fixture spread','zh-CN':'测试牌阵'},descriptions:{en:'fixture','zh-CN':'测试'},cardCount:3,
  labelsByLocale:{en:['Position 1','Position 2','Position 3'],'zh-CN':['位置1','位置2','位置3']},cardPools:['FULL','FULL','FULL'],
  interpretationInstructions:{en:'fixture','zh-CN':'测试'},layout:{type:'flex' as const,positions:null}};
registerRemoteSpreads([fixtureSpread]);
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

const snapshot:TarotAppSnapshot={version:1,readingId:'111111111111111111111111',stage:GameState.PICKING,question:reading.question,spread:'THREE',
  pickedCards:cards.slice(0,1),drawTargets:cards,revealedCardIds:[],cardFaceStyle:'dreamy',
  apiReading:{readingId:'111111111111111111111111',datasetVersion:'fixture',algorithmVersion:'sha256-counter-v1',seed:'fixture',spreadId:'THREE',drawLocale:'zh-CN',reversedProbability:0.4,cards:cards.map((card,index)=>({positionIndex:index+1,positionLabel:`位置${index+1}`,cardId:card.image,orientation:card.isReversed?'REVERSED':'UPRIGHT'}))}};
test('cold-page recovery preserves the exact reading before the remote catalog loads', () => {
  const catalog = { ...SPREADS };
  for (const key of Object.keys(SPREADS)) delete (SPREADS as any)[key];
  try {
    const saved = { ...snapshot, stage: GameState.READING, pickedCards: cards, revealedCardIds: [cards[0].id], readingText: 'Saved interpretation' };
    assert.deepEqual(restoreSnapshot(JSON.parse(JSON.stringify(saved))), saved);
    assert.equal(restoreSnapshot({ ...saved, drawTargets: [] }), undefined);
  } finally { Object.assign(SPREADS, catalog); }
});
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
  assert.equal(restoreSnapshot({...snapshot,apiReading:undefined}),undefined);
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

test('refresh restores the final table and completes an interrupted last-pick transition',()=>{
  const final={...snapshot,stage:GameState.READING,pickedCards:cards,revealedCardIds:cards.map(c=>c.id),readingText:'光照见下一步。',summaryRequested:true};
  const restored=restoreSnapshot(JSON.parse(JSON.stringify(final)))!;
  assert.equal(restored.stage,GameState.READING);
  assert.equal(restored.readingId,final.readingId);
  assert.deepEqual(restored.pickedCards,final.pickedCards);
  assert.deepEqual(restored.revealedCardIds,final.revealedCardIds);
  assert.equal(restored.readingText,final.readingText);
  assert.equal(restored.summaryRequested,true);
  const interrupted=restoreSnapshot({...final,stage:GameState.PICKING,revealedCardIds:[]})!;
  assert.equal(interrupted.stage,GameState.READING);
  assert.deepEqual(interrupted.revealedCardIds,[]);
  assert.deepEqual(interrupted.pickedCards,final.pickedCards);
});
