import { useSyncExternalStore } from "react";
import { getCardBackAppearance, subscribeCardBackAppearance } from "@/features/tarot/services/cardBackAppearance";

export const useCardBackAppearance = () =>
  useSyncExternalStore(subscribeCardBackAppearance, getCardBackAppearance);
