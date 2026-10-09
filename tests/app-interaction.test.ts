import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Render the real App and API client. Stub only visual/audio/browser adapters,
// so tests exercise App effects and event handlers without WebGL or a host.
const require = createRequire(import.meta.url);
const viewNames = ['CircleActionButton','HeaderBar','IntroSection','InputSection','PickingSection','ReadingSection','RitualCardStage','DeckLibrary','StatusToast','SkyScene'];
const source = await build({
  entryPoints:['src/app/App.tsx'],bundle:true,write:false,platform:'node',format:'cjs',
  external:['react','react-dom'],define:{'import.meta.env':'{}'},
  plugins:[{name:'interaction-adapters',setup(plugin){
    plugin.onResolve({filter:/.*/}, args=>{
      const name = args.path.split('/').at(-1)!;
      if (viewNames.includes(name) || ['motion/react','react-i18next'].includes(args.path) ||
          ['useTarotAudio','useResponsive','storage','printTheReading','SpreadIcons'].includes(name)) {
        return {path:args.path,namespace:'fixture'};
      }
    });
    plugin.onLoad({filter:/.*/,namespace:'fixture'},args=>{
      const name=args.path.split('/').at(-1)!;
      let contents='';
      if(viewNames.includes(name)) contents=`import React from 'react'; export default function View(props){return React.createElement('${name}',props)}`;
      else if(args.path==='motion/react') contents=`export const motion=new Proxy({}, {get:(_,name)=>name}); export const AnimatePresence=({children})=>children; export const LayoutGroup=AnimatePresence;`;
      else if(args.path==='react-i18next') contents=`export const useTranslation=()=>({t:key=>key,i18n:{language:'en',changeLanguage:async()=>{}}});`;
      else if(name==='storage') contents=`export const preferences={getItem:()=>null,setItem:()=>{}};`;
      else if(name==='useResponsive') contents=`export const useResponsive=()=>({isMobile:false,isTablet:false,isShortViewport:false});`;
      else if(name==='SpreadIcons') contents=`export const makeSpreadIcon=()=>()=>null;`;
      else if(name==='printTheReading') contents=`export default ()=>async()=>({}); export const renderReadingImage=async()=>({});`;
      else contents=`import {useRef} from 'react'; export const useTarotAudio=()=>({hasPlayedIntroWelcomeRef:useRef(false),initAudio(){},stopVoice(){},playVoice(){},waitForVoiceToFinish:async()=>{},playIntroWelcome:async()=>{},prefetchStaticAudio(){}});`;
      return {contents,loader:'js'};
    });
  }}],
});
const module={exports:{} as any};
new Function('require','module','exports',source.outputFiles[0].text)(require,module,module.exports);
const App=module.exports.default;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const cards=Array.from({length:4},(_,rank)=>({id:`maj0${rank}`,suit:null,rank,names:{en:`Card ${rank}`,'zh-CN':`牌${rank}`},imageUrls:{redraw:'https://fixture/card.webp',dreamy:'https://fixture/card.webp',original:'https://fixture/card.webp'},keywords:{en:[],'zh-CN':[]},description:{en:'','zh-CN':''},meanings:{upright:{en:'up','zh-CN':'正'},reversed:{en:'down','zh-CN':'逆'}}}));
const spread={id:'THREE',names:{en:'Three','zh-CN':'三张'},descriptions:{en:'','zh-CN':''},cardCount:3,labelsByLocale:{en:['Past','Present','Future'],'zh-CN':['过去','现在','未来']},cardPools:['FULL','FULL','FULL'],layout:{type:'flex',positions:null},interpretationInstructions:{en:'reflect','zh-CN':'反思'}};

test('opening, picking, restore and final reveal never auto-interpret or call a draw endpoint',async()=>{
  const originalFetch=globalThis.fetch;
  const urls:string[]=[];
  globalThis.fetch=async(input)=>{
    const url=String(input);urls.push(url);
    assert.ok(!url.includes('/draw') && !url.includes('/random'),url);
    return new Response(JSON.stringify(url.includes('/spreads')?{spreads:[spread]}:{cards}),{headers:{'content-type':'application/json'}});
  };
  let saved:any;
  const summaries:any[]=[];const interpretations:any[]=[];
  let failSummary=true;
  const host={reportState:async(state:any)=>{saved=JSON.parse(JSON.stringify(state));},summarize:async(reading:any)=>{summaries.push(reading);if(failSummary) throw Error('Host unavailable');},interpret:async(reading:any)=>{interpretations.push(reading);},saveResult:async()=>({destination:'download',name:'test'})};
  let app:any;
  const view=(name:string)=>app.root.findByType(name);
  try {
    await act(async()=>{app=create(React.createElement(App,{host,initialSetup:{question:'Question',spread:'THREE',revision:1}}));});
    assert.equal(saved.stage,'INPUT');assert.equal(saved.pickedCards.length,0);
    assert.equal(saved.dealtCards,undefined);assert.equal(summaries.length,0);
    await act(async()=>{const start=view('InputSection').props.onStartRitual;await start();await start();});
    assert.equal(saved.stage,'PICKING');assert.equal(saved.pickedCards.length,0);
    assert.equal(saved.dealtCards.length,4);
    const first=view('PickingSection').props.activeDeck[0];
    await act(async()=>{
      const click=view('PickingSection').props.onCardSelect;
      await click(first);await click(first);
    });
    assert.equal(saved.pickedCards.length,1);
    const beforeRestore=structuredClone(saved);
    await act(async()=>app.unmount());
    await act(async()=>{app=create(React.createElement(App,{host,initialSnapshot:beforeRestore}));});
    assert.deepEqual(saved,beforeRestore);
    // Two clicks in one React batch must use the latest picks, not a stale closure.
    await act(async()=>{
      const {activeDeck,onCardSelect}=view('PickingSection').props;
      await onCardSelect(activeDeck[0]);await onCardSelect(activeDeck[1]);
    });
    assert.equal(saved.pickedCards.length,3);
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,650));});
    assert.equal(saved.stage,'READING');assert.equal(summaries.length,0);
    await act(async()=>{await view('ReadingSection').props.onRetryBrief();});
    assert.equal(summaries.length,0,'unrevealed cards cannot be interpreted');
    await act(async()=>{const stage=view('RitualCardStage').props;for(const card of stage.pickedCards) stage.onCardReveal(card.id);});
    assert.equal(saved.revealedCardIds.length,3);
    assert.equal(summaries.length,0);assert.equal(interpretations.length,0);
    const finalCards=structuredClone(saved.pickedCards);
    // Explicit request fails, then retries with exactly the same cards.
    await act(async()=>{await view('ReadingSection').props.onRetryBrief();});
    assert.equal(view('ReadingSection').props.briefStatus,'error');
    failSummary=false;
    await act(async()=>{await view('ReadingSection').props.onRetryBrief();});
    assert.equal(summaries.length,2);assert.deepEqual(summaries[0],summaries[1]);
    await act(async()=>{await view('ReadingSection').props.onInterpret();});
    assert.equal(interpretations.length,1);assert.deepEqual(interpretations[0].cards,finalCards);
    const completed=structuredClone(saved);
    await act(async()=>app.unmount());
    await act(async()=>{app=create(React.createElement(App,{host,initialSnapshot:completed}));});
    assert.equal(summaries.length,2);assert.equal(interpretations.length,1);
    assert.deepEqual(saved.pickedCards,finalCards);
    assert.ok(urls.every(url=>/\/api\/v1\/(cards|spreads)\?locale=en$/.test(url)));
  } finally {await act(async()=>app?.unmount());globalThis.fetch=originalFetch;}
});
