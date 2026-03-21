'use client';

import type { AgentStatus } from '@/lib/backoffice/types';
import { useMemo } from 'react';

interface Props {
  name?: string;
  color: string;
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  forceStyle?: number;
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
  },
  // 7. Doge
  {
    map: [
      '_ E E _ _ E E _',
      '_ E E E E E E _',
      'E E O E E O E E',
      'E _ _ N N _ _ E',
      'E _ N N N N _ E',
      '_ E E P P E E _',
      '_ _ P P P P _ _',
      '_ E E P P E E _',
      '_ _ E E E E _ _',
      '_ E E _ _ E E _'
    ],
    palette: {
      '_': () => 'transparent',
      'E': () => '#facc15', // Yellow/Gold
      'O': () => '#000',    // Black Eyes
      'N': () => '#333',    // Dark Nose
      'P': () => '#fef08a'  // Light belly
    }
  },
  // 8. Pepe
  {
    map: [
      '_ _ G G G G _ _',
      '_ G G G G G G _',
      '_ G G G G G G _',
      'G W O G G O W G',
      'G G G G G G G G',
      '_ G R R R R G _',
      '_ _ G G G G _ _',
      '_ G G P P G G _',
      '_ _ P P P P _ _',
      '_ P P _ _ P P _'
    ],
    palette: {
      '_': () => 'transparent',
      'G': () => '#4ade80', // Apple Green
      'W': () => '#fff',    // Sclera
      'O': () => '#000',    // Pupil
      'R': () => '#ef4444', // Red Lips
      'P': () => '#1e40af'  // Blue Pants
    }
  },
  // 9. Floki (Viking Dog)
  {
    map: [
      'M _ S S S S _ M',
      'M _ S _ _ S _ M',
      '_ Y Y Y Y Y Y _',
      'Y Y O Y Y O Y Y',
      'Y _ _ N N _ _ Y',
      '_ Y Y Y Y Y Y _',
      '_ _ B B B B _ _',
      '_ Y Y B B Y Y _',
      '_ _ Y Y Y Y _ _',
      '_ Y Y _ _ Y Y _'
    ],
    palette: {
      '_': () => 'transparent',
      'M': () => '#f8fafc', // White Horns
      'S': () => '#64748b', // Iron Helmet
      'Y': () => '#fbbf24', // Gold Dog
      'O': () => '#000',    // Eyes
      'N': () => '#333',    // Nose
      'B': () => '#78350f'  // Brown Vest
    }
  },
  // 10. Shib (Red Dog)
  {
    map: [
      '_ R R _ _ R R _',
      '_ R R R R R R _',
      'R R W R R W R R',
      'R _ _ N N _ _ R',
      'R _ N N N N _ R',
      '_ R R W W R R _',
      '_ _ W W W W _ _',
      '_ R R W W R R _',
      '_ _ R R R R _ _',
      '_ R R _ _ R R _'
    ],
    palette: {
      '_': () => 'transparent',
      'R': () => '#dc2626', // Shiba Red
      'W': () => '#ffffff', // White
      'N': () => '#000'     // Nose
    }
  },
  // 11. Bonk (Orange Dog with Bat)
  {
    map: [
      '_ _ _ _ I I _ _',
      '_ O O _ _ O O _',
      '_ O O O O O O _',
      'O O B O O B O O',
      'O _ N N N N _ O',
      '_ O O W W O O I',
      '_ _ W W W W _ I',
      '_ O O W W O O I',
      '_ _ O O O O _ I',
      '_ O O _ _ O O _'
    ],
    palette: {
      '_': () => 'transparent',
      'O': () => '#f97316', // Orange
      'B': () => '#111',    // Eyes
      'W': () => '#ffedd5', // Light Chest
      'N': () => '#000',    // Nose
      'I': () => '#92400e'  // Brown Bat (Bonk!)
    }
  }
];

export function PixelAvatar({ color, status, name = '', size = 'md', className = '', forceStyle }: Props) {
  const scales = { sm: 2, md: 3, lg: 4 };
  const px = scales[size];

  // Derive template deterministically from name or color
  const seed = name || color;
  const hash = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const template = forceStyle !== undefined ? TEMPLATES[forceStyle % TEMPLATES.length] : TEMPLATES[hash % TEMPLATES.length];

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
