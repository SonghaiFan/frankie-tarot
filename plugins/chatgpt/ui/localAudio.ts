// Plugin mode uses ChatGPT for interpretation; preserve the original prerecorded voice.
import { loadLocalAudio, getStaticAudioFilename } from "@/features/tarot/services/audio";
import type { Locale, PickedCard, SpreadType } from "@/features/tarot/types";
export const hasAiKey = () => false;
export const predictBestSpread = async (_question: string, _locale: Locale): Promise<SpreadType> => "SINGLE";
export const generateTarotReading = async (_cards: PickedCard[], _spread: SpreadType, _question: string, _locale: Locale) => "";
export const generateSpeech = async (_text: string, context: AudioContext, key?: string, locale: Locale = "zh-CN") =>
  key ? loadLocalAudio(getStaticAudioFilename(key, locale), context) : null;
