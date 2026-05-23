import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import * as gameService from '../services/gameService';
import { sendEmote as sendEmoteService } from '../services/gameService';
import { Game, Player, Card, BetAction, EmoteEvent } from '../types';
import { ref, onChildAdded } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { FIREBASE_PATHS } from '../utils/constants';

interface UseGameReturn {
  game: Game | null;
  currentPlayer: Player | null;
  isMyTurn: boolean;
  isLoading: boolean;
  error: string | null;
  timerSeconds: number;
  startGame: (roomId: string) => Promise<void>;
  placeBet: (amount: number, action: BetAction) => Promise<void>;
  peekCards: () => Promise<void>;
  requestSideshow: (challengedId: string) => Promise<void>;
  respondToSideshow: (accept: boolean) => Promise<void>;
  showHand: () => Promise<void>;
  sendEmote: (emote: string) => Promise<void>;
  endGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  subscribeToCurrentGame: (gameId: string, roomId: string) => () => void;
}

export function useGame(): UseGameReturn {
  const { currentGame, currentRoom, setGame, addEmote } = useGameStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [myCards, setMyCards] = useState<Card[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoFoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Merge own cards (from private subcollection) into the current player object
  const rawCurrentPlayer = currentGame?.players.find((p) => p.uid === user?.uid) ?? null;
  const currentPlayer: Player | null = rawCurrentPlayer
    ? { ...rawCurrentPlayer, cards: myCards }
    : null;
  const isMyTurn = currentPlayer?.isCurrentTurn ?? false;

  // Reset and start countdown timer whenever the active player changes
  useEffect(() => {
    if (!currentGame || currentGame.status !== 'playing') {
      clearTimers();
      return;
    }

    const turnDuration = currentRoom?.turnTimer ?? 30;
    setTimerSeconds(turnDuration);

    if (isMyTurn) {
      startCountdown(turnDuration);
    } else {
      clearTimers();
    }

    return clearTimers;
  }, [currentGame?.currentPlayerIndex, isMyTurn]);

  function clearTimers(): void {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoFoldRef.current) {
      clearTimeout(autoFoldRef.current);
      autoFoldRef.current = null;
    }
  }

  function startCountdown(seconds: number): void {
    clearTimers();
    setTimerSeconds(seconds);

    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearTimers();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-fold when timer reaches 0
    autoFoldRef.current = setTimeout(async () => {
      if (isMyTurn && currentGame && currentRoom && user) {
        try {
          await gameService.placeBet(
            currentGame.id,
            currentRoom.id,
            user.uid,
            0,
            'fold'
          );
        } catch {
          // Silently ignore auto-fold errors
        }
      }
    }, seconds * 1000);
  }

  async function startGame(roomId: string): Promise<void> {
    if (!user) throw new Error('Not authenticated.');
    setIsLoading(true);
    setError(null);
    try {
      const game = await gameService.startGame(roomId, user.uid);
      setGame(game);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start game.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function placeBet(amount: number, action: BetAction): Promise<void> {
    if (!user || !currentGame || !currentRoom) throw new Error('Not in a game.');
    setIsLoading(true);
    setError(null);
    try {
      await gameService.placeBet(currentGame.id, currentRoom.id, user.uid, amount, action);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bet failed.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function peekCards(): Promise<void> {
    if (!user || !currentGame || !currentRoom) throw new Error('Not in a game.');
    setIsLoading(true);
    setError(null);
    try {
      await gameService.peekCards(currentGame.id, currentRoom.id, user.uid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to see cards.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function requestSideshow(challengedId: string): Promise<void> {
    if (!user || !currentGame || !currentRoom) throw new Error('Not in a game.');
    await gameService.requestSideshow(currentGame.id, currentRoom.id, user.uid, challengedId);
  }

  async function respondToSideshow(accept: boolean): Promise<void> {
    if (!user || !currentGame || !currentRoom) throw new Error('Not in a game.');
    await gameService.respondToSideshow(currentGame.id, currentRoom.id, user.uid, accept);
  }

  async function showHand(): Promise<void> {
    if (!user || !currentGame || !currentRoom) throw new Error('Not in a game.');
    setIsLoading(true);
    setError(null);
    try {
      await gameService.showHand(currentGame.id, currentRoom.id, user.uid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Show failed.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function sendEmote(emote: string): Promise<void> {
    if (!user || !currentGame) return;
    await sendEmoteService(currentGame.id, user.uid, emote);
  }

  async function endGame(): Promise<void> {
    if (!currentGame || !currentRoom) return;
    await gameService.endGame(currentGame.id, currentRoom.id);
    setGame(null);
  }

  async function restartGame(): Promise<void> {
    if (!user || !currentRoom) throw new Error('Not in a room.');
    setIsLoading(true);
    setError(null);
    try {
      const game = await gameService.restartGame(currentRoom.id, user.uid);
      setGame(game);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Restart failed.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  function subscribeToCurrentGame(gameId: string, roomId: string): () => void {
    const gameUnsub = gameService.subscribeToGame(gameId, roomId, (game) => {
      setGame(game);
    });

    // Subscribe to own hand (private subcollection — other players' cards stay hidden)
    const handUnsub = user
      ? gameService.subscribeToMyHand(gameId, roomId, user.uid, (cards) => {
          setMyCards(cards);
        })
      : undefined;

    // Subscribe to real-time emotes via RTDB
    const emoteRef = ref(rtdb, `${FIREBASE_PATHS.emotes}/${gameId}`);
    const emoteUnsub = onChildAdded(emoteRef, (snap) => {
      const emote = snap.val() as EmoteEvent;
      if (emote) {
        addEmote(emote);
      }
    });

    return () => {
      gameUnsub();
      handUnsub?.();
      emoteUnsub();
      setMyCards([]);
      clearTimers();
    };
  }

  return {
    game: currentGame,
    currentPlayer,
    isMyTurn,
    isLoading,
    error,
    timerSeconds,
    startGame,
    placeBet,
    peekCards,
    requestSideshow,
    respondToSideshow,
    showHand,
    sendEmote,
    endGame,
    restartGame,
    subscribeToCurrentGame,
  };
}
