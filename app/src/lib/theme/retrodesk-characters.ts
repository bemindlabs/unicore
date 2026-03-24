export type CharacterRole = 'mascot' | 'helper' | 'error' | 'empty-state' | 'loading' | 'celebration';

export interface RetroDeskCharacter {
  id: string;
  name: string;
  /** 12x14 grid of hex color values. 'transparent' for empty pixels. */
  grid: string[][];
  role: CharacterRole;
  defaultMessage?: string;
  /** Hex color used for the glowing aura behind the pixel character */
  auraColor?: string;
}

const _ = 'transparent';
const SKIN = '#f5d0a9';
const HAIR_DARK = '#3a2a1a';
const HAIR_PINK = '#ff6b9d';
const EYES = '#222222';
const WHITE = '#ffffff';
const BLUSH = '#ffb3b3';

/** Chinja — main mascot, pink shirt, star hair clip */
const chinja: RetroDeskCharacter = {
  id: 'chinja',
  name: 'Chinja',
  role: 'mascot',
  defaultMessage: 'Hi there!',
  auraColor: '#ff6b9d',
  grid: [
    [_, _, _, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, _, _, _, _, _],
    [_, _, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, _, _, _, _],
    [_, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, '#ffd93d', _, _, _],
    [_, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _],
    [SKIN, SKIN, EYES, SKIN, SKIN, SKIN, EYES, SKIN, SKIN, _, _, _],
    [SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _],
    [_, SKIN, SKIN, BLUSH, SKIN, SKIN, BLUSH, SKIN, _, _, _, _],
    [_, _, SKIN, SKIN, '#d4736a', SKIN, SKIN, _, _, _, _, _],
    [_, _, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, _, _, _, _],
    [_, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, _, _, _],
    [_, HAIR_PINK, SKIN, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, SKIN, HAIR_PINK, _, _, _],
    [_, _, _, HAIR_PINK, HAIR_PINK, HAIR_PINK, HAIR_PINK, _, _, _, _, _],
    [_, _, '#4a3a2a', '#4a3a2a', _, _, '#4a3a2a', '#4a3a2a', _, _, _, _],
    [_, _, '#4a3a2a', '#4a3a2a', _, _, '#4a3a2a', '#4a3a2a', _, _, _, _],
  ],
};

/** Pixo — helper bot, blue, square head, antenna */
const pixo: RetroDeskCharacter = {
  id: 'pixo',
  name: 'Pixo',
  role: 'helper',
  defaultMessage: 'Need help?',
  auraColor: '#7ec8e3',
  grid: [
    [_, _, _, _, '#7ec8e3', _, _, _, _, _, _, _],
    [_, _, _, _, '#7ec8e3', _, _, _, _, _, _, _],
    [_, _, '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', _, _, _, _, _],
    [_, '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', _, _, _, _],
    [_, '#7ec8e3', WHITE, WHITE, '#7ec8e3', WHITE, WHITE, '#7ec8e3', _, _, _, _],
    [_, '#7ec8e3', EYES, WHITE, '#7ec8e3', EYES, WHITE, '#7ec8e3', _, _, _, _],
    [_, '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', '#7ec8e3', _, _, _, _],
    [_, _, '#7ec8e3', '#ffd93d', '#ffd93d', '#ffd93d', '#7ec8e3', _, _, _, _, _],
    [_, _, '#5ba8c8', '#5ba8c8', '#5ba8c8', '#5ba8c8', '#5ba8c8', '#5ba8c8', _, _, _, _],
    [_, '#5ba8c8', '#5ba8c8', '#5ba8c8', '#5ba8c8', '#5ba8c8', '#5ba8c8', '#5ba8c8', '#5ba8c8', _, _, _],
    [_, '#5ba8c8', '#7ec8e3', '#5ba8c8', '#5ba8c8', '#5ba8c8', '#7ec8e3', '#5ba8c8', _, _, _, _],
    [_, _, _, '#5ba8c8', '#5ba8c8', '#5ba8c8', _, _, _, _, _, _],
    [_, _, '#4a4a5a', '#4a4a5a', _, _, '#4a4a5a', '#4a4a5a', _, _, _, _],
    [_, _, '#4a4a5a', '#4a4a5a', _, _, '#4a4a5a', '#4a4a5a', _, _, _, _],
  ],
};

/** Oopsy — error character, orange, surprised face */
const oopsy: RetroDeskCharacter = {
  id: 'oopsy',
  name: 'Oopsy',
  role: 'error',
  defaultMessage: 'Oops! Something went wrong...',
  auraColor: '#ffb347',
  grid: [
    [_, _, _, '#ffb347', '#ffb347', '#ffb347', '#ffb347', _, _, _, _, _],
    [_, _, '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', _, _, _, _],
    [_, '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', _, _, _, _],
    [_, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _],
    [SKIN, SKIN, '#ffffff', EYES, SKIN, '#ffffff', EYES, SKIN, SKIN, _, _, _],
    [SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _],
    [_, SKIN, BLUSH, SKIN, SKIN, SKIN, BLUSH, SKIN, _, _, _, _],
    [_, _, SKIN, '#d4736a', '#d4736a', '#d4736a', SKIN, _, _, _, _, _],
    [_, _, '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', _, _, _, _],
    [_, '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', '#ffb347', _, _, _],
    [_, '#ffb347', SKIN, '#ffb347', '#ffb347', '#ffb347', '#ffb347', SKIN, _, _, _, _],
    [_, _, _, '#ffb347', '#ffb347', '#ffb347', _, _, _, _, _, _],
    [_, _, '#4a3a2a', '#4a3a2a', _, _, '#4a3a2a', '#4a3a2a', _, _, _, _],
    [_, _, '#4a3a2a', '#4a3a2a', _, _, '#4a3a2a', '#4a3a2a', _, _, _, _],
  ],
};

/** Sleepy — idle/empty state character, green pajamas */
const sleepy: RetroDeskCharacter = {
  id: 'sleepy',
  name: 'Sleepy',
  role: 'empty-state',
  defaultMessage: 'No agents here yet... Add one!',
  auraColor: '#a8e6cf',
  grid: [
    [_, _, _, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, _, _, _, _, _],
    [_, _, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, _, _, _, _],
    [_, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, HAIR_DARK, _, _, _, _],
    [_, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _],
    [SKIN, SKIN, '#666', '#666', SKIN, '#666', '#666', SKIN, SKIN, _, _, _],
    [SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _],
    [_, SKIN, BLUSH, SKIN, SKIN, SKIN, BLUSH, SKIN, _, _, _, _],
    [_, _, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _, _, _],
    [_, _, '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', _, _, _, _],
    [_, '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', _, _, _],
    [_, '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', _, _, _, _],
    [_, _, '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', '#a8e6cf', _, _, _, _, _],
    [_, _, '#4a3a2a', '#4a3a2a', _, _, '#4a3a2a', '#4a3a2a', _, _, _, _],
    [_, _, '#4a3a2a', '#4a3a2a', _, _, '#4a3a2a', '#4a3a2a', _, _, _, _],
  ],
};

/** Sparky — celebration character, yellow, confetti mood */
const sparky: RetroDeskCharacter = {
  id: 'sparky',
  name: 'Sparky',
  role: 'celebration',
  defaultMessage: 'Woohoo!',
  auraColor: '#ffd93d',
  grid: [
    [_, _, _, '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', _, _, _, _, _],
    [_, _, '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', _, _, _, _],
    [_, '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ff6b9d', _, _, _],
    [_, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _],
    [SKIN, SKIN, '#222', SKIN, SKIN, SKIN, '#222', SKIN, SKIN, _, _, _],
    [SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, SKIN, _, _, _],
    [_, SKIN, BLUSH, SKIN, SKIN, SKIN, BLUSH, SKIN, _, _, _, _],
    [_, _, SKIN, SKIN, '#ff6b9d', SKIN, SKIN, _, _, _, _, _],
    [_, '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', _, _, _, _],
    [SKIN, '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', SKIN, _, _, _],
    [_, '#ffd93d', SKIN, '#ffd93d', '#ffd93d', '#ffd93d', '#ffd93d', SKIN, _, _, _, _],
    [_, _, _, '#ffd93d', '#ffd93d', '#ffd93d', _, _, _, _, _, _],
    [_, _, '#4a3a2a', '#4a3a2a', _, _, '#4a3a2a', '#4a3a2a', _, _, _, _],
    [_, _, '#4a3a2a', '#4a3a2a', _, _, '#4a3a2a', '#4a3a2a', _, _, _, _],
  ],
};

export const RETRODESK_CHARACTERS: RetroDeskCharacter[] = [chinja, pixo, oopsy, sleepy, sparky];

export function findCharacter(id: string): RetroDeskCharacter | undefined {
  return RETRODESK_CHARACTERS.find((c) => c.id === id);
}

export function findCharacterByRole(role: CharacterRole): RetroDeskCharacter | undefined {
  return RETRODESK_CHARACTERS.find((c) => c.role === role);
}
