import { type View, viewTransform } from "./camera";
import { HORIZON_FRACTION, POLE, TURN_SECONDS } from "./world";

/**
 * The stars, turning about the pole. Like looking through a telescope, they
 * stay points at any zoom, and zooming in reveals fainter ones: the number
 * drawn grows with the zoom², so the sky keeps its density instead of
 * thinning out as the camera moves in.
 */

/** Stars generated; enough for the deepest shot. */
const STAR_COUNT = 20000;
/** Stars shown at zoom 1 within the original home-page reach (the old density). */
const HOME_STAR_COUNT = 900;
/** The newest tenth of the visible stars fades in as the camera moves in. */
const REVEAL_BAND = 0.1;

interface Star {
  /** Distance from the pole as a share of the reach (uniform over the disc). */
  radius: number;
  angle: number;
  size: number;
  brightness: number;
  color: string;
  twinkle: number;
}

/** Star colours: white, and faint blue and warm tints. */
const COLOURS = ["255,255,255", "214,226,255", "255,236,214", "198,214,255"];

// A fixed seed keeps the same sky between visits.
const createStars = () => {
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: STAR_COUNT }, (): Star => {
    const magnitude = Math.pow(random(), 3.2); // Mostly faint, a few bright.
    return {
      radius: Math.sqrt(random()),
      angle: random() * Math.PI * 2,
      size: 0.35 + magnitude * 1.5,
      brightness: 0.18 + magnitude * 0.82,
      color: COLOURS[Math.floor(random() * COLOURS.length)],
      twinkle: random() * Math.PI * 2,
    };
  });
};

const stars = createStars();
// Each star's offset from the pole at rest (in units of the reach): the whole
// sky turns by one angle, so a frame needs one rotation, not a sin/cos per star.
const unitX = Float32Array.from(stars, (star) => Math.cos(star.angle) * star.radius);
const unitY = Float32Array.from(stars, (star) => Math.sin(star.angle) * star.radius);
const colourIndex = Uint8Array.from(stars, (star) => COLOURS.indexOf(star.color));

// Stars are drawn in batches: one fill per colour × brightness step instead of
// one per star. Eight brightness steps are finer than the eye can tell apart.
const ALPHA_STEPS = 8;
const batches = Array.from({ length: COLOURS.length * ALPHA_STEPS }, () => [] as number[]);
// Below this radius (device px) a star is drawn as a square: the same to the eye, cheaper.
const DOT_AS_SQUARE = 1.3;

/**
 * How far from the pole stars are scattered, in world pixels: far enough to
 * fill every shot the camera takes: the whole world, plus the sky up to
 * 0.6× its height above the top, where the reading's shot looks.
 */
const starReach = (width: number, height: number) => {
  const dx = Math.max(POLE.x, 1 - POLE.x) * width;
  return Math.max(
    Math.hypot(dx, POLE.y * height + 0.6 * height),
    Math.hypot(dx, (HORIZON_FRACTION - POLE.y) * height),
  ) * 1.05;
};

/** The reach the home page's 900 stars were spread over. */
const homeReach = (width: number, height: number) =>
  Math.hypot(Math.max(POLE.x, 1 - POLE.x) * width, (HORIZON_FRACTION - POLE.y) * height);

export const paintStars = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: View,
  dpr: number,
  seconds: number,
  animated: boolean,
) => {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);

  const reach = starReach(width, height);
  const densityScale = (reach / homeReach(width, height)) ** 2;
  const count = Math.min(STAR_COUNT, Math.round(HOME_STAR_COUNT * densityScale * view.zoom ** 2));
  const revealFrom = count * (1 - REVEAL_BAND);

  const { scale, dx, dy } = viewTransform(width, height, view, dpr);
  const poleX = width * POLE.x;
  const poleY = height * POLE.y;
  const horizonY = height * HORIZON_FRACTION;
  // Counter-clockwise on screen, as the northern sky turns.
  const turn = animated ? -(seconds / TURN_SECONDS) * Math.PI * 2 : 0;
  const screenWidth = context.canvas.width;
  const screenHeight = context.canvas.height;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);

  for (const batch of batches) batch.length = 0;
  for (let i = 0; i < count; i++) {
    const offsetX = (unitX[i] * cos - unitY[i] * sin) * reach;
    const offsetY = (unitX[i] * sin + unitY[i] * cos) * reach;
    const worldY = poleY + offsetY;
    if (worldY > horizonY) continue; // Set below the sea.
    const x = (poleX + offsetX) * scale + dx;
    const y = worldY * scale + dy;
    if (x < -8 || x > screenWidth + 8 || y < -8 || y > screenHeight + 8) continue;

    // Dimmed by thicker air near the horizon, with a slow shimmer; the
    // faintest newly revealed stars ease in as the camera moves closer.
    const star = stars[i];
    const extinction = Math.min(1, Math.max(0, (horizonY - worldY) / (height * 0.18)));
    const shimmer = animated ? 0.85 + 0.15 * Math.sin(seconds * 1.7 + star.twinkle) : 1;
    const reveal = i < revealFrom ? 1 : (count - i) / Math.max(1, count - revealFrom);
    const alpha = star.brightness * shimmer * (0.25 + 0.75 * extinction) * reveal;
    const step = Math.min(ALPHA_STEPS - 1, Math.floor(alpha * ALPHA_STEPS));
    if (step < 0 || alpha <= 0.01) continue;
    batches[colourIndex[i] * ALPHA_STEPS + step].push(x, y, star.size * dpr);
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    if (!batch.length) continue;
    const colour = COLOURS[Math.floor(b / ALPHA_STEPS)];
    const alpha = ((b % ALPHA_STEPS) + 0.5) / ALPHA_STEPS;
    context.fillStyle = `rgba(${colour},${alpha})`;
    context.beginPath();
    for (let j = 0; j < batch.length; j += 3) {
      const x = batch[j];
      const y = batch[j + 1];
      const r = batch[j + 2];
      if (r < DOT_AS_SQUARE) {
        context.rect(x - r, y - r, r * 2, r * 2);
      } else {
        context.moveTo(x + r, y);
        context.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    context.fill();
  }
};
