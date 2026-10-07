import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { type SceneStage, type View, camera, frameStage, readView } from "./camera";
import { paintBackdrop, paintHorizon, paintPlanet } from "./painters";
import { getReflectionSubject } from "./reflection";
import { createSea } from "./sea";
import { paintStars } from "./stars";

const MAX_DPR = 2;
// The sea and its reflected sky render at half resolution: ripples and blur hide it.
const SEA_SCALE = 0.5;
// The stars move a fraction of a degree a second; 30 redraws a second is plenty.
const STAR_FRAME_MS = 1000 / 30;
const RIM = "rgba(255,214,184,0.85)";

const sameView = (a: View, b: View) => a.zoom === b.zoom && a.x === b.x && a.y === b.y;

/**
 * The night world behind every stage — sky, stars, planet, horizon and sea —
 * seen through one camera. Each stage frames a different part of it, and a
 * change of stage moves the camera, so the background travels with the user
 * instead of being swapped.
 */
const SkyScene: React.FC<{ stage: SceneStage; starsOnly?: boolean }> = ({ stage, starsOnly = false }) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const restartSceneRef = useRef<(() => void) | null>(null);
  useEffect(() => { restartSceneRef.current?.(); }, [starsOnly]);
  const fullSkyRef = useRef(starsOnly);
  fullSkyRef.current = starsOnly;
  const backdropRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const planetRef = useRef<HTMLCanvasElement>(null);
  const seaRef = useRef<HTMLCanvasElement>(null);

  const framedOnce = useRef(false);
  useEffect(() => {
    const stop = frameStage(stage, prefersReducedMotion || !framedOnce.current);
    framedOnce.current = true;
    return stop;
  }, [stage, prefersReducedMotion]);

  useEffect(() => {
    const backdrop = backdropRef.current?.getContext("2d");
    const starsContext = starsRef.current?.getContext("2d");
    const planet = planetRef.current?.getContext("2d");
    const seaCanvas = seaRef.current;
    if (!backdrop || !starsContext || !planet || !seaCanvas) return;
    const sea = createSea(seaCanvas);
    const planetLayer = document.createElement("canvas");
    const sky = document.createElement("canvas");
    const skyContext = sky.getContext("2d");

    const animated = !prefersReducedMotion;
    const startedAt = performance.now();
    let frame = 0;
    let lastStars = -Infinity;
    let lastView: View | null = null;
    let lastLight = -1;
    let lastFullSky: boolean | null = null;
    let size = { width: 0, height: 0, dpr: 1 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const width = window.innerWidth;
      const height = window.innerHeight;
      for (const canvas of [backdrop.canvas, starsContext.canvas, planet.canvas]) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      seaCanvas.width = Math.round(width * dpr * SEA_SCALE);
      seaCanvas.height = Math.round(height * dpr * SEA_SCALE);
      sky.width = seaCanvas.width;
      sky.height = seaCanvas.height;
      size = { width, height, dpr };
      lastView = null; // repaint everything
    };

    // The sky as the sea mirrors it: backdrop and planet (not the stars),
    // plus whatever card floats over the water.
    const paintReflectedSky = () => {
      if (!skyContext) return;
      skyContext.setTransform(1, 0, 0, 1, 0, 0);
      skyContext.clearRect(0, 0, sky.width, sky.height);
      skyContext.drawImage(backdrop.canvas, 0, 0, sky.width, sky.height);
      skyContext.drawImage(planet.canvas, 0, 0, sky.width, sky.height);
      const subject = getReflectionSubject();
      const face = subject?.canvas;
      if (!subject || !face || face.width < 2) return;
      const scale = sky.width / size.width;
      const bounds = face.getBoundingClientRect();
      const w = face.offsetWidth;
      const h = face.offsetHeight;
      skyContext.setTransform(scale, 0, 0, scale, 0, 0);
      skyContext.globalAlpha = Number(getComputedStyle(face).opacity) || 1;
      skyContext.translate(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      skyContext.rotate((subject.rotate.get() * Math.PI) / 180);
      skyContext.beginPath();
      skyContext.roundRect(-w / 2, -h / 2, w, h, Math.min(w * 0.07, h * 0.041));
      skyContext.save();
      skyContext.clip();
      skyContext.drawImage(face, -w / 2, -h / 2, w, h);
      skyContext.restore();
      skyContext.lineWidth = 1.5;
      skyContext.strokeStyle = RIM;
      skyContext.stroke();
      skyContext.globalAlpha = 1;
    };

    const render = (now: number) => {
      const { width, height, dpr } = size;
      const view = readView();
      const light = camera.cardLight.get();
      const seconds = (now - startedAt) / 1000;

      const fullSky = fullSkyRef.current;
      // Sky, sea colour, planet and horizon only change with the camera.
      if (!lastView || !sameView(view, lastView) || light !== lastLight || fullSky !== lastFullSky) {
        paintBackdrop(backdrop, width, height, view, dpr, fullSky);
        planet.setTransform(1, 0, 0, 1, 0, 0);
        planet.clearRect(0, 0, planet.canvas.width, planet.canvas.height);
        paintPlanet(planet, planetLayer, width, height, view, dpr);
        paintHorizon(planet, width, height, view, dpr, light);
        lastView = view;
        lastLight = light;
        lastFullSky = fullSky;
      }
      if (now - lastStars >= STAR_FRAME_MS || !animated) {
        paintStars(starsContext, width, height, view, dpr, seconds, animated, fullSky);
        lastStars = now;
      }
      if (sea) {
        paintReflectedSky();
        sea.render(sky, view, width, height, animated ? seconds : 20);
      }

      frame = animated && !document.hidden ? requestAnimationFrame(render) : 0;
    };

    const restart = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    restartSceneRef.current = () => { lastView = null; restart(); };
    resize();
    frame = requestAnimationFrame(render);
    const onResize = () => {
      resize();
      restart();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", restart);
    // Without animation the loop parks after one frame; camera moves restart it.
    const unsubscribe = [camera.zoom, camera.x, camera.y, camera.cardLight].map((value) => value.on("change", restart));
    // Without animation, repaint once the card's aura has arrived.
    const settle = animated ? undefined : setTimeout(restart, 600);

    return () => {
      restartSceneRef.current = null;
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      unsubscribe.forEach((stop) => stop());
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", restart);
      sea?.dispose();
    };
  }, [prefersReducedMotion]);

  return (
    <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-[#020308]">
      <canvas ref={backdropRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={starsRef} className="absolute inset-0 h-full w-full" />
      <motion.div className="absolute inset-0" animate={{ opacity: starsOnly ? 0 : 1 }} transition={{ duration: 0.3 }}>
        <canvas ref={planetRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={seaRef} className="absolute inset-0 h-full w-full" />
      </motion.div>
      {/* Darker behind text-heavy stages, so what's in front stays easy to read. */}
      <motion.div className="absolute inset-0 bg-[#020308]" style={{ opacity: camera.veil }} />
    </motion.div>
  );
};

export default SkyScene;
