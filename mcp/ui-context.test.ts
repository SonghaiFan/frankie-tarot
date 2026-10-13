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
].map((card,i)=>({...card,suit:null,rank:card.id,isReversed:i===1,visualId:70+i}));
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
  assert.deepEqual(context.cards.map(card=>card.meaning),['开始','封闭','滋养']);
  assert.equal(context.spread.interpretationInstruction,'测试');
  assert.throws(()=>completeReadingContext({...reading,revealedCardIds:[cards[0].id,cards[1].id]}));
  assert.throws(()=>completeReadingContext({...reading,cards:[cards[0]]}));
  assert.throws(()=>completeReadingContext({...reading,cards:[cards[0],cards[0],cards[2]]}));
  assert.throws(()=>completeReadingContext({...reading,spread:'AUTO'}));
});

const snapshot:TarotAppSnapshot={version:1,readingId:'8cc59a71-b4fb-4cdb-abf8-6930e45d37ba',stage:GameState.PICKING,question:reading.question,spread:'THREE',
  pickedCards:cards.slice(0,1),revealedCardIds:[],cardFaceStyle:'dreamy'};
test('cold-page recovery preserves the exact reading before the remote catalog loads', () => {
  const catalog = { ...SPREADS };
  for (const key of Object.keys(SPREADS)) delete (SPREADS as any)[key];
  try {
    const saved = { ...snapshot, stage: GameState.READING, pickedCards: cards, revealedCardIds: [cards[0].id], readingText: 'Saved interpretation' };
    assert.deepEqual(restoreSnapshot(JSON.parse(JSON.stringify(saved))), saved);
    assert.equal(restoreSnapshot({ ...saved, readingId: undefined }), undefined);
  } finally { Object.assign(SPREADS, catalog); }
});
test('private recovery preserves picked cards and orientation',()=>{
  const restored=restoreSnapshot(JSON.parse(JSON.stringify(snapshot)))!;
  assert.ok(restored);
  assert.deepEqual(restored.pickedCards.map(c=>c.id),[cards[0].id]);
  assert.equal(restored.pickedCards[0].visualId,70);
  const partial=restoreSnapshot({...snapshot,stage:GameState.READING,pickedCards:cards,revealedCardIds:[cards[1].id]})!;
  assert.deepEqual(partial.revealedCardIds,[cards[1].id]);
  assert.deepEqual(partial.pickedCards.map(c=>c.isReversed),[false,true,false]);
  assert.ok(!('drawTargets' in restoreSnapshot({...snapshot,drawTargets:cards} as any)!), 'legacy draw targets are dropped');
  assert.equal(restoreSnapshot({...snapshot,revealedCardIds:[999]}),undefined);
  assert.equal(restoreSnapshot({...snapshot,pickedCards:[cards[0],cards[0]]}),undefined);
  assert.equal(restoreSnapshot({...snapshot,stage:GameState.READING,pickedCards:[]}),undefined);
  assert.equal(restoreSnapshot({...snapshot,readingId:undefined}),undefined);
  assert.equal(restoreSnapshot({...snapshot,version:99} as any),undefined);
});

test('summary updates only the matching completed reading and preserves the exact cards',()=>{
  const complete={...snapshot,stage:GameState.READING,pickedCards:cards,revealedCardIds:cards.map(c=>c.id),summaryRequested:true};
  const summary={readingId:complete.readingId!,text:'  风穿过旧门，光照见下一步。  '};
  assert.throws(()=>applyReadingSummary({...complete,summaryRequested:false},summary), 'unsolicited summaries are rejected');
  const updated=applyReadingSummary(complete,summary);
  assert.equal(updated.readingText,'风穿过旧门，光照见下一步。');
  assert.equal(updated.summaryRequested,true);
  assert.deepEqual(updated.pickedCards,complete.pickedCards);
  assert.throws(()=>applyReadingSummary(complete,{...summary,readingId:'another-draw'}));
  assert.throws(()=>applyReadingSummary(snapshot,summary));
  assert.throws(()=>applyReadingSummary(undefined,summary));
  assert.throws(()=>applyReadingSummary(complete,{...summary,text:'x'.repeat(801)}));
  assert.equal(restoreSnapshot(JSON.parse(JSON.stringify(updated)))?.readingText,updated.readingText);
});

test('refresh restores the final table and an interrupted last pick',()=>{
  const final={...snapshot,stage:GameState.READING,pickedCards:cards,revealedCardIds:cards.map(c=>c.id),readingText:'光照见下一步。',summaryRequested:true};
  const restored=restoreSnapshot(JSON.parse(JSON.stringify(final)))!;
  assert.equal(restored.stage,GameState.READING);
  assert.equal(restored.readingId,final.readingId);
  assert.deepEqual(restored.pickedCards,final.pickedCards);
  assert.deepEqual(restored.revealedCardIds,final.revealedCardIds);
  assert.equal(restored.readingText,final.readingText);
  assert.equal(restored.summaryRequested,true);
  // The app moves a fully picked table on to READING once the spread catalog loads.
  const interrupted=restoreSnapshot({...final,stage:GameState.PICKING,revealedCardIds:[]})!;
  assert.equal(interrupted.stage,GameState.PICKING);
  assert.deepEqual(interrupted.revealedCardIds,[]);
  assert.deepEqual(interrupted.pickedCards,final.pickedCards);
});
