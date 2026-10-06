import { preferences } from "@/shared/storage";

export interface CardBackAppearance {
  mode: "gradient" | "solid";
  colors: string[];
  solidColor: string;
}

export const MAX_AURA_COLORS = 16;
export const DEFAULT_AURA_COLORS = [
  "#1a63d4", "#b8b2d6", "#efe4c6", "#ffae78", "#ff6424", "#ef5577",
  "#8a5ccc", "#ffa03a", "#22a862", "#0e9b8c", "#2a63d8",
];
export const DEFAULT_CARD_BACK_APPEARANCE: CardBackAppearance = {
  mode: "gradient",
  colors: DEFAULT_AURA_COLORS,
  solidColor: "#1a63d4",
};
const STORAGE_KEY = "f-tarot-card-back-appearance";
const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function normalizeCardBackAppearance(value: unknown): CardBackAppearance {
  const saved = value as Partial<CardBackAppearance> | null;
  const colors = Array.isArray(saved?.colors)
    ? saved.colors.filter(isColor).slice(0, MAX_AURA_COLORS)
    : [];
  return {
    mode: saved?.mode === "solid" ? "solid" : "gradient",
    colors: colors.length >= 2 ? colors : [...DEFAULT_AURA_COLORS],
    solidColor: isColor(saved?.solidColor) ? saved.solidColor : DEFAULT_CARD_BACK_APPEARANCE.solidColor,
  };
}

// Resample to the shader's eleven color roles, retaining the original field
// exactly at the default palette while supporting any number of custom colors.
export function getAuraColorChannels(colors: readonly string[]): Float32Array {
  const channels = colors.map((hex) => [1, 3, 5].map((offset) =>
    parseInt(hex.slice(offset, offset + 2), 16) / 255
  ));
  return new Float32Array(DEFAULT_AURA_COLORS.flatMap((_, index) => {
    const position = index * (colors.length - 1) / (DEFAULT_AURA_COLORS.length - 1);
    const left = Math.floor(position);
    const right = Math.min(left + 1, colors.length - 1);
    const amount = position - left;
    return channels[left].map((channel, component) =>
      channel + (channels[right][component] - channel) * amount
    );
  }));
}

let appearance = DEFAULT_CARD_BACK_APPEARANCE;
try {
  appearance = normalizeCardBackAppearance(JSON.parse(preferences.getItem(STORAGE_KEY) ?? "null"));
} catch { /* Invalid saved settings fall back to the original palette. */ }
const listeners = new Set<() => void>();

export const getCardBackAppearance = () => appearance;
export const subscribeCardBackAppearance = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const setCardBackAppearance = (next: CardBackAppearance) => {
  appearance = normalizeCardBackAppearance(next);
  preferences.setItem(STORAGE_KEY, JSON.stringify(appearance));
  listeners.forEach((listener) => listener());
};
