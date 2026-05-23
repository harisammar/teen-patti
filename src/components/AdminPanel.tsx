import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoom } from '../hooks/useRoom';
import { useGame } from '../hooks/useGame';
import { Player } from '../types';
import { COLORS } from '../utils/constants';
import { useAuthStore } from '../store/authStore';

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  gameId: string;
  players: Player[];
}

export default function AdminPanel({
  visible,
  onClose,
  roomId,
  gameId,
  players,
}: AdminPanelProps) {
  const { kickPlayer, mutePlayer, transferAdmin } = useRoom();
  const { endGame, restartGame, isLoading } = useGame();
  const { user } = useAuthStore();
  const [transferMode, setTransferMode] = useState(false);

  async function handleRestart() {
    Alert.alert('Restart Game', 'Start a new round with the same players?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        onPress: async () => {
          try {
            await restartGame();
            onClose();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to restart.');
          }
        },
      },
    ]);
  }

  async function handleEndSession() {
    Alert.alert('End Session', 'End the game and return everyone to the lobby?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          try {
            await endGame();
            onClose();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to end session.');
          }
        },
      },
    ]);
  }

  async function handleKick(player: Player) {
    Alert.alert('Kick Player', `Remove ${player.name} from the room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick',
        style: 'destructive',
        onPress: () => kickPlayer(player.uid),
      },
    ]);
  }

  async function handleMute(player: Player) {
    try {
      await mutePlayer(player.uid);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to mute.');
    }
  }

  async function handleTransferAdmin(player: Player) {
    Alert.alert('Transfer Host', `Make ${player.name} the new host?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Transfer',
        onPress: async () => {
          try {
            await transferAdmin(player.uid);
            setTransferMode(false);
            onClose();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to transfer.');
          }
        },
      },
    ]);
  }

  const otherPlayers = players.filter((p) => p.uid !== user?.uid && p.status !== 'folded');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>⚙️ Admin Controls</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Game controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.restartBtn]}
                onPress={handleRestart}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>↻ Restart Game</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.endBtn]}
                onPress={handleEndSession}
                disabled={isLoading}
              >
                <Text style={styles.actionBtnText}>⏹ End Session</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Transfer admin */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Transfer Host</Text>
              <TouchableOpacity onPress={() => setTransferMode(!transferMode)}>
                <Text style={styles.toggleText}>{transferMode ? 'Cancel' : 'Select'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Players list */}
          <Text style={styles.sectionTitle2}>Players</Text>
          <FlatList
            data={otherPlayers}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }) => (
              <View style={styles.playerRow}>
                <Text style={styles.playerAvatar}>{item.avatar}</Text>
                <Text style={styles.playerName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.playerActions}>
                  {transferMode && (
                    <TouchableOpacity
                      style={[styles.playerBtn, styles.transferBtn]}
                      onPress={() => handleTransferAdmin(item)}
                    >
                      <Text style={styles.playerBtnText}>Host</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.playerBtn, styles.muteBtn]}
                    onPress={() => handleMute(item)}
                  >
                    <Text style={styles.playerBtnText}>🔇</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.playerBtn, styles.kickBtnStyle]}
                    onPress={() => handleKick(item)}
                  >
                    <Text style={styles.playerBtnText}>Kick</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            style={styles.playerList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No other players in game.</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.gold, fontSize: 18, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: COLORS.textMuted, fontSize: 14 },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionTitle2: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  toggleText: { color: COLORS.gold, fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  restartBtn: { backgroundColor: '#1e3a20', borderColor: COLORS.success },
  endBtn: { backgroundColor: '#3d1515', borderColor: COLORS.danger },
  actionBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  playerList: { paddingHorizontal: 16, paddingBottom: 32 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  playerAvatar: { fontSize: 24 },
  playerName: { flex: 1, color: COLORS.white, fontSize: 14, fontWeight: '600' },
  playerActions: { flexDirection: 'row', gap: 6 },
  playerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  transferBtn: { backgroundColor: '#1e3a20', borderColor: COLORS.success },
  muteBtn: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  kickBtnStyle: { backgroundColor: '#3d1515', borderColor: COLORS.danger },
  playerBtnText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', paddingVertical: 20, fontSize: 14 },
});
