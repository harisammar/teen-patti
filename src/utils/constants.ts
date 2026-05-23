import { Suit, CardValue, GameVariant } from '../types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const VALUES: CardValue[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_COLORS: Record<Suit, string> = {
  spades: '#1a1a2e',
  hearts: '#e74c3c',
  diamonds: '#e74c3c',
  clubs: '#1a1a2e',
};

export const HAND_NAMES: Record<number, string> = {
  1: 'High Card',
  2: 'Pair',
  3: 'Color',
  4: 'Sequence',
  5: 'Pure Sequence',
  6: 'Trail',
};

export const EMOTES: string[] = [
  '😂', '🔥', '💪', '😤', '🙏', '👑', '😱', '🤑', '💰', '😎', '🎰', '🃏',
];

export const COLORS = {
  // Primary palette
  background: '#0d2b1a',
  tableGreen: '#1a4a2e',
  tableBorder: '#2d6b45',
  gold: '#c9a227',
  goldDark: '#a07d1a',
  white: '#ffffff',
  danger: '#e74c3c',
  dangerDark: '#c0392b',

  // Cards
  cardBack: '#1a4a6e',
  cardFront: '#ffffff',
  cardBorder: '#cccccc',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#b0c4be',
  textMuted: '#6b8a7a',
  textDanger: '#e74c3c',

  // UI elements
  surface: '#1e3a2a',
  surfaceLight: '#264d38',
  overlay: 'rgba(0,0,0,0.7)',
  inputBg: '#0f2a1a',
  border: '#2d6b45',

  // Status
  success: '#27ae60',
  warning: '#f39c12',
  info: '#3498db',

  // Bet actions
  fold: '#e74c3c',
  call: '#27ae60',
  raise: '#c9a227',
  sideshow: '#9b59b6',
  seeCards: '#f39c12',
  show: '#3498db',

  // Player status
  blind: '#f39c12',
  seen: '#27ae60',
  folded: '#666666',

  // Timer
  timerNormal: '#27ae60',
  timerWarning: '#f39c12',
  timerDanger: '#e74c3c',
} as const;

export const GAME_VARIANTS: Record<GameVariant, { label: string; description: string; emoji: string }> = {
  classic: {
    label: 'Classic',
    emoji: '🃏',
    description: 'Standard Teen Patti rules. Trail is the highest hand, High Card is lowest.',
  },
  muflis: {
    label: 'Muflis',
    emoji: '🔄',
    description: 'Reverse rankings! High Card beats Trail. The worst hand becomes the best.',
  },
  ak47: {
    label: 'AK47',
    emoji: '🃏✨',
    description: 'Aces, Kings, 4s, and 7s are wild cards. They take the best possible value for your hand.',
  },
};

export const WILD_CARDS_AK47 = new Set<string>(['A', 'K', '4', '7']);

export const BOOT_AMOUNT_OPTIONS = [10, 20, 30, 50, 100, 200, 500];

export const AVATARS = ['👤', '🦁', '🐯', '🦊', '🐺', '🦅', '🐲', '🃏'];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const CARDS_PER_PLAYER = 3;

export const FIREBASE_PATHS = {
  users: 'users',
  rooms: 'rooms',
  games: 'games',
  messages: 'messages',
  players: 'players',
  voice: 'voice',
  emotes: 'emotes',
} as const;
