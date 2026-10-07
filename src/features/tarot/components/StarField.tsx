import React, { useEffect, useRef } from "react";

interface StarFieldProps {
  /** Horizon as a fraction of the viewport height; stars set below it. */
  horizon: number;
  animated: boolean;
}

// The sky turns around the celestial pole, placed high on the left, so stars
// further out rise and set at the horizon. Real time is 15°/hour; this is a
// gentle time-lapse of one turn in 30 minutes.
const POLE = { x: 0.2, y: 0.14 };
const TURN_SECONDS = 1800;
const STAR_COUNT = 900;
const MAX_DPR = 2;
// The sky moves a fraction of a degree a second, so 30 redraws a second is plenty.
const FRAME_MS = 1000 / 30;

interface Star {
  radius: number;
  angle: number;
  size: number;
  brightness: number;
  color: string;
  twinkle: number;
}

// A fixed seed keeps the same sky between visits.
const createStars = () => {
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const colors = ["255,255,255", "214,226,255", "255,236,214", "198,214,255"];
  return Array.from({ length: STAR_COUNT }, (): Star => {
    const magnitude = Math.pow(random(), 3.2); // Mostly faint, a few bright.
    return {
      radius: Math.sqrt(random()),
      angle: random() * Math.PI * 2,
      size: 0.35 + magnitude * 1.5,
      brightness: 0.18 + magnitude * 0.82,
      color: colors[Math.floor(random() * colors.length)],
      twinkle: random() * Math.PI * 2,
    };
  });
};

/** The night sky behind the home page, turning about its pole. */
const StarField: React.FC<StarFieldProps> = ({ horizon, animated }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const stars = createStars();
    const startedAt = performance.now();
    let frame = 0;
    let lastDrawn = -Infinity;

    const draw = (now: number) => {
      if (animated && now - lastDrawn < FRAME_MS) {
        frame = document.hidden ? 0 : requestAnimationFrame(draw);
        return;
      }
      lastDrawn = now;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const horizonY = height * horizon;
      const poleX = width * POLE.x;
      const poleY = height * POLE.y;
      // Far enough to reach the farthest visible corner from the pole.
      const reach = Math.hypot(Math.max(poleX, width - poleX), horizonY - poleY);
      const seconds = (now - startedAt) / 1000;
      // Counter-clockwise on screen, as the northern sky turns.
      const turn = animated ? -(seconds / TURN_SECONDS) * Math.PI * 2 : 0;

      context.save();
      context.beginPath();
      context.rect(0, 0, width, horizonY);
      context.clip();

      for (const star of stars) {
        const radius = star.radius * reach;
        const angle = star.angle + turn;
        const x = poleX + Math.cos(angle) * radius;
        const y = poleY + Math.sin(angle) * radius;
        if (x < -40 || x > width + 40 || y < -40 || y > horizonY + 4) continue;

        // Dimmed by thicker air near the horizon, with a slow shimmer.
        const extinction = Math.min(1, Math.max(0, (horizonY - y) / (height * 0.18)));
        const shimmer = animated ? 0.85 + 0.15 * Math.sin(seconds * 1.7 + star.twinkle) : 1;
        const alpha = star.brightness * shimmer * (0.25 + 0.75 * extinction);

        context.fillStyle = `rgba(${star.color},${alpha})`;
        context.beginPath();
        context.arc(x, y, star.size, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      frame = animated && !document.hidden ? requestAnimationFrame(draw) : 0;
    };

    const restart = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", restart);
    document.addEventListener("visibilitychange", restart);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", restart);
      document.removeEventListener("visibilitychange", restart);
    };
  }, [horizon, animated]);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
};

export default StarField;
