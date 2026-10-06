import React, { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";

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

// The sky above the horizon is mirrored below it. Ripples are compressed near
// the horizon (far away) and grow toward the viewer; the reflection is smeared
// into vertical streaks and broken into wavy horizontal slices, with glints.
const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSky;
uniform float uTime;
uniform float uSkyToWater;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float d = vUv.y;
  float depth = 1.0 / (d + 0.04);
  float t = uTime;
  float slices = noise(vec2(vUv.x * 3.0 + t * 0.04, depth * 1.4 - t * 0.55));
  float chop = noise(vec2(vUv.x * 11.0 - t * 0.07, depth * 3.4 - t * 0.9));
  float wave = slices * 0.65 + chop * 0.35 - 0.5;

  float dx = wave * (0.006 + d * 0.16);
  float skyY = 1.0 - d * uSkyToWater + wave * d * 0.05;

  vec3 reflection = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float o = float(i) / 6.0 - 0.5;
    vec2 uv = vec2(vUv.x + dx, skyY + o * (0.012 + d * 0.06));
    reflection += texture2D(uSky, clamp(uv, 0.0, 1.0)).rgb * step(0.0, uv.y);
  }
  reflection /= 7.0;

  // Bright slices with dark gaps between them, fading toward the viewer.
  float strength = mix(0.85, 0.3, d) * smoothstep(0.22, 0.78, slices) * 1.5;
  float glint = pow(max(chop - 0.62, 0.0) * 2.6, 3.0) * dot(reflection, vec3(0.5)) * 2.4;
  vec3 water = mix(vec3(0.02, 0.026, 0.05), vec3(0.004, 0.005, 0.012), smoothstep(0.0, 0.8, d));
  gl_FragColor = vec4(water + reflection * strength + glint, 1.0);
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

    // The sky: what stands above the water, redrawn each frame in screen space.
    const sky = document.createElement("canvas");
    const skyContext = sky.getContext("2d");
    if (!skyContext) return;

    let frame = 0;
    const startedAt = performance.now();

    const paintSky = (scale: number, horizonY: number) => {
      const width = window.innerWidth;
      skyContext.setTransform(scale, 0, 0, scale, 0, 0);
      skyContext.clearRect(0, 0, width, horizonY);

      // The bright seam where the card's light meets the horizon.
      const glow = skyContext.createRadialGradient(width / 2, horizonY, 0, width / 2, horizonY, Math.min(width * 0.28, 320));
      glow.addColorStop(0, "rgba(255,226,206,0.55)");
      glow.addColorStop(0.45, "rgba(255,180,140,0.12)");
      glow.addColorStop(1, "rgba(255,180,140,0)");
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
      }

      paintSky(dpr, horizonY);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sky);
      gl.uniform1f(uTime, (now - startedAt) / 1000);
      gl.uniform1f(uSkyToWater, waterHeight / horizonY);
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
