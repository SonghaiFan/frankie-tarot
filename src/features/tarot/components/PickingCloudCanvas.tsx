import React, { useEffect, useRef } from "react";
import { getCardBackImageUrl, type CardBackId } from "../constants/cardBacks";
import { CARD_FRAME_PRESETS, useCardFrame } from "../hooks/useCardFrame";
import {
  createPickingCloudRenderer,
  type CloudSurface,
} from "../services/pickingCloudRenderer";
import {
  getCardBackAppearance,
  subscribeCardBackAppearance,
} from "../services/cardBackAppearance";

interface Props {
  stageRef: React.RefObject<HTMLDivElement | null>;
  cardBackId: CardBackId;
  onReady: (ready: boolean) => void;
}

/** The DOM retains hit testing/shared-layout flights; this canvas paints the deck. */
export default function PickingCloudCanvas({
  stageRef,
  cardBackId,
  onReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCardFrame(cardBackId);
  useEffect(() => {
    const canvas = canvasRef.current,
      stage = stageRef.current;
    if (!canvas || !stage) return;
    const controller = new AbortController();
    let disposed = false,
      announced = false,
      frameId = 0;
    let renderer:
      Awaited<ReturnType<typeof createPickingCloudRenderer>> | undefined;
    let surfaces: CloudSurface[] = [];
    let dirty = true,
      movingUntil = performance.now() + 750;
    let bounds: DOMRect;
    const started = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const render = (now: number) => {
      frameId = 0;
      if (disposed || !renderer || document.hidden) return;
      try {
        if (dirty) {
          surfaces = [
            ...stage.querySelectorAll<HTMLElement>("[data-cloud-card]"),
          ].map((element) => ({
            element,
            rotation: Number(element.dataset.rotation),
          }));
          bounds = stage.getBoundingClientRect();
        }
        const moving = now < movingUntil;
        renderer.render(
          surfaces,
          bounds,
          reduced.matches ? 20 : (now - started) / 1000,
          dirty || moving,
        );
        dirty = false;
        if (!announced) {
          renderer.assertHealthy();
          announced = true;
          onReady(true);
        }
        if (
          surfaces.length > 0 &&
          stage.dataset.forceSettled !== "false" &&
          (moving ||
            (!reduced.matches && getCardBackAppearance().mode === "gradient"))
        )
          frameId = requestAnimationFrame(render);
      } catch {
        // Keep the existing DOM card backs functional if this GPU path fails.
        disposed = true;
        renderer.dispose();
        onReady(false);
      }
    };
    const invalidate = () => {
      dirty = true;
      movingUntil = performance.now() + 750;
      if (!frameId && !disposed && renderer && !document.hidden)
        frameId = requestAnimationFrame(render);
    };
    const forceFrame = () => {
      if (!renderer || disposed || document.hidden) return;
      cancelAnimationFrame(frameId);
      movingUntil = performance.now() + 30;
      render(performance.now());
    };
    stage.addEventListener("forceframe", forceFrame);
    const observer = new MutationObserver(invalidate);
    observer.observe(stage, { childList: true, subtree: true });
    const resize = new ResizeObserver(invalidate);
    resize.observe(stage);
    stage.addEventListener("pointerover", invalidate);
    stage.addEventListener("pointerout", invalidate);
    window.addEventListener("resize", invalidate, { passive: true });
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      } else invalidate();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      disposed = true;
      cancelAnimationFrame(frameId);
      onReady(false);
    };
    canvas.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", invalidate);
    const unsubscribe = subscribeCardBackAppearance(invalidate);
    onReady(false);
    void createPickingCloudRenderer(
      canvas,
      getCardBackImageUrl(cardBackId),
      CARD_FRAME_PRESETS[frame.preset],
      controller.signal,
    )
      .then((result) => {
        if (disposed) {
          result.dispose();
          return;
        }
        renderer = result;
        invalidate();
      })
      .catch(() => {
        if (!disposed) onReady(false);
      });
    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      stage.removeEventListener("forceframe", forceFrame);
      resize.disconnect();
      unsubscribe();
      renderer?.dispose();
      stage.removeEventListener("pointerover", invalidate);
      stage.removeEventListener("pointerout", invalidate);
      window.removeEventListener("resize", invalidate);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", invalidate);
      canvas.removeEventListener("webglcontextlost", lost);
    };
  }, [stageRef, cardBackId, frame.preset, onReady]);
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-picking-gpu=""
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
