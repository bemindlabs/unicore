/**
 * Terminal retro TUI themes — UNC-1001
 * Updated: 2026-03-23
 *
 * Defines xterm.js-compatible theme presets, font options, and localStorage
 * persistence helpers.  The AgentTerminal component reads these at init time
 * and re-applies them when the user runs `/theme <name>`.
 */

import type { ITheme } from '@xterm/xterm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerminalThemeId =
  | 'github-dark'
  | 'matrix'
  | 'amber'
  | 'blue'
  | 'solarized-dark'
  | 'dracula'
  | 'crt';

export type TerminalFontId = 'jetbrains' | 'fira' | 'ibm';

export interface TerminalThemeDefinition {
  id: TerminalThemeId;
  name: string;
  description: string;
  /** xterm ITheme color map */
  xterm: ITheme;
  /** Optional extra CSS class applied to the wrapper div (e.g. for CRT overlay) */
  cssClass?: string;
  /** Inline style overrides for the wrapper div */
  wrapperStyle?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Theme presets
// ---------------------------------------------------------------------------

export const TERMINAL_THEMES: Record<TerminalThemeId, TerminalThemeDefinition> = {
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    description: 'Default GitHub dark palette',
    xterm: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      cursorAccent: '#0d1117',
      selectionBackground: '#264f78',
      black:         '#0d1117',
      red:           '#ff7b72',
      green:         '#7ee787',
      yellow:        '#d29922',
      blue:          '#58a6ff',
      magenta:       '#bc8cff',
      cyan:          '#39c5cf',
      white:         '#c9d1d9',
      brightBlack:   '#484f58',
      brightRed:     '#ffa198',
      brightGreen:   '#56d364',
      brightYellow:  '#e3b341',
      brightBlue:    '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan:    '#56d4dd',
      brightWhite:   '#f0f6fc',
    },
  },

  matrix: {
    id: 'matrix',
    name: 'Matrix',
    description: 'Black background, phosphor green — like the Matrix',
    xterm: {
      background: '#000000',
      foreground: '#00FF41',
      cursor: '#00FF41',
      cursorAccent: '#000000',
      selectionBackground: '#003b00',
      black:         '#000000',
      red:           '#ff0000',
      green:         '#00FF41',
      yellow:        '#ccff00',
      blue:          '#005500',
      magenta:       '#00cc44',
      cyan:          '#00ffaa',
      white:         '#00FF41',
      brightBlack:   '#003300',
      brightRed:     '#ff4444',
      brightGreen:   '#39ff14',
      brightYellow:  '#ddff55',
      brightBlue:    '#007700',
      brightMagenta: '#00ff77',
      brightCyan:    '#44ffcc',
      brightWhite:   '#ccffcc',
    },
  },

  amber: {
    id: 'amber',
    name: 'Amber',
    description: 'Classic amber phosphor on black — 1980s CRT monitor',
    xterm: {
      background: '#0a0500',
      foreground: '#ffb000',
      cursor: '#ffcc00',
      cursorAccent: '#0a0500',
      selectionBackground: '#4a2800',
      black:         '#0a0500',
      red:           '#cc4400',
      green:         '#ffb000',
      yellow:        '#ffcc00',
      blue:          '#995500',
      magenta:       '#cc7700',
      cyan:          '#ffaa44',
      white:         '#ffb000',
      brightBlack:   '#3a1800',
      brightRed:     '#ff6600',
      brightGreen:   '#ffd000',
      brightYellow:  '#ffee44',
      brightBlue:    '#cc8800',
      brightMagenta: '#ffaa00',
      brightCyan:    '#ffcc88',
      brightWhite:   '#ffeecc',
    },
  },

  blue: {
    id: 'blue',
    name: 'Blue',
    description: 'Cyan on dark blue — like classic terminal emulators',
    xterm: {
      background: '#00001a',
      foreground: '#00e5ff',
      cursor: '#00e5ff',
      cursorAccent: '#00001a',
      selectionBackground: '#003366',
      black:         '#00001a',
      red:           '#ff4466',
      green:         '#00ff99',
      yellow:        '#ffee00',
      blue:          '#0066ff',
      magenta:       '#6600ff',
      cyan:          '#00e5ff',
      white:         '#aaddff',
      brightBlack:   '#003366',
      brightRed:     '#ff6688',
      brightGreen:   '#44ffbb',
      brightYellow:  '#ffff55',
      brightBlue:    '#4488ff',
      brightMagenta: '#9944ff',
      brightCyan:    '#55eeff',
      brightWhite:   '#cceeff',
    },
  },

  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    description: 'Ethan Schoonover\'s Solarized dark palette',
    xterm: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#839496',
      cursorAccent: '#002b36',
      selectionBackground: '#073642',
      black:         '#073642',
      red:           '#dc322f',
      green:         '#859900',
      yellow:        '#b58900',
      blue:          '#268bd2',
      magenta:       '#d33682',
      cyan:          '#2aa198',
      white:         '#eee8d5',
      brightBlack:   '#002b36',
      brightRed:     '#cb4b16',
      brightGreen:   '#586e75',
      brightYellow:  '#657b83',
      brightBlue:    '#839496',
      brightMagenta: '#6c71c4',
      brightCyan:    '#93a1a1',
      brightWhite:   '#fdf6e3',
    },
  },

  dracula: {
    id: 'dracula',
    name: 'Dracula',
    description: 'The dark Dracula color scheme',
    xterm: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      black:         '#21222c',
      red:           '#ff5555',
      green:         '#50fa7b',
      yellow:        '#f1fa8c',
      blue:          '#bd93f9',
      magenta:       '#ff79c6',
      cyan:          '#8be9fd',
      white:         '#f8f8f2',
      brightBlack:   '#6272a4',
      brightRed:     '#ff6e6e',
      brightGreen:   '#69ff94',
      brightYellow:  '#ffffa5',
      brightBlue:    '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan:    '#a4ffff',
      brightWhite:   '#ffffff',
    },
  },

  crt: {
    id: 'crt',
    name: 'Retro CRT',
    description: 'Phosphor green with scanline overlay + glow animation',
    cssClass: 'terminal-crt',
    xterm: {
      background: '#010f01',
      foreground: '#33ff33',
      cursor: '#33ff33',
      cursorAccent: '#010f01',
      selectionBackground: '#003300',
      black:         '#010f01',
      red:           '#aa1100',
      green:         '#33ff33',
      yellow:        '#aaff00',
      blue:          '#004400',
      magenta:       '#22cc44',
      cyan:          '#00ffaa',
      white:         '#33ff33',
      brightBlack:   '#005500',
      brightRed:     '#ff2200',
      brightGreen:   '#66ff66',
      brightYellow:  '#ccff44',
      brightBlue:    '#008800',
      brightMagenta: '#44ff88',
      brightCyan:    '#88ffcc',
      brightWhite:   '#ccffcc',
    },
  },
};

// ---------------------------------------------------------------------------
// Font presets
// ---------------------------------------------------------------------------

export interface TerminalFontDefinition {
  id: TerminalFontId;
  name: string;
  fontFamily: string;
}

export const TERMINAL_FONTS: Record<TerminalFontId, TerminalFontDefinition> = {
  jetbrains: {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  },
  fira: {
    id: 'fira',
    name: 'Fira Code',
    fontFamily: "'Fira Code', 'Courier New', monospace",
  },
  ibm: {
    id: 'ibm',
    name: 'IBM Plex Mono',
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
  },
};

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const LS_THEME_KEY = 'unicore:terminal:theme';
const LS_FONT_KEY  = 'unicore:terminal:font';

export function getStoredTheme(): TerminalThemeId {
  if (typeof window === 'undefined') return 'github-dark';
  const stored = window.localStorage.getItem(LS_THEME_KEY) as TerminalThemeId | null;
  return stored && stored in TERMINAL_THEMES ? stored : 'github-dark';
}

export function setStoredTheme(id: TerminalThemeId): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_THEME_KEY, id);
}

export function getStoredFont(): TerminalFontId {
  if (typeof window === 'undefined') return 'jetbrains';
  const stored = window.localStorage.getItem(LS_FONT_KEY) as TerminalFontId | null;
  return stored && stored in TERMINAL_FONTS ? stored : 'jetbrains';
}

export function setStoredFont(id: TerminalFontId): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_FONT_KEY, id);
}

// ---------------------------------------------------------------------------
// /theme command parser
// ---------------------------------------------------------------------------

/** All valid theme name aliases (including short aliases) */
const THEME_ALIASES: Record<string, TerminalThemeId> = {
  'github-dark':    'github-dark',
  github:           'github-dark',
  default:          'github-dark',
  matrix:           'matrix',
  amber:            'amber',
  blue:             'blue',
  'solarized-dark': 'solarized-dark',
  solarized:        'solarized-dark',
  sol:              'solarized-dark',
  dracula:          'dracula',
  crt:              'crt',
  retro:            'crt',
};

const FONT_ALIASES: Record<string, TerminalFontId> = {
  jetbrains:  'jetbrains',
  jb:         'jetbrains',
  fira:       'fira',
  'fira-code': 'fira',
  ibm:        'ibm',
  'ibm-plex': 'ibm',
  plex:       'ibm',
};

export type ThemeCommandResult =
  | { type: 'theme-changed'; themeId: TerminalThemeId; message: string }
  | { type: 'font-changed';  fontId: TerminalFontId;   message: string }
  | { type: 'help';          message: string }
  | { type: 'error';         message: string }
  | { type: 'not-a-command' };

/**
 * Try to parse a line the user typed as a `/theme` or `/font` command.
 * Returns `{ type: 'not-a-command' }` when the line should be forwarded to the PTY.
 */
export function parseThemeCommand(line: string): ThemeCommandResult {
  const trimmed = line.trim();

  // /font <name>
  if (trimmed.startsWith('/font')) {
    const arg = trimmed.slice(5).trim().toLowerCase();
    if (!arg || arg === 'help') {
      const fontList = Object.values(TERMINAL_FONTS)
        .map((f) => `  ${f.id.padEnd(12)} — ${f.name}`)
        .join('\r\n');
      return {
        type: 'help',
        message:
          '\r\n\x1b[1;36mFont options:\x1b[0m\r\n' +
          fontList +
          '\r\n\r\nUsage: /font <name>\r\n',
      };
    }
    const fontId = FONT_ALIASES[arg];
    if (!fontId) {
      return {
        type: 'error',
        message: `\r\n\x1b[1;31mUnknown font:\x1b[0m ${arg}. Run /font help for options.\r\n`,
      };
    }
    const font = TERMINAL_FONTS[fontId];
    return {
      type: 'font-changed',
      fontId,
      message: `\r\n\x1b[1;32mFont set to:\x1b[0m ${font.name}\r\n`,
    };
  }

  // /theme <name>
  if (trimmed.startsWith('/theme')) {
    const arg = trimmed.slice(6).trim().toLowerCase();
    if (!arg || arg === 'help') {
      const themeList = Object.values(TERMINAL_THEMES)
        .map((t) => `  ${t.id.padEnd(16)} — ${t.description}`)
        .join('\r\n');
      return {
        type: 'help',
        message:
          '\r\n\x1b[1;36mTerminal themes:\x1b[0m\r\n' +
          themeList +
          '\r\n\r\nUsage: /theme <name>  |  /font <name>\r\n',
      };
    }
    const themeId = THEME_ALIASES[arg];
    if (!themeId) {
      return {
        type: 'error',
        message: `\r\n\x1b[1;31mUnknown theme:\x1b[0m ${arg}. Run /theme help for options.\r\n`,
      };
    }
    const theme = TERMINAL_THEMES[themeId];
    return {
      type: 'theme-changed',
      themeId,
      message: `\r\n\x1b[1;32mTheme set to:\x1b[0m ${theme.name} — ${theme.description}\r\n`,
    };
  }

  return { type: 'not-a-command' };
}

// ---------------------------------------------------------------------------
// CRT CSS injection (call once, idempotent)
// ---------------------------------------------------------------------------

const CRT_STYLE_ID = 'unicore-terminal-crt-styles';

export function injectCrtStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CRT_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = CRT_STYLE_ID;
  style.textContent = `
    /* ── Retro CRT theme ─────────────────────────────────────────────────── */
    @keyframes crt-phosphor-pulse {
      0%   { text-shadow: 0 0 4px #33ff33, 0 0 8px #33ff33; }
      50%  { text-shadow: 0 0 6px #33ff33, 0 0 14px #33ff33, 0 0 22px #00ff0088; }
      100% { text-shadow: 0 0 4px #33ff33, 0 0 8px #33ff33; }
    }

    @keyframes crt-flicker {
      0%   { opacity: 1; }
      92%  { opacity: 1; }
      93%  { opacity: 0.94; }
      94%  { opacity: 1; }
      96%  { opacity: 0.97; }
      100% { opacity: 1; }
    }

    /* Outer wrapper that carries the scanlines + flicker */
    .terminal-crt {
      position: relative;
      animation: crt-flicker 8s infinite;
    }

    /* Scanline overlay — sits above the canvas, pointer-events: none */
    .terminal-crt::before {
      content: '';
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 10;
      background: repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent 2px,
        rgba(0, 0, 0, 0.18) 2px,
        rgba(0, 0, 0, 0.18) 4px
      );
    }

    /* Phosphor glow — vignette edge glow */
    .terminal-crt::after {
      content: '';
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 11;
      border-radius: 4px;
      box-shadow:
        inset 0 0 40px rgba(0, 255, 0, 0.08),
        inset 0 0 80px rgba(0, 255, 0, 0.04);
    }

    /* Text glow for the xterm canvas */
    .terminal-crt .xterm-viewport,
    .terminal-crt .xterm-screen canvas {
      filter: blur(0.3px) brightness(1.1);
    }

    @media (prefers-reduced-motion: reduce) {
      .terminal-crt {
        animation: none;
      }
    }
  `;
  document.head.appendChild(style);
}
