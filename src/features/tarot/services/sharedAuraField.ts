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

const subscribers = new Set<HTMLCanvasElement>();
/** Card height (px) the aura pattern is sized to, for windows much larger than a deck card. */
const scaleReferences = new WeakMap<HTMLCanvasElement, number>();
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
const createShaders = () => {
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

  const { vertex, fragment } = createShaders();
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
  const reference = Array.from(subscribers, (canvas) => scaleReferences.get(canvas)).find(Boolean);
  const cardHeight = reference ?? firstCard?.getBoundingClientRect().height ?? 160;

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

const drawWindows = () => {
  const appearance = getCardBackAppearance();
  const field = source ?? fallbackSource;
  if (!field && appearance.mode !== "solid") return;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

  subscribers.forEach((target) => {
    const rect = target.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    if (appearance.mode === "gradient" && (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth)) return;

    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (target.width !== width || target.height !== height) {
      target.width = width;
      target.height = height;
    }

    const context = target.getContext("2d");
    if (!context) return;
    if (appearance.mode === "solid") {
      context.fillStyle = appearance.solidColor;
      context.fillRect(0, 0, width, height);
      return;
    }

    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    const sx = left * fieldScale;
    const sy = top * fieldScale;
    const sw = Math.max(1, (right - left) * fieldScale);
    const sh = Math.max(1, (bottom - top) * fieldScale);
    const dx = (left - rect.left) * dpr;
    const dy = (top - rect.top) * dpr;
    const dw = (right - left) * dpr;
    const dh = (bottom - top) * dpr;

    context.clearRect(0, 0, width, height);
    context.drawImage(field!, sx, sy, sw, sh, dx, dy, dw, dh);
  });
};

const render = (now: number) => {
  if (!startedAt) startedAt = now;
  paintField(reducedMotion.matches ? 20 : (now - startedAt) / 1000);
  drawWindows();
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

export const registerAuraWindow = (canvas: HTMLCanvasElement, scaleReference?: number) => {
  subscribers.add(canvas);
  if (scaleReference) scaleReferences.set(canvas, scaleReference);
  invalidate();
  return () => {
    subscribers.delete(canvas);
    if (subscribers.size === 0 && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };
};
