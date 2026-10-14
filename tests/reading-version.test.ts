import assert from 'node:assert/strict';
import test from 'node:test';
import {captureReadingSpread,restoreReadingSpread,registerRemoteSpreads,getLocalizedSpread,type ApiSpread} from '../src/features/tarot/constants/spreads';
import {buildTarotReadingPrompt} from '../src/host/readingPrompt';
import {restoreSnapshot} from '../src/host/readingSnapshot';
import {GameState} from '../src/features/tarot/types';

const definition = (version:string):ApiSpread => ({id:'SINGLE',names:{en:'One','zh-CN':'一张'},descriptions:{en:'','zh-CN':''},cardCount:1,
 labelsByLocale:{en:[version],'zh-CN':[`${version}中文`]},cardPools:['FULL'],layout:{type:'flex',positions:null},
 interpretationInstructions:{en:`Rules ${version}`,'zh-CN':`规则 ${version}`},datasetVersion:version,
 interpretationProfile:{id:version,templates:{en:'API poetry then analysis: {{spreadInstructions}}\n{{question}}\n{{cards}}\n{{previousInterpretation}}','zh-CN':'API诗意然后详细分析：{{spreadInstructions}}\n{{cards}}'}}});
const card={id:1,nameEn:'Saved card',nameCn:'旧牌',image:'unchanged.webp',suit:null,rank:1,keywords:[],positive:'已存正位',negative:'已存逆位',positiveEn:'Saved upright',negativeEn:'Saved reversed',isReversed:true};

test('frozen reading survives catalog replacement, language changes and cold recovery',()=>{
 registerRemoteSpreads([definition('v1')]);const frozen=captureReadingSpread('SINGLE')!;
 registerRemoteSpreads([definition('v2')]);restoreReadingSpread('SINGLE',frozen);
 assert.equal(getLocalizedSpread('SINGLE','en').labels?.[0],'v1');
 assert.equal(getLocalizedSpread('SINGLE','zh-CN',frozen).labels?.[0],'v1中文');
 const snapshot={version:1 as const,stage:GameState.READING,question:'Question',spread:'SINGLE',cardFaceStyle:'dreamy' as const,pickedCards:[card],revealedCardIds:[1],readingId:'existing',spreadDefinition:frozen};
 registerRemoteSpreads([]);const restored=restoreSnapshot(JSON.parse(JSON.stringify(snapshot)))!;
 assert.deepEqual(JSON.parse(JSON.stringify(restored)),snapshot);restoreReadingSpread('SINGLE',restored.spreadDefinition);
 const prompt=buildTarotReadingPrompt({...restored,cards:restored.pickedCards,spread:'SINGLE',locale:'en',question:'{{cards}} is literal user text',readingText:'Earlier reading'});
 assert.ok(prompt.startsWith('API poetry then analysis: Rules v1'));
 assert.ok(prompt.includes('Saved reversed'));assert.ok(prompt.includes('Earlier reading'));assert.ok(prompt.includes('{{cards}} is literal user text'));
 assert.ok(!prompt.includes('Rules v2'));
 assert.equal(restoreSnapshot({...snapshot,spreadDefinition:{...frozen,id:'OTHER'}}),undefined);
});

test('pre-versioned tables use API legacy semantics while new readings select current semantics',()=>{
 registerRemoteSpreads([{...definition('current'),legacyDefinition:definition('legacy')}]);
 assert.equal(restoreReadingSpread('SINGLE')?.datasetVersion,'legacy');
 assert.equal(captureReadingSpread('SINGLE')?.datasetVersion,'current');
 assert.equal(getLocalizedSpread('SINGLE','en').labels?.[0],'current');
});
