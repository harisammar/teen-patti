import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGame } from '../hooks/useGame';
import { useRoom } from '../hooks/useRoom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import PlayerSeat from '../components/PlayerSeat';
import ChatPanel from '../components/ChatPanel';
import { COLORS, GAME_VARIANTS } from '../utils/constants';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Player } from '../types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
type Route = RouteProp<RootStackParamList, 'Spectator'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function getSeatPositions(count: number): Array<{ x: number; y: number }> {
  const cx = SCREEN_W / 2;
  const cy = SCREEN_H * 0.38;
  const rx = SCREEN_W * 0.38;
  const ry = SCREEN_H * 0.22;
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / count;
    return { x: cx + rx * Math.cos(angle), y: cy - ry * Math.sin(angle) };
  });
}

export default function SpectatorScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { roomId, gameId } = route.params;

  const { user } = useAuthStore();
  const { game, subscribeToCurrentGame } = useGame();
  const { currentRoom } = useGameStore();
  const { leaveRoom } = useRoom();
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    const unsub = subscribeToCurrentGame(gameId, roomId);
    return unsub;
  }, [gameId, roomId]);

  async function handleLeave() {
    Alert.alert('Leave', 'Stop spectating and return home?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveRoom();
          navigation.replace('Home');
        },
      },
    ]);
  }

  async function handleRequestToPlay() {
    Alert.alert(
      'Request to Play',
      'The host will be notified that you want to join as a player.',
      [{ text: 'OK' }]
    );
  }

  if (!game) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Waiting for game to start...</Text>
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const players: Player[] = game.players;
  const seatPositions = getSeatPositions(players.length);

  return (
    <View style={styles.container}>
      {/* Table */}
      <View style={styles.table}>
        <View style={styles.tableInner} />
        <View style={styles.spectatorBadge}>
          <Text style={styles.spectatorBadgeText}>👁 SPECTATING</Text>
        </View>
      </View>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topBarContent}>
          <Text style={styles.roundText}>Round {game.roundNumber}</Text>
          <View style={styles.potContainer}>
            <Text style={styles.potLabel}>POT</Text>
            <Text style={styles.potAmount}>{game.pot.toLocaleString()}</Text>
          </View>
          <TouchableOpacity style={styles.leaveBtnSmall} onPress={handleLeave}>
            <Text style={styles.leaveBtnSmallText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Seats — all face down for spectators */}
      {players.map((player, idx) => {
        const pos = seatPositions[idx];
        return (
          <View
            key={player.uid}
            style={[styles.seatWrapper, { left: pos.x - 48, top: pos.y - 60 }]}
          >
            <PlayerSeat
              player={player}
              isCurrentTurn={player.isCurrentTurn}
              position={idx}
              isCurrentUser={false}
              showCards={false} // Spectators never see cards
            />
          </View>
        );
      })}

      {/* Bet indicator */}
      <View style={styles.betIndicator}>
        <Text style={styles.betLabel}>CURRENT BET</Text>
        <Text style={styles.betValue}>{game.currentBet}</Text>
      </View>

      {/* Variant badge */}
      <View style={styles.variantBadge}>
        <Text style={styles.variantText}>
          {GAME_VARIANTS[currentRoom?.gameVariant ?? 'classic'].emoji}{' '}
          {GAME_VARIANTS[currentRoom?.gameVariant ?? 'classic'].label}
        </Text>
      </View>

      {/* Bottom bar */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <View style={styles.bottomContent}>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => setShowChat(true)}
          >
            <Text style={styles.chatBtnText}>💬 Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.requestBtn}
            onPress={handleRequestToPlay}
          >
            <Text style={styles.requestBtnText}>🎮 Request to Play</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ChatPanel
        visible={showChat}
        onClose={() => setShowChat(false)}
        roomId={roomId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.tableGreen },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 16 },
  table: {
    position: 'absolute',
    width: SCREEN_W * 0.84,
    height: SCREEN_H * 0.44,
    borderRadius: SCREEN_W * 0.42,
    backgroundColor: '#1a4a2e',
    top: SCREEN_H * 0.16,
    left: SCREEN_W * 0.08,
    borderWidth: 4,
    borderColor: '#5a3a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  tableInner: {
    width: '85%',
    height: '85%',
    borderRadius: SCREEN_W * 0.5,
    borderWidth: 2,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  spectatorBadge: {
    position: 'absolute',
    bottom: SCREEN_H * 0.06,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  spectatorBadgeText: { color: COLORS.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(13,43,26,0.9)',
  },
  roundText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  potContainer: { alignItems: 'center' },
  potLabel: { color: COLORS.gold, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  potAmount: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  leaveBtnSmall: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  leaveBtnSmallText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
  seatWrapper: { position: 'absolute', width: 96, zIndex: 5, alignItems: 'center' },
  betIndicator: {
    position: 'absolute',
    top: SCREEN_H * 0.36,
    alignSelf: 'center',
    left: SCREEN_W * 0.5 - 50,
    alignItems: 'center',
    zIndex: 6,
  },
  betLabel: { color: COLORS.gold, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  betValue: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  variantBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    left: SCREEN_W * 0.5 - 60,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gold,
    zIndex: 6,
  },
  variantText: { color: COLORS.gold, fontSize: 13, fontWeight: '600' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,43,26,0.95)',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    zIndex: 10,
  },
  bottomContent: { flexDirection: 'row', gap: 12, padding: 12 },
  chatBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chatBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  requestBtn: {
    flex: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  requestBtnText: { color: COLORS.background, fontWeight: '700' },
  leaveBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  leaveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
