import { create } from 'zustand';
import { Room, Game, ChatMessage, EmoteEvent } from '../types';

interface GameState {
  currentRoom: Room | null;
  currentGame: Game | null;
  messages: ChatMessage[];
  emotes: EmoteEvent[];
  mutedPlayers: string[];

  setRoom: (room: Room | null) => void;
  setGame: (game: Game | null) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addEmote: (emote: EmoteEvent) => void;
  clearEmote: (timestamp: number) => void;
  setMuted: (mutedPlayers: string[]) => void;
  toggleMutedPlayer: (playerId: string) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentRoom: null,
  currentGame: null,
  messages: [],
  emotes: [],
  mutedPlayers: [],

  setRoom: (room) => set({ currentRoom: room }),

  setGame: (game) => set({ currentGame: game }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setMessages: (messages) => set({ messages }),

  addEmote: (emote) =>
    set((state) => ({
      emotes: [...state.emotes, emote],
    })),

  clearEmote: (timestamp) =>
    set((state) => ({
      emotes: state.emotes.filter((e) => e.timestamp !== timestamp),
    })),

  setMuted: (mutedPlayers) => set({ mutedPlayers }),

  toggleMutedPlayer: (playerId) =>
    set((state) => {
      const isMuted = state.mutedPlayers.includes(playerId);
      return {
        mutedPlayers: isMuted
          ? state.mutedPlayers.filter((id) => id !== playerId)
          : [...state.mutedPlayers, playerId],
      };
    }),

  resetGame: () =>
    set({
      currentRoom: null,
      currentGame: null,
      messages: [],
      emotes: [],
      mutedPlayers: [],
    }),
}));
