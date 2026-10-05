import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import OriginalApp from '@/app/App';
import ReadingCard from '@/features/tarot/components/ReadingCard';
import printTheReading from '@/features/tarot/utils/printTheReading';
import { I18nProvider } from '@/i18n/I18nProvider';
import i18n from '@/i18n/config';
import { FULL_DECK } from '@/features/tarot/constants/cards';
import type { HostedReading, TarotHost } from '@/host/tarotHost';
import type { SpreadType } from '@/features/tarot/types';
import type { TarotView } from '../shared';
import '@/app/index.css';

const bridge = new McpApp({name:'Frank Tarot',version:'0.3.0'}, {}, {autoResize:true});
let current: TarotView | undefined;
let uiState: Parameters<NonNullable<TarotHost['reportState']>>[0] | undefined;
let syncQueue: Promise<void> = Promise.resolve();
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
    stage:current.stage === "ready" || current.stage === "reveal" ? current.stage
      : uiState?.stage === "READING" ? (current.revealed.length === (reading?.cards.length ?? -1) ? "ready" : "reveal")
      : uiState?.stage === "PICKING" ? "picking" : current.stage,
    question:reading?.question ?? uiState?.question ?? current.question,
    spread:reading?.spread ?? uiState?.spread ?? current.spread,
    pickedCount:uiState?.pickedCount, cardFaceStyle:uiState?.cardFaceStyle ?? current.cardFaceStyle, revealed:current.revealed,
    cardCount:reading?.cards.length ?? 0,
    cards:reading?.cards.filter(card=>current!.revealed.includes(card.position)) ?? [],
    canInterpret:!!reading && current.revealed.length===reading.cards.length,
    instruction:'Wait for all cards to be revealed AND the user to request interpretation. Use show_tarot_result with the newest sessionToken to return the shared inline card. Never silently redraw.',
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
const host:TarotHost={
  async expand(){if(bridge.getHostContext()?.availableDisplayModes?.includes('fullscreen')) await bridge.requestDisplayMode({mode:'fullscreen'});},
  async draw(question,spread,locale){
    await syncQueue.catch(()=>{});
    current=payload(await bridge.callServerTool({name:'draw_tarot_cards',arguments:{question,spread,locale}}));
    uiState=undefined;
    void syncContext().catch(()=>{});
    return originalReading(current);
  },
  async reportState(state){
    uiState=state;
    // Returning to input clears the old draw from subsequent model context.
    if(state.stage==='INPUT' && current?.reading) current={locale:current.locale,spreads:current.spreads,question:state.question,spread:state.spread ?? 'THREE',revealed:[],stage:'input',view:'table'};
    syncQueue=syncQueue.catch(()=>{}).then(syncReveals);
    await syncQueue;
  },
  async interpret(locale,reflection){
    await syncQueue.catch(()=>{}); await syncReveals();
    if(!current?.reading || current.revealed.length!==current.reading.cards.length) throw new Error('Reveal all cards first');
    await send((locale==='zh-CN'
      ? '我已翻开全部卡牌。请结合我的问题解读，用 show_tarot_result 把这次牌阵与解读作为结果卡返回聊天，保持同一组牌，不要重新抽牌。'
      : 'I have revealed every card. Interpret this existing reading and call show_tarot_result to return the shared reading card in chat. Do not redraw.')
      +(reflection ? `\n我的感受 / My reflection: ${reflection}` : ''));
  },
};
function PluginRoot(){
  const [view,setView]=useState<TarotView>();
  const [initialReading,setInitialReading]=useState<HostedReading>();
  const [setup,setSetup]=useState<{question:string;spread:SpreadType;revision:number}>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [followup,setFollowup]=useState('');
  function receive(next:TarotView){
    current=next;uiState=undefined;setView(next);setError('');
    void i18n.changeLanguage(next.locale);
    if(next.reading) {setSetup(undefined);setInitialReading(originalReading(next));}
    else if(next.stage==='input') {setInitialReading(undefined);setSetup({question:next.question ?? '',spread:(next.spread ?? 'THREE') as SpreadType,revision:Date.now()});}
  }
  useEffect(()=>{
    bridge.ontoolresult=result=>{try{receive(payload(result));}catch(e){setError((e as Error).message);}};
    void bridge.connect().catch(()=>setError('暂时无法连接对话，请重新打开 Frank Tarot。'));
    return ()=>{void bridge.close();};
  },[]);
  async function action(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const zh=view?.locale!=='en';
  const reading=view?.reading ? originalReading(view) : undefined;
  const button='border border-white/25 rounded-md px-3 py-2 text-xs text-neutral-200 hover:bg-white/10 disabled:opacity-40';
  return <I18nProvider>
    {view?.view==='result' && reading ? <main style={{padding:12,background:'#101110',color:'#ddd',minHeight:240}}>
      <ReadingCard question={reading.question} spread={reading.spread} pickedCards={reading.cards} readingText={view.interpretation ?? ''} locale={view.locale} cardFaceStyle={view.cardFaceStyle}
        onCardClick={position=>void action(()=>send(`${zh?'请深入讨论':'Explore'} ${position} ${zh?'号牌与我问题的关系；沿用当前牌阵。':'in relation to my question, keeping this draw.'}`))}>
        <div className="flex flex-wrap gap-2 mt-5">
          <button className={button} disabled={busy} onClick={()=>void action(async()=>{const next=payload(await bridge.callServerTool({name:'open_tarot',arguments:{sessionToken:current!.sessionToken}}));receive({...next,interpretation:view.interpretation});await host.expand?.();})}>{zh?'回到牌桌':'Open table'}</button>
          <button className={button} disabled={busy} onClick={()=>void action(printTheReading(reading.question,reading.spread,reading.cards,view.interpretation ?? '',view.locale))}>{zh?'保存图文':'Save image'}</button>
        </div>
        <form className="flex gap-2 mt-4" onSubmit={e=>{e.preventDefault();if(followup.trim()) void action(async()=>{await send(followup.trim());setFollowup('');});}}>
          <input aria-label={zh?'继续追问':'Follow-up question'} value={followup} maxLength={2000} onChange={e=>setFollowup(e.target.value)} placeholder={zh?'对这组牌，继续问……':'Ask about these cards…'} className="min-w-0 flex-1 bg-transparent border border-white/25 rounded-md px-3 py-2 text-sm"/>
          <button className={button} disabled={busy || !followup.trim()}>{zh?'继续聊':'Discuss'}</button>
        </form>
      </ReadingCard>
      {error&&<p role="alert">{error}</p>}
    </main> : view ? <OriginalApp host={host} initialReading={initialReading} initialSetup={setup}/> : <p className="p-6 text-neutral-400">Connecting Frank Tarot…</p>}
    {error && view?.view!=='result' && <div role="alert" className="fixed bottom-12 inset-x-4 z-[300] text-center text-red-200">{error}</div>}
  </I18nProvider>;
}
createRoot(document.getElementById('root')!).render(<PluginRoot/>);
