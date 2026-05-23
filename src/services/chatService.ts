import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatMessage } from '../types';
import { FIREBASE_PATHS } from '../utils/constants';

/**
 * Sends a text message to the room chat.
 */
export async function sendMessage(
  roomId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<void> {
  const messagesRef = collection(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.messages);
  await addDoc(messagesRef, {
    senderId,
    senderName,
    text,
    timestamp: Date.now(),
    type: 'message',
  });
}

/**
 * Sends an emote message to the chat.
 */
export async function sendEmoteMessage(
  roomId: string,
  senderId: string,
  senderName: string,
  emote: string
): Promise<void> {
  const messagesRef = collection(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.messages);
  await addDoc(messagesRef, {
    senderId,
    senderName,
    text: emote,
    timestamp: Date.now(),
    type: 'emote',
  });
}

/**
 * Sends a system message (player joined, left, won, etc.).
 */
export async function sendSystemMessage(roomId: string, text: string): Promise<void> {
  const messagesRef = collection(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.messages);
  await addDoc(messagesRef, {
    senderId: 'system',
    senderName: 'System',
    text,
    timestamp: Date.now(),
    type: 'system',
  });
}

/**
 * Subscribes to real-time chat messages for a room.
 * Loads last 100 messages and streams new ones.
 */
export function subscribeToMessages(
  roomId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  const messagesRef = collection(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.messages);
  const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ChatMessage, 'id'>),
    }));
    callback(messages);
  });
}
