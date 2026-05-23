import { useState, useEffect, useRef } from 'react';
import * as voiceService from '../services/voiceService';

interface UseVoiceChatReturn {
  isConnected: boolean;
  isMuted: boolean;
  connectedPeers: string[];
  toggleMute: () => void;
  joinVoiceChat: (roomId: string, userId: string) => Promise<void>;
  leaveVoiceChat: () => void;
  error: string | null;
}

export function useVoiceChat(): UseVoiceChatReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Register peer callbacks
    voiceService.onPeerJoined((userId) => {
      setConnectedPeers(voiceService.getConnectedPeers());
    });

    voiceService.onPeerLeft((userId) => {
      setConnectedPeers(voiceService.getConnectedPeers());
    });

    return () => {
      // Cleanup on unmount
      if (isConnected) {
        voiceService.leaveVoiceChat();
      }
    };
  }, []);

  async function joinVoiceChat(roomId: string, userId: string): Promise<void> {
    try {
      setError(null);
      await voiceService.initVoiceChat(roomId, userId);
      setIsConnected(true);
      setConnectedPeers(voiceService.getConnectedPeers());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join voice chat.';
      setError(msg);
      setIsConnected(false);
    }
  }

  function leaveVoiceChat(): void {
    voiceService.leaveVoiceChat();
    setIsConnected(false);
    setConnectedPeers([]);
  }

  function toggleMute(): void {
    const newMutedState = voiceService.toggleMute();
    setIsMuted(newMutedState);
  }

  return {
    isConnected,
    isMuted,
    connectedPeers,
    toggleMute,
    joinVoiceChat,
    leaveVoiceChat,
    error,
  };
}
