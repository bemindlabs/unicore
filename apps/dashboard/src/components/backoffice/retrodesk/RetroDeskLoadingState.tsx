'use client';

import { findCharacterByRole } from '@/lib/backoffice/retrodesk-characters';
import { PixelCharacter } from './PixelCharacter';
import { PixelStar } from './PixelDecorations';

const mascot = findCharacterByRole('mascot')!;

export function RetroDeskLoadingState() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--retrodesk-bg, #faf8f5)' }}>
      <div className="relative">
        <PixelStar className="absolute -top-6 -left-8" px={3} />
        <PixelStar className="absolute -top-4 right-0" px={2} />
        <PixelCharacter character={mascot} size="xl" animation="bounce" />
        <PixelStar className="absolute -bottom-4 -right-6" px={3} />
      </div>
      <div className="mt-6 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-3 h-3 bg-[#ff6b9d]"
            style={{ animation: `pixelBounce 1s ease-in-out infinite ${i * 0.15}s` }}
          />
        ))}
      </div>
      <p
        className="mt-4 tracking-wider uppercase text-[#2d2d2d]"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10 }}
      >
        Loading...
      </p>
    </div>
  );
}
