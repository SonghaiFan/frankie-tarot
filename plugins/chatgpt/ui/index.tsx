import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import OriginalApp from '@/app/App';
import { I18nProvider } from '@/i18n/I18nProvider';
import i18n from '@/i18n/config';
import { FULL_DECK } from '@/features/tarot/constants/cards';
import type { HostedReading, TarotHost } from '@/host/tarotHost';
import type { SpreadType } from '@/features/tarot/types';
import { nextAction, type TarotView } from '../shared';
import { readingPrompts } from '../prompts';
import { saveReadingImage } from './saveReadingImage';
import '@/app/index.css';

const bridge = new McpApp({name:'Frank Tarot',version:'0.3.0'}, {availableDisplayModes:['inline','fullscreen']}, {autoResize:true});
let current: TarotView | undefined;
let uiState: Parameters<NonNullable<TarotHost['reportState']>>[0] | undefined;
let syncQueue: Promise<void> = Promise.resolve();
let requestedAction: 'interpret' | 'save' | 'deeper' | undefined;
function payload(result: unknown): TarotView {
  const value = result as {isError?:boolean;_meta?:{tarot?:TarotView};content?:{text?:string}[]};
  if (value.isError || !value._meta?.tarot) throw new Error(value.content?.[0]?.text ?? 'Tarot tool failed');
  return value._meta.tarot;
}
function originalReading(value: TarotView): HostedReading {
  const reading=value.reading;
  if(!reading) throw new Error('Missing reading');
  return {id:reading.id,question:reading.question,spread:reading.spread.id as SpreadType,
    stage:value.stage === 'picking' ? 'picking' : 'reveal', interpretation:value.interpretation, cardFaceStyle:value.cardFaceStyle,
    revealedCardIds:reading.cards.filter(card=>value.revealed.includes(card.position)).map(card=>card.id),
    cards:reading.cards.map(card=>{
      const original=FULL_DECK.find(item=>item.id===card.id);
      if(!original) throw new Error('Unknown card');
      return {...original,isReversed:card.isReversed};
    })};
}
async function syncContext() {
  if(!current) return;
  const reading=current.reading;
  const stage = current.stage !== 'result' && uiState?.stage === 'READING'
    ? (current.revealed.length === reading?.cards.length ? 'ready' : 'reveal')
    : current.stage;
  // Hidden draw and legacy readingToken stay inside the app, never in model context.
  await bridge.updateModelContext({structuredContent:{
    sessionToken:current.sessionToken, readingId:reading?.id, flowId:current.flowId,
    nextAction:nextAction({...current,stage}),
    requestedAction,
    stage,
    question:reading?.question ?? uiState?.question ?? current.question,
    spread:reading?.spread ?? uiState?.spread ?? current.spread,
    pickedCount:uiState?.pickedCount, cardFaceStyle:uiState?.cardFaceStyle ?? current.cardFaceStyle, revealed:current.revealed,
    cardCount:reading?.cards.length ?? 0,
    cards:reading?.cards.filter(card=>current!.revealed.includes(card.position)) ?? [],
    interpretation:current.interpretation,
    canInterpret:!!reading && current.revealed.length===reading.cards.length,
    ...readingPrompts(current),
    instruction:current.stage==='result'
      ? 'The brief reading is displayed in the original interactive table. Preserve its cards, artwork and interpretation. Save result exports a PNG from the app; do not call show_tarot_result to save or open a separate result page. Deeper follow-ups belong in ordinary chat. Never redraw.'
      : 'Wait for all cards to be revealed AND the user to request interpretation. Follow interpretationPrompt for the brief reading, use show_tarot_result with intent=interpret and the newest sessionToken, then follow followUpPrompt for deeper analysis in ordinary chat outside the app. Never silently redraw.',
  }});
}
async function syncReveals() {
  const value=current;
  if(value?.reading && uiState && value.sessionToken) {
    const positions=value.reading.cards.filter(card=>uiState!.revealedCardIds.includes(card.id)).map(card=>card.position);
    if(positions.some(p=>!value.revealed.includes(p))) {
      const next=payload(await bridge.callServerTool({name:'reveal_tarot_cards',arguments:{sessionToken:value.sessionToken,positions}}));
      // A late completion from an old draw must not replace a new draw.
      if(current?.reading?.id===value.reading.id) current=next;
    }
  }
  await syncContext();
}
async function send(text:string) {
  await syncContext();
  const result=await bridge.sendMessage({role:'user',content:[{type:'text',text}]});
  if(result.isError) throw new Error('Host did not accept the message');
}
const host:Omit<TarotHost,'saveResult'>={
  async expand(){if(bridge.getHostContext()?.availableDisplayModes?.includes('fullscreen')) await bridge.requestDisplayMode({mode:'fullscreen'});},
  async draw(question,spread,locale){
    await syncQueue.catch(()=>{});
    requestedAction=undefined;
    current=payload(await bridge.callServerTool({name:'draw_tarot_cards',arguments:{question,spread,locale,flowId:current?.flowId}}));
    uiState=undefined;
    void syncContext().catch(()=>{});
    return originalReading(current);
  },
  async reportState(state){
    uiState=state;
    // Returning to input clears the old draw from subsequent model context.
    if(state.stage==='INPUT' && current?.reading) {requestedAction=undefined;current={locale:current.locale,spreads:current.spreads,flowId:current.flowId,question:state.question,spread:state.spread ?? 'THREE',revealed:[],stage:'input',view:'table'};}
    syncQueue=syncQueue.catch(()=>{}).then(syncReveals);
    await syncQueue;
  },
  async interpret(locale){
    await syncQueue.catch(()=>{}); await syncReveals();
    if(!current?.reading || current.revealed.length!==current.reading.cards.length) throw new Error('Reveal all cards first');
    if(current.interpretation) {
      requestedAction='deeper';
      const prompt=readingPrompts(current).followUpPrompt;
      if(prompt) await send(`${prompt}\n\n${locale==='zh-CN'?'请在普通聊天里继续深入，保留牌桌中的简短解读，不重新调用结果工具，不重新抽牌。':'Continue in ordinary chat, keeping the brief reading in the table. Do not call the result tool again or redraw.'}`);
    } else {
      requestedAction='interpret';
      await send(locale==='zh-CN'
        ? '请解读这次已翻开的牌。我点击了“请 ChatGPT 解读”，现在明确请求开始解读。请沿用网页端的简短回答风格，把简短答案写回当前原版牌桌的解读区域，然后在聊天回复里继续深入分析。保持同一组牌，不打开另一张结果卡，不重新抽牌。'
        : 'Please interpret these revealed cards. I explicitly clicked Interpret with ChatGPT. Write the brief website-style reading back into the original interactive table, then continue deeper in ordinary chat. Keep this draw; do not open a separate result card or redraw.');
    }
  },
};
function PluginRoot(){
  const [displayMode,setDisplayMode]=useState<'inline'|'fullscreen'|'pip'>('inline');
  const [view,setView]=useState<TarotView>();
  const [initialReading,setInitialReading]=useState<HostedReading>();
  const [setup,setSetup]=useState<{question:string;spread:SpreadType;revision:number}>();
  const [error,setError]=useState('');
  function receive(next:TarotView){
    requestedAction=undefined;
    current=next;uiState=undefined;setView(next);setError('');
    void i18n.changeLanguage(next.locale);
    if(next.reading) {setSetup(undefined);setInitialReading(originalReading(next));}
    else if(next.stage==='input') {setInitialReading(undefined);setSetup({question:next.question ?? '',spread:(next.spread ?? 'THREE') as SpreadType,revision:Date.now()});}
  }
  const appHost=useMemo<TarotHost>(()=>({...host,
    async saveResult(_locale,_readingText,image){
      await syncQueue.catch(()=>{}); await syncReveals();
      if(!current?.reading || current.revealed.length!==current.reading.cards.length) throw new Error('Reveal all cards first');
      // Export the existing reading; saving does not change stages or ask the model to interpret.
      return saveReadingImage(bridge,image);
    },
  }),[]);
  useEffect(()=>{
    bridge.ontoolresult=result=>{try{receive(payload(result));}catch(e){setError((e as Error).message);}};
    const updateDisplayMode=()=>setDisplayMode(bridge.getHostContext()?.displayMode ?? 'inline');
    bridge.onhostcontextchanged=updateDisplayMode;
    void bridge.connect().then(updateDisplayMode).catch(()=>setError('暂时无法连接对话，请重新打开 Frank Tarot。'));
    return ()=>{void bridge.close();};
  },[]);
  return <I18nProvider>
    {view ? <div style={{height:displayMode==='inline'?640:'100dvh'}}><OriginalApp host={appHost} initialReading={initialReading} initialSetup={setup}/></div> : <p className="p-6 text-neutral-400">Connecting Frank Tarot…</p>}
    {error && <div role="alert" className="fixed bottom-12 inset-x-4 z-[300] text-center text-red-200">{error}</div>}
  </I18nProvider>;
}
createRoot(document.getElementById('root')!).render(<PluginRoot/>);
