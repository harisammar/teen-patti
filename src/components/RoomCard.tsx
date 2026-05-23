import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Room } from '../types';
import { COLORS, GAME_VARIANTS } from '../utils/constants';

interface RoomCardProps {
  room: Room;
  onJoin: () => void;
  onSpectate: () => void;
  /**
   * Override the primary action button label. When supplied, the join button is
   * always shown (even for full or playing rooms) — used by "Continue Playing"
   * where the user is already a member and should be able to resume.
   */
  joinLabel?: string;
}

export default function RoomCard({ room, onJoin, onSpectate, joinLabel }: RoomCardProps) {
  const isFull = room.currentPlayers >= room.maxPlayers;
  const isPlaying = room.status === 'playing';
  const showResumeButton = !!joinLabel;

  return (
    <View style={styles.card}>
      {/* Left: Room info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.roomName} numberOfLines={1}>
            {room.name}
          </Text>
          <View style={styles.variantBadge}>
            <Text style={styles.variantText}>
              {GAME_VARIANTS[room.gameVariant].emoji} {GAME_VARIANTS[room.gameVariant].label}
            </Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <Text style={styles.detail}>
            👥 {room.currentPlayers}/{room.maxPlayers}
          </Text>
          <Text style={styles.detail}>
            💰 {room.bootAmount} boot
          </Text>
          <Text style={[styles.statusBadge, isPlaying ? styles.statusPlaying : styles.statusWaiting]}>
            {isPlaying ? '● Playing' : '● Waiting'}
          </Text>
        </View>
      </View>

      {/* Right: Action buttons */}
      <View style={styles.actions}>
        {showResumeButton || (!isPlaying && !isFull) ? (
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={onJoin}
            activeOpacity={0.8}
          >
            <Text style={styles.joinText}>{joinLabel ?? 'Join'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.spectateBtn}
            onPress={onSpectate}
            activeOpacity={0.8}
          >
            <Text style={styles.spectateText}>👁 Watch</Text>
          </TouchableOpacity>
        )}

        {isPlaying && (
          <TouchableOpacity
            style={styles.spectateBtn}
            onPress={onSpectate}
            activeOpacity={0.8}
          >
            <Text style={styles.spectateText}>👁 Watch</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 10,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  roomName: { color: COLORS.white, fontSize: 15, fontWeight: '700', flex: 1 },
  variantBadge: {
    backgroundColor: COLORS.tableGreen,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  variantText: { color: COLORS.gold, fontSize: 10, fontWeight: '600' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detail: { color: COLORS.textMuted, fontSize: 12 },
  statusBadge: { fontSize: 11, fontWeight: '600' },
  statusPlaying: { color: COLORS.danger },
  statusWaiting: { color: COLORS.success },
  actions: { gap: 6 },
  joinBtn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinText: { color: COLORS.background, fontWeight: '700', fontSize: 14 },
  spectateBtn: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  spectateText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
});
