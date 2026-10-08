import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import OriginalApp from '@/app/App';
import { I18nProvider } from '@/i18n/I18nProvider';
import i18n from '@/i18n/config';
import { GameState } from '@/features/tarot/types';
import type { TarotAppSnapshot, TarotHost, TarotReadingRequest } from '@/host/tarotHost';
import type { SpreadType } from '@/features/tarot/types';
import type { TarotView } from '../shared';
import { cardContext, completeReadingContext, restoreSnapshot, applyReadingSummary } from './readingContext';
import { chatMessage } from './chatMessages';
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
    await attach({question,locale,requestedAction:'select_spread',instruction:'Use list_tarot_spreads to choose a supported spread, then open_tarot with this exact question, locale, chosen spread and current flowId. The user requested the smart ritual; the UI will enter manual card picking. Do not pick, flip or interpret.'});
    await send(chatMessage('select_spread',locale));
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
    await attach({...context,locale:reading.locale,readingId:reading.readingId,requestedAction:'brief_summary',instruction:'All cards are revealed. Write 2–4 brief, poetic but concrete sentences without certain predictions. Call open_tarot with the current flowId, locale and summary containing this exact readingId and your text; omit question and spread. Do not redraw or repeat the summary in chat.'});
    await send(chatMessage('brief_summary',reading.locale));
  },
  async interpret(reading){
    const context = completeReadingContext(reading);
    await attach({...context,locale:reading.locale,requestedAction:'interpret',previousInterpretation:snapshot?.readingText ?? '',instruction:'Interpret this exact spread in ordinary chat with practical reflection. Keep the current cards; do not reopen the app or draw again.'});
    await send(chatMessage('interpret',reading.locale));
  },
  async saveResult(_locale,_text,image){ return saveReadingImage(bridge,image); },
};
// ── What the host's own chrome covers ─────────────────────────
// In fullscreen on a phone, ChatGPT lays its top bar and message box over
// the app, and the iframe's env(safe-area-inset-*) knows nothing of either.
// The host reports them (MCP Apps host context; ChatGPT's own window.openai
// too), and they become --host-inset-*, which index.css folds into --safe-*.
type Insets = {top:number;right:number;bottom:number;left:number};
type OpenAiGlobals = {safeArea?:{insets?:Insets}};
// When a touch host in fullscreen reports nothing, keep clear of the bar and
// composer we can see it draw, rather than put the title under them.
const ASSUMED_FULLSCREEN_TOUCH_INSETS: Insets = {top:112,right:0,bottom:120,left:0};
function applyHostInsets(){
  const context = bridge.getHostContext();
  const reported = context?.safeAreaInsets ?? (window as unknown as {openai?:OpenAiGlobals}).openai?.safeArea?.insets;
  const touch = context?.deviceCapabilities?.touch ?? window.matchMedia('(pointer: coarse)').matches;
  const insets = reported ?? (context?.displayMode === 'fullscreen' && touch ? ASSUMED_FULLSCREEN_TOUCH_INSETS : undefined);
  const root = document.documentElement.style;
  for (const side of ['top','right','bottom','left'] as const) {
    if (insets) root.setProperty(`--host-inset-${side}`, `${Math.max(0, insets[side] ?? 0)}px`);
    else root.removeProperty(`--host-inset-${side}`);
  }
}

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
    const updateDisplayMode=()=>{setDisplayMode(bridge.getHostContext()?.displayMode ?? 'inline');applyHostInsets();};
    bridge.onhostcontextchanged=updateDisplayMode;
    // ChatGPT announces changes to window.openai (safeArea among them) this way.
    window.addEventListener('openai:set_globals',applyHostInsets);
    void bridge.connect().then(updateDisplayMode).catch(()=>setError('暂时无法连接对话，请重新打开 Frank Tarot。'));
    return ()=>{window.removeEventListener('openai:set_globals',applyHostInsets);void bridge.close();};
  },[]);
  return <I18nProvider>
    {view ? <div style={{height:displayMode==='inline'?640:'100dvh'}}><OriginalApp key={view.flowId} host={appHost} initialSnapshot={initialSnapshot} initialSetup={setup} briefSummary={briefSummary}/></div> : <p className="p-6 text-neutral-400">Connecting Frank Tarot…</p>}
    {error && <div role="alert" className="fixed bottom-12 inset-x-4 z-[300] text-center text-red-200">{error}</div>}
  </I18nProvider>;
}
createRoot(document.getElementById('root')!).render(<PluginRoot/>);
