// Card types
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit;
  value: CardValue;
  rank: number;
  isWild?: boolean;
}

// Hand rankings - higher number = better hand (except in Muflis where inverted)
export enum HandRank {
  HIGH_CARD = 1,
  PAIR = 2,
  COLOR = 3,
  SEQUENCE = 4,
  PURE_SEQUENCE = 5,
  TRAIL = 6,
}

export type PlayerStatus = 'blind' | 'seen' | 'folded' | 'active' | 'winner';

export interface Player {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  points: number;
  status: PlayerStatus;
  cards: Card[];
  currentBet: number;
  isDealer: boolean;
  isCurrentTurn: boolean;
  isMuted?: boolean;
  isSpectator?: boolean;
  totalBetThisRound?: number;
}

export type GameVariant = 'classic' | 'muflis' | 'ak47';
export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  name: string;
  adminId: string;
  status: RoomStatus;
  gameVariant: GameVariant;
  bootAmount: number;
  maxPlayers: number;
  currentPlayers: number;
  startingPoints: number;
  turnTimer: 15 | 30 | 60;
  potLimit: number | null;
  isPublic: boolean;
  createdAt: number;
  roomCode: string;
  currentGameId?: string;
  spectators?: string[];
  playerIds?: string[];
}

export type GameStatus = 'dealing' | 'playing' | 'sideshow_pending' | 'showdown' | 'finished';

export interface Game {
  id: string;
  roomId: string;
  roundNumber: number;
  pot: number;
  currentBet: number;
  currentPlayerIndex: number;
  players: Player[];
  status: GameStatus;
  jokerCard?: Card;
  winner?: string;
  winnerHandName?: string;
  startedAt: number;
  sideshowChallengerId?: string;
  sideshowChallengedId?: string;
  lastAction?: {
    playerId: string;
    action: string;
    amount?: number;
    timestamp: number;
  };
  // Chaal pricing state machine.
  // - previousPlayerStatus: 'blind' | 'seen' of the last player who chaaled/raised.
  //   null at game start (treated as if previous was blind for first-chaal pricing).
  // - counterTriggered: set true the first time a seen player chaals after a
  //   blind player has played. Once true, subsequent seen-after-blind chaals
  //   pay 3x previousChaal instead of 2x.
  previousPlayerStatus?: 'blind' | 'seen' | null;
  counterTriggered?: boolean;
}

export type ChatMessageType = 'message' | 'emote' | 'system';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: ChatMessageType;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  avatar: string;          // emoji avatar
  photoURL?: string;       // custom uploaded profile picture URL
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  sessionsWon: number;
  biggestPot: number;
  createdAt?: number;
  profileComplete?: boolean; // false until user sets name/avatar on ProfileSetup
}

// ---- Friends ---------------------------------------------------------------

export type FriendStatus = 'pending' | 'accepted';

export interface FriendEntry {
  uid: string;          // the other person's uid (document ID in subcollection)
  name: string;
  avatar: string;
  status: FriendStatus;
  initiatedBy: string;  // uid of whoever sent the request
  createdAt: number;
}

export interface RoomInvite {
  roomId: string;
  roomCode: string;
  roomName: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  createdAt: number;
}

// Lightweight profile returned by user-search
export interface UserSearchResult {
  uid: string;
  name: string;
  avatar: string;
  email: string;
}

// ---------------------------------------------------------------------------

export interface EmoteEvent {
  playerId: string;
  emote: string;
  timestamp: number;
}

export interface HandResult {
  rank: HandRank;
  score: number;
  name: string;
  cards: Card[];
}

export interface GameSettings {
  gameVariant: GameVariant;
  bootAmount: number;
  maxPlayers: number;
  startingPoints: number;
  turnTimer: 15 | 30 | 60;
  potLimit: number | null;
  isPublic: boolean;
  name: string;
}

export type BetAction = 'call' | 'raise' | 'fold';

export interface VoicePeer {
  userId: string;
  isMuted: boolean;
  isSpeaking: boolean;
  connection?: RTCPeerConnection;
}

export interface NavigationParams {
  RoomLobby: { roomId: string };
  Game: { roomId: string; gameId: string };
  Spectator: { roomId: string; gameId: string };
}
