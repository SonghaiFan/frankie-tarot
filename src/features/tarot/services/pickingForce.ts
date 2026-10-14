import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";

export interface CardNode extends SimulationNodeDatum {
  layer?: number;
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
export const cardPoses = new WeakMap<HTMLElement, CardNode>();

// Edges depend only on identities, so removing a picked card never rewires the deck.
export function graphEdges(ids: number[]) {
  const available = new Set(ids);
  // A seeded permutation supplies random-looking, reproducible connectivity.
  const order = Array.from({ length: 78 }, (_, id) => id).sort((a, b) => {
    const hash = (id: number) => (Math.sin((id + 1) * 127.1) * 43758.5453) % 1;
    return hash(a) - hash(b);
  });
  return order.flatMap((id, index) =>
    [1, ...(index % 3 === 0 ? [13] : [])].flatMap((step) => {
      const target = order[(index + step) % order.length];
      return available.has(id) && available.has(target)
        ? [{ source: id, target }]
        : [];
    }),
  );
}

export function constrainCard(node: CardNode, width: number, height: number) {
  const a = (node.rotation * Math.PI) / 180;
  const ex =
    (Math.abs(Math.cos(a)) * node.width + Math.abs(Math.sin(a)) * node.height) /
      2 +
    4;
  const ey =
    (Math.abs(Math.sin(a)) * node.width + Math.abs(Math.cos(a)) * node.height) /
      2 +
    4;
  const limitX = Math.max(0, width / 2 - ex),
    limitY = Math.max(0, height / 2 - ey);
  const clampX = (x: number) => Math.max(-limitX, Math.min(limitX, x));
  const clampY = (y: number) => Math.max(-limitY, Math.min(limitY, y));
  if (node.fx != null) node.fx = clampX(node.fx);
  if (node.fy != null) node.fy = clampY(node.fy);
  const x = clampX(node.x),
    y = clampY(node.y);
  if (x !== node.x) node.vx = 0;
  if (y !== node.y) node.vy = 0;
  node.x = x;
  node.y = y;
}

export function createCardSimulation(
  nodes: CardNode[],
  width: number,
  height: number,
) {
  const spacing = Math.sqrt((width * height) / Math.max(nodes.length, 1));
  const links = graphEdges(nodes.map((n) => n.id));
  const simulation = forceSimulation(nodes)
    .stop()
    .alphaDecay(0.065)
    .velocityDecay(0.38)
    .force(
      "links",
      forceLink<CardNode, { source: number; target: number }>(links)
        .id((n) => n.id)
        .distance(spacing * 1.7)
        .strength(0.055),
    )
    .force(
      "charge",
      forceManyBody<CardNode>()
        .strength(-spacing * 1.8)
        .distanceMax(spacing * 4),
    )
    // Soft, density-aware separation: 78 full card rectangles cannot tile a phone.
    .force(
      "collision",
      forceCollide<CardNode>()
        .radius((n) => Math.min(n.width * 0.6, spacing * 0.43))
        .strength(0.65)
        .iterations(2),
    )
    .force("x", forceX(0).strength(0.018))
    .force("y", forceY(0).strength(0.018));
  return simulation;
}
