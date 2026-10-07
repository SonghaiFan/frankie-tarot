import { HORIZON_FRACTION, PLANET_LIT_ARC, SEA_STOPS, SKY_STOPS, getPlanet } from "./world";
import { type View, viewTransform, visibleWorld } from "./camera";

/**
 * Painters for the parts of the world that only change when the camera moves
 * or the window resizes: the sky and sea colour, the planet, and the
 * horizon's light. They draw in world pixels through the camera transform;
 * strokes and blurs are divided by the zoom so they stay crisp and constant
 * on screen.
 */

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const applyView = (context: CanvasRenderingContext2D, width: number, height: number, view: View, dpr: number) => {
  const { scale, dx, dy } = viewTransform(width, height, view, dpr);
  context.setTransform(scale, 0, 0, scale, dx, dy);
};

/** Sky above the horizon, the sea's base colour below it. */
export const paintBackdrop = (context: CanvasRenderingContext2D, width: number, height: number, view: View, dpr: number, fullSky = false) => {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  applyView(context, width, height, view, dpr);
  const area = visibleWorld(width, height, view);
  const horizonY = fullSky ? Math.max(height, area.bottom) : height * HORIZON_FRACTION;

  const sky = context.createLinearGradient(0, 0, 0, horizonY);
  for (const [at, color] of SKY_STOPS) sky.addColorStop(at, color);
  context.fillStyle = sky;
  context.fillRect(area.left, area.top, area.right - area.left, Math.max(0, Math.min(area.bottom, horizonY) - area.top));

  if (area.bottom > horizonY) {
    const sea = context.createLinearGradient(0, horizonY, 0, height);
    for (const [at, color] of SEA_STOPS) sea.addColorStop(at, color);
    context.fillStyle = sea;
    context.fillRect(area.left, horizonY, area.right - area.left, area.bottom - horizonY);
  }
};

// The planet is backlit from the upper right; its limb is brightest there.
const LIT_DIRECTION = (PLANET_LIT_ARC.from + PLANET_LIT_ARC.to) / 2;

/**
 * The planet: an opaque dark body hiding the stars, a blue atmosphere just
 * inside the lit limb and a soft glow outside it (both fading out toward the
 * unlit lower left), and a thin warm rim line that fades at both ends. Drawn
 * in a scratch layer so the fade can composite against the planet alone.
 */
export const paintPlanet = (
  context: CanvasRenderingContext2D,
  layerCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  view: View,
  dpr: number,
) => {
  const { cx, cy, r } = getPlanet(width, height);
  const horizonY = height * HORIZON_FRACTION;
  const area = visibleWorld(width, height, view);
  // Entirely out of frame: nothing to draw.
  if (cx + r * 1.1 < area.left || cx - r * 1.1 > area.right || cy - r * 1.1 > area.bottom || cy + r * 1.1 < area.top) return;

  if (layerCanvas.width !== context.canvas.width || layerCanvas.height !== context.canvas.height) {
    layerCanvas.width = context.canvas.width;
    layerCanvas.height = context.canvas.height;
  }
  const layer = layerCanvas.getContext("2d");
  if (!layer) return;
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
  // Clips accumulate on a reused canvas: scope this frame's to save/restore.
  layer.save();
  applyView(layer, width, height, view, dpr);
  // The planet sets into the sea: nothing of it below the horizon.
  layer.beginPath();
  layer.rect(area.left, area.top, area.right - area.left, Math.max(0, horizonY - area.top));
  layer.clip();

  // Atmosphere: a blue band just inside the limb and a glow just outside it.
  const atmosphere = layer.createRadialGradient(cx, cy, r * 0.78, cx, cy, r * 1.09);
  atmosphere.addColorStop(0, "rgba(40,56,110,0)");
  atmosphere.addColorStop(0.5, "rgba(56,74,140,0.42)");
  atmosphere.addColorStop(0.69, "rgba(125,145,225,0.62)");
  atmosphere.addColorStop(0.71, "rgba(130,150,235,0.3)");
  atmosphere.addColorStop(1, "rgba(130,150,235,0)");
  layer.fillStyle = atmosphere;
  layer.beginPath();
  layer.arc(cx, cy, r * 1.09, 0, Math.PI * 2);
  layer.fill();

  // Only the lit side glows: fade it out toward the unlit lower left.
  const fade = layer.createLinearGradient(
    cx - Math.cos(LIT_DIRECTION) * r, cy - Math.sin(LIT_DIRECTION) * r,
    cx + Math.cos(LIT_DIRECTION) * r, cy + Math.sin(LIT_DIRECTION) * r,
  );
  fade.addColorStop(0.35, "rgba(0,0,0,0)");
  fade.addColorStop(0.85, "rgba(0,0,0,0.8)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  layer.globalCompositeOperation = "destination-in";
  layer.fillStyle = fade;
  layer.fillRect(area.left, area.top, area.right - area.left, area.bottom - area.top);

  // Underneath it all, the body: opaque, so it hides the stars behind it.
  layer.globalCompositeOperation = "destination-over";
  layer.fillStyle = "#03040b";
  layer.beginPath();
  layer.arc(cx, cy, r, 0, Math.PI * 2);
  layer.fill();
  layer.globalCompositeOperation = "source-over";

  // The rim: a thin warm line, haloed in blue, fading at both ends.
  const segments = 90;
  const span = PLANET_LIT_ARC.to - PLANET_LIT_ARC.from;
  layer.lineCap = "round";
  layer.lineWidth = 1.6 / view.zoom;
  // shadowBlur ignores the transform: ~11 CSS px of halo at any zoom.
  layer.shadowBlur = 11 * dpr;
  for (let i = 0; i < segments; i++) {
    const a0 = PLANET_LIT_ARC.from + (span * i) / segments;
    const a1 = PLANET_LIT_ARC.from + (span * (i + 1)) / segments;
    const along = (i + 0.5) / segments;
    const strength = smoothstep(0, 0.35, along) * smoothstep(1, 0.75, along);
    layer.beginPath();
    layer.arc(cx, cy, r - 1 / view.zoom, a0, a1);
    layer.shadowColor = `rgba(150,170,255,${0.8 * strength})`;
    layer.strokeStyle = `rgba(255,238,226,${0.95 * strength})`;
    layer.stroke();
  }
  layer.shadowBlur = 0;
  layer.restore();

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(layerCanvas, 0, 0);
  context.restore();
};

/** An elliptical radial glow, centred on (x, y) with radii in world pixels. */
const glow = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  stops: [number, string][],
) => {
  context.save();
  context.translate(x, y);
  context.scale(radiusX, radiusY);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  context.fillStyle = gradient;
  context.fillRect(-1, -1, 2, 2);
  context.restore();
};

/**
 * The horizon: a haze band above it, a hairline across, and — while the card
 * floats above it (cardLight) — a bright core with a long horizontal flare.
 */
export const paintHorizon = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: View,
  dpr: number,
  cardLight: number,
) => {
  const horizonY = height * HORIZON_FRACTION;
  const area = visibleWorld(width, height, view);
  if (horizonY < area.top - height * 0.15 || horizonY > area.bottom + height * 0.05) return;
  applyView(context, width, height, view, dpr);

  const haze = context.createLinearGradient(0, horizonY - height * 0.12, 0, horizonY);
  haze.addColorStop(0, "rgba(120,140,210,0)");
  haze.addColorStop(1, "rgba(120,140,210,0.07)");
  context.fillStyle = haze;
  context.fillRect(area.left, horizonY - height * 0.12, area.right - area.left, height * 0.12);

  const line = context.createLinearGradient(0, 0, width, 0);
  line.addColorStop(0, "rgba(255,255,255,0)");
  line.addColorStop(0.5, "rgba(255,255,255,0.3)");
  line.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = line;
  context.fillRect(Math.min(0, area.left), horizonY - 0.5 / view.zoom, Math.max(width, area.right) - Math.min(0, area.left), 1 / view.zoom);

  if (cardLight <= 0.001) return;
  const centre = width / 2;
  const light = (alpha: number) => alpha * cardLight;
  glow(context, centre, horizonY, Math.min(width * 0.35, 450), 2.2, [
    [0, `rgba(255,238,226,${light(0.85)})`],
    [0.35, `rgba(255,214,190,${light(0.25)})`],
    [0.7, "rgba(255,214,190,0)"],
  ]);
  glow(context, centre, horizonY, Math.min(width * 0.19, 220), 48, [
    [0, `rgba(255,232,216,${light(0.35)})`],
    [0.45, `rgba(200,190,230,${light(0.08)})`],
    [0.7, "rgba(200,190,230,0)"],
  ]);
  glow(context, centre, horizonY, 80, 7, [
    [0, `rgba(255,255,255,${light(0.95)})`],
    [0.4, `rgba(255,236,222,${light(0.4)})`],
    [0.72, "rgba(255,236,222,0)"],
  ]);
};
