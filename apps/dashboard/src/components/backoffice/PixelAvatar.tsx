'use client';

import type { AgentStatus } from '@/lib/backoffice/types';

interface Props {
  color: string;
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PixelAvatar({ color, status, size = 'md', className = '' }: Props) {
  const scales = { sm: 2, md: 3, lg: 4 };
  const px = scales[size];

  const skin = '#f5d0a9';
  const hair = '#3a2a1a';
  const shirt = color;
  const pants = '#2a3a4a';
  const _ = 'transparent';

  const grid: string[][] = [
    [_, _, hair, hair, hair, hair, _, _],
    [_, hair, hair, hair, hair, hair, hair, _],
    [_, skin, skin, skin, skin, skin, skin, _],
    [_, skin, '#222', skin, skin, '#222', skin, _],
    [_, skin, skin, skin, skin, skin, skin, _],
    [_, _, skin, skin, skin, skin, _, _],
    [_, shirt, shirt, shirt, shirt, shirt, shirt, _],
    [shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt],
    [_, _, pants, pants, pants, pants, _, _],
    [_, _, pants, _, _, pants, _, _],
  ];

  const shadows = grid
    .flatMap((row, y) =>
      row.map((cell, x) => (cell === 'transparent' ? null : `${x * px}px ${y * px}px 0 0 ${cell}`))
    )
    .filter(Boolean)
    .join(', ');

  return (
    <div className={`relative ${className} group`} style={{ width: 8 * px, height: 10 * px }}>
      <div
        className="transition-transform group-hover:-translate-y-2 group-hover:scale-110"
        style={{
          width: px,
          height: px,
          boxShadow: shadows,
          position: 'absolute',
          top: 0,
          left: 0,
          animation: status === 'working' ? 'pixelBob 1s ease-in-out infinite alternate' : 'pixelFloat 4s ease-in-out infinite',
        }}
      />
      {status === 'working' && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 animate-pulse"
          style={{
            width: 6 * px,
            height: 2,
            background: `radial-gradient(ellipse, ${color}60, transparent)`,
          }}
        />
      )}
    </div>
  );
}
