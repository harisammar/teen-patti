import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Room, GameSettings } from '../types';
import { FIREBASE_PATHS } from '../utils/constants';

/**
 * Generates a random 6-character alphanumeric room code.
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a new room and adds the admin as the first player.
 */
export async function createRoom(adminId: string, settings: GameSettings): Promise<Room> {
  const roomRef = doc(collection(db, FIREBASE_PATHS.rooms));
  const roomCode = generateRoomCode();

  const room: Room = {
    id: roomRef.id,
    name: settings.name,
    adminId,
    status: 'waiting',
    gameVariant: settings.gameVariant,
    bootAmount: settings.bootAmount,
    maxPlayers: settings.maxPlayers,
    currentPlayers: 1,
    startingPoints: settings.startingPoints,
    turnTimer: settings.turnTimer,
    potLimit: settings.potLimit,
    isPublic: settings.isPublic,
    createdAt: Date.now(),
    roomCode,
    playerIds: [adminId],
  };

  await setDoc(roomRef, room);

  // Add admin as first player in subcollection
  const playerRef = doc(db, FIREBASE_PATHS.rooms, roomRef.id, FIREBASE_PATHS.players, adminId);
  await setDoc(playerRef, {
    uid: adminId,
    joinedAt: Date.now(),
    isSpectator: false,
  });

  return room;
}

/**
 * Joins an existing room by ID.
 */
export async function joinRoom(roomId: string, userId: string): Promise<void> {
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error('Room not found.');
  }

  const room = roomSnap.data() as Room;

  if (room.currentPlayers >= room.maxPlayers) {
    throw new Error('Room is full.');
  }

  if (room.status === 'playing') {
    throw new Error('Game is already in progress. You can join as a spectator.');
  }

  // Add player to subcollection
  const playerRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.players, userId);
  await setDoc(playerRef, {
    uid: userId,
    joinedAt: Date.now(),
    isSpectator: false,
  });

  // Increment player count and track membership
  await updateDoc(roomRef, {
    currentPlayers: room.currentPlayers + 1,
    playerIds: arrayUnion(userId),
  });
}

/**
 * Joins a room using its 6-char code.
 */
export async function joinRoomByCode(code: string, userId: string): Promise<Room> {
  const roomsRef = collection(db, FIREBASE_PATHS.rooms);
  const q = query(roomsRef, where('roomCode', '==', code.toUpperCase()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('No room found with that code.');
  }

  const roomDoc = snapshot.docs[0];
  const room = roomDoc.data() as Room;

  await joinRoom(room.id, userId);
  return room;
}

/**
 * Removes a player from the room.
 */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) return;

  const room = roomSnap.data() as Room;

  // Remove from players subcollection
  const playerRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.players, userId);
  await deleteDoc(playerRef);

  const newCount = Math.max(0, room.currentPlayers - 1);

  if (newCount === 0 || userId === room.adminId) {
    // If admin leaves and there are other players, transfer admin
    if (newCount > 0) {
      const playersSnap = await getDocs(
        collection(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.players)
      );
      const remaining = playersSnap.docs.filter((d) => d.id !== userId);
      if (remaining.length > 0) {
        await updateDoc(roomRef, {
          currentPlayers: newCount,
          adminId: remaining[0].id,
          playerIds: arrayRemove(userId),
        });
        return;
      }
    }
    // No players left — delete room
    await deleteDoc(roomRef);
    return;
  }

  await updateDoc(roomRef, {
    currentPlayers: newCount,
    playerIds: arrayRemove(userId),
  });
}

/**
 * Returns all public rooms that are in 'waiting' status.
 */
export async function getRooms(): Promise<Room[]> {
  const roomsRef = collection(db, FIREBASE_PATHS.rooms);
  const q = query(
    roomsRef,
    where('isPublic', '==', true),
    where('status', '==', 'waiting')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as Room);
}

/**
 * Returns all rooms the user is currently a member of (any status, public or
 * private). Used to populate the "Continue Playing" section so users can rejoin
 * sessions they were part of — including ones stuck mid-game.
 */
export async function getMyRooms(userId: string): Promise<Room[]> {
  const roomsRef = collection(db, FIREBASE_PATHS.rooms);
  const q = query(roomsRef, where('playerIds', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => d.data() as Room)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Subscribes to real-time room updates.
 * Returns an unsubscribe function.
 */
export function subscribeToRoom(roomId: string, callback: (room: Room | null) => void): () => void {
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  return onSnapshot(roomRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as Room);
    } else {
      callback(null);
    }
  });
}

/**
 * Admin kicks a player from the room.
 */
export async function kickPlayer(roomId: string, targetId: string, adminId: string): Promise<void> {
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Room not found.');

  const room = roomSnap.data() as Room;
  if (room.adminId !== adminId) throw new Error('Only the admin can kick players.');

  await leaveRoom(roomId, targetId);
}

/**
 * Admin mutes/unmutes a player's voice chat.
 */
export async function mutePlayer(roomId: string, targetId: string, adminId: string): Promise<void> {
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Room not found.');

  const room = roomSnap.data() as Room;
  if (room.adminId !== adminId) throw new Error('Only the admin can mute players.');

  // Store muted players list in room document
  const mutedPlayers: string[] = (roomSnap.data() as Record<string, unknown>).mutedPlayers as string[] || [];
  const isMuted = mutedPlayers.includes(targetId);

  await updateDoc(roomRef, {
    mutedPlayers: isMuted ? arrayRemove(targetId) : arrayUnion(targetId),
  });
}

/**
 * Transfers admin role to a new player.
 */
export async function transferAdmin(
  roomId: string,
  newAdminId: string,
  currentAdminId: string
): Promise<void> {
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Room not found.');

  const room = roomSnap.data() as Room;
  if (room.adminId !== currentAdminId) throw new Error('Only the current admin can transfer admin role.');

  await updateDoc(roomRef, { adminId: newAdminId });
}

/**
 * Adds a user as a spectator.
 */
export async function addSpectator(roomId: string, userId: string): Promise<void> {
  const playerRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.players, userId);
  await setDoc(playerRef, {
    uid: userId,
    joinedAt: Date.now(),
    isSpectator: true,
  });

  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  await updateDoc(roomRef, {
    spectators: arrayUnion(userId),
  });
}
