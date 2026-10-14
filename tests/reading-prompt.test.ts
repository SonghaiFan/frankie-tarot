import assert from 'node:assert/strict';
import test from 'node:test';
import { registerRemoteSpreads } from '../src/features/tarot/constants/spreads';
import { buildTarotReadingPrompt } from '../src/host/readingPrompt';
import type { TarotReadingRequest } from '../src/host/tarotHost';

registerRemoteSpreads([{id:'THREE',names:{en:'Timeline','zh-CN':'时间线'},descriptions:{en:'', 'zh-CN':''},cardCount:3,
  labelsByLocale:{en:['Past','Present','Future'],'zh-CN':['过去','现在','未来']},cardPools:['FULL','FULL','FULL'],
  interpretationInstructions:{en:'Connect past, present and future.', 'zh-CN':'串联过去、现在、未来的变化。'},layout:{type:'flex',positions:null}}]);
const cards = [1,2,3].map(id=>({id,nameEn:`Card ${id}`,nameCn:`牌${id}`,image:`card${id}`,suit:null,rank:id,
  keywords:['中文关键词'],keywordsEn:['English keyword'],positive:'正位含义',negative:'逆位含义',positiveEn:'Upright hint',negativeEn:'Reversed hint',isReversed:id===2}));
const reading: TarotReadingRequest = {question:'工作方向？',spread:'THREE',cards,revealedCardIds:[1,2,3],locale:'zh-CN'};

test('Chinese full prompt combines poetry and detailed analysis with the exact spread and prior reading',()=>{
  const prompt=buildTarotReadingPrompt({...reading,readingText:'已经保存的整体解读'});
  assert.ok(prompt.includes('串联过去、现在、未来的变化。'));
  assert.ok(prompt.includes('2. 现在：牌2（逆位）\n   核心关键词：中文关键词\n   对应正逆位的牌义参考：逆位含义'));
  assert.ok(prompt.includes('工作方向？'));
  assert.ok(prompt.includes('结合你对发问人的了解'));
  assert.ok(prompt.includes('只使用你真实已有的信息，不编造个人经历'));
  assert.ok(prompt.includes('已经保存的整体解读'));
  assert.ok(prompt.indexOf('一、诗意解读') < prompt.indexOf('二、详细分析'));
  assert.ok(prompt.includes('不要重新抽牌'));
});
test('English prompt uses localized spread rules, orientation-specific meanings and default guidance',()=>{
  const prompt=buildTarotReadingPrompt({...reading,question:' ',locale:'en'});
  assert.ok(prompt.includes('General guidance for the path ahead.'));
  assert.ok(prompt.includes("the seeker's usual AI assistant"));
  assert.ok(prompt.includes('do not invent personal history'));
  assert.ok(prompt.includes('Connect past, present and future.'));
  assert.ok(prompt.includes('2. Present: Card 2 (Reversed)\n   Core keywords: English keyword\n   Orientation-specific meaning hints: Reversed hint'));
  assert.ok(prompt.indexOf('1. Poetic reading') < prompt.indexOf('2. Detailed analysis'));
  assert.ok(!prompt.includes('Existing interpretation for this same reading:'));
});
test('external AI prompt rejects incomplete and duplicate readings',()=>{
  assert.throws(()=>buildTarotReadingPrompt({...reading,revealedCardIds:[1,2]}));
  assert.throws(()=>buildTarotReadingPrompt({...reading,cards:[cards[0],cards[0],cards[2]]}));
});
