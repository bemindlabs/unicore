'use client';

export function TerminalLauncher(): JSX.Element {
  const openTerminal = () => {
    window.open('/ssh/', '_blank', 'width=1024,height=768,menubar=no,toolbar=no');
  };

  return (
    <button
      onClick={openTerminal}
      className="inline-flex items-center gap-2 font-mono text-xs text-green-400 hover:text-green-200 border border-green-800/40 hover:border-green-600/60 px-3 py-1.5 rounded transition-colors"
    >
      Open Terminal
    </button>
  );
}
