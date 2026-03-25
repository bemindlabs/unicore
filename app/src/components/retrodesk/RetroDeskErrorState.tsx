'use client';

import { findCharacterByRole } from '@/lib/theme/retrodesk-characters';
import { PixelCharacter } from './PixelCharacter';

const oopsy = findCharacterByRole('error')!;

export function RetroDeskErrorState({ message }: { message?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2 bg-[#ffb347]/10 border-b-2 border-[#ffb347]/30">
      <PixelCharacter
        character={oopsy}
        size="sm"
        animation="bounce"
        speechBubble={message ?? 'Oops! API unreachable — showing cached data'}
      />
    </div>
  );
}
