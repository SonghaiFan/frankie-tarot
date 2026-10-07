import { HORIZON_FRACTION } from "./world";
import { type View, horizonOnScreen } from "./camera";

const VERTEX = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// A height field of travelling waves, seen in perspective: each screen pixel
// below the horizon is mapped back to its point in the world (through the
// camera), then onto the sea's surface, so waves are tiny near the horizon,
// grow toward the viewer, and magnify as the camera zooms. Their slopes bend
// the mirrored sky — breaking reflections into long wavy streaks — and the
// whole surface carries the sky's navy sheen, brighter at grazing angles
// (fresnel), with glints on the crests. Above the horizon: transparent.
const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSky;
uniform float uTime;
uniform float uHorizon;    // horizon on screen (fraction of height)
uniform float uZoom;
uniform vec2 uViewCentre;  // world point at screen centre (fractions)
uniform float uWorldHorizon;
uniform float uAspect;     // the sea's width / depth in the world

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Screen → world: x across the world's width, d down from the horizon to the
// world's bottom edge (0..1 on the home page).
vec2 toWorld(vec2 screen) {
  float x = (screen.x - 0.5) / uZoom + uViewCentre.x;
  float y = (screen.y - 0.5) / uZoom + uViewCentre.y;
  return vec2(x, (y - uWorldHorizon) / (1.0 - uWorldHorizon));
}

float waveHeight(vec2 world, float t) {
  float z = 1.0 / (max(world.y, 0.0) + 0.035);
  vec2 p = vec2((world.x - 0.5) * uAspect * z * 0.9, z);
  float h = noise(vec2(p.x * 0.55 + t * 0.03, p.y * 1.6 - t * 0.45)) * 0.6;
  h += noise(vec2(p.x * 1.4 - t * 0.05, p.y * 3.6 - t * 0.8)) * 0.28;
  h += noise(vec2(p.x * 3.4 + t * 0.07, p.y * 8.0 - t * 1.25)) * 0.12;
  return h;
}

void main() {
  if (vUv.y <= uHorizon) { gl_FragColor = vec4(0.0); return; }
  float t = uTime;
  vec2 world = toWorld(vUv);
  float d = world.y;
  // Slopes on the sea's own surface (world units), as on the home page.
  vec2 e = vec2(0.0025, 0.0);
  float h = waveHeight(world, t);
  float slopeX = (waveHeight(world + e.xy, t) - waveHeight(world - e.xy, t)) / (2.0 * e.x);
  float slopeY = (waveHeight(world + e.yx, t) - waveHeight(world - e.yx, t)) / (2.0 * e.x);

  // Slopes bend the reflected ray. Offsets are in world fractions — sideways
  // of the width, vertically of the sky's height — then scaled to the screen.
  float near = 0.15 + d;
  float bendX = clamp(slopeX * 0.009 * near, -0.12, 0.12) * uZoom;
  float skyScale = uWorldHorizon * uZoom;
  float bendY = clamp(slopeY * 0.006 * near, -0.12, 0.12) * skyScale;
  // Mirror about the horizon, on screen: the camera's zoom is uniform.
  float skyY = uHorizon - (vUv.y - uHorizon) * 0.82 - bendY;

  vec3 reflection = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float o = float(i) / 6.0 - 0.5;
    vec2 uv = vec2(vUv.x + bendX, skyY + o * (0.01 + d * 0.07) * skyScale);
    reflection += texture2D(uSky, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
  }
  reflection /= 7.0;

  float fresnel = mix(0.95, 0.42, smoothstep(0.0, 1.0, d));
  float facing = clamp(0.75 + slopeY * 0.004, 0.35, 1.25);
  vec3 deep = vec3(0.003, 0.004, 0.009);
  float sheenPattern = smoothstep(-40.0, 120.0, slopeY) * (0.6 + 0.4 * h);
  vec3 sheen = vec3(0.07, 0.09, 0.16) * sheenPattern * mix(1.0, 0.35, d);
  vec3 color = deep + sheen + reflection * fresnel * facing;

  float glint = pow(clamp(h - 0.55, 0.0, 1.0) * 2.2, 4.0) * dot(reflection, vec3(0.33)) * 3.0;
  gl_FragColor = vec4(color + glint, 1.0);
}`;

const compile = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
};

/**
 * The sea, rendered with WebGL into a full-screen transparent canvas. Returns
 * null without WebGL; the backdrop's flat sea colour shows instead.
 */
export const createSea = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // The sky is partly transparent; premultiply so faint glow stays faint.
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    time: uniform("uTime"),
    horizon: uniform("uHorizon"),
    zoom: uniform("uZoom"),
    centre: uniform("uViewCentre"),
    worldHorizon: uniform("uWorldHorizon"),
    aspect: uniform("uAspect"),
  };
  gl.uniform1f(u.worldHorizon, HORIZON_FRACTION);

  let cleared = false;
  return {
    /** Draws a frame; returns false (and stays clear) while the sea is out of frame. */
    render(sky: HTMLCanvasElement, view: View, width: number, height: number, seconds: number) {
      const horizon = horizonOnScreen(view);
      if (horizon >= 1) {
        if (!cleared) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          cleared = true;
        }
        return false;
      }
      cleared = false;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sky);
      gl.uniform1f(u.time, seconds);
      gl.uniform1f(u.horizon, horizon);
      gl.uniform1f(u.zoom, view.zoom);
      gl.uniform2f(u.centre, view.x, view.y);
      gl.uniform1f(u.aspect, width / (height * (1 - HORIZON_FRACTION)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
};
