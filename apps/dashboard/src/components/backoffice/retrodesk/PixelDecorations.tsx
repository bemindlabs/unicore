'use client';

import { useRetroDeskTheme } from './RetroDeskThemeProvider';

const _ = 'transparent';

function PixelShape({ grid, px = 3, animation, className = '' }: { grid: string[][]; px?: number; animation?: string; className?: string }) {
  const { animationLevel } = useRetroDeskTheme();
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;

  const shadows = grid
    .flatMap((row, y) =>
      row.map((cell, x) => (cell === 'transparent' ? null : `${x * px}px ${y * px}px 0 0 ${cell}`))
    )
    .filter(Boolean)
    .join(', ');

  return (
    <div className={`pointer-events-none ${className}`} style={{ width: cols * px, height: rows * px, position: 'relative' }}>
      <div
        style={{
          width: px,
          height: px,
          boxShadow: shadows,
          position: 'absolute',
          top: 0,
          left: 0,
          animation: animationLevel !== 'none' ? animation : undefined,
        }}
      />
    </div>
  );
}

const STAR_GRID = [
  [_, '#ffd93d', _],
  ['#ffd93d', '#ffd93d', '#ffd93d'],
  [_, '#ffd93d', _],
];

const HEART_GRID = [
  [_, '#ff6b9d', _, '#ff6b9d', _],
  ['#ff6b9d', '#ff6b9d', '#ff6b9d', '#ff6b9d', '#ff6b9d'],
  ['#ff6b9d', '#ff6b9d', '#ff6b9d', '#ff6b9d', '#ff6b9d'],
  [_, '#ff6b9d', '#ff6b9d', '#ff6b9d', _],
  [_, _, '#ff6b9d', _, _],
];

const CLOUD_GRID = [
  [_, _, '#e8e8e8', '#e8e8e8', _, _, _, _, _, _],
  [_, '#e8e8e8', '#ffffff', '#ffffff', '#e8e8e8', _, '#e8e8e8', '#e8e8e8', _, _],
  ['#e8e8e8', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e8e8e8', '#ffffff', '#ffffff', '#e8e8e8', _],
  ['#e8e8e8', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e8e8e8'],
  [_, '#e8e8e8', '#e8e8e8', '#e8e8e8', '#e8e8e8', '#e8e8e8', '#e8e8e8', '#e8e8e8', '#e8e8e8', _],
];

const FLOWER_GRID = [
  [_, _, '#ff6b9d', _, _],
  [_, '#ff6b9d', '#ffd93d', '#ff6b9d', _],
  ['#ff6b9d', '#ffd93d', '#ffd93d', '#ffd93d', '#ff6b9d'],
  [_, '#ff6b9d', '#ffd93d', '#ff6b9d', _],
  [_, _, '#ff6b9d', _, _],
  [_, _, '#a8e6cf', _, _],
  [_, _, '#a8e6cf', _, _],
];

export function PixelStar({ className, px }: { className?: string; px?: number }): JSX.Element {
  return <PixelShape grid={STAR_GRID} px={px ?? 3} animation="pixelTwinkle 2s ease-in-out infinite" className={className} />;
}

export function PixelHeart({ className, px }: { className?: string; px?: number }): JSX.Element {
  return <PixelShape grid={HEART_GRID} px={px ?? 2} animation="pixelFloat 3s ease-in-out infinite" className={className} />;
}

export function PixelCloud({ className, px }: { className?: string; px?: number }): JSX.Element {
  return <PixelShape grid={CLOUD_GRID} px={px ?? 2} animation="pixelFloat 5s ease-in-out infinite" className={className} />;
}

export function PixelFlower({ className, px }: { className?: string; px?: number }): JSX.Element {
  return <PixelShape grid={FLOWER_GRID} px={px ?? 3} className={className} />;
}
