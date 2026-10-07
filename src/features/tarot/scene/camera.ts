import { animate, motionValue } from "motion/react";
import { SILKY_EASE } from "@/shared/constants/ui";
import { HORIZON_FRACTION } from "./world";

/**
 * The camera over the night world. Each stage of the reading frames a
 * different part of the same world, and moving between stages moves the
 * camera — so the sky the user started under is the sky they read under.
 */
export type SceneStage = "intro" | "input" | "picking" | "reading";

export interface View {
  /** Magnification of the world; 1 frames it as on the home page. */
  zoom: number;
  /** The world point held at the centre of the screen, as a fraction of the world's width and height. */
  x: number;
  y: number;
}

export interface Shot extends View {
  /** The hero card's light on the horizon: 1 while it floats there, 0 once it has gone. */
  cardLight: number;
  /** A dark veil over the scene, so text in front of it stays easy to read. */
  veil: number;
}

/** Where the horizon lands on screen (fraction of the height) for a given zoom and centre. */
const centreForHorizon = (zoom: number, screenY: number) =>
  HORIZON_FRACTION - (screenY - 0.5) / zoom;

export const SHOTS: Record<SceneStage, Shot> = {
  // The whole composition: sky, planet, card and sea.
  intro: { zoom: 1, x: 0.5, y: 0.5, cardLight: 1, veil: 0 },
  // The same view: only the card has flown off, taking its light with it.
  input: { zoom: 1, x: 0.5, y: 0.5, cardLight: 0, veil: 0.12 },
  // The deck is already laid out in open sky; the camera frames it in place.
  picking: { zoom: 2.4, x: 0.5, y: -0.36, cardLight: 0, veil: 0.2 },
  // Keep the same centred sky framing while the cards are read.
  reading: { zoom: 2.4, x: 0.5, y: -0.36, cardLight: 0, veil: 0.3 },
};

/** The camera's live values, shared by everything that draws the world. */
export const camera = {
  zoom: motionValue(SHOTS.intro.zoom),
  x: motionValue(SHOTS.intro.x),
  y: motionValue(SHOTS.intro.y),
  cardLight: motionValue(SHOTS.intro.cardLight),
  veil: motionValue(SHOTS.intro.veil),
};

/**
 * One move for everything that travels between stages — the camera and the
 * UI arriving with it (e.g. the deck flying in) — so they set off and land
 * together: a quick, decisive start and a clean landing.
 */
export const SCENE_MOVE = { duration: 1, ease: SILKY_EASE };

/** Moves the camera to a stage's shot; instantly if motion is reduced. */
export const frameStage = (stage: SceneStage, instant = false) => {
  const shot = SHOTS[stage];
  const controls = (Object.keys(camera) as (keyof Shot)[]).map((key) =>
    instant
      ? (camera[key].set(shot[key]), undefined)
      : animate(camera[key], shot[key], key === "cardLight" ? { duration: 0.5, ease: "easeOut" } : SCENE_MOVE),
  );
  return () => controls.forEach((control) => control?.stop());
};

export const readView = (): View => ({ zoom: camera.zoom.get(), x: camera.x.get(), y: camera.y.get() });

/**
 * World → screen: a uniform scale about the camera's centre. Returned as a
 * canvas transform (device pixels) so painters draw in world pixels.
 */
export const viewTransform = (width: number, height: number, view: View, dpr: number) => {
  const scale = view.zoom * dpr;
  return {
    scale,
    dx: dpr * (width / 2 - view.x * width * view.zoom),
    dy: dpr * (height / 2 - view.y * height * view.zoom),
  };
};

/** The rectangle of the world (in world pixels) currently on screen. */
export const visibleWorld = (width: number, height: number, view: View) => {
  const halfWidth = width / (2 * view.zoom);
  const halfHeight = height / (2 * view.zoom);
  return {
    left: view.x * width - halfWidth,
    right: view.x * width + halfWidth,
    top: view.y * height - halfHeight,
    bottom: view.y * height + halfHeight,
  };
};

/** The horizon's position on screen, as a fraction of the screen's height (may be off screen). */
export const horizonOnScreen = (view: View) => (HORIZON_FRACTION - view.y) * view.zoom + 0.5;
