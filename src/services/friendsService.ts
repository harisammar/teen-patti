import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { FriendEntry, UserSearchResult } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a reference to the friends subcollection of a user. */
function friendsRef(uid: string) {
  return collection(db, 'users', uid, 'friends');
}

/** Convert a Firestore doc snapshot to FriendEntry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function docToFriend(docSnap: any): FriendEntry {
  const d = docSnap.data();
  return {
    uid: docSnap.id,
    name: d.name ?? '',
    avatar: d.avatar ?? '👤',
    status: d.status,
    initiatedBy: d.initiatedBy,
    createdAt:
      d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : (d.createdAt ?? 0),
  };
}

// ---------------------------------------------------------------------------
// User search
// ---------------------------------------------------------------------------

/**
 * Search for users by display name (prefix match, case-insensitive).
 * Relies on a `nameLower` field written at registration time.
 * Returns up to 10 results, excluding the caller.
 */
export async function searchUsers(
  term: string,
  callerUid: string
): Promise<UserSearchResult[]> {
  if (!term.trim()) return [];

  const lower = term.trim().toLowerCase();
  //  is the highest code-point in BMP — standard Firestore prefix trick
  const upper = lower + '';

  const usersCol = collection(db, 'users');
  const q = query(
    usersCol,
    where('nameLower', '>=', lower),
    where('nameLower', '<=', upper),
    orderBy('nameLower')
  );

  const snap = await getDocs(q);
  const results: UserSearchResult[] = [];
  snap.forEach((d) => {
    if (d.id === callerUid) return; // skip self
    const data = d.data();
    results.push({
      uid: d.id,
      name: data.name ?? '',
      avatar: data.avatar ?? '👤',
      email: data.email ?? '',
    });
  });
  return results.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Send / cancel request
// ---------------------------------------------------------------------------

/**
 * Send a friend request from `fromUid` to `toUid`.
 * Writes a `pending` entry in both users' friends subcollections.
 */
export async function sendFriendRequest(
  fromUid: string,
  fromName: string,
  fromAvatar: string,
  toUid: string,
  toName: string,
  toAvatar: string
): Promise<void> {
  const now = Date.now();

  await setDoc(doc(db, 'users', fromUid, 'friends', toUid), {
    name: toName,
    avatar: toAvatar,
    status: 'pending',
    initiatedBy: fromUid,
    createdAt: now,
  });

  await setDoc(doc(db, 'users', toUid, 'friends', fromUid), {
    name: fromName,
    avatar: fromAvatar,
    status: 'pending',
    initiatedBy: fromUid,
    createdAt: now,
  });
}

/**
 * Cancel a pending friend request (either side can call this).
 */
export async function cancelFriendRequest(
  myUid: string,
  otherUid: string
): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, 'users', myUid, 'friends', otherUid)),
    deleteDoc(doc(db, 'users', otherUid, 'friends', myUid)),
  ]);
}

// ---------------------------------------------------------------------------
// Accept / reject
// ---------------------------------------------------------------------------

/**
 * Accept an incoming friend request. Sets status to 'accepted' in both docs.
 */
export async function acceptFriendRequest(
  myUid: string,
  myName: string,
  myAvatar: string,
  senderUid: string,
  senderName: string,
  senderAvatar: string
): Promise<void> {
  const now = Date.now();
  await Promise.all([
    setDoc(doc(db, 'users', myUid, 'friends', senderUid), {
      name: senderName,
      avatar: senderAvatar,
      status: 'accepted',
      initiatedBy: senderUid,
      createdAt: now,
    }),
    setDoc(doc(db, 'users', senderUid, 'friends', myUid), {
      name: myName,
      avatar: myAvatar,
      status: 'accepted',
      initiatedBy: senderUid,
      createdAt: now,
    }),
  ]);
}

/**
 * Remove or decline a friend relationship (works for pending or accepted).
 */
export async function removeFriend(myUid: string, otherUid: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, 'users', myUid, 'friends', otherUid)),
    deleteDoc(doc(db, 'users', otherUid, 'friends', myUid)),
  ]);
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Returns all accepted friends for a user. */
export async function getFriends(uid: string): Promise<FriendEntry[]> {
  const q = query(friendsRef(uid), where('status', '==', 'accepted'));
  const snap = await getDocs(q);
  return snap.docs.map(docToFriend);
}

/** Returns pending requests received by this user (others sent them).
 *  Fetches all pending docs then filters in JS — avoids needing a
 *  composite index on (status + initiatedBy) in Firestore. */
export async function getPendingRequests(uid: string): Promise<FriendEntry[]> {
  const q = query(friendsRef(uid), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(docToFriend).filter((f) => f.initiatedBy !== uid);
}

/** Returns pending requests sent by this user. */
export async function getSentRequests(uid: string): Promise<FriendEntry[]> {
  const q = query(friendsRef(uid), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(docToFriend).filter((f) => f.initiatedBy === uid);
}

/**
 * Returns the friend entry doc (or null) for a specific pair.
 * Callers use this to determine the relationship status before showing UI.
 */
export async function getFriendEntry(
  myUid: string,
  otherUid: string
): Promise<FriendEntry | null> {
  const snap = await getDoc(doc(db, 'users', myUid, 'friends', otherUid));
  if (!snap.exists()) return null;
  return docToFriend(snap);
}

// ---------------------------------------------------------------------------
// Real-time subscription
// ---------------------------------------------------------------------------

export interface FriendsSnapshot {
  friends: FriendEntry[];        // status === 'accepted'
  incoming: FriendEntry[];       // status === 'pending', initiated by someone else
  sent: FriendEntry[];           // status === 'pending', initiated by me
}

/**
 * Subscribes to the entire friends subcollection with onSnapshot.
 * Fires immediately with current data, then on every change.
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 */
export function subscribeFriends(
  uid: string,
  onUpdate: (snapshot: FriendsSnapshot) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, 'users', uid, 'friends');
  return onSnapshot(
    colRef,
    (snap) => {
      const all = snap.docs.map(docToFriend);
      onUpdate({
        friends: all.filter((f) => f.status === 'accepted'),
        incoming: all.filter((f) => f.status === 'pending' && f.initiatedBy !== uid),
        sent:     all.filter((f) => f.status === 'pending' && f.initiatedBy === uid),
      });
    },
    (err) => onError?.(err as Error)
  );
}

// ---------------------------------------------------------------------------
// Room invites  (stored at users/{uid}/invites/{roomId})
// ---------------------------------------------------------------------------

export interface RoomInvite {
  roomId: string;
  roomCode: string;
  roomName: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  createdAt: number;
}

/** Send a room invite to a friend. Overwrites any existing invite for the same room. */
export async function sendRoomInvite(
  toUid: string,
  invite: Omit<RoomInvite, 'createdAt'>
): Promise<void> {
  await setDoc(doc(db, 'users', toUid, 'invites', invite.roomId), {
    ...invite,
    createdAt: Date.now(),
  });
}

/** Dismiss / delete a room invite (called when user joins or taps ✕). */
export async function dismissRoomInvite(myUid: string, roomId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', myUid, 'invites', roomId));
}

/** Real-time subscription to incoming room invites. Returns unsubscribe fn. */
export function subscribeInvites(
  uid: string,
  onUpdate: (invites: RoomInvite[]) => void
): () => void {
  const colRef = collection(db, 'users', uid, 'invites');
  return onSnapshot(colRef, (snap) => {
    const invites: RoomInvite[] = snap.docs.map((d) => d.data() as RoomInvite);
    // Sort newest first
    invites.sort((a, b) => b.createdAt - a.createdAt);
    onUpdate(invites);
  });
}
