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
  CardPoolType,
  CardFaceStyle,
} from "@/features/tarot/types";
import { DEFAULT_CARD_FACE_STYLE } from "@/features/tarot/constants/cardFaceStyles";
import {
  FULL_DECK,
  getDeckForPool,
  getCardImageUrl,
} from "@/features/tarot/constants/cards";
import { SPREADS } from "@/features/tarot/constants/spreads";
import { drawCards } from "@/core/tarotEngine";
import type { TarotHost, HostedReading } from "@/host/tarotHost";
import Galaxy from "@/app/components/Galaxy";
import HeaderBar from "@/app/components/HeaderBar";
import IntroSection from "@/features/tarot/components/IntroSection";
import InputSection from "@/features/tarot/components/InputSection";
import PickingSection from "@/features/tarot/components/PickingSection";
import ReadingSection from "@/features/tarot/components/ReadingSection";
import RitualCardStage from "@/features/tarot/components/RitualCardStage";
import DeckLibrary from "@/features/tarot/components/DeckLibrary";
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

const App: React.FC<{ host?: TarotHost; initialReading?: HostedReading; initialSetup?: {question: string; spread: SpreadType; revision: number} }> = ({ host, initialReading, initialSetup }) => {
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

  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.INTRO);
  const [previousGameState, setPreviousGameState] = useState<GameState | null>(
    null
  );

  // Input State
  const [question, setQuestion] = useState("");
  const [spread, setSpread] = useState<SpreadType | null>(host ? "THREE" : "SINGLE");

  // Game Data
  const [pickedCards, setPickedCards] = useState<PickedCard[]>([]);
  const [readingText, setReadingText] = useState<string>("");
  const [revealedCardIds, setRevealedCardIds] = useState<Set<number>>(
    new Set()
  );

  const [hostError, setHostError] = useState("");

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

  // --- Refs ---
  const predeterminedCardsRef = useRef<PickedCard[]>([]);
  const predeterminedCardsIndexRef = useRef<number>(0);
  const hiddenCardIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!initialReading) return;
    setQuestion(initialReading.question);
    setSpread(initialReading.spread);
    const picking = initialReading.stage === 'picking';
    setPickedCards(picking ? [] : initialReading.cards);
    predeterminedCardsRef.current = initialReading.cards;
    predeterminedCardsIndexRef.current = 0;
    hiddenCardIdsRef.current.clear();
    setRevealedCardIds(new Set(initialReading.revealedCardIds ?? []));
    setSelectedCardId(null);
    setReadingText(initialReading.interpretation ?? "");
    if (initialReading.cardFaceStyle) setCardFaceStyle(initialReading.cardFaceStyle);
    setIsThinking(false);
    setHostError("");
    setGameState(initialReading.stage === 'picking' ? GameState.PICKING : GameState.READING);
  }, [initialReading?.id, initialReading?.revealedCardIds?.join(','), initialReading?.interpretation, initialReading?.cardFaceStyle]);

  useEffect(() => {
    if (!initialSetup) return;
    setQuestion(initialSetup.question); setSpread(initialSetup.spread);
    setPickedCards([]); setRevealedCardIds(new Set()); setReadingText("");
    setSelectedCardId(null); setIsThinking(false); setGameState(GameState.INPUT);
  }, [initialSetup?.revision]);

  useEffect(() => {
    if (!host?.reportState) return;
    const timer = setTimeout(() => {
      void host.reportState!({stage:gameState,question,spread,revealedCardIds:[...revealedCardIds],pickedCount:pickedCards.length,cardFaceStyle})
        .then(()=>setHostError(""))
        .catch(()=>setHostError(locale === 'zh-CN' ? '翻牌进度未同步，请再次点击解读重试。' : 'Progress could not sync. Use Interpret to retry.'));
    }, 150);
    return ()=>clearTimeout(timer);
  }, [host,gameState,question,spread,pickedCards.length,[...revealedCardIds].join(','),cardFaceStyle]);

  useEffect(() => {
    preferences.setItem("f-tarot-card-back", cardBackId);
  }, [cardBackId]);

  useEffect(() => {
    preferences.setItem("f-tarot-card-face-style", cardFaceStyle);
  }, [cardFaceStyle]);

  // --- Computed Deck ---
  const activeDeck = useMemo(() => {
    if (!spread) return FULL_DECK;

    const spreadDef = SPREADS[spread];

    if (pickedCards.length >= spreadDef.cardCount) {
      return [];
    }

    const currentStep = pickedCards.length;
    let poolType: CardPoolType = "FULL";
    if (spreadDef.cardPools && spreadDef.cardPools[currentStep]) {
      poolType = spreadDef.cardPools[currentStep];
    }

    return getDeckForPool(poolType);
  }, [spread, pickedCards.length]);

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
    if (isThinking) return;
    setHostError("");
    const selectedSpread = !spread || spread === "AUTO" ? "SINGLE" : spread;
    if (selectedSpread !== spread) setSpread(selectedSpread);

    let targets: PickedCard[];
    if (host) {
      setIsThinking(true);
      try {
        targets = (await host.draw(question, selectedSpread, locale)).cards;
      } catch (error) {
        console.error("Hosted tarot draw failed", error);
        const detail = error instanceof Error ? error.message : String(error);
        setHostError(locale === "zh-CN" ? `抽牌没有完成：${detail}` : `The draw did not complete: ${detail}`);
        return;
      } finally { setIsThinking(false); }
    } else {
      targets = drawCards(selectedSpread);
    }
    setGameState(GameState.PICKING);
    setPickedCards([]);
    setSelectedCardId(null);
    setRevealedCardIds(new Set());
    setReadingText("");
    hiddenCardIdsRef.current.clear();

    predeterminedCardsRef.current = targets;
    predeterminedCardsIndexRef.current = 0;

    targets.forEach((card) => {
      const url = getCardImageUrl(card.image, cardFaceStyle);
      preload(url, { as: "image" });
      const img = new Image();
      img.src = url;
    });

    playVoice("PICK", "pick");
  };

  const handleCardSelect = async (visualCard: TarotCard) => {
    if (isThinking || gameState !== GameState.PICKING) return;

    const requiredCards = SPREADS[spread!].cardCount;
    if (pickedCards.length >= requiredCards) return;

    if (hiddenCardIdsRef.current.has(visualCard.id)) return;

    const targetIndex = predeterminedCardsIndexRef.current;
    if (targetIndex >= predeterminedCardsRef.current.length) return;

    const targetCard = predeterminedCardsRef.current[targetIndex];
    predeterminedCardsIndexRef.current++;

    const hybridCard: PickedCard = {
      ...targetCard,
      visualId: visualCard.id,
    };

    hiddenCardIdsRef.current.add(visualCard.id);

    const newPicked: PickedCard[] = [...pickedCards, hybridCard];
    setPickedCards(newPicked);

    if (newPicked.length === requiredCards) {
      setTimeout(startRevealProcess, 1000);
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
    setPickedCards([]);
    setSelectedCardId(null);
    setRevealedCardIds(new Set());
    setReadingText("");
    setQuestion("");
    setIsThinking(false);
    setPreviousGameState(null);
    playVoice("ASK", "ask");
  };

  const saveResult = host ? async () => host.saveResult(locale, readingText, await renderReadingImage({
    question, spread:spread!, pickedCards, readingText, locale, cardFaceStyle
  })) : printTheReading(
    question,
    spread!,
    pickedCards,
    readingText,
    locale,
    cardFaceStyle
  );

  const toggleLibrary = () => {
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

  const bgOpacity = gameState === GameState.INTRO ? 0.9 : 0.3;

  const renderPhase = () => {
    switch (gameState) {
      case GameState.INTRO:
        return <IntroSection onEnter={enterInputPhase} />;
      case GameState.LIBRARY:
        return (
          <DeckLibrary
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
        return (
          <InputSection
            question={question}
            spread={spread}
            onQuestionChange={setQuestion}
            onSpreadChange={setSpread}
            onStartRitual={startRitual}
            isMobile={isMobile}
            isTablet={isTablet}
            isThinking={isThinking}
          />
        );
      case GameState.PICKING:
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
        return (
          <ReadingSection
            spread={spread}
            pickedCards={pickedCards}
            revealedCardIds={revealedCardIds}
            isObscured={selectedCardId !== null}
            question={question}
            readingText={readingText}
            onSaveResult={saveResult}
            savesToChat={!!host}
            onReset={resetRitual}
            onInterpret={host ? () => host.interpret(locale) : undefined}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] bg-black text-neutral-200 font-serif select-none cursor-default overflow-hidden">
      {/* Galaxy Background (Persistent) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: bgOpacity }}
        transition={{ duration: 2 }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <Galaxy
          speed={
            gameState === GameState.PICKING
              ? 0.2
              : gameState === GameState.READING
              ? 0.15
              : gameState === GameState.REVEAL
              ? 0.8
              : 1.0
          }
          hueShift={260}
          saturation={
            hoveredCardId !== null && gameState === GameState.READING
              ? 0.9
              : 0.15
          }
          density={1.05}
          glowIntensity={
            hoveredCardId !== null && gameState === GameState.READING
              ? 0.5
              : 0.22
          }
          twinkleIntensity={0.18}
          rotationSpeed={0.08}
          mouseRepulsion={false}
          mouseInteraction={false}
          transparent={true}
        />
      </motion.div>

      {/* Header */}
      <motion.div
        animate={{
          opacity: selectedCardId === null ? 1 : 0,
          filter: selectedCardId === null ? "blur(0px)" : "blur(8px)",
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-[60] ${
          selectedCardId === null ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <HeaderBar
          gameState={gameState === GameState.READING && revealedCardIds.size < pickedCards.length ? GameState.REVEAL : gameState}
          isAudioPlaying={isAudioPlaying}
          pickingCount={spread ? SPREADS[spread].cardCount : 0}
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
              spread && (
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
                  onCardReveal={(id) =>
                    setRevealedCardIds((prev) => new Set(prev).add(id))
                  }
                  onCardHover={setHoveredCardId}
                  onCardFocus={setSelectedCardId}
                  cardBackId={cardBackId}
                  cardFaceStyle={cardFaceStyle}
                />
              )}
            <AnimatePresence mode="sync">{renderPhase()}</AnimatePresence>
          </LayoutGroup>
        </div>
      </motion.main>

      {hostError && <div role="alert" className="fixed bottom-12 inset-x-4 z-[200] text-center text-sm text-red-200">{hostError}</div>}
      {/* Creator Credit */}
      <div className="fixed bottom-[calc(var(--safe-bottom)+0.75rem)] right-[calc(var(--safe-right)+1rem)] md:right-6 z-50 text-[9px] text-neutral-600 font-sans tracking-widest opacity-50 select-none pointer-events-none mix-blend-difference">
        Created by 范松海frank
      </div>
    </div>
  );
};

export default App;
