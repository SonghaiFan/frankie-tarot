import { cardPoses } from "./pickingForce";
import {
  AURA_FIELD_SETTINGS,
  createAuraShaderSources,
} from "./sharedAuraField";
import {
  getAuraColorChannels,
  getCardBackAppearance,
} from "./cardBackAppearance";

export interface CloudSurface {
  element: HTMLElement;
  rotation: number;
}

/** One GPU surface for the entire deck. No per-card canvas or GPU readback. */
export async function createPickingCloudRenderer(
  canvas: HTMLCanvasElement,
  patternUrl: string,
  insetPercent: number,
  signal: AbortSignal,
) {
  const pattern = new Image();
  pattern.crossOrigin = "anonymous";
  pattern.src = patternUrl;
  await pattern.decode();
  if (signal.aborted) throw new DOMException("Renderer disposed", "AbortError");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: true,
  });
  if (!gl) throw new Error("WebGL unavailable");
  const programs: WebGLProgram[] = [];
  const textures: WebGLTexture[] = [];
  const buffers: WebGLBuffer[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  const dispose = () => {
    programs.forEach((p) => gl.deleteProgram(p));
    textures.forEach((t) => gl.deleteTexture(t));
    buffers.forEach((b) => gl.deleteBuffer(b));
    framebuffers.forEach((f) => gl.deleteFramebuffer(f));
  };
  try {
    const program = (vertex: string, fragment: string) => {
      const p = gl.createProgram()!;
      programs.push(p);
      for (const [kind, text] of [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, fragment],
      ] as const) {
        const shader = gl.createShader(kind)!;
        gl.shaderSource(shader, text);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const error = gl.getShaderInfoLog(shader);
          gl.deleteShader(shader);
          throw new Error(error ?? "Shader compilation failed");
        }
        gl.attachShader(p, shader);
        gl.deleteShader(shader);
      }
      gl.bindAttribLocation(p, 0, "position");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p) ?? "Shader linking failed");
      return p;
    };
    const texture = () => {
      const t = gl.createTexture()!;
      textures.push(t);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const target = () => {
      const tex = texture(),
        fb = gl.createFramebuffer()!;
      framebuffers.push(fb);
      let width = 0,
        height = 0;
      return {
        tex,
        fb,
        resize(w: number, h: number) {
          if (width === w && height === h) return;
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            w,
            h,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
          );
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            tex,
            0,
          );
          if (
            gl.checkFramebufferStatus(gl.FRAMEBUFFER) !==
            gl.FRAMEBUFFER_COMPLETE
          )
            throw new Error("Incomplete aura framebuffer");
          width = w;
          height = h;
        },
      };
    };
    const rawSources = createAuraShaderSources("scene");
    const blurSources = createAuraShaderSources("blur");
    const raw = program(rawSources.vertex, rawSources.fragment);
    const blur = program(blurSources.vertex, blurSources.fragment);
    const cards = program(
      `
attribute vec2 position;
uniform vec2 uViewport, uCenter, uSize;
uniform float uRotation;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  vec2 p = position * uSize * 0.5;
  float c = cos(uRotation), s = sin(uRotation);
  p = vec2(c*p.x-s*p.y, s*p.x+c*p.y) + uCenter;
  gl_Position = vec4(p.x/uViewport.x*2.0-1.0, 1.0-p.y/uViewport.y*2.0, 0.0, 1.0);
}`,
      `
precision highp float;
varying vec2 vUv;
uniform sampler2D uField, uDecoration;
uniform vec4 uCrop;
uniform vec2 uSize;
uniform float uInset, uOpacity, uPixel, uSolid;
uniform vec3 uSolidColor;
float roundedBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float radius = uSize.x * 0.07;
  float coverage = 1.0-smoothstep(-uPixel, 0.0, roundedBox(p,uSize*0.5,radius));
  float inset = uSize.x * uInset;
  float inner = inset < 0.001 ? 1.0 : 1.0-smoothstep(-uPixel,0.0,roundedBox(p,uSize*0.5-inset,max(0.0,radius-inset)));
  vec2 uv = clamp((vUv*uSize-inset)/(uSize-2.0*inset),0.0,1.0);
  vec2 fieldUv = uCrop.xy + uv*uCrop.zw;
  vec3 col = mix(texture2D(uField,vec2(fieldUv.x,1.0-fieldUv.y)).rgb,uSolidColor,uSolid);
  vec4 decoration = texture2D(uDecoration,uv);
  col = mix(col,decoration.rgb,decoration.a);
  // The same subtle vertical sheen used by CardBackSurface.
  float top = max(0.0,1.0-uv.y*2.0)*0.05*(1.0-uSolid);
  float bottom = max(0.0,uv.y*2.0-1.0)*0.25*(1.0-uSolid);
  col = mix(col,vec3(1.0),top)*(1.0-bottom);
  gl_FragColor = vec4(mix(vec3(1.0),col,inner),coverage*uOpacity);
}`,
    );
    const uniforms = (p: WebGLProgram, names: string[]) =>
      Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
    const ru = uniforms(raw, [
      "uRes",
      "uTime",
      "uScale",
      "uPadding",
      "uColors[0]",
    ]);
    const bu = uniforms(blur, ["uScale", "uPadding", "uSceneSize", "uScene"]);
    const cu = uniforms(cards, [
      "uViewport",
      "uCenter",
      "uSize",
      "uRotation",
      "uField",
      "uDecoration",
      "uCrop",
      "uInset",
      "uOpacity",
      "uPixel",
      "uSolid",
      "uSolidColor",
    ]);
    const rawTarget = target(),
      blurredTarget = target();
    const decoration = texture();
    const art = document.createElement("canvas");
    art.width = 256;
    art.height = Math.round((256 * 12) / 7);
    const ctx = art.getContext("2d")!;
    ctx.globalAlpha = 0.1;
    ctx.drawImage(pattern, 0, 0, art.width, art.height);
    ctx.globalAlpha = 1;
    const star = new Path2D(
      "M50 0C54 34 66 46 100 50 66 54 54 66 50 100 46 66 34 54 0 50 34 46 46 34 50 0Z",
    );
    ctx.translate(art.width / 2, art.height / 2);
    ctx.scale((art.width * 0.15) / 100, (art.width * 0.15) / 100);
    ctx.translate(-50, -50);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.shadowColor = "rgba(255,255,255,0.5)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 1;
    ctx.fill(star);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    const buffer = gl.createBuffer()!;
    buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // First three vertices cover the field; the last six form each card.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 3, -1, -1, 3, -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    let colors: string[] | undefined;
    let referenceHeight = 100;
    let geometry: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      rotation: number;
      opacity: number;
      crop: number[];
    }[] = [];
    return {
      dispose,
      assertHealthy() {
        if (gl.getError() !== gl.NO_ERROR)
          throw new Error("GPU deck rendering failed");
      },
      render(
        surfaces: CloudSurface[],
        bounds: DOMRect,
        seconds: number,
        measure: boolean,
      ) {
        if (gl.isContextLost()) throw new Error("GPU context lost");
        // React strict-mode/HMR can finish an older asynchronous initializer
        // on this same canvas. Reassert our own vertex buffer after its cleanup.
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        if (surfaces.length === 0) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          return;
        }
        const appearance = getCardBackAppearance();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(bounds.width * dpr)),
          h = Math.max(1, Math.round(bounds.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          measure = true;
        }
        if (measure) {
          referenceHeight =
            cardPoses.get(surfaces[0]?.element)?.height ??
            surfaces[0]?.element.offsetHeight ??
            100;
          // Read all animated geometry before drawing; cache it once cards settle.
          geometry = [...surfaces]
            .sort(
              (a, b) =>
                (cardPoses.get(a.element)?.layer ?? 0) -
                (cardPoses.get(b.element)?.layer ?? 0),
            )
            .map(({ element, rotation }) => {
              const pose = cardPoses.get(element);
              if (pose) {
                const theta = (pose.rotation * Math.PI) / 180;
                const sw =
                  Math.abs(Math.cos(theta)) * pose.width +
                  Math.abs(Math.sin(theta)) * pose.height;
                const sh =
                  Math.abs(Math.sin(theta)) * pose.width +
                  Math.abs(Math.cos(theta)) * pose.height;
                const centerX = bounds.width / 2 + pose.x,
                  centerY = bounds.height / 2 + pose.y;
                return {
                  centerX,
                  centerY,
                  width: pose.width,
                  height: pose.height,
                  rotation: theta,
                  opacity: 1,
                  crop: [
                    Math.max(
                      0,
                      Math.min(innerWidth - sw, bounds.left + centerX - sw / 2),
                    ) / innerWidth,
                    Math.max(
                      0,
                      Math.min(innerHeight - sh, bounds.top + centerY - sh / 2),
                    ) / innerHeight,
                    Math.min(innerWidth, sw) / innerWidth,
                    Math.min(innerHeight, sh) / innerHeight,
                  ],
                };
              }
              const r = element.getBoundingClientRect();
              const theta = (rotation * Math.PI) / 180;
              const width =
                r.width /
                (Math.abs(Math.cos(theta)) +
                  (12 / 7) * Math.abs(Math.sin(theta)));
              const height = (width * 12) / 7;
              const sw = Math.min(innerWidth, r.width),
                sh = Math.min(innerHeight, r.height);
              const cloud = element.closest(".tarot-card-cloud")!;
              return {
                centerX: r.left + r.width / 2 - bounds.left,
                centerY: r.top + r.height / 2 - bounds.top,
                width,
                height,
                rotation: theta,
                opacity:
                  Number(getComputedStyle(element.parentElement!).opacity) *
                  Number(getComputedStyle(cloud).opacity),
                crop: [
                  Math.max(0, Math.min(innerWidth - sw, r.left)) / innerWidth,
                  Math.max(0, Math.min(innerHeight - sh, r.top)) / innerHeight,
                  sw / innerWidth,
                  sh / innerHeight,
                ],
              };
            });
        }
        const fw = Math.max(
          1,
          Math.ceil(innerWidth * AURA_FIELD_SETTINGS.renderScale * dpr),
        );
        const fh = Math.max(
          1,
          Math.ceil(innerHeight * AURA_FIELD_SETTINGS.renderScale * dpr),
        );
        const scale =
          (referenceHeight * AURA_FIELD_SETTINGS.sceneScale * fw) / innerWidth;
        const padding = Math.ceil(AURA_FIELD_SETTINGS.blur * scale) + 1;
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        if (appearance.mode === "gradient") {
          rawTarget.resize(fw + 2 * padding, fh + 2 * padding);
          blurredTarget.resize(fw, fh);
          gl.bindFramebuffer(gl.FRAMEBUFFER, rawTarget.fb);
          gl.viewport(0, 0, fw + 2 * padding, fh + 2 * padding);
          gl.useProgram(raw);
          // Do not sample the texture currently attached to the framebuffer.
          gl.bindTexture(gl.TEXTURE_2D, null);
          gl.uniform2f(ru.uRes, fw, fh);
          gl.uniform1f(ru.uTime, seconds * AURA_FIELD_SETTINGS.timeSpeed);
          gl.uniform1f(ru.uScale, scale);
          gl.uniform1f(ru.uPadding, padding);
          if (colors !== appearance.colors) {
            gl.uniform3fv(
              ru["uColors[0]"],
              getAuraColorChannels(appearance.colors),
            );
            colors = appearance.colors;
          }
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.bindFramebuffer(gl.FRAMEBUFFER, blurredTarget.fb);
          gl.viewport(0, 0, fw, fh);
          gl.useProgram(blur);
          gl.bindTexture(gl.TEXTURE_2D, rawTarget.tex);
          gl.uniform1i(bu.uScene, 0);
          gl.uniform1f(bu.uScale, scale);
          gl.uniform1f(bu.uPadding, padding);
          gl.uniform2f(bu.uSceneSize, fw + padding * 2, fh + padding * 2);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        } else {
          blurredTarget.resize(1, 1);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA,
        );
        gl.useProgram(cards);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, blurredTarget.tex);
        gl.uniform1i(cu.uField, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, decoration);
        gl.uniform1i(cu.uDecoration, 1);
        gl.uniform2f(cu.uViewport, bounds.width, bounds.height);
        gl.uniform1f(cu.uInset, insetPercent / 100);
        gl.uniform1f(cu.uPixel, 1 / dpr);
        gl.uniform1f(cu.uSolid, appearance.mode === "solid" ? 1 : 0);
        gl.uniform3f(
          cu.uSolidColor,
          ...([1, 3, 5].map(
            (i) => parseInt(appearance.solidColor.slice(i, i + 2), 16) / 255,
          ) as [number, number, number]),
        );
        for (const card of geometry) {
          if (card.width < 1 || card.height < 1) continue;
          gl.uniform2f(cu.uCenter, card.centerX, card.centerY);
          gl.uniform2f(cu.uSize, card.width, card.height);
          gl.uniform1f(cu.uRotation, card.rotation);
          gl.uniform1f(cu.uOpacity, card.opacity);
          gl.uniform4f(
            cu.uCrop,
            ...(card.crop as [number, number, number, number]),
          );
          gl.drawArrays(gl.TRIANGLES, 3, 6);
        }
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
