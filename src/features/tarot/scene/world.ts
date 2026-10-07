/**
 * The night world behind every stage: one sky, one planet, one sea. Its
 * coordinates are "world pixels" — the viewport as it is framed on the home
 * page — and the camera (camera.ts) decides which part of it is on screen.
 */

/** Where the sky meets the water, as a fraction of the world's height. */
export const HORIZON_FRACTION = 0.58;

/** Viewports at least this wide use the desktop composition. */
const DESKTOP_MIN_WIDTH = 768;

export interface Planet {
  /** Centre and radius in world pixels. */
  cx: number;
  cy: number;
  r: number;
}

/**
 * A planet larger than the screen is tall, centred left of the card so only
 * its upper-right limb shows. Sized from the viewport height, placed so the
 * limb's rightmost point sits at a fixed share of the width.
 */
export const getPlanet = (width: number, height: number): Planet => {
  const r = height * 0.565;
  const rimX = width * (width >= DESKTOP_MIN_WIDTH ? 0.766 : 0.94);
  return { cx: rimX - r, cy: height * 0.476, r };
};

/** The limb's lit arc in canvas angles (0 = right, negative = up). */
export const PLANET_LIT_ARC = { from: -Math.PI * 0.62, to: Math.PI * 0.06 };

/** The night sky's colour from zenith to horizon: near black, then a navy haze. */
export const SKY_STOPS: [number, string][] = [
  [0, "#020308"],
  [0.55, "#03050d"],
  [0.88, "#070b1a"],
  [1, "#0f1630"],
];

/** The sea's own colour, under the reflections the sea shader adds. */
export const SEA_STOPS: [number, string][] = [
  [0, "#05070e"],
  [1, "#010103"],
];

/**
 * The celestial pole the stars turn about, placed high on the left so stars
 * further out rise and set at the horizon. Real time is 15°/hour; this is a
 * gentle time-lapse of one turn in 30 minutes.
 */
export const POLE = { x: 0.2, y: 0.14 };
export const TURN_SECONDS = 1800;
