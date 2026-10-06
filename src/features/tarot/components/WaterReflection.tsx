import React, { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import { paintPlanet, paintSkyGradient } from "./introScene";

interface WaterReflectionProps {
  /** Horizon as a fraction of the viewport height; the water fills everything below. */
  horizon: number;
  /** The hero card's painted face, mirrored into the water every frame. */
  faceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** The card's current rotation in degrees. */
  rotate: MotionValue<number>;
  animated: boolean;
}

// The water renders at reduced resolution: ripples and blur hide it, and it is
// a full-width surface that redraws every frame.
const RENDER_SCALE = 0.5;
const MAX_DPR = 2;
const RIM = "rgba(255,214,184,0.85)";

const VERTEX = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// A height field of travelling waves, seen in perspective: each water pixel is
// mapped to a point on the surface, so waves are tiny near the horizon and grow
// toward the viewer. Their slopes bend the mirrored sky — breaking the card's
// reflection into long wavy streaks — and the whole surface carries the sky's
// navy sheen, brighter at grazing angles (fresnel), with glints on the crests.
const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSky;
uniform float uTime;
uniform float uSkyToWater;
uniform float uAspect;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// The surface under a water pixel: x spreads and z recedes toward the horizon.
vec2 surface(vec2 uv) {
  float z = 1.0 / (uv.y + 0.035);
  return vec2((uv.x - 0.5) * uAspect * z * 0.9, z);
}

float waveHeight(vec2 uv, float t) {
  vec2 p = surface(uv);
  // Long swells running across, then finer chop; all drift toward the viewer.
  float h = noise(vec2(p.x * 0.55 + t * 0.03, p.y * 1.6 - t * 0.45)) * 0.6;
  h += noise(vec2(p.x * 1.4 - t * 0.05, p.y * 3.6 - t * 0.8)) * 0.28;
  h += noise(vec2(p.x * 3.4 + t * 0.07, p.y * 8.0 - t * 1.25)) * 0.12;
  return h;
}

void main() {
  float d = vUv.y;
  float t = uTime;
  vec2 e = vec2(0.0025, 0.0);
  float h = waveHeight(vUv, t);
  float slopeX = (waveHeight(vUv + e.xy, t) - waveHeight(vUv - e.xy, t)) / (2.0 * e.x);
  float slopeY = (waveHeight(vUv + e.yx, t) - waveHeight(vUv - e.yx, t)) / (2.0 * e.x);

  // Slopes bend the reflected ray: sideways shimmer and up/down reach, both
  // growing toward the viewer where the waves are larger on screen.
  float near = 0.15 + d;
  float bendX = clamp(slopeX * 0.009 * near, -0.12, 0.12);
  float bendY = clamp(slopeY * 0.006 * near, -0.12, 0.12);
  float skyY = 1.0 - d * uSkyToWater * 0.82 - bendY;

  // Average along the reflected column: ripples smear reflections vertically.
  vec3 reflection = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float o = float(i) / 6.0 - 0.5;
    vec2 uv = vec2(vUv.x + bendX, skyY + o * (0.01 + d * 0.07));
    reflection += texture2D(uSky, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
  }
  reflection /= 7.0;

  // Water reflects most at grazing angles, near the horizon.
  float fresnel = mix(0.95, 0.42, smoothstep(0.0, 1.0, d));
  // Faces tilted toward the viewer catch more sky; backs of waves less.
  float facing = clamp(0.75 + slopeY * 0.004, 0.35, 1.25);
  vec3 deep = vec3(0.003, 0.004, 0.009);
  // The night sky's own light on the ripples: a blue-grey sheen over the whole
  // surface, strongest toward the horizon, patterned by the wave slopes.
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

/** A WebGL water surface below the horizon that mirrors the hero card. */
const WaterReflection: React.FC<WaterReflectionProps> = ({ horizon, faceCanvasRef, rotate, animated }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!canvas || !gl) return; // Without WebGL the plain dark water underneath shows.

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    // The sky is mostly transparent; premultiply so faint glow stays faint.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const uTime = gl.getUniformLocation(program, "uTime");
    const uSkyToWater = gl.getUniformLocation(program, "uSkyToWater");
    const uAspect = gl.getUniformLocation(program, "uAspect");

    // The sky: what stands above the water, redrawn each frame in screen space.
    const sky = document.createElement("canvas");
    const skyContext = sky.getContext("2d");
    if (!skyContext) return;
    // The planet is static: painted once per size into its own layer.
    const planetLayer = document.createElement("canvas");
    let planetDirty = true;

    let frame = 0;
    const startedAt = performance.now();

    const paintSky = (scale: number, horizonY: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      skyContext.setTransform(scale, 0, 0, scale, 0, 0);
      paintSkyGradient(skyContext, width, height);
      const planetContext = planetDirty ? planetLayer.getContext("2d") : null;
      if (planetContext) {
        planetContext.setTransform(scale, 0, 0, scale, 0, 0);
        planetContext.clearRect(0, 0, width, horizonY);
        paintPlanet(planetContext, width, height);
        planetDirty = false;
      }
      skyContext.save();
      skyContext.setTransform(1, 0, 0, 1, 0, 0);
      skyContext.drawImage(planetLayer, 0, 0);
      skyContext.restore();

      // The bright core where the card's light meets the horizon.
      const glow = skyContext.createRadialGradient(width / 2, horizonY, 0, width / 2, horizonY, Math.min(width * 0.22, 260));
      glow.addColorStop(0, "rgba(255,236,222,0.75)");
      glow.addColorStop(0.3, "rgba(255,214,190,0.18)");
      glow.addColorStop(1, "rgba(255,214,190,0)");
      skyContext.fillStyle = glow;
      skyContext.fillRect(0, 0, width, horizonY);

      const face = faceCanvasRef.current;
      if (!face || face.width < 2) return;
      const bounds = face.getBoundingClientRect();
      const w = face.offsetWidth;
      const h = face.offsetHeight;
      const radius = Math.min(w * 0.07, h * 0.041);
      skyContext.save();
      skyContext.translate(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      skyContext.rotate((rotate.get() * Math.PI) / 180);
      skyContext.beginPath();
      skyContext.roundRect(-w / 2, -h / 2, w, h, radius);
      skyContext.save();
      skyContext.clip();
      skyContext.drawImage(face, -w / 2, -h / 2, w, h);
      skyContext.restore();
      skyContext.lineWidth = 1.5;
      skyContext.strokeStyle = RIM;
      skyContext.stroke();
      skyContext.restore();
    };

    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * RENDER_SCALE;
      const horizonY = window.innerHeight * horizon;
      const waterHeight = window.innerHeight - horizonY;
      const width = Math.max(1, Math.round(window.innerWidth * dpr));
      const height = Math.max(1, Math.round(waterHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      const skyHeight = Math.max(1, Math.round(horizonY * dpr));
      if (sky.width !== width || sky.height !== skyHeight) {
        sky.width = width;
        sky.height = skyHeight;
        planetLayer.width = width;
        planetLayer.height = skyHeight;
        planetDirty = true;
      }

      paintSky(dpr, horizonY);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sky);
      gl.uniform1f(uTime, (now - startedAt) / 1000);
      gl.uniform1f(uSkyToWater, waterHeight / horizonY);
      gl.uniform1f(uAspect, window.innerWidth / waterHeight);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      frame = animated && !document.hidden ? requestAnimationFrame(render) : 0;
    };

    const restart = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    window.addEventListener("resize", restart);
    document.addEventListener("visibilitychange", restart);
    // Without animation, still repaint once the card's aura has arrived.
    const settle = animated ? undefined : setTimeout(restart, 600);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("resize", restart);
      document.removeEventListener("visibilitychange", restart);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [horizon, faceCanvasRef, rotate, animated]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-x-0 w-full"
      style={{ top: `${horizon * 100}%`, height: `${(1 - horizon) * 100}%` }}
    />
  );
};

export default WaterReflection;
