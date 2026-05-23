import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import * as roomService from '../services/roomService';
import { subscribeToMessages } from '../services/chatService';
import { Room, GameSettings } from '../types';

interface UseRoomReturn {
  room: Room | null;
  isLoading: boolean;
  error: string | null;
  createRoom: (settings: GameSettings) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  joinRoomByCode: (code: string) => Promise<Room>;
  joinAsSpectator: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  kickPlayer: (targetId: string) => Promise<void>;
  mutePlayer: (targetId: string) => Promise<void>;
  transferAdmin: (newAdminId: string) => Promise<void>;
  getRooms: () => Promise<Room[]>;
  subscribeToCurrentRoom: (roomId: string) => () => void;
}

export function useRoom(): UseRoomReturn {
  const { currentRoom, setRoom, setMessages } = useGameStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom(settings: GameSettings): Promise<Room> {
    if (!user) throw new Error('Not authenticated.');
    setIsLoading(true);
    setError(null);
    try {
      const room = await roomService.createRoom(user.uid, settings);
      setRoom(room);
      return room;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create room.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function joinRoom(roomId: string): Promise<void> {
    if (!user) throw new Error('Not authenticated.');
    setIsLoading(true);
    setError(null);
    try {
      await roomService.joinRoom(roomId, user.uid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join room.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function joinRoomByCode(code: string): Promise<Room> {
    if (!user) throw new Error('Not authenticated.');
    setIsLoading(true);
    setError(null);
    try {
      const room = await roomService.joinRoomByCode(code, user.uid);
      setRoom(room);
      return room;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Room not found with that code.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function joinAsSpectator(roomId: string): Promise<void> {
    if (!user) throw new Error('Not authenticated.');
    setIsLoading(true);
    setError(null);
    try {
      await roomService.addSpectator(roomId, user.uid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join as spectator.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function leaveRoom(): Promise<void> {
    if (!user || !currentRoom) return;
    setIsLoading(true);
    setError(null);
    try {
      await roomService.leaveRoom(currentRoom.id, user.uid);
      setRoom(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to leave room.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function kickPlayer(targetId: string): Promise<void> {
    if (!user || !currentRoom) throw new Error('Not in a room.');
    await roomService.kickPlayer(currentRoom.id, targetId, user.uid);
  }

  async function mutePlayer(targetId: string): Promise<void> {
    if (!user || !currentRoom) throw new Error('Not in a room.');
    await roomService.mutePlayer(currentRoom.id, targetId, user.uid);
  }

  async function transferAdmin(newAdminId: string): Promise<void> {
    if (!user || !currentRoom) throw new Error('Not in a room.');
    await roomService.transferAdmin(currentRoom.id, newAdminId, user.uid);
  }

  async function getRooms(): Promise<Room[]> {
    return roomService.getRooms();
  }

  function subscribeToCurrentRoom(roomId: string): () => void {
    const roomUnsub = roomService.subscribeToRoom(roomId, (room) => {
      setRoom(room);
    });

    const msgUnsub = subscribeToMessages(roomId, (messages) => {
      setMessages(messages);
    });

    return () => {
      roomUnsub();
      msgUnsub();
    };
  }

  return {
    room: currentRoom,
    isLoading,
    error,
    createRoom,
    joinRoom,
    joinRoomByCode,
    joinAsSpectator,
    leaveRoom,
    kickPlayer,
    mutePlayer,
    transferAdmin,
    getRooms,
    subscribeToCurrentRoom,
  };
}
