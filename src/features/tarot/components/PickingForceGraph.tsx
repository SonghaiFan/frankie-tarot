import React from "react";
import {
  cardPoses,
  constrainCard,
  createCardSimulation,
  graphEdges,
  type CardNode,
} from "../services/pickingForce";

/** Imperative physics owns only the position wrapper, never Motion's flight node. */
export default function PickingForceGraph({
  stageRef,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    const stage = stageRef.current,
      svg = svgRef.current;
    if (!stage || !svg) return;
    let nodes: CardNode[] = [],
      elements: HTMLElement[] = [];
    let edges: { a: CardNode; b: CardNode; line: SVGLineElement }[] = [];
    let simulation: ReturnType<typeof createCardSimulation> | undefined;
    let bounds = stage.getBoundingClientRect(),
      frame = 0,
      previous = 0,
      accumulator = 0;
    let drag:
      | {
          node: CardNode;
          element: HTMLElement;
          pointer: number;
          x: number;
          y: number;
          dx: number;
          dy: number;
          moved: boolean;
        }
      | undefined;
    let suppressClickUntil = 0,
      topLayer = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const paint = () => {
      nodes.forEach((node, i) => {
        constrainCard(node, bounds.width, bounds.height);
        elements[i].parentElement!.style.transform =
          `translate3d(${node.x}px,${node.y}px,0)`;
      });
      edges.forEach(({ a, b, line }) => {
        line.setAttribute("x1", String(a.x + bounds.width / 2));
        line.setAttribute("y1", String(a.y + bounds.height / 2));
        line.setAttribute("x2", String(b.x + bounds.width / 2));
        line.setAttribute("y2", String(b.y + bounds.height / 2));
        line.style.opacity =
          drag && (a === drag.node || b === drag.node) ? "0.5" : "0.09";
      });
      stage.dispatchEvent(new Event("forceframe"));
    };
    const tick = (now: number) => {
      frame = 0;
      if (!simulation || document.hidden) return;
      accumulator += Math.min(50, previous ? now - previous : 1000 / 60);
      previous = now;
      while (accumulator >= 1000 / 60) {
        simulation.tick();
        nodes.forEach((n) => constrainCard(n, bounds.width, bounds.height));
        accumulator -= 1000 / 60;
      }
      const active = simulation.alpha() > simulation.alphaMin() || !!drag;
      stage.dataset.forceSettled = String(!active);
      paint();
      if (active) frame = requestAnimationFrame(tick);
      else previous = 0;
    };
    const wake = (alpha = 0.3) => {
      simulation?.alpha(Math.max(simulation.alpha(), alpha));
      stage.dataset.forceSettled = "false";
      if (!frame && !document.hidden) {
        previous = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const sync = () => {
      bounds = stage.getBoundingClientRect();
      const old = new Map(nodes.map((n) => [n.id, n]));
      elements = [...stage.querySelectorAll<HTMLElement>("[data-cloud-card]")];
      nodes = elements.map((element) => {
        const id = Number(element.dataset.cloudCard);
        const node = old.get(id) ?? {
          id,
          x: Number(element.parentElement!.dataset.seedX),
          y: Number(element.parentElement!.dataset.seedY),
          width: 0,
          height: 0,
          rotation: Number(element.dataset.rotation),
        };
        node.width = element.offsetWidth;
        node.height = element.offsetHeight;
        cardPoses.set(element, node);
        return node;
      });
      simulation?.stop();
      simulation = createCardSimulation(nodes, bounds.width, bounds.height);
      svg.replaceChildren();
      const byId = new Map(nodes.map((n) => [n.id, n]));
      edges = graphEdges(nodes.map((n) => n.id)).map((edge) => {
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        svg.appendChild(line);
        return { a: byId.get(edge.source)!, b: byId.get(edge.target)!, line };
      });
      if (reduced.matches) {
        for (let i = 0; i < 110; i++) {
          simulation.tick();
          nodes.forEach((n) => constrainCard(n, bounds.width, bounds.height));
        }
        simulation.alpha(0);
      } else simulation.alpha(old.size ? 0.18 : 0.65);
      paint();
      wake(reduced.matches ? 0 : 0.18);
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || drag) return;
      const element = (event.target as Element).closest<HTMLElement>(
        "[data-cloud-card]",
      );
      const node = element && cardPoses.get(element);
      if (!element || !node) return;
      bounds = stage.getBoundingClientRect();
      drag = {
        node,
        element,
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dx: node.x - (event.clientX - bounds.left - bounds.width / 2),
        dy: node.y - (event.clientY - bounds.top - bounds.height / 2),
        moved: false,
      };
      node.fx = node.x;
      node.fy = node.y;
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      if (
        !drag.moved &&
        Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8
      )
        return;
      if (!drag.moved) {
        drag.node.layer = ++topLayer;
        drag.element.parentElement!.style.zIndex = String(topLayer);
      }
      drag.moved = true;
      event.preventDefault();
      drag.node.fx = event.clientX - bounds.left - bounds.width / 2 + drag.dx;
      drag.node.fy = event.clientY - bounds.top - bounds.height / 2 + drag.dy;
      constrainCard(drag.node, bounds.width, bounds.height);
      drag.node.x = drag.node.fx!;
      drag.node.y = drag.node.fy!;
      wake(0.22);
    };
    const up = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const moved = drag.moved;
      drag.node.fx = null;
      drag.node.fy = null;
      drag = undefined;
      if (event.type === "pointercancel")
        suppressClickUntil = performance.now() + 700;
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil = performance.now() + 700;
        wake(0.22);
      }
    };
    const click = (event: MouseEvent) => {
      if (event.detail > 0 && performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const visibility = () => {
      if (document.hidden) {
        if (drag) {
          drag.node.fx = null;
          drag.node.fy = null;
          drag = undefined;
        }
        cancelAnimationFrame(frame);
        frame = 0;
      } else wake(0);
    };
    // Observe only the cloud; SVG line updates must not restart the simulation.
    const observer = new MutationObserver((records) => {
      if (records.some((r) => r.target !== svg && !svg.contains(r.target)))
        sync();
    });
    observer.observe(stage, { childList: true, subtree: true });
    const resize = new ResizeObserver(sync);
    resize.observe(stage);
    stage.addEventListener("pointerdown", down, true);
    stage.addEventListener("pointermove", move, {
      capture: true,
      passive: false,
    });
    stage.addEventListener("pointerup", up, true);
    stage.addEventListener("pointercancel", up, true);
    stage.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", visibility);
    sync();
    return () => {
      simulation?.stop();
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      elements.forEach((e) => cardPoses.delete(e));
      stage.removeEventListener("pointerdown", down, true);
      stage.removeEventListener("pointermove", move, true);
      stage.removeEventListener("pointerup", up, true);
      stage.removeEventListener("pointercancel", up, true);
      stage.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [stageRef]);
  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      data-force-links=""
      className="pointer-events-none absolute inset-0 w-full h-full opacity-0"
      stroke="white"
      strokeWidth="0.75"
    />
  );
}
