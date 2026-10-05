import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import OriginalApp from '@/app/App';
import ReadingCard from '@/features/tarot/components/ReadingCard';
import { I18nProvider } from '@/i18n/I18nProvider';
import i18n from '@/i18n/config';
import { FULL_DECK } from '@/features/tarot/constants/cards';
import type { HostedReading, TarotHost } from '@/host/tarotHost';
import type { SpreadType } from '@/features/tarot/types';
import type { TarotView } from '../shared';
import { readingPrompts } from '../prompts';
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
    stage:value.stage === 'picking' ? 'picking' : 'reveal', interpretation:value.interpretation,
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
  // Hidden draw and legacy readingToken stay inside the app, never in model context.
  await bridge.updateModelContext({structuredContent:{
    sessionToken:current.sessionToken, readingId:reading?.id,
    requestedAction,
    stage:current.stage === "ready" || current.stage === "reveal" ? current.stage
      : uiState?.stage === "READING" ? (current.revealed.length === (reading?.cards.length ?? -1) ? "ready" : "reveal")
      : uiState?.stage === "PICKING" ? "picking" : current.stage,
    question:reading?.question ?? uiState?.question ?? current.question,
    spread:reading?.spread ?? uiState?.spread ?? current.spread,
    pickedCount:uiState?.pickedCount, cardFaceStyle:uiState?.cardFaceStyle ?? current.cardFaceStyle, revealed:current.revealed,
    cardCount:reading?.cards.length ?? 0,
    cards:reading?.cards.filter(card=>current!.revealed.includes(card.position)) ?? [],
    interpretation:current.interpretation,
    canInterpret:!!reading && current.revealed.length===reading.cards.length,
    ...readingPrompts(current),
    instruction:current.view==='result'
      ? 'This result is saved. Preserve its cards, artwork and existing interpretation. For Save result use show_tarot_result without adding interpretation. Only interpret when explicitly requested. Never redraw.'
      : 'Wait for all cards to be revealed AND the user to request interpretation. Follow interpretationPrompt for the brief card, use show_tarot_result with intent=interpret and the newest sessionToken, then follow followUpPrompt for deeper analysis in ordinary chat outside the app. Never silently redraw.',
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
    current=payload(await bridge.callServerTool({name:'draw_tarot_cards',arguments:{question,spread,locale}}));
    uiState=undefined;
    void syncContext().catch(()=>{});
    return originalReading(current);
  },
  async reportState(state){
    uiState=state;
    // Returning to input clears the old draw from subsequent model context.
    if(state.stage==='INPUT' && current?.reading) {requestedAction=undefined;current={locale:current.locale,spreads:current.spreads,question:state.question,spread:state.spread ?? 'THREE',revealed:[],stage:'input',view:'table'};}
    syncQueue=syncQueue.catch(()=>{}).then(syncReveals);
    await syncQueue;
  },
  async interpret(locale){
    await syncQueue.catch(()=>{}); await syncReveals();
    if(!current?.reading || current.revealed.length!==current.reading.cards.length) throw new Error('Reveal all cards first');
    requestedAction='interpret';
    await send((locale==='zh-CN'
      ? '请解读这次已翻开的牌。我点击了“请 ChatGPT 解读”，现在明确请求开始解读。请沿用网页端的简短回答风格，把简短答案放进结果卡，然后在卡外的聊天回复里继续深入分析。保持同一组牌，不重新抽牌。'
      : 'Please interpret these revealed cards. I clicked “Interpret with ChatGPT” and explicitly request interpretation now. Use the website’s brief reading style for the result card, then continue deeper in ordinary chat outside it. Keep this draw; do not redraw.'));
  },
};
function PluginRoot(){
  const [displayMode,setDisplayMode]=useState<'inline'|'fullscreen'|'pip'>('inline');
  const [view,setView]=useState<TarotView>();
  const [initialReading,setInitialReading]=useState<HostedReading>();
  const [setup,setSetup]=useState<{question:string;spread:SpreadType;revision:number}>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  function receive(next:TarotView){
    requestedAction=undefined;
    current=next;uiState=undefined;setView(next);setError('');
    void i18n.changeLanguage(next.locale);
    if(next.reading) {setSetup(undefined);setInitialReading(originalReading(next));}
    else if(next.stage==='input') {setInitialReading(undefined);setSetup({question:next.question ?? '',spread:(next.spread ?? 'THREE') as SpreadType,revision:Date.now()});}
  }
  const appHost=useMemo<TarotHost>(()=>({...host,
    async saveResult(locale,readingText){
      await syncQueue.catch(()=>{}); await syncReveals();
      if(!current?.reading || current.revealed.length!==current.reading.cards.length) throw new Error('Reveal all cards first');
      const saved=payload(await bridge.callServerTool({name:'show_tarot_result',arguments:{
        sessionToken:current.sessionToken,interpretation:readingText || current.interpretation,
        intent:'save',
        cardFaceStyle:uiState?.cardFaceStyle ?? current.cardFaceStyle,
      }}));
      // App tool calls render locally; an explicit message asks the host to also
      // publish the same result in the conversation, without a new interpretation.
      current=saved; uiState=undefined;
      requestedAction='save';
      await syncContext();
      await send(locale==='zh-CN'
        ? '保存这次结果。请用 show_tarot_result 将当前牌阵、画风和已有解读作为结果卡返回聊天。仅保存，不新增解读，不重新抽牌；如果没有已有解读，请省略 interpretation。'
        : 'Save this result. Call show_tarot_result to post the current draw, artwork style, and existing interpretation as a result card in chat. Save only; do not add an interpretation or redraw. Omit interpretation if none exists.');
      receive(saved);
    },
  }),[]);
  useEffect(()=>{
    bridge.ontoolresult=result=>{try{receive(payload(result));}catch(e){setError((e as Error).message);}};
    const updateDisplayMode=()=>setDisplayMode(bridge.getHostContext()?.displayMode ?? 'inline');
    bridge.onhostcontextchanged=updateDisplayMode;
    void bridge.connect().then(updateDisplayMode).catch(()=>setError('暂时无法连接对话，请重新打开 Frank Tarot。'));
    return ()=>{void bridge.close();};
  },[]);
  async function action(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const zh=view?.locale!=='en';
  const reading=view?.reading ? originalReading(view) : undefined;
  const button='border border-white/25 rounded-md px-3 py-2 text-xs text-neutral-200 hover:bg-white/10 disabled:opacity-40';
  return <I18nProvider>
    {view?.view==='result' && reading ? <main style={{padding:12,background:'#101110',color:'#ddd',minHeight:240}}>
      <ReadingCard question={reading.question} spread={reading.spread} pickedCards={reading.cards} readingText={view.interpretation ?? ''} locale={view.locale} cardFaceStyle={view.cardFaceStyle}
        onCardClick={position=>void action(()=>send(`${zh?'请深入讨论':'Explore'} ${position} ${zh?'号牌与我问题的关系；沿用当前牌阵。':'in relation to my question, keeping this draw.'}`))}/>
      <section aria-label={zh?'结果操作':'Result actions'} className="px-3">
        <div className="flex flex-wrap gap-2 mt-5">
          <button className={button} disabled={busy} onClick={()=>void action(async()=>{const next=payload(await bridge.callServerTool({name:'open_tarot',arguments:{sessionToken:current!.sessionToken}}));receive({...next,interpretation:view.interpretation});})}>{zh?'回到牌桌':'Open table'}</button>
          {view.interpretation && <button className={button} disabled={busy} onClick={()=>void action(async()=>{
            const prompt=readingPrompts(view).followUpPrompt;
            requestedAction='deeper';
            if(prompt) await send(`${prompt}\n\n${zh?'请在结果卡外的聊天回复中回答，保留卡片中的简短解读，不调用 show_tarot_result 替换它，也不重新抽牌。':'Answer in ordinary chat outside the result card. Preserve its brief reading; do not call show_tarot_result to replace it or redraw.'}`);
          })}>{i18n.t('reading.prompt')}</button>}
        </div>
      </section>
      {error&&<p role="alert">{error}</p>}
    </main> : view ? <div style={{height:displayMode==='inline'?640:'100dvh'}}><OriginalApp host={appHost} initialReading={initialReading} initialSetup={setup}/></div> : <p className="p-6 text-neutral-400">Connecting Frank Tarot…</p>}
    {error && view?.view!=='result' && <div role="alert" className="fixed bottom-12 inset-x-4 z-[300] text-center text-red-200">{error}</div>}
  </I18nProvider>;
}
createRoot(document.getElementById('root')!).render(<PluginRoot/>);
