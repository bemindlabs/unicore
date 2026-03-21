'use client';

import type { AgentStatus } from '@/lib/backoffice/types';
import { useMemo } from 'react';

interface Props {
  name?: string;
  color: string;
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

type SpriteTemplate = { map: string[], palette: Record<string, (c: string) => string> };

const TEMPLATES: SpriteTemplate[] = [
  // 1. Classic Standard Agent
  {
    map: [
      '_ _ H H H H _ _',
      '_ H H H H H H _',
      '_ S S S S S S _',
      '_ S E S S E S _',
      '_ S S S S S S _',
      '_ _ C C C C _ _',
      '_ C C C C C C _',
      'C C C C C C C C',
      '_ _ P P P P _ _',
      '_ _ P _ _ P _ _',
    ],
    palette: {
       '_': () => 'transparent',
       'H': () => '#3a2a1a', 
       'S': () => '#f5d0a9', 
       'E': () => '#222', 
       'C': (color) => color, 
       'P': () => '#2a3a4a', 
    }
  },
  // 2. The Robot
  {
    map: [
      '_ A A A A A A _',
      '_ A R R R R A _',
      '_ A R E E R A _',
      '_ A R R R R A _',
      '_ _ A A A A _ _',
      '_ D M M M M D _',
      'D D M C C M D D',
      'D D M M M M D D',
      '_ _ L L L L _ _',
      '_ _ L _ _ L _ _',
    ],
    palette: {
       '_': () => 'transparent',
       'A': (c) => c, 
       'R': () => '#111', 
       'E': () => '#06b6d4', 
       'D': () => '#475569', 
       'M': () => '#94a3b8', 
       'C': () => '#fbbf24', 
       'L': () => '#334155', 
    }
  },
  // 3. Cute Slime
  {
    map: [
      '_ _ _ _ _ _ _ _',
      '_ _ _ _ _ _ _ _',
      '_ _ C C C C _ _',
      '_ C C C C C C _',
      '_ C C C C C C _',
      '_ C E C C E C _',
      'C C C C C C C C',
      'C C C C C C C C',
      'C D D C C D D C',
      'C C C C C C C C',
    ],
    palette: {
      '_': () => 'transparent',
      'C': (color) => color,
      'E': () => '#111',
      'D': () => '#ffffff40',
    }
  },
  // 4. Wizard
  {
    map: [
      '_ _ _ B B _ _ _',
      '_ _ B R R B _ _',
      '_ B R R R R B _',
      'C C C C C C C C',
      '_ _ S E S E _ _',
      '_ _ M M M M _ _',
      '_ R R R R R R _',
      'R R R R R R R R',
      '_ R R R R R R _',
      '_ R R _ _ R R _',
    ],
    palette: {
      '_': () => 'transparent',
      'B': () => '#64748b',
      'C': () => '#1e293b', 
      'R': (color) => color, 
      'S': () => '#f5d0a9', 
      'E': () => '#222', 
      'M': () => '#e2e8f0', 
    }
  },
  // 5. Ninja
  {
    map: [
       '_ _ N N N N _ _',
       '_ N N N N N N _',
       '_ N S S S S N _',
       '_ N S E S E N _',
       '_ N N N N N N _',
       '_ _ N R R N _ _',
       '_ N N N N N N _',
       'N N N N N N N N',
       '_ _ N N N N _ _',
       '_ _ N _ _ N _ _',
    ],
    palette: {
       '_': () => 'transparent',
       'N': () => '#1e293b',
       'S': () => '#f5d0a9',
       'E': () => '#fff',
       'R': (color) => color,
    }
  },
  // 6. Cyberpunk
  {
    map: [
      '_ _ H H H H _ _',
      '_ H H H H H H _',
      '_ H R R R R H _',
      '_ H R E R E H _',
      '_ _ G G G G _ _',
      '_ _ J J J J _ _',
      '_ J J J J J J _',
      'J C J J J J C J',
      '_ _ P P P P _ _',
      '_ _ P _ _ P _ _',
    ],
    palette: {
      '_': () => 'transparent',
      'H': () => '#ec4899', // Pink hair
      'R': () => '#334155', // Visor
      'E': (color) => color, // Glowing visor dots
      'G': () => '#0f172a', // Mask
      'J': () => '#eab308', // Yellow jacket
      'C': () => '#111827', // Collar/Trim
      'P': () => '#1e293b', // Pants
    }
  }
];

export function PixelAvatar({ color, status, name = '', size = 'md', className = '' }: Props) {
  const scales = { sm: 2, md: 3, lg: 4 };
  const px = scales[size];

  // Derive template deterministically from name or color
  const seed = name || color;
  const hash = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const template = TEMPLATES[hash % TEMPLATES.length];

  const shadows = useMemo(() => {
    return template.map
      .flatMap((rowStr, y) => {
        const row = rowStr.split(' ');
        return row.map((cell, x) => {
          const resolveColor = template.palette[cell] || (() => 'transparent');
          const cellColor = resolveColor(color);
          return cellColor === 'transparent' ? null : `${x * px}px ${y * px}px 0 0 ${cellColor}`;
        });
      })
      .filter(Boolean)
      .join(', ');
  }, [template, color, px]);

  return (
    <div className={`relative ${className} group`} style={{ width: 8 * px, height: 10 * px }}>
      {/* Ground Shadow */}
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-black/20 blur-[1px]" 
        style={{ width: 6 * px, height: px, borderRadius: '50%' }} 
      />
      
      {/* Sprite */}
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
