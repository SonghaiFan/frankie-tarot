import React from "react";
import { SpreadType } from "@/features/tarot/types";

export interface SpreadPosition {
  x: number | string;
  y: number | string;
  label: string;
  rotation?: number;
  labelPosition?: "top" | "bottom" | "left" | "right";
  zIndex?: number;
}

export type SpreadPositionLayout = Omit<SpreadPosition, "label">;

type IconCard = {
  x: number;
  y: number;
  w?: number;
  h?: number;
  rotate?: number;
  accent?: boolean;
};

type IconLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  accent?: boolean;
  dashed?: boolean;
};

type IconCircle = {
  cx: number;
  cy: number;
  r: number;
  accent?: boolean;
  filled?: boolean;
};

const getIconPalette = (isActive: boolean) => ({
  stroke: isActive ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.2)",
  fill: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)",
  accentStroke: isActive ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.24)",
  accentFill: isActive ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.42)",
});

export function SpreadIcon({
  isActive,
  cards = [],
  lines = [],
  circles = [],
  paths = [],
}: {
  isActive: boolean;
  cards?: IconCard[];
  lines?: IconLine[];
  circles?: IconCircle[];
  paths?: { d: string; accent?: boolean; filled?: boolean }[];
}) {
  const palette = getIconPalette(isActive);

  return (
    <div
      className={`relative w-full h-full transition-all duration-500 ${
        isActive ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.18)]" : ""
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full overflow-visible"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {lines.map((line, index) => (
          <line
            key={`line-${index}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.accent ? palette.accentStroke : palette.stroke}
            strokeWidth={line.accent ? 1.4 : 1.1}
            strokeDasharray={line.dashed ? "1.5 2" : undefined}
            opacity={line.accent ? 0.95 : 0.8}
          />
        ))}
        {paths.map((path, index) => (
          <path
            key={`path-${index}`}
            d={path.d}
            stroke={path.accent ? palette.accentStroke : palette.stroke}
            fill={path.filled ? palette.accentFill : "none"}
            strokeWidth={path.accent ? 1.4 : 1.1}
          />
        ))}
        {circles.map((circle, index) => (
          <circle
            key={`circle-${index}`}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            stroke={circle.accent ? palette.accentStroke : palette.stroke}
            fill={
              circle.filled
                ? circle.accent
                  ? palette.accentFill
                  : palette.fill
                : "none"
            }
            strokeWidth={circle.accent ? 1.4 : 1.1}
          />
        ))}
        {cards.map((card, index) => {
          const w = card.w ?? 4;
          const h = card.h ?? 6;

          return (
            <rect
              key={`card-${index}`}
              x={card.x}
              y={card.y}
              width={w}
              height={h}
              rx={0.9}
              ry={0.9}
              transform={
                card.rotate
                  ? `rotate(${card.rotate} ${card.x + w / 2} ${card.y + h / 2})`
                  : undefined
              }
              fill={card.accent ? palette.accentFill : palette.fill}
              stroke="none"
            />
          );
        })}
      </svg>
    </div>
  );
}

function getFlexIconCards(cardCount: number): IconCard[] {
  const width = cardCount <= 1 ? 5 : cardCount <= 4 ? 4 : cardCount <= 7 ? 3 : 2.4;
  const gap = cardCount >= 10 ? 0.6 : 1;
  const height = Math.min(8, Math.max(4.5, width * 1.55));
  const totalWidth = cardCount * width + Math.max(0, cardCount - 1) * gap;
  const startX = (24 - totalWidth) / 2;
  const y = (24 - height) / 2;

  return Array.from({ length: cardCount }, (_, index) => ({
    x: startX + index * (width + gap),
    y,
    w: width,
    h: height,
  }));
}

function getAbsoluteIconCards(positions: SpreadPositionLayout[]): IconCard[] {
  const xs = positions.map((p) => (typeof p.x === "number" ? p.x : 0));
  const ys = positions.map((p) => (typeof p.y === "number" ? p.y : 0));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 2.5;
  const width = 24 - pad * 2;
  const height = 24 - pad * 2;

  return positions.map((pos) => {
    const nx = typeof pos.x === "number" ? pos.x : 0;
    const ny = typeof pos.y === "number" ? pos.y : 0;
    const cx = pad + ((nx - minX) / (maxX - minX || 1)) * width;
    const cy = pad + ((ny - minY) / (maxY - minY || 1)) * height;
    const w = 3.8;
    const h = 5.8;

    return {
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      rotate: pos.rotation,
    };
  });
}

export function LayoutDrivenIcon({
  isActive,
  layoutType,
  cardCount,
  positions,
}: {
  isActive: boolean;
  layoutType: "flex" | "absolute";
  cardCount: number;
  positions?: SpreadPositionLayout[];
}) {
  const cards =
    layoutType === "absolute" && positions?.length
      ? getAbsoluteIconCards(positions)
      : getFlexIconCards(cardCount);

  return <SpreadIcon isActive={isActive} cards={cards} />;
}

export const makeSpreadIcon = (spread: {
  id: SpreadType;
  layout: {
    type: "flex" | "absolute";
    positions?: SpreadPositionLayout[] | null;
  };
  cardCount: number;
}) => {
  return (isActive: boolean) => (
    <LayoutDrivenIcon
      isActive={isActive}
      layoutType={spread.layout.type}
      cardCount={spread.cardCount}
      positions={spread.layout.positions ?? undefined}
    />
  );
};
