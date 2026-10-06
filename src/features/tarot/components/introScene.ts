/**
 * The home page's scene geometry, shared by the DOM sky and the water's
 * reflection of it so both agree on where everything stands.
 */

/** Where the sky meets the water, as a fraction of the viewport height. */
export const HORIZON_FRACTION = 0.58;

/** Viewports at least this wide use the desktop composition. */
const DESKTOP_MIN_WIDTH = 768;

export interface Planet {
  /** Centre and radius in CSS pixels. */
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

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** The night sky's colour from zenith to horizon: near black, then a navy haze. */
const SKY_STOPS: [number, string][] = [[0, "#020308"], [0.55, "#03050d"], [0.88, "#070b1a"], [1, "#0f1630"]];

/** The same sky as a CSS background, for the DOM layer behind the stars. */
export const SKY_GRADIENT_CSS = `linear-gradient(to bottom, ${SKY_STOPS.map(([at, color]) => `${color} ${at * 100}%`).join(", ")})`;

export const paintSkyGradient = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const horizonY = height * HORIZON_FRACTION;
  const sky = context.createLinearGradient(0, 0, 0, horizonY);
  for (const [at, color] of SKY_STOPS) sky.addColorStop(at, color);
  context.fillStyle = sky;
  context.fillRect(0, 0, width, horizonY);
};

// The planet is backlit from the upper right; its limb is brightest there.
const LIT_DIRECTION = (PLANET_LIT_ARC.from + PLANET_LIT_ARC.to) / 2;
let planetLayer: HTMLCanvasElement | undefined;

/**
 * The planet: an opaque dark body hiding the stars, a blue atmosphere just
 * inside the lit limb and a soft glow outside it (both fading out toward the
 * unlit lower left), and a thin warm rim line that fades at both ends.
 */
export const paintPlanet = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const { cx, cy, r } = getPlanet(width, height);
  const horizonY = height * HORIZON_FRACTION;
  const scale = context.getTransform().a;
  planetLayer ??= document.createElement("canvas");
  const layerWidth = Math.max(1, Math.round(width * scale));
  const layerHeight = Math.max(1, Math.round(horizonY * scale));
  if (planetLayer.width !== layerWidth || planetLayer.height !== layerHeight) {
    planetLayer.width = layerWidth;
    planetLayer.height = layerHeight;
  }
  const layer = planetLayer.getContext("2d");
  if (!layer) return;
  layer.setTransform(scale, 0, 0, scale, 0, 0);
  layer.clearRect(0, 0, width, horizonY);

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
  layer.fillRect(0, 0, width, horizonY);

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
  for (let i = 0; i < segments; i++) {
    const a0 = PLANET_LIT_ARC.from + (span * i) / segments;
    const a1 = PLANET_LIT_ARC.from + (span * (i + 1)) / segments;
    const along = (i + 0.5) / segments;
    const strength = smoothstep(0, 0.35, along) * smoothstep(1, 0.75, along);
    layer.beginPath();
    layer.arc(cx, cy, r - 1, a0, a1);
    layer.shadowColor = `rgba(150,170,255,${0.8 * strength})`;
    layer.shadowBlur = 22;
    layer.strokeStyle = `rgba(255,238,226,${0.95 * strength})`;
    layer.lineWidth = 1.6;
    layer.stroke();
  }
  layer.shadowBlur = 0;

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(planetLayer, 0, 0);
  context.restore();
};
