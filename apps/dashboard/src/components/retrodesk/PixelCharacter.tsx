'use client';

import type { RetroDeskCharacter } from '@/lib/backoffice/retrodesk-characters';
import { useRetroDeskTheme } from './RetroDeskThemeProvider';

type AnimationType = 'idle' | 'bounce' | 'wave' | 'sleep' | 'celebrate' | 'none';

interface Props {
  character: RetroDeskCharacter;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animation?: AnimationType;
  flipped?: boolean;
  speechBubble?: string;
  className?: string;
}

const SCALES = { xs: 1, sm: 2, md: 3, lg: 4, xl: 6 };

const ANIMATION_MAP: Record<AnimationType, string | undefined> = {
  idle: 'pixelFloat 3s ease-in-out infinite',
  bounce: 'pixelBounce 1s ease-in-out infinite',
  wave: 'pixelWave 2s ease-in-out infinite',
  sleep: 'pixelFloat 4s ease-in-out infinite',
  celebrate: 'pixelCelebrate 1.5s ease-in-out infinite',
  none: undefined,
};

export function PixelCharacter({ character, size = 'md', animation = 'idle', flipped, speechBubble, className = '' }: Props): JSX.Element {
  const { animationLevel } = useRetroDeskTheme();
  const px = SCALES[size];
  const cols = character.grid[0]?.length ?? 12;
  const rows = character.grid.length;

  const shadows = character.grid
    .flatMap((row, y) =>
      row.map((cell, x) => (cell === 'transparent' ? null : `${x * px}px ${y * px}px 0 0 ${cell}`))
    )
    .filter(Boolean)
    .join(', ');

  const effectiveAnimation =
    animationLevel === 'none' ? undefined : ANIMATION_MAP[animation];

  const message = speechBubble ?? character.defaultMessage;

  return (
    <div
      className={`relative inline-flex flex-col items-center ${className}`}
      style={{ transform: flipped ? 'scaleX(-1)' : undefined }}
    >
      {message && speechBubble !== undefined && (
        <div
          className="mb-2 px-2 py-1 bg-white border-2 border-[#2d2d2d] relative"
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: Math.max(12, px * 4),
            color: '#2d2d2d',
            transform: flipped ? 'scaleX(-1)' : undefined,
            lineHeight: 1.2,
          }}
        >
          {message}
          <div
            className="absolute left-1/2 -bottom-1.5 w-2 h-2 bg-white border-b-2 border-r-2 border-[#2d2d2d]"
            style={{ transform: 'translateX(-50%) rotate(45deg)' }}
          />
        </div>
      )}
      <div style={{ width: cols * px, height: rows * px, position: 'relative' }}>
        {animationLevel !== 'none' && character.auraColor && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: cols * px * 1.4,
              height: rows * px * 1.4,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${character.auraColor}40 0%, ${character.auraColor}00 70%)`,
              animation: 'pixelAura 3s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          style={{
            width: px,
            height: px,
            boxShadow: shadows,
            position: 'absolute',
            top: 0,
            left: 0,
            animation: effectiveAnimation,
          }}
        />
      </div>
      {animation === 'sleep' && animationLevel !== 'none' && (
        <div className="absolute -top-2 -right-2 text-xs" style={{ fontFamily: "'VT323', monospace", color: '#7ec8e3' }}>
          {['z', 'Z', 'z'].map((z, i) => (
            <span
              key={i}
              className="absolute"
              style={{
                animation: `pixelSleep 2s ease-in-out infinite ${i * 0.4}s`,
                right: i * 6,
                top: -i * 8,
                fontSize: 10 + i * 4,
              }}
            >
              {z}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
