import { useSyncExternalStore } from "react";
import { preferences } from "@/shared/storage";
import { CARD_BACKS, type CardBackId } from "../constants/cardBacks";

export const CARD_FRAME_PRESETS = { none: 0, thin: 1, standard: 2, wide: 4 } as const;
export type CardFramePreset = keyof typeof CARD_FRAME_PRESETS;
const storageKey = "f-tarot-card-frames";
const saved: Partial<Record<CardBackId, CardFramePreset>> = {};
try {
  const value = JSON.parse(preferences.getItem(storageKey) ?? "{}");
  for (const { id } of CARD_BACKS) {
    if (Object.hasOwn(CARD_FRAME_PRESETS, value?.[id])) saved[id] = value[id];
  }
} catch { /* Use the theme defaults for invalid stored preferences. */ }
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const setCardFrame = (id: CardBackId, preset: CardFramePreset) => {
  saved[id] = preset;
  preferences.setItem(storageKey, JSON.stringify(saved));
  listeners.forEach(listener => listener());
};

export function useCardFrame(id: CardBackId) {
  const preset = useSyncExternalStore(subscribe, () => saved[id] ?? (id === "eclipse-nocturne" ? "none" : "standard"));
  const width = CARD_FRAME_PRESETS[preset];
  // CSS percentage padding uses the card width on both axes (7:12 card).
  const verticalInset = width * 7 / 12;
  const innerRadius = `${(7 - width) / (100 - width * 2) * 100}% / ${(4.1 - verticalInset) / (100 - verticalInset * 2) * 100}%`;
  return { preset, padding: `${width}%`, innerRadius };
}
