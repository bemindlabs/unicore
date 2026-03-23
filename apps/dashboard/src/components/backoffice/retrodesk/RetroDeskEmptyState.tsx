'use client';

import { findCharacterByRole } from '@/lib/backoffice/retrodesk-characters';
import { PixelCharacter } from './PixelCharacter';
import { PixelStar } from './PixelDecorations';

const sleepy = findCharacterByRole('empty-state')!;

export function RetroDeskEmptyState({ message }: { message?: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative">
        <PixelStar className="absolute -top-4 -left-6" px={2} />
        <PixelCharacter
          character={sleepy}
          size="lg"
          animation="sleep"
          speechBubble={message ?? sleepy.defaultMessage}
        />
        <PixelStar className="absolute -bottom-2 -right-4" px={2} />
      </div>
    </div>
  );
}
