import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import OriginalApp from '@/app/App';
import { I18nProvider } from '@/i18n/I18nProvider';
import i18n from '@/i18n/config';
import { GameState } from '@/features/tarot/types';
import { buildTarotFollowUpPrompt } from '@/core/promptBuilder';
import type { TarotAppSnapshot, TarotHost } from '@/host/tarotHost';
import type { SpreadType } from '@/features/tarot/types';
import type { TarotView } from '../shared';
import { cardContext, completeReadingContext, restoreSnapshot, applyReadingSummary } from './readingContext';
import { saveReadingImage } from './saveReadingImage';
import '@/app/index.css';

const bridge = new McpApp({name:'Frank Tarot',version:'0.4.0'}, {availableDisplayModes:['inline','fullscreen']}, {autoResize:true});
let current: TarotView | undefined;
let smartSelectionFlowId: string | undefined;
let snapshot: TarotAppSnapshot | undefined;
let modelContext: Record<string, unknown> = {};
let contextQueue: Promise<void> = Promise.resolve();
// Widget persistence is optional; privateContent never becomes model context.
type WidgetState = {modelContent:Record<string,unknown>;privateContent:{flowId?:string;snapshot?:TarotAppSnapshot;smartSelectionFlowId?:string}};
type Persistence = {widgetState?:WidgetState;setWidgetState?(state:WidgetState):void};
const persistence = () => (window as unknown as {openai?:Persistence}).openai;
function persist() {
  persistence()?.setWidgetState?.({modelContent:modelContext,privateContent:{flowId:current?.flowId,snapshot,smartSelectionFlowId}});
}
function attach(context: Record<string, unknown>) {
  modelContext = {flowId:current?.flowId,...context};
  persist();
  const next = modelContext;
  contextQueue = contextQueue.catch(()=>{}).then(async()=>{
    await bridge.updateModelContext({structuredContent:next});
  });
  return contextQueue;
}
async function send(text: string) {
  const result = await bridge.sendMessage({role:'user',content:[{type:'text',text}]});
  if(result.isError) throw new Error('Host did not accept the message');
}
const host:TarotHost={
  async expand(){if(bridge.getHostContext()?.availableDisplayModes?.includes('fullscreen')) await bridge.requestDisplayMode({mode:'fullscreen'});},
  async requestSpread(question,locale){
    smartSelectionFlowId=current?.flowId;
    await attach({question,requestedAction:'select_spread'});
    await send(locale === 'en'
      ? `Choose a suitable F.Tarot spread for my question using list_tarot_spreads. Then call open_tarot with this exact question, the chosen actual spread ID, locale="en" and flowId="${current?.flowId}". The user already requested the smart ritual; the UI will immediately enter manual card picking after applying your spread. Do not pick, flip or interpret.\nQuestion: ${question}`
      : `请通过 list_tarot_spreads，根据我的问题智能选择合适的牌阵，再调用 open_tarot，预填原问题与所选实际牌阵，locale="zh-CN"，flowId="${current?.flowId}"。用户已点击智能开始；应用会在收到牌阵后直接进入选牌。不要替用户选牌、翻牌或解读。\n问题：${question}`);
  },
  async reportState(state){
    const previous = snapshot;
    snapshot = state;
    persist();
    // Clear stale reading context on a new draw or reset. Flips never report progress.
    if (previous && (previous.readingId !== state.readingId ||
      (state.stage === GameState.INPUT && previous.stage !== GameState.INPUT))) {
      await attach({question:state.question,spread:state.spread});
    }
  },
  async attachCard(selection){
    await attach({...cardContext(selection),instruction:'The user selected this card in the app. This is context only, not a request for interpretation. Do not infer other cards or track reveal progress.'});
  },
  async summarize(reading){
    const context = completeReadingContext(reading);
    if (!reading.readingId) throw new Error('Missing current reading ID');
    if (snapshot?.readingId === reading.readingId) {
      snapshot={...snapshot,revealedCardIds:reading.revealedCardIds,summaryRequested:true};
      persist();
    }
    await attach({...context,readingId:reading.readingId,requestedAction:'brief_summary',instruction:'All cards are revealed. Give a brief poetic summary and write it into this exact table using open_tarot summary. Do not redraw.'});
    await send((reading.locale === 'zh-CN'
      ? '牌已全部翻开。请根据以下问题与牌阵写一段简短、富有诗意但具体的解读，2–4句，不作确定性预言。通过 open_tarot 写回牌桌：'
      : 'All cards are revealed. Write a brief, poetic but concrete interpretation in 2–4 sentences, without certain predictions. Write it to the table using open_tarot: ')
      + JSON.stringify({flowId:current?.flowId,locale:reading.locale,summary:{readingId:reading.readingId,text:'<your brief interpretation>'}})
      + '\nOmit question and spread from the tool call. Do not repeat the summary in chat.\n' + JSON.stringify(context));
  },
  async interpret(reading){
    const context = completeReadingContext(reading);
    await attach({...context,requestedAction:'interpret',instruction:'Interpret this exact spread in ordinary chat. Keep the current cards; do not reopen the app or draw again.'});
    await send(buildTarotFollowUpPrompt({...reading,readingText:snapshot?.readingText ?? ''}));
  },
  async saveResult(_locale,_text,image){ return saveReadingImage(bridge,image); },
};
function PluginRoot(){
  const [displayMode,setDisplayMode]=useState<'inline'|'fullscreen'|'pip'>('inline');
  const [view,setView]=useState<TarotView>();
  const [initialSnapshot,setInitialSnapshot]=useState<TarotAppSnapshot>();
  const [setup,setSetup]=useState<{question:string;spread:SpreadType;revision:number;autoStart?:boolean}>();
  const [briefSummary,setBriefSummary]=useState<{readingId:string;text:string}>();
  const [error,setError]=useState('');
  function receive(next:TarotView){
    const stored = persistence()?.widgetState;
    const saved = current?.flowId === next.flowId ? snapshot
      : stored?.privateContent?.flowId === next.flowId ? restoreSnapshot(stored.privateContent.snapshot) : undefined;
    if (next.summary) {
      try {
        const updated = applyReadingSummary(saved, next.summary);
        const sameMounted=current?.flowId===next.flowId && !!snapshot;
        current=next;snapshot=updated;setView(next);setBriefSummary(next.summary);setError('');
        if (!sameMounted) setInitialSnapshot(updated);
        persist();
      } catch { setError(next.locale === 'en' ? 'This summary is for another or unavailable reading. Your current cards are preserved.' : '这段解读不属于当前牌局，或牌局无法恢复。当前卡牌已保留。'); }
      return;
    }
    setBriefSummary(undefined);
    // ChatGPT replays the original launch result on refresh, including its question.
    const resume = next.question === undefined || (!current && !!saved);
    const savedContext = current?.flowId === next.flowId ? modelContext : stored?.modelContent;
    current=next;setView(next);setError(resume && next.restoreRequested && !saved
      ? (next.locale === 'en' ? 'This host has no saved table state. No replacement cards were drawn.' : '当前宿主没有可恢复的牌局状态，未重新抽牌。') : '');
    void i18n.changeLanguage(next.locale);
    if (resume && saved) {
      snapshot=saved;setSetup(undefined);setInitialSnapshot(saved);
    } else {
      snapshot=undefined;setInitialSnapshot(undefined);
      setSetup(next.stage==='input' ? {question:next.question ?? '',spread:(next.spread ?? 'THREE') as SpreadType,revision:Date.now(),autoStart:smartSelectionFlowId===next.flowId || stored?.privateContent?.smartSelectionFlowId===next.flowId} : undefined);
    }
    if (next.question !== undefined) smartSelectionFlowId=undefined;
    const context = resume && saved && savedContext ? savedContext : {question:snapshot?.question ?? next.question ?? '',spread:snapshot?.spread ?? next.spread};
    void attach(context).catch(()=>setError('卡牌上下文暂时无法同步，请重试。'));
  }
  const appHost=useMemo(()=>host,[]);
  useEffect(()=>{
    bridge.ontoolresult=result=>{
      const value=result as {isError?:boolean;_meta?:{tarot?:TarotView};content?:{text?:string}[]};
      if(value.isError || !value._meta?.tarot) {setError(value.content?.[0]?.text ?? 'Tarot could not open');return;}
      receive(value._meta.tarot);
    };
    const updateDisplayMode=()=>setDisplayMode(bridge.getHostContext()?.displayMode ?? 'inline');
    bridge.onhostcontextchanged=updateDisplayMode;
    void bridge.connect().then(updateDisplayMode).catch(()=>setError('暂时无法连接对话，请重新打开 Frank Tarot。'));
    return ()=>{void bridge.close();};
  },[]);
  return <I18nProvider>
    {view ? <div style={{height:displayMode==='inline'?640:'100dvh'}}><OriginalApp key={view.flowId} host={appHost} initialSnapshot={initialSnapshot} initialSetup={setup} briefSummary={briefSummary}/></div> : <p className="p-6 text-neutral-400">Connecting Frank Tarot…</p>}
    {error && <div role="alert" className="fixed bottom-12 inset-x-4 z-[300] text-center text-red-200">{error}</div>}
  </I18nProvider>;
}
createRoot(document.getElementById('root')!).render(<PluginRoot/>);
