import { camera } from "../scene/camera";
import {
  getCardBackAppearance,
  getAuraColorChannels,
  subscribeCardBackAppearance,
} from "./cardBackAppearance";

const SETTINGS = {
  bands: [0.425, 0.47, 0.49, 0.505, 0.545],
  skyBias: 0.12,
  poolStart: 0.6,
  coolEdges: 0.42,
  sceneScale: 0.9,
  warp: 1.5,
  blur: 0.1,
  timeSpeed: 0.35,
  contrast: 1.04,
  saturation: 1.08,
  renderScale: 0.35,
} as const;

/** Seconds-to-shader-time factor used by the aura, for other renderers of the same field. */
export const AURA_TIME_SPEED = SETTINGS.timeSpeed;

const subscribers = new Set<HTMLCanvasElement>();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const maxDpr = 2;

let source: HTMLCanvasElement | undefined;
let fallbackSource: HTMLCanvasElement | undefined;
let sourceInitialized = false;
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let uResolution: WebGLUniformLocation | null = null;
let uTime: WebGLUniformLocation | null = null;
let uScale: WebGLUniformLocation | null = null;
let uColors: WebGLUniformLocation | null = null;
let uploadedColors: string[] | undefined;
let frameId = 0;
let startedAt = 0;
let fieldScale = SETTINGS.renderScale;

const value = (number: number) => Number(number).toFixed(4);
/** The aura's GLSL (uniforms uRes, uTime, uScale, uColors[11]), for other renderers of the same field. */
export const createAuraShaderSources = () => {
  const { bands: b } = SETTINGS;
  const vertex = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

  const fragment = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform vec3 uColors[11];

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float n = mix(mix(dot(-1.0 + 2.0 * hash(i), f),
                    dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                    dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
  return 0.5 + 0.5 * n;
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 2; i++) {
    v += a * noise(p);
    p = p * 1.9 + vec2(1.7, 9.2);
    a *= 0.4;
  }
  return 0.5 + (v / 0.7 - 0.5) * 1.15;
}

vec3 scene(vec2 fc) {
  float t = uTime;
  vec2 uv = fc / uRes;
  vec2 p = fc / uScale;
  vec2 q = vec2(noise(p * 0.6 + vec2(0.0, t * 0.08)),
                noise(p * 0.6 + vec2(5.2, 1.3) - vec2(t * 0.06, 0.0)));
  vec2 w = p + (q - 0.5) * ${value(SETTINGS.warp)};

  float sky = fbm(w * 0.7 + vec2(1.7, 9.2) + t * 0.03) + (uv.y - 0.5) * ${value(SETTINGS.skyBias)};
  float pool = fbm(w * 0.9 + vec2(8.3, 2.8) - t * 0.04) + (0.5 - uv.y) * ${value(SETTINGS.skyBias * 0.6)};
  float cool = fbm(p * 0.35 + vec2(3.1, 7.7) + t * 0.02);

  vec3 warm = uColors[4];
  warm = mix(warm, uColors[3], smoothstep(${value(b[0])}, ${value(b[1])}, sky));
  warm = mix(warm, uColors[2], smoothstep(${value(b[1])}, ${value(b[2])}, sky));
  warm = mix(warm, uColors[1], smoothstep(${value(b[2])}, ${value(b[3])}, sky));
  warm = mix(warm, uColors[0], smoothstep(${value(b[3])}, ${value(b[4])}, sky));

  vec3 coolc = uColors[4];
  coolc = mix(coolc, uColors[5], smoothstep(${value(b[0])}, ${value(b[2])}, sky));
  coolc = mix(coolc, uColors[6], smoothstep(${value(b[2])}, ${value(b[3])}, sky));
  coolc = mix(coolc, uColors[0], smoothstep(${value(b[3])}, ${value(b[4])}, sky));

  float coolAmt = smoothstep(0.62 - ${value(SETTINGS.coolEdges * 0.24)}, 0.70 - ${value(SETTINGS.coolEdges * 0.24)}, cool);
  vec3 col = mix(warm, coolc, coolAmt);

  float rim = smoothstep(${value(SETTINGS.poolStart)}, ${value(SETTINGS.poolStart + 0.08)}, pool);
  float depth = smoothstep(${value(SETTINGS.poolStart)}, ${value(SETTINGS.poolStart + 0.16)}, pool);
  vec3 pc = mix(uColors[7], uColors[8], smoothstep(0.0, 0.35, depth));
  pc = mix(pc, uColors[9], smoothstep(0.35, 0.7, depth));
  pc = mix(pc, uColors[10], smoothstep(0.7, 1.0, depth));
  float onGround = 1.0 - smoothstep(${value(b[1])}, ${value(b[3])}, sky);
  col = mix(col, pc, rim * onGround);
  return col;
}

void main() {
  vec3 col = vec3(0.0);
  float radius = ${value(SETTINGS.blur)} * uScale;
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float r = radius * sqrt((fi + 0.5) / 16.0);
    float a = fi * 2.39996;
    col += scene(gl_FragCoord.xy + r * vec2(cos(a), sin(a)));
  }
  col /= 16.0;
  col = (col - 0.5) * ${value(SETTINGS.contrast)} + 0.5;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, ${value(SETTINGS.saturation)});
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  return { vertex, fragment };
};

const compileShader = (context: WebGLRenderingContext, kind: number, sourceText: string) => {
  const shader = context.createShader(kind);
  if (!shader) return null;
  context.shaderSource(shader, sourceText);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    console.warn("Aura field shader failed to compile:", context.getShaderInfoLog(shader));
    context.deleteShader(shader);
    return null;
  }
  return shader;
};

const initializeWebGL = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("webgl", {
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
  });
  if (!context) return false;

  const { vertex, fragment } = createAuraShaderSources();
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertex);
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragment);
  if (!vertexShader || !fragmentShader) return false;

  const linkedProgram = context.createProgram();
  if (!linkedProgram) return false;
  context.attachShader(linkedProgram, vertexShader);
  context.attachShader(linkedProgram, fragmentShader);
  context.linkProgram(linkedProgram);
  if (!context.getProgramParameter(linkedProgram, context.LINK_STATUS)) {
    console.warn("Aura field shader failed to link:", context.getProgramInfoLog(linkedProgram));
    return false;
  }

  const buffer = context.createBuffer();
  if (!buffer) return false;
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW);
  context.useProgram(linkedProgram);
  const position = context.getAttribLocation(linkedProgram, "position");
  context.enableVertexAttribArray(position);
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);

  gl = context;
  program = linkedProgram;
  uResolution = context.getUniformLocation(linkedProgram, "uRes");
  uTime = context.getUniformLocation(linkedProgram, "uTime");
  uScale = context.getUniformLocation(linkedProgram, "uScale");
  uColors = context.getUniformLocation(linkedProgram, "uColors[0]");
  return true;
};

const ensureSource = () => {
  if (sourceInitialized) return source;
  sourceInitialized = true;
  source = document.createElement("canvas");
  if (!initializeWebGL(source)) {
    source = undefined;
    console.warn("WebGL is unavailable; using the static aura fallback.");
  }
  return source;
};

const paintFallback = () => {
  if (!fallbackSource) fallbackSource = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const scale = SETTINGS.renderScale * dpr;
  fallbackSource.width = Math.max(1, Math.ceil(window.innerWidth * scale));
  fallbackSource.height = Math.max(1, Math.ceil(window.innerHeight * scale));
  fieldScale = fallbackSource.width / Math.max(1, window.innerWidth);
  const context = fallbackSource.getContext("2d");
  if (!context) return;
  context.scale(scale, scale);
  const channels = getAuraColorChannels(getCardBackAppearance().colors);
  const roleColor = (index: number) => `rgb(${[0, 1, 2].map((channel) =>
    Math.round(channels[index * 3 + channel] * 255)
  ).join(",")})`;
  const gradient = context.createLinearGradient(0, 0, 0, window.innerHeight);
  gradient.addColorStop(0, roleColor(0));
  gradient.addColorStop(0.25, roleColor(0));
  gradient.addColorStop(0.42, roleColor(2));
  gradient.addColorStop(0.52, roleColor(4));
  gradient.addColorStop(0.75, roleColor(4));
  gradient.addColorStop(0.88, roleColor(8));
  gradient.addColorStop(1, roleColor(10));
  context.fillStyle = gradient;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
};

const paintField = (time: number) => {
  const appearance = getCardBackAppearance();
  if (appearance.mode === "solid") return;
  const canvas = ensureSource();
  const activeSource = canvas ?? fallbackSource;
  if (!activeSource) {
    paintFallback();
    return;
  }
  if (!canvas) paintFallback();

  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  fieldScale = activeSource.width / Math.max(1, window.innerWidth);
  const firstCard = subscribers.values().next().value as HTMLCanvasElement | undefined;
  const cardHeight = firstCard?.getBoundingClientRect().height ?? 160;

  if (gl && program && canvas) {
    const width = Math.max(1, Math.ceil(window.innerWidth * SETTINGS.renderScale * dpr));
    const height = Math.max(1, Math.ceil(window.innerHeight * SETTINGS.renderScale * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    fieldScale = canvas.width / Math.max(1, window.innerWidth);
    if (uploadedColors !== appearance.colors) {
      gl.uniform3fv(uColors, getAuraColorChannels(appearance.colors));
      uploadedColors = appearance.colors;
    }
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, time * SETTINGS.timeSpeed);
    gl.uniform1f(uScale, cardHeight * SETTINGS.sceneScale * fieldScale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
};

// Small windows (a deck of cards in a cloud) are many and tiny: the aura is a
// soft gradient, so they repaint together on a shared 15-per-second tick at one
// pixel per CSS pixel, and look the same. Together, because each tick costs
// one GPU→CPU readback of the field (see cpuField) however many windows paint.
const SMALL_WINDOW_PX = 200;
const SMALL_WINDOW_FPS = 15;
let lastSmallTick = -Infinity;
// Asking an animated card where it is forces the page's styles and layout to
// be worked out early — the dominant cost with dozens of cards. Small windows
// sample a slow, soft gradient, so they re-measure together twice a second and
// reuse those boxes in between; a drifting card is off by a few pixels at most.
const SMALL_RECT_REFRESH_MS = 500;
let lastSmallSweep = -Infinity;
const cachedRects = new WeakMap<HTMLCanvasElement, DOMRect>();
// Track the short entrance continuously; idle caching would retain the
// pre-flight crop and snap to the final position after the cards land.
const entranceUntil = new WeakMap<HTMLCanvasElement, number>();

export interface AuraWindowOptions {
  /** Repaints per second at most (default: every frame, or 20 for small windows). */
  maxFps?: number;
  /** Backing-store pixels per CSS pixel (default: the device ratio, or 1 for small windows). */
  resolution?: number;
}

const windowOptions = new WeakMap<HTMLCanvasElement, AuraWindowOptions>();
const lastPainted = new WeakMap<HTMLCanvasElement, number>();
const smallWindows = new WeakMap<HTMLCanvasElement, boolean>();

// Small canvases live in CPU memory, so each copy from the GPU-rendered field
// into one is a GPU→CPU readback. Read the field back once per frame into this
// CPU-side copy and paint the small windows from it instead.
let fieldCopy: HTMLCanvasElement | undefined;
let fieldCopyFrame = -1;
const cpuField = (field: HTMLCanvasElement, now: number) => {
  fieldCopy ??= document.createElement("canvas");
  if (fieldCopyFrame !== now) {
    if (fieldCopy.width !== field.width || fieldCopy.height !== field.height) {
      fieldCopy.width = field.width;
      fieldCopy.height = field.height;
    }
    const context = fieldCopy.getContext("2d", { willReadFrequently: true });
    context?.clearRect(0, 0, fieldCopy.width, fieldCopy.height);
    context?.drawImage(field, 0, 0);
    fieldCopyFrame = now;
  }
  return fieldCopy;
};

const drawWindows = (now: number) => {
  const appearance = getCardBackAppearance();
  const field = source ?? fallbackSource;
  if (!field && appearance.mode !== "solid") return;
  const deviceRatio = Math.min(window.devicePixelRatio || 1, maxDpr);
  const smallTick = now - lastSmallTick >= 1000 / SMALL_WINDOW_FPS;
  if (smallTick) lastSmallTick = now;
  const smallSweep = smallTick && now - lastSmallSweep >= SMALL_RECT_REFRESH_MS;
  if (smallSweep) lastSmallSweep = now;

  subscribers.forEach((target) => {
    // Throttle before measuring: reading dozens of on-screen boxes every frame
    // is itself a cost. Whether a window is small is known from its last paint;
    // a window not yet painted paints at once.
    const options = windowOptions.get(target);
    const entering = now < (entranceUntil.get(target) ?? 0);
    if (!entering && appearance.mode === "gradient" && lastPainted.has(target)) {
      if (options?.maxFps) {
        if (now - lastPainted.get(target)! < 1000 / options.maxFps) return;
      } else if (smallWindows.get(target) && !smallTick) {
        return;
      }
    }

    const cached = cachedRects.get(target);
    const rect = cached && !entering && smallWindows.get(target) && !smallSweep ? cached : target.getBoundingClientRect();
    cachedRects.set(target, rect);
    if (rect.width < 1 || rect.height < 1) return;
    const small = rect.height < SMALL_WINDOW_PX;
    smallWindows.set(target, small);
    if (lastPainted.has(target) && appearance.mode === "gradient" && (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth)) return;
    const dpr = options?.resolution ?? (small ? 1 : deviceRatio);

    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (target.width !== width || target.height !== height) {
      target.width = width;
      target.height = height;
    }

    const context = target.getContext("2d");
    if (!context) return;
    lastPainted.set(target, now);
    if (appearance.mode === "solid") {
      context.fillStyle = appearance.solidColor;
      context.fillRect(0, 0, width, height);
      return;
    }

    // Fill the entire card even at the viewport edge; clipping a rotated
    // bounding box leaves transparent (black) patches inside the visible card.
    const sw = Math.min(field!.width, Math.max(1, rect.width * fieldScale));
    const sh = Math.min(field!.height, Math.max(1, rect.height * fieldScale));
    const sx = Math.max(0, Math.min(field!.width - sw, rect.left * fieldScale));
    const sy = Math.max(0, Math.min(field!.height - sh, rect.top * fieldScale));
    context.drawImage(small ? cpuField(field!, now) : field!, sx, sy, sw, sh, 0, 0, width, height);

  });
};

const render = (now: number) => {
  if (!startedAt) startedAt = now;
  paintField(reducedMotion.matches ? 20 : (now - startedAt) / 1000);
  drawWindows(now);
  if (getCardBackAppearance().mode === "gradient" && !reducedMotion.matches && subscribers.size > 0 && !document.hidden) {
    frameId = requestAnimationFrame(render);
  } else {
    frameId = 0;
  }
};

const invalidate = () => {
  if (subscribers.size > 0 && !frameId) frameId = requestAnimationFrame(render);
};

subscribeCardBackAppearance(invalidate);

// Camera travel moves cards much faster than the idle position cache expects.
for (const value of [camera.x, camera.y, camera.zoom]) {
  value.on("change", () => {
    lastSmallSweep = -Infinity;
    invalidate();
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", invalidate, { passive: true });
  window.addEventListener("scroll", invalidate, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    } else invalidate();
  });
  reducedMotion.addEventListener("change", invalidate);
}

export const registerAuraWindow = (canvas: HTMLCanvasElement, options?: AuraWindowOptions) => {
  subscribers.add(canvas);
  entranceUntil.set(canvas, performance.now() + 650);
  if (options) windowOptions.set(canvas, options);
  invalidate();
  return () => {
    subscribers.delete(canvas);
    if (subscribers.size === 0 && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };
};
