import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { Player } from '../types';
import { COLORS } from '../utils/constants';

interface VoiceChatControlsProps {
  players: Player[];
}

export default function VoiceChatControls({ players }: VoiceChatControlsProps) {
  const { isMuted, isConnected, connectedPeers, toggleMute, leaveVoiceChat } = useVoiceChat();

  return (
    <View style={styles.container}>
      {/* Connection status */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, isConnected ? styles.statusConnected : styles.statusDisconnected]} />
        <Text style={styles.statusText}>
          {isConnected ? 'Voice Connected' : 'Voice Disconnected'}
        </Text>
      </View>

      {/* Mic toggle */}
      <TouchableOpacity
        style={[styles.micBtn, isMuted && styles.micBtnMuted]}
        onPress={toggleMute}
        activeOpacity={0.8}
      >
        <Text style={styles.micIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
        <Text style={styles.micText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
      </TouchableOpacity>

      {/* Players voice indicator */}
      <View style={styles.peersRow}>
        {players.map((player) => {
          const isConnectedPeer = connectedPeers.includes(player.uid);
          return (
            <View key={player.uid} style={styles.peerItem}>
              <View style={[styles.peerAvatar, isConnectedPeer && styles.peerAvatarActive]}>
                <Text style={styles.peerAvatarText}>{player.avatar}</Text>
              </View>
              <Text style={styles.peerName} numberOfLines={1}>
                {player.name.split(' ')[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusConnected: { backgroundColor: COLORS.success },
  statusDisconnected: { backgroundColor: COLORS.danger },
  statusText: { color: COLORS.textSecondary, fontSize: 12 },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.tableGreen,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: 'flex-start',
  },
  micBtnMuted: {
    backgroundColor: '#3d1515',
    borderColor: COLORS.danger,
  },
  micIcon: { fontSize: 16 },
  micText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  peersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  peerItem: { alignItems: 'center', gap: 2 },
  peerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  peerAvatarActive: {
    borderColor: COLORS.success,
    borderWidth: 2,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  peerAvatarText: { fontSize: 18 },
  peerName: { color: COLORS.textMuted, fontSize: 9, maxWidth: 36 },
});
