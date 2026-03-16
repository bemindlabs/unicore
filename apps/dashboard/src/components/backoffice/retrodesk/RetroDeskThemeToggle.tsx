'use client';

import { useTheme } from '@/hooks/use-theme';
import { findCharacterByRole } from '@/lib/backoffice/retrodesk-characters';

const mascot = findCharacterByRole('mascot')!;
const MINI_PX = 2;

function MiniMascot({ active }: { active: boolean }) {
  const grid = mascot.grid.slice(0, 8); // just head portion
  const cols = grid[0]?.length ?? 12;
  const rows = grid.length;

  const shadows = grid
    .flatMap((row, y) =>
      row.map((cell, x) => (cell === 'transparent' ? null : `${x * MINI_PX}px ${y * MINI_PX}px 0 0 ${cell}`))
    )
    .filter(Boolean)
    .join(', ');

  return (
    <div style={{ width: cols * MINI_PX, height: rows * MINI_PX, position: 'relative' }}>
      <div
        style={{
          width: MINI_PX,
          height: MINI_PX,
          boxShadow: shadows,
          position: 'absolute',
          top: 0,
          left: 0,
          animation: active ? 'pixelBounce 1s ease-in-out infinite' : undefined,
        }}
      />
    </div>
  );
}

export function RetroDeskThemeToggle() {
  const { characterTheme, setCharacterTheme } = useTheme();
  const isActive = characterTheme === 'retrodesk';

  return (
    <button
      onClick={() => setCharacterTheme(isActive ? null : 'retrodesk')}
      className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] font-mono tracking-wider uppercase transition-all ${
        isActive
          ? 'bg-[#ff6b9d]/20 border-[#ff6b9d]/50 text-[#ff6b9d]'
          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
      }`}
      title={isActive ? 'Switch to default theme' : 'Switch to RetroDesk pixel art theme'}
    >
      <MiniMascot active={isActive} />
      <span>{isActive ? 'RetroDesk ON' : 'RetroDesk'}</span>
    </button>
  );
}
