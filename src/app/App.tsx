import CircleActionButton from "@/shared/components/CircleActionButton";
import { Languages, Library } from "lucide-react";
import { restoreSnapshot } from "@/host/readingSnapshot";
import { preferences } from "@/shared/storage";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { preload } from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  GameState,
  TarotCard,
  SpreadType,
  PickedCard,
  CardFaceStyle,
} from "@/features/tarot/types";
import { DEFAULT_CARD_FACE_STYLE } from "@/features/tarot/constants/cardFaceStyles";
import {
  getCardImageUrl,
} from "@/features/tarot/constants/cards";
import { SPREADS } from "@/features/tarot/constants/spreads";
import { loadApiDeck, loadApiSpreads } from "@/api/client";
import { isInPool } from "@/features/tarot/utils/cardPools";
import { completeReadingContext } from "@/host/readingContext";
import type { TarotHost, TarotAppSnapshot } from "@/host/tarotHost";
import SkyScene from "@/features/tarot/scene/SkyScene";
import type { SceneStage } from "@/features/tarot/scene/camera";
import HeaderBar from "@/app/components/HeaderBar";
import IntroSection from "@/features/tarot/components/IntroSection";
import InputSection from "@/features/tarot/components/InputSection";
import PickingSection from "@/features/tarot/components/PickingSection";
import ReadingSection from "@/features/tarot/components/ReadingSection";
import RitualCardStage from "@/features/tarot/components/RitualCardStage";
import DeckLibrary from "@/features/tarot/components/DeckLibrary";
import StatusToast from "@/shared/components/StatusToast";
import printTheReading, { renderReadingImage } from "@/features/tarot/utils/printTheReading";
import { useTarotAudio } from "@/features/tarot/hooks/useTarotAudio";
import { useResponsive } from "@/shared/hooks/useResponsive";
import { useTranslation } from "react-i18next";
import { Locale } from "@/i18n/types";
import { CardBackId, DEFAULT_CARD_BACK_ID } from "@/features/tarot/constants/cardBacks";
import {
  CardPack,
  DEFAULT_CARD_PACK_ID,
  findPackByCombination,
} from "@/features/tarot/constants/cardPacks";

import { dealReadingTable, selectLocalCard } from "@/features/tarot/utils/localDraw";

const App: React.FC<{ host?: TarotHost; initialSnapshot?: TarotAppSnapshot; briefSummary?: {readingId:string;text:string}; initialSetup?: {question: string; spread: SpreadType; revision: number; autoStart?: boolean} }> = ({ host, initialSnapshot, initialSetup, briefSummary }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;

  const { isMobile, isTablet, isShortViewport } = useResponsive();

  const {
    isAudioPlaying,
    hasPlayedIntroWelcomeRef,
    initAudio,
    stopVoice,
    playVoice,
    waitForVoiceToFinish,
    playIntroWelcome,
    prefetchStaticAudio,
  } = useTarotAudio(locale);

  const [savedReading] = useState(() => {
    if (host) return initialSnapshot;
    try { return restoreSnapshot(JSON.parse(sessionStorage.getItem('f-tarot-reading') ?? 'null')); }
    catch { return undefined; }
  });
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(savedReading?.stage ?? GameState.INTRO);
  const [previousGameState, setPreviousGameState] = useState<GameState | null>(
    null
  );

  // Input State
  const [question, setQuestion] = useState(savedReading?.question ?? "");
  const [spread, setSpread] = useState<SpreadType | null>(savedReading?.spread ?? initialSetup?.spread ?? null);

  // Game Data
  const [pickedCards, setPickedCards] = useState<PickedCard[]>(savedReading?.pickedCards ?? []);
  const [readingText, setReadingText] = useState<string>(savedReading?.readingText ?? "");
  const [revealedCardIds, setRevealedCardIds] = useState<Set<number>>(
    new Set(savedReading?.revealedCardIds)
  );

  const [briefStatus,setBriefStatus] = useState<'idle'|'pending'|'error'>('idle');
  const [hostError, setHostError] = useState("");
  const [apiError, setApiError] = useState("");
  const [apiDeck, setApiDeck] = useState<TarotCard[]>([]);

  // System State
  const [isThinking, setIsThinking] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardBackId, setCardBackId] = useState<CardBackId>(() => {
    const savedCardBack = preferences.getItem("f-tarot-card-back");
    return savedCardBack === "celestial-compass" ||
      savedCardBack === "eclipse-nocturne" ||
      savedCardBack === "thorn-bloom" ||
      savedCardBack === "sacred-geometry"
      ? savedCardBack
      : "eclipse-nocturne";
  });

  const [cardFaceStyle, setCardFaceStyle] = useState<CardFaceStyle>(() => {
    if (savedReading) return savedReading.cardFaceStyle;
    const saved = preferences.getItem("f-tarot-card-face-style");
    return saved === "original" || saved === "redraw" || saved === "dreamy"
      ? saved
      : "dreamy";
  });

  const [cardPackId, setCardPackId] = useState<string>(() => {
    const saved = preferences.getItem("f-tarot-card-pack");
    return saved || DEFAULT_CARD_PACK_ID;
  });

  const handleSelectPack = (pack: CardPack) => {
    setCardPackId(pack.id);
    setCardFaceStyle(pack.cardFaceStyle);
    setCardBackId(pack.cardBackId);
    preferences.setItem("f-tarot-card-pack", pack.id);
    preferences.setItem("f-tarot-card-face-style", pack.cardFaceStyle);
    preferences.setItem("f-tarot-card-back", pack.cardBackId);
  };

  const handleCardFaceStyleChange = (style: CardFaceStyle) => {
    setCardFaceStyle(style);
    const matched = findPackByCombination(style, cardBackId);
    const newPackId = matched ? matched.id : "custom";
    setCardPackId(newPackId);
    preferences.setItem("f-tarot-card-pack", newPackId);
  };

  const handleCardBackChange = (back: CardBackId) => {
    setCardBackId(back);
    const matched = findPackByCombination(cardFaceStyle, back);
    const newPackId = matched ? matched.id : "custom";
    setCardPackId(newPackId);
    preferences.setItem("f-tarot-card-pack", newPackId);
  };

  // Keep rapid successive clicks atomic before React renders the next state.
  const pickedCardsRef = useRef(pickedCards);
  const updatePickedCards = (cards: PickedCard[]) => {
    pickedCardsRef.current = cards;
    setPickedCards(cards);
  };
  // --- Refs ---
  // The card hidden behind each face-down tile, shuffled for every reading.
  const [tileCards, setTileCards] = useState<Map<number, PickedCard>>(() => new Map(savedReading?.dealtCards?.map(card => [card.visualId!, card])));
  // A refresh mid-pick can land on a table whose last pick already happened.
  const restoredPickingRef = useRef(savedReading?.stage === GameState.PICKING);
  const hiddenCardIdsRef = useRef<Set<number>>(new Set(savedReading?.pickedCards.map(card => card.visualId ?? card.id)));
  const summaryRequestedRef = useRef<string | undefined>(savedReading?.summaryRequested ? savedReading.readingId : undefined);
  const readingIdRef = useRef<string | undefined>(savedReading?.readingId);

  const loadDeck = async () => {
    setApiError("");
    try {
      const [response, remoteSpreads] = await Promise.all([loadApiDeck(locale), loadApiSpreads(locale)]);
      setApiDeck(response.cards);
      setSpread((current) => current ?? remoteSpreads[0]?.id ?? null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Could not load cards from the Tarot API.");
    }
  };

  useEffect(() => { void loadDeck(); }, []);

  useEffect(() => {
    if (!initialSetup) return;
    summaryRequestedRef.current = undefined;setBriefStatus('idle');
    readingIdRef.current = undefined;
    setTileCards(new Map());
    hiddenCardIdsRef.current.clear();
    setQuestion(initialSetup.question); setSpread(initialSetup.spread);
    updatePickedCards([]); setRevealedCardIds(new Set()); setReadingText("");
    setSelectedCardId(null); setIsThinking(false); setGameState(GameState.INPUT);
  }, [initialSetup?.revision]);

  useEffect(() => {
    if (!initialSnapshot) return;
    summaryRequestedRef.current = initialSnapshot.summaryRequested ? initialSnapshot.readingId : undefined;
    setBriefStatus(initialSnapshot.summaryRequested && !initialSnapshot.readingText ? 'pending' : 'idle');
    readingIdRef.current = initialSnapshot.readingId;
    setQuestion(initialSnapshot.question);
    setSpread(initialSnapshot.spread);
    updatePickedCards(initialSnapshot.pickedCards);
    setTileCards(new Map(initialSnapshot.dealtCards?.map(card => [card.visualId!, card])));
    restoredPickingRef.current = initialSnapshot.stage === GameState.PICKING;
    hiddenCardIdsRef.current = new Set(initialSnapshot.pickedCards.map(card => card.visualId ?? card.id));
    setRevealedCardIds(new Set(initialSnapshot.revealedCardIds));
    setCardFaceStyle(initialSnapshot.cardFaceStyle);
    setSelectedCardId(null); setReadingText(initialSnapshot.readingText ?? ''); setIsThinking(false);
    setGameState(initialSnapshot.stage);
    if (initialSnapshot.stage === GameState.PICKING && initialSnapshot.spread &&
      initialSnapshot.pickedCards.length === SPREADS[initialSnapshot.spread]?.cardCount) {
      setGameState(GameState.READING);
    }
  }, [initialSnapshot]);

  useEffect(() => {
    const state: TarotAppSnapshot = {version:1,readingId:readingIdRef.current,
      stage:gameState === GameState.LIBRARY ? previousGameState ?? GameState.INTRO : gameState,
      question,spread,pickedCards,readingText,
      ...(tileCards.size ? {dealtCards:[...tileCards.values()]} : {}),
      summaryRequested:!!readingIdRef.current && summaryRequestedRef.current===readingIdRef.current,
      revealedCardIds:[...revealedCardIds],cardFaceStyle};
    if (host?.reportState) {
      void host.reportState(state).catch(()=>setHostError(locale === 'zh-CN' ? '牌局状态未保存，请重试。' : 'Could not save this table state. Please retry.'));
    } else if (!host) {
      try { sessionStorage.setItem('f-tarot-reading',JSON.stringify(state)); } catch { /* Storage may be unavailable. */ }
    }
  }, [host,gameState,previousGameState,question,spread,pickedCards,tileCards,[...revealedCardIds].join(','),cardFaceStyle,readingText,briefStatus]);

  const attachCardContext = (id: number) => {
    const position = pickedCards.findIndex(card => card.id === id);
    if (!host?.attachCard || !spread || position < 0) return;
    void host.attachCard({question,spread,card:pickedCards[position],position:position + 1,locale})
      .then(()=>setHostError(''))
      .catch(()=>setHostError(locale === 'zh-CN' ? '卡牌上下文未发送，请再次点击卡牌重试。' : 'Could not attach this card. Click it again to retry.'));
  };

  useEffect(() => {
    preferences.setItem("f-tarot-card-back", cardBackId);
  }, [cardBackId]);

  useEffect(() => {
    preferences.setItem("f-tarot-card-face-style", cardFaceStyle);
  }, [cardFaceStyle]);

  // The face-down tiles a user can pick now: those hiding a card from the
  // current position's pool that has not been picked yet.
  const currentPool = (spread && SPREADS[spread]?.cardPools?.[pickedCards.length]) || "FULL";
  const activeDeck = useMemo(() => {
    if (gameState !== GameState.PICKING || !tileCards.size) return apiDeck;
    const pickedIds = new Set(pickedCards.map(card => card.id));
    return apiDeck.filter((tile) => {
      const card = tileCards.get(tile.id);
      return !!card && !pickedIds.has(card.id) && isInPool(card, currentPool);
    });
  }, [apiDeck, tileCards, gameState, pickedCards, currentPool]);

  useEffect(() => {
    if (gameState !== GameState.PICKING || !apiDeck.length || tileCards.size) return;
    const saved = pickedCardsRef.current;
    const remainingCards = apiDeck.filter(card => !saved.some(pick => pick.image === card.image));
    const remainingTiles = apiDeck.filter(tile => !saved.some(pick => (pick.visualId ?? pick.id) === tile.id));
    const dealt = dealReadingTable(remainingCards).map((card, index) => ({...card, visualId:remainingTiles[index].id}));
    setTileCards(new Map([...dealt, ...saved.map(card => ({...card, visualId:card.visualId ?? card.id}))].map(card => [card.visualId!, card])));
  }, [gameState, apiDeck, tileCards]);

  useEffect(() => {
    if (!restoredPickingRef.current || !spread || !SPREADS[spread] || !apiDeck.length) return;
    restoredPickingRef.current = false;
    if (gameState === GameState.PICKING && pickedCards.length === SPREADS[spread].cardCount) setGameState(GameState.READING);
  }, [apiDeck, spread, gameState, pickedCards.length]);

  // --- Flow Handlers ---
  const enterInputPhase = async () => {
    initAudio();
    setGameState(GameState.INPUT);
    prefetchStaticAudio();

    if (!hasPlayedIntroWelcomeRef.current) {
      await playIntroWelcome();
    } else {
      await waitForVoiceToFinish();
    }

  };

  const startRitual = async () => {
    if (isThinking || readingIdRef.current) return;
    setHostError("");
    setApiError("");
    if (spread === 'AUTO' && host?.requestSpread) {
      setIsThinking(true);
      try { await host.requestSpread(question, locale); }
      catch {
        setIsThinking(false);
        setHostError(locale === 'zh-CN' ? '智能牌阵请求未发送，请重试。' : 'Could not request a smart spread. Please retry.');
      }
      return;
    }
    const selectedSpread = spread && spread !== "AUTO" ? spread : Object.keys(SPREADS)[0];
    if (!selectedSpread) {
      setApiError(locale === 'zh-CN' ? '牌阵目录尚未加载。请重试。' : 'The spread catalog is not available yet. Please retry.');
      return;
    }
    if (selectedSpread !== spread) setSpread(selectedSpread);
    if (!apiDeck.length || !SPREADS[selectedSpread]) {
      setApiError(locale === 'zh-CN' ? '牌库 API 尚未连接。请检查服务地址后重试。' : 'The card API is unavailable. Check the service URL and retry.');
      return;
    }
    // Tags this reading so a summary the model writes back later lands only on this table.
    readingIdRef.current = crypto.randomUUID();
    setGameState(GameState.PICKING);
    updatePickedCards([]);
    setSelectedCardId(null);
    setRevealedCardIds(new Set());
    setReadingText("");
    hiddenCardIdsRef.current.clear();
    setTileCards(new Map(dealReadingTable(apiDeck).map(card => [card.visualId!, card])));

    playVoice("PICK", "pick");
    setIsThinking(false);
  };


  const autoStartedRevisionRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!initialSetup?.autoStart || autoStartedRevisionRef.current === initialSetup.revision ||
      gameState !== GameState.INPUT || isThinking || question !== initialSetup.question || spread !== initialSetup.spread) return;
    autoStartedRevisionRef.current = initialSetup.revision;
    void startRitual();
  }, [initialSetup,gameState,isThinking,question,spread]);

  useEffect(() => {
    if (briefSummary && briefSummary.readingId === readingIdRef.current) {
      setReadingText(briefSummary.text);setBriefStatus('idle');
    }
  }, [briefSummary]);

  const requestBriefSummary = async () => {
    if (!host?.summarize || !spread || !readingIdRef.current || briefStatus === 'pending' || readingText ||
      gameState !== GameState.READING || pickedCards.length !== SPREADS[spread]?.cardCount ||
      !pickedCards.every(card => revealedCardIds.has(card.id))) return;
    summaryRequestedRef.current = readingIdRef.current;setBriefStatus('pending');
    try { await host.summarize({readingId:readingIdRef.current,question,spread,cards:pickedCards,revealedCardIds:[...revealedCardIds],locale}); }
    catch { setBriefStatus('error'); }
  };
  useEffect(() => {
    if (briefStatus !== 'pending' || readingText) return;
    const timer=setTimeout(()=>setBriefStatus('error'),60000);
    return ()=>clearTimeout(timer);
  },[briefStatus,readingText]);

  const handleCardSelect = async (visualCard: TarotCard) => {
    if (isThinking || gameState !== GameState.PICKING) return;

    const requiredCards = SPREADS[spread!]?.cardCount;
    if (!requiredCards) return;
    if (pickedCardsRef.current.length >= requiredCards) return;

    if (hiddenCardIdsRef.current.has(visualCard.id)) return;

    const current = pickedCardsRef.current;
    const pools = SPREADS[spread!].cardPools ?? Array.from({length:requiredCards}, () => "FULL" as const);
    const newPicked = selectLocalCard(tileCards, current, visualCard.id, pools);
    if (newPicked === current) return;
    const card = newPicked[newPicked.length - 1];
    preload(getCardImageUrl(card.image, cardFaceStyle), { as: "image" });
    hiddenCardIdsRef.current.add(visualCard.id);

    updatePickedCards(newPicked);

    if (newPicked.length === requiredCards) {
      // Request expansion directly from the final user selection.
      void host?.expand?.().catch(() => {});
      // Long enough for the last card to land in its slot (0.45s), then a beat.
      const readingId = readingIdRef.current;
      setTimeout(() => { if (readingIdRef.current === readingId) startRevealProcess(); }, 600);
    }
  };

  const startRevealProcess = () => {
    setGameState(GameState.READING);
    playVoice("REVEAL", "reveal");
    setReadingText("");
    setIsThinking(false);
  };

  const resetRitual = () => {
    stopVoice();
    setGameState(GameState.INPUT);
    updatePickedCards([]);
    setSelectedCardId(null);
    setRevealedCardIds(new Set());
    setReadingText("");
    setQuestion("");
    summaryRequestedRef.current = undefined;setBriefStatus('idle');
    readingIdRef.current = undefined;
    setTileCards(new Map());
    setIsThinking(false);
    setPreviousGameState(null);
    playVoice("ASK", "ask");
  };

  const saveResult = host ? async () => host.saveResult(locale, readingText, await renderReadingImage({
    question, spread:spread!, pickedCards, readingText, locale, cardFaceStyle, cardBackId
  })) : printTheReading(
    question,
    spread!,
    pickedCards,
    readingText,
    locale,
    cardFaceStyle,
    cardBackId
  );

  const primaryActionRef = useRef<(() => void) | null>(null);
  const [inputConfirmed, setInputConfirmed] = useState(false);
  const [returningFromLibrary, setReturningFromLibrary] = useState(false);
  const toggleLibrary = () => {
    setReturningFromLibrary(gameState === GameState.LIBRARY);
    setSelectedCardId(null);
    if (gameState === GameState.LIBRARY) {
      if (previousGameState) {
        setGameState(previousGameState);
        setPreviousGameState(null);
      } else {
        setGameState(GameState.INTRO);
      }
    } else {
      setPreviousGameState(gameState);
      setGameState(GameState.LIBRARY);
    }
  };

  // The intro draws its own turning night sky, so the galaxy rests there.
  // Where the camera over the night world stands for each stage: the home
  // page's full view (the question keeps it, without the card), closer in
  // for the draw, and among the stars for the reading and the library.
  // The library overlays the current scene without moving its camera.
  const sceneGameState = gameState === GameState.LIBRARY
    ? previousGameState ?? GameState.INTRO
    : gameState;
  const sceneStage: SceneStage =
    sceneGameState === GameState.INTRO ? "intro"
    : sceneGameState === GameState.INPUT ? "input"
    : sceneGameState === GameState.PICKING ? "picking"
    : "reading";

  const renderPhase = () => {
    switch (gameState) {
      case GameState.INTRO:
        // Keyed so AnimatePresence plays its exit (the card flying off) while
        // the next stage appears; the other stages still swap as before.
        return <IntroSection quietEntrance={returningFromLibrary} key="intro" />;
      case GameState.LIBRARY:
        return (
          <DeckLibrary
            cards={apiDeck}
            selectedCardId={selectedCardId}
            isMobile={isMobile}
            isTablet={isTablet}
            onCardFocus={setSelectedCardId}
            cardBackId={cardBackId}
            onCardBackChange={handleCardBackChange}
            cardFaceStyle={cardFaceStyle}
            onCardFaceStyleChange={handleCardFaceStyleChange}
            cardPackId={cardPackId}
            onSelectPack={handleSelectPack}
          />
        );
      case GameState.INPUT:
        if (!apiDeck.length || (spread && !SPREADS[spread])) return <p role="status" className="fixed inset-x-0 top-1/2 z-[100] text-center text-sm text-white/60">{locale === 'zh-CN' ? '正在连接牌库…' : 'Connecting to the card library…'}</p>;
        return (
          <InputSection
            primaryActionRef={primaryActionRef}
            onConfirmationChange={setInputConfirmed}
            key="input"
            question={question}
            spread={spread}
            onQuestionChange={setQuestion}
            onSpreadChange={(value) => {setSpread(value);setIsThinking(false);}}
            onStartRitual={startRitual}
            isMobile={isMobile}
            isTablet={isTablet}
            isThinking={isThinking}
          />
        );
      case GameState.PICKING:
        if (!apiDeck.length || !spread || !SPREADS[spread]) return <p className="fixed inset-x-0 top-1/2 z-[100] text-center text-sm text-white/60">{locale === 'zh-CN' ? '正在恢复牌局…' : 'Restoring the reading…'}</p>;
        return (
          <PickingSection
            spread={spread}
            activeDeck={activeDeck}
            pickedCards={pickedCards}
            isMobile={isMobile}
            isTablet={isTablet}
            hoveredCardId={hoveredCardId}
            onCardHover={setHoveredCardId}
            onCardSelect={handleCardSelect}
            cardBackId={cardBackId}
          />
        );
      case GameState.REVEAL:
      case GameState.READING:
        if (!pickedCards.length) return null;
        if (!apiDeck.length || !spread || !SPREADS[spread]) return <p className="fixed inset-x-0 top-1/2 z-[100] text-center text-sm text-white/60">{locale === 'zh-CN' ? '正在恢复牌局…' : 'Restoring the reading…'}</p>;
        return (
          <ReadingSection
            spread={spread}
            pickedCards={pickedCards}
            revealedCardIds={revealedCardIds}
            isObscured={selectedCardId !== null}
            question={question}
            readingText={readingText}
            briefStatus={briefStatus}
            onRetryBrief={host?.summarize ? requestBriefSummary : undefined}
            onSaveResult={saveResult}
            savesToChat={!!host}
            onReset={resetRitual}
            onCopyContext={async () => {
              const context = completeReadingContext({question,spread,cards:pickedCards,revealedCardIds:[...revealedCardIds],locale});
              return `${locale === 'zh-CN' ? '请解读以下同一次牌局，给出具体可行的反思建议。不要重新抽牌，不作确定性预测。' : 'Interpret this same reading with practical reflection. Do not redraw or make certain predictions.'}\n\n${JSON.stringify(context, null, 2)}`;
            }}
            onInterpret={host ? () => host.interpret({question,spread:spread!,cards:pickedCards,revealedCardIds:[...revealedCardIds],locale}) : undefined}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] bg-black text-neutral-200 font-serif select-none cursor-default overflow-hidden">
      {/* One night world behind every stage; each stage frames part of it. */}
      <div className="absolute inset-0 z-0">
        <SkyScene stage={sceneStage} starsOnly={gameState === GameState.LIBRARY} />
      </div>
      <StatusToast
        open={!!apiError}
        variant="warning"
        title={t("errors.apiUnavailable")}
        message={apiError}
        action={{
          label: apiDeck.length && spread && SPREADS[spread] ? t("errors.retryReading") : t("errors.retryConnection"),
          onClick: () => apiDeck.length && spread && SPREADS[spread] ? void startRitual() : void loadDeck(),
        }}
      />

      {/* Header */}
      <motion.div
        animate={{
          opacity: selectedCardId === null ? 1 : 0,
          filter: selectedCardId === null ? "blur(0px)" : "blur(8px)",
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        // Fills the viewport: its animated filter makes it the box that the
        // header's fixed positioning measures from, top or bottom.
        className={`fixed inset-0 z-[60] pointer-events-none ${
          selectedCardId === null ? "" : "[&_*]:pointer-events-none!"
        }`}
      >
        <HeaderBar
          gameState={gameState === GameState.READING && revealedCardIds.size < pickedCards.length ? GameState.REVEAL : gameState}
          isAudioPlaying={isAudioPlaying}
          pickingCount={spread ? SPREADS[spread]?.cardCount ?? 0 : 0}
          pickedCount={pickedCards.length}
          onLibraryClick={toggleLibrary}
          onExpand={host?.expand}
          onHomeClick={() => {
            setSelectedCardId(null);
            setGameState(GameState.INTRO);
            setPreviousGameState(null);
          }}
        />
      </motion.div>

      {/* Main content uses the dynamic viewport so mobile browser chrome does not
          steal space from fixed-height layouts. */}
      <motion.main
        layoutScroll
        className={`absolute inset-0 ${selectedCardId !== null ? "z-[100]" : "z-10"} h-[100dvh] overflow-hidden overscroll-y-contain ${
          gameState === GameState.READING ||
          gameState === GameState.REVEAL ||
          gameState === GameState.INPUT ||
          gameState === GameState.LIBRARY
            ? "overflow-y-auto"
            : "overflow-hidden"
        }`}
      >
        {/* Scrollable phases start below the safe-area header instead of being
            vertically forced into a viewport that may be shorter than content. */}
        <div
          className={`relative w-full flex flex-col items-center px-4 ${
            gameState === GameState.READING ||
            gameState === GameState.REVEAL
              ? "min-h-full pt-[calc(var(--safe-top)+1rem)] pb-[calc(var(--safe-bottom)+3rem)] justify-start"
              : gameState === GameState.INPUT ||
                gameState === GameState.LIBRARY
              ? "min-h-full pt-[calc(var(--safe-top)+4.5rem)] pb-[calc(var(--safe-bottom)+3rem)] justify-start md:justify-center"
              : "h-full justify-center pt-[calc(var(--safe-top)+4rem)] pb-[calc(var(--safe-bottom)+2rem)]"
          }`}
        >
          <LayoutGroup id="ritual-cards">
            {(gameState === GameState.PICKING ||
              gameState === GameState.REVEAL ||
              gameState === GameState.READING) &&
              spread && apiDeck.length > 0 && SPREADS[spread] && (
                <RitualCardStage
                  gameState={gameState}
            spread={spread}
                  pickedCards={pickedCards}
                  revealedCardIds={revealedCardIds}
                  hoveredCardId={hoveredCardId}
                  selectedCardId={selectedCardId}
                  isMobile={isMobile}
                  isTablet={isTablet}
                  isShortViewport={isShortViewport}
                  onCardReveal={(id) => {
                    setRevealedCardIds((prev) => new Set(prev).add(id));
                    attachCardContext(id);
                  }}
                  onCardHover={setHoveredCardId}
                  onCardFocus={(id) => {
                    setSelectedCardId(id);
                    if (id !== null && revealedCardIds.has(id)) attachCardContext(id);
                  }}
                  cardBackId={cardBackId}
                  cardFaceStyle={cardFaceStyle}
                />
              )}
            <AnimatePresence mode={gameState === GameState.INPUT ? "wait" : "sync"}>{renderPhase()}</AnimatePresence>
          </LayoutGroup>
        </div>
      </motion.main>

      <AnimatePresence>
        {(gameState === GameState.INTRO || gameState === GameState.INPUT) && (
          <motion.div key="primary-draw-action"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-[calc((58%+100%-var(--safe-bottom)-4.5rem)/2)] z-50 -translate-x-1/2 -translate-y-1/2 md:top-[73%]"
          >
            <CircleActionButton
              label={gameState === GameState.INPUT && !inputConfirmed
                ? (spread ? t("input.confirmSpread") : t("input.selectSpread"))
                : isThinking ? t("input.divining") : t("actions.startDrawing")}
              disabled={gameState === GameState.INPUT && (!spread || isThinking)}
              onClick={gameState === GameState.INTRO ? enterInputPhase : () => primaryActionRef.current?.()}
            />
            {gameState === GameState.INTRO && <>
              <button type="button" onClick={() => void i18n.changeLanguage(locale === "en" ? "zh-CN" : "en")}
                aria-label={locale === "en" ? t("header.switchToChinese") : t("header.switchToEnglish")}
                className="absolute right-[calc(100%+2rem)] top-3 grid size-10 place-items-center rounded-full border border-white/20 text-white/70 md:hidden"><Languages size={17} strokeWidth={1.5} /></button>
              <button type="button" onClick={toggleLibrary} aria-label={t("header.openLibraryTitle")}
                className="absolute left-[calc(100%+2rem)] top-3 grid size-10 place-items-center rounded-full border border-white/20 text-white/70 md:hidden"><Library size={17} strokeWidth={1.5} /></button>
            </>}
          </motion.div>
        )}
      </AnimatePresence>

      {hostError && <div role="alert" className="fixed bottom-12 inset-x-4 z-[200] text-center text-sm text-red-200">{hostError}</div>}
      {/* Creator Credit (the intro carries its own) */}
      {gameState !== GameState.INTRO && <div className="fixed bottom-[calc(var(--safe-bottom)+0.75rem)] right-[calc(var(--safe-right)+1rem)] md:right-6 z-50 text-[9px] text-neutral-600 font-sans tracking-widest opacity-50 select-none pointer-events-none mix-blend-difference">
        Created by 范松海frank
      </div>}
    </div>
  );
};

export default App;
