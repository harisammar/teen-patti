// react-native-webrtc is a native module unavailable in Expo Go.
// All access is gated behind VOICE_CHAT_ENABLED so the native module is
// never touched on simulators / Expo Go builds.
// Flip to `true` only when building a custom dev client on a real device.
const VOICE_CHAT_ENABLED = false;

import {
  ref,
  set,
  push,
  onChildAdded,
  onDisconnect,
  remove,
  get,
} from 'firebase/database';
import { rtdb } from './firebase';

// ---------------------------------------------------------------------------
// Lazy WebRTC bindings — loaded only when VOICE_CHAT_ENABLED = true.
// Using `any` so TypeScript doesn't complain about the null stubs.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _RTCPeerConnection: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _RTCIceCandidate: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _RTCSessionDescription: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mediaDevices: any = null;

function loadWebRTC() {
  if (!VOICE_CHAT_ENABLED) return;
  if (_RTCPeerConnection) return; // already loaded
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const webrtc = require('react-native-webrtc');
  _RTCPeerConnection = webrtc.RTCPeerConnection;
  _RTCIceCandidate = webrtc.RTCIceCandidate;
  _RTCSessionDescription = webrtc.RTCSessionDescription;
  _mediaDevices = webrtc.mediaDevices;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeerState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: any; // RTCPeerConnection when enabled
  userId: string;
  isMuted: boolean;
}

type OnPeerJoinedCallback = (userId: string) => void;
type OnPeerLeftCallback = (userId: string) => void;

// ---------------------------------------------------------------------------
// Module-level state (singleton voice session)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localStream: any | null = null; // MediaStream when enabled
let roomId: string | null = null;
let currentUserId: string | null = null;
let isMuted = false;

const peers: Map<string, PeerState> = new Map();
const unsubscribeFns: Array<() => void> = [];

let onPeerJoinedCallback: OnPeerJoinedCallback | null = null;
let onPeerLeftCallback: OnPeerLeftCallback | null = null;

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ---------------------------------------------------------------------------
// Helper: create a peer connection with ICE and track handlers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPeerConnection(remoteUserId: string): any {
  const pc = new _RTCPeerConnection({ iceServers: ICE_SERVERS });

  if (localStream) {
    localStream.getTracks().forEach((track: any) => {
      pc.addTrack(track, localStream);
    });
  }

  pc.onicecandidate = ({ candidate }: any) => {
    if (candidate && roomId && currentUserId) {
      const candidateRef = ref(
        rtdb,
        `voice/${roomId}/ice/${currentUserId}/${remoteUserId}`
      );
      push(candidateRef, candidate.toJSON());
    }
  };

  pc.onconnectionstatechange = () => {
    if (
      pc.connectionState === 'disconnected' ||
      pc.connectionState === 'failed' ||
      pc.connectionState === 'closed'
    ) {
      peers.delete(remoteUserId);
      onPeerLeftCallback?.(remoteUserId);
    }
  };

  return pc;
}

// ---------------------------------------------------------------------------
// Listen for ICE candidates from a remote peer
// ---------------------------------------------------------------------------

function listenForICECandidates(remoteUserId: string, pc: any): void {
  if (!roomId || !currentUserId) return;

  const icePath = `voice/${roomId}/ice/${remoteUserId}/${currentUserId}`;
  const iceRef = ref(rtdb, icePath);

  const unsub = onChildAdded(iceRef, async (snap) => {
    try {
      const candidateData = snap.val();
      if (candidateData) {
        await pc.addIceCandidate(new _RTCIceCandidate(candidateData));
      }
    } catch (err) {
      console.warn('ICE candidate error:', err);
    }
  });

  unsubscribeFns.push(unsub);
}

// ---------------------------------------------------------------------------
// Handle incoming offer from a remote peer
// ---------------------------------------------------------------------------

async function handleOffer(
  remoteUserId: string,
  offerData: { sdp: string; type: string }
): Promise<void> {
  if (!VOICE_CHAT_ENABLED) return;
  if (!roomId || !currentUserId) return;

  const pc = createPeerConnection(remoteUserId);
  peers.set(remoteUserId, { connection: pc, userId: remoteUserId, isMuted: false });

  await pc.setRemoteDescription(new _RTCSessionDescription(offerData));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  const answerRef = ref(rtdb, `voice/${roomId}/answers/${currentUserId}_${remoteUserId}`);
  await set(answerRef, {
    sdp: answer.sdp,
    type: answer.type,
    from: currentUserId,
    to: remoteUserId,
  });

  listenForICECandidates(remoteUserId, pc);
  onPeerJoinedCallback?.(remoteUserId);
}

// ---------------------------------------------------------------------------
// Initiate offer to a remote peer (caller side)
// ---------------------------------------------------------------------------

async function initiateOffer(remoteUserId: string): Promise<void> {
  if (!VOICE_CHAT_ENABLED) return;
  if (!roomId || !currentUserId) return;

  const pc = createPeerConnection(remoteUserId);
  peers.set(remoteUserId, { connection: pc, userId: remoteUserId, isMuted: false });

  const offer = await pc.createOffer({});
  await pc.setLocalDescription(offer);

  const offerRef = ref(rtdb, `voice/${roomId}/offers/${currentUserId}_${remoteUserId}`);
  await set(offerRef, {
    sdp: offer.sdp,
    type: offer.type,
    from: currentUserId,
    to: remoteUserId,
  });

  const answerPath = `voice/${roomId}/answers/${remoteUserId}_${currentUserId}`;
  const answerRef = ref(rtdb, answerPath);
  const answerUnsub = onChildAdded(answerRef, async (snap) => {
    try {
      const answerData = snap.val();
      if (answerData && !pc.remoteDescription) {
        await pc.setRemoteDescription(new _RTCSessionDescription(answerData));
      }
    } catch (err) {
      console.warn('Answer handling error:', err);
    }
  });
  unsubscribeFns.push(answerUnsub);

  listenForICECandidates(remoteUserId, pc);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initializes voice chat for the current user in the given room.
 * No-op when VOICE_CHAT_ENABLED = false.
 */
export async function initVoiceChat(rId: string, userId: string): Promise<void> {
  roomId = rId;
  currentUserId = userId;

  if (!VOICE_CHAT_ENABLED) {
    console.log('[voiceService] Voice chat disabled. Skipping WebRTC init.');
    return;
  }

  loadWebRTC();

  localStream = await _mediaDevices.getUserMedia({ audio: true, video: false });

  const presenceRef = ref(rtdb, `voice/${roomId}/presence/${userId}`);
  await set(presenceRef, { userId, joinedAt: Date.now() });
  onDisconnect(presenceRef).remove();

  const offersRef = ref(rtdb, `voice/${roomId}/offers`);
  const offerUnsub = onChildAdded(offersRef, async (snap) => {
    try {
      const offerData = snap.val();
      if (offerData && offerData.to === userId && offerData.from !== userId) {
        await handleOffer(offerData.from, { sdp: offerData.sdp, type: offerData.type });
      }
    } catch (err) {
      console.warn('Offer handling error:', err);
    }
  });
  unsubscribeFns.push(offerUnsub);

  const presenceSnap = await get(ref(rtdb, `voice/${roomId}/presence`));
  if (presenceSnap.exists()) {
    const existingUsers = Object.keys(presenceSnap.val()).filter((uid) => uid !== userId);
    for (const remoteUserId of existingUsers) {
      await initiateOffer(remoteUserId);
    }
  }
}

/**
 * Disconnects from voice chat and cleans up all peer connections.
 */
export function leaveVoiceChat(): void {
  peers.forEach(({ connection }) => {
    connection.close();
  });
  peers.clear();

  if (localStream) {
    localStream.getTracks().forEach((track: any) => track.stop());
    localStream = null;
  }

  unsubscribeFns.forEach((fn) => fn());
  unsubscribeFns.length = 0;

  if (roomId && currentUserId) {
    const presenceRef = ref(rtdb, `voice/${roomId}/presence/${currentUserId}`);
    remove(presenceRef);
  }

  roomId = null;
  currentUserId = null;
  isMuted = false;
}

/**
 * Toggles the microphone mute state.
 * Returns the new mute state (true = muted).
 */
export function toggleMute(): boolean {
  if (localStream) {
    localStream.getAudioTracks().forEach((track: any) => {
      track.enabled = isMuted;
    });
  }
  isMuted = !isMuted;
  return isMuted;
}

/** Returns the current mute state. */
export function getIsMuted(): boolean {
  return isMuted;
}

/** Registers a callback for when a new peer joins. */
export function onPeerJoined(callback: OnPeerJoinedCallback): void {
  onPeerJoinedCallback = callback;
}

/** Registers a callback for when a peer leaves. */
export function onPeerLeft(callback: OnPeerLeftCallback): void {
  onPeerLeftCallback = callback;
}

/** Returns the list of currently connected peer IDs. */
export function getConnectedPeers(): string[] {
  return Array.from(peers.keys());
}
