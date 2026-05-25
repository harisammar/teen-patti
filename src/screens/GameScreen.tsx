import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGame } from '../hooks/useGame';
import { useRoom } from '../hooks/useRoom';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import PlayerSeat from '../components/PlayerSeat';
import BettingControls from '../components/BettingControls';
import EmotePanel from '../components/EmotePanel';
import ChatPanel from '../components/ChatPanel';
import AdminPanel from '../components/AdminPanel';
import ScoreBoard from '../components/ScoreBoard';
import VoiceChatControls from '../components/VoiceChatControls';
import { Player } from '../types';
import { COLORS, GAME_VARIANTS } from '../utils/constants';
import { RootStackParamList } from '../navigation/AppNavigator';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
type Route = RouteProp<RootStackParamList, 'Game'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

// Calculates seat positions around an oval table for N players
function getSeatPositions(count: number): Array<{ x: number; y: number }> {
  const cx = SCREEN_W / 2;
  const cy = SCREEN_H * 0.38;
  const rx = SCREEN_W * 0.38;
  const ry = SCREEN_H * 0.22;

  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    // Start from bottom center (current player), go clockwise
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / count;
    positions.push({
      x: cx + rx * Math.cos(angle),
      y: cy - ry * Math.sin(angle),
    });
  }
  return positions;
}

export default function GameScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { roomId, gameId } = route.params;

  const { user } = useAuthStore();
  const {
    game,
    currentPlayer,
    isMyTurn,
    timerSeconds,
    placeBet,
    peekCards,
    requestSideshow,
    respondToSideshow,
    showHand,
    sendEmote,
    restartGame,
    subscribeToCurrentGame,
  } = useGame();
  const { subscribeToCurrentRoom } = useRoom();
  const { currentRoom, emotes } = useGameStore();
  const { isMuted, toggleMute, isConnected, connectedPeers } = useVoiceChat();

  const [showEmotes, setShowEmotes] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [latestMessage, setLatestMessage] = useState<string | null>(null);
  const { messages } = useGameStore();

  const isAdmin = user?.uid === currentRoom?.adminId;
  const isGameFinished = game?.status === 'finished' && !!game?.winner;
  const winnerVisible = isGameFinished;

  // Subscribe to game updates
  useEffect(() => {
    const unsub = subscribeToCurrentGame(gameId, roomId);
    return unsub;
  }, [gameId, roomId]);

  // Subscribe to room so we detect when admin restarts (currentGameId changes)
  useEffect(() => {
    const unsub = subscribeToCurrentRoom(roomId);
    return unsub;
  }, [roomId]);

  // Sync route with the room's current game:
  //   - If currentGameId changed to a NEW id  → admin restarted; jump to it.
  //   - If currentGameId was cleared (null)   → admin ended the session;
  //                                              send everyone back to the lobby.
  useEffect(() => {
    // currentRoom may still be loading from the subscription on first mount,
    // so wait until we actually have it before reacting to currentGameId.
    if (!currentRoom) return;
    const nextGameId = currentRoom.currentGameId;
    if (!nextGameId) {
      navigation.replace('RoomLobby', { roomId });
      return;
    }
    if (nextGameId !== gameId) {
      navigation.replace('Game', { roomId, gameId: nextGameId });
    }
  }, [currentRoom, currentRoom?.currentGameId, gameId, roomId]);

  // Show latest chat message as bubble
  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.type !== 'system') {
        setLatestMessage(`${last.senderName}: ${last.text}`);
        const timer = setTimeout(() => setLatestMessage(null), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [messages.length]);

  if (!game) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading game...</Text>
      </View>
    );
  }

  const players = game.players;
  const seatPositions = getSeatPositions(players.length);
  const myIndex = players.findIndex((p) => p.uid === user?.uid);

  // Reorder so current user is always at bottom (index 0)
  const orderedPlayers: Player[] = myIndex >= 0
    ? [...players.slice(myIndex), ...players.slice(0, myIndex)]
    : players;

  const previousPlayer = isMyTurn
    ? players[(game.currentPlayerIndex - 1 + players.length) % players.length]
    : null;

  const canSideshow =
    isMyTurn &&
    currentPlayer?.status === 'seen' &&
    previousPlayer?.status === 'seen' &&
    players.filter((p) => p.status !== 'folded').length >= 3;

  const winnerPlayer = game.winner
    ? players.find((p) => p.uid === game.winner)
    : null;

  async function handleRaise(amount: number) {
    await placeBet(amount, 'raise');
  }

  async function handleChaal() {
    await placeBet(game!.currentBet, 'call');
  }

  async function handleFold() {
    await placeBet(0, 'fold');
  }

  return (
    <View style={styles.container}>
      {/* Table background */}
      <View style={styles.table}>
        <View style={styles.tableInner} />
      </View>

      {/* Game info bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topBarContent}>
          <View style={styles.roundBadge}>
            <Text style={styles.roundText}>Round {game.roundNumber}</Text>
          </View>
          <View style={styles.potContainer}>
            <Text style={styles.potLabel}>POT</Text>
            <Text style={styles.potAmount}>{game.pot.toLocaleString()}</Text>
          </View>
          <View style={styles.variantBadge}>
            <Text style={styles.variantText}>
              {GAME_VARIANTS[currentRoom?.gameVariant ?? 'classic'].label}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Player seats */}
      {orderedPlayers.map((player, idx) => {
        const pos = seatPositions[idx];
        const isCurrentUser = player.uid === user?.uid;
        const activeEmote = emotes.find((e) => e.playerId === player.uid);

        // Current user gets a wider seat so larger cards have room to display
        const seatWidth = isCurrentUser ? 130 : 96;
        const seatOffsetX = seatWidth / 2;

        return (
          <View
            key={player.uid}
            style={[
              styles.seatWrapper,
              isCurrentUser && styles.seatWrapperSelf,
              { left: pos.x - seatOffsetX, top: pos.y - 60 },
            ]}
          >
            {activeEmote && (
              <Text style={styles.floatingEmote}>{activeEmote.emote}</Text>
            )}
            <PlayerSeat
              // currentPlayer has real cards injected from the private hands
              // subcollection; game.players always has cards:[] for security.
              player={isCurrentUser && currentPlayer ? currentPlayer : player}
              isCurrentTurn={player.isCurrentTurn}
              position={idx}
              isCurrentUser={isCurrentUser}
              // Your own cards stay face-down while you're blind (Teen Patti
              // rule: you choose when to peek by tapping "See Cards"). After
              // peeking you become 'seen' and pay the full bet rate.
              showCards={
                isCurrentUser && (
                  (currentPlayer?.status === 'seen') ||
                  (currentPlayer?.status === 'winner') ||
                  (player.status === 'seen') ||
                  (player.status === 'winner')
                )
              }
              timerSeconds={isCurrentUser && player.isCurrentTurn ? timerSeconds : undefined}
              turnDuration={currentRoom?.turnTimer ?? 30}
              cardSize={isCurrentUser ? 'md' : 'sm'}
            />
          </View>
        );
      })}

      {/* Current bet indicator */}
      <View style={styles.betIndicator}>
        <Text style={styles.betLabel}>CURRENT BET</Text>
        <Text style={styles.betValue}>{game.currentBet}</Text>
      </View>

      {/* Latest chat bubble */}
      {latestMessage && (
        <View style={styles.chatBubble}>
          <Text style={styles.chatBubbleText} numberOfLines={2}>
            {latestMessage}
          </Text>
        </View>
      )}

      {/* Side buttons */}
      <View style={styles.sideButtons}>
        <TouchableOpacity style={styles.sideBtn} onPress={() => setShowEmotes(true)}>
          <Text style={styles.sideBtnIcon}>😊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={() => setShowChat(true)}>
          <Text style={styles.sideBtnIcon}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={() => setShowScores(true)}>
          <Text style={styles.sideBtnIcon}>📊</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={styles.sideBtn} onPress={() => setShowAdmin(true)}>
            <Text style={styles.sideBtnIcon}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Voice chat button */}
      <TouchableOpacity style={styles.voiceBtn} onPress={toggleMute}>
        <Text style={styles.voiceBtnIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
      </TouchableOpacity>

      {/* Sideshow response bar (when pending) */}
      {game.status === 'sideshow_pending' && game.sideshowChallengedId === user?.uid && (
        <View style={styles.sideshowBar}>
          <Text style={styles.sideshowText}>Sideshow requested! Compare hands?</Text>
          <View style={styles.sideshowBtns}>
            <TouchableOpacity
              style={styles.sideshowAccept}
              onPress={() => respondToSideshow(true)}
            >
              <Text style={styles.sideshowBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sideshowDecline}
              onPress={() => respondToSideshow(false)}
            >
              <Text style={styles.sideshowBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Betting controls — hidden once the round is over */}
      {!isGameFinished && (
        <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
          <BettingControls
            currentBet={game.currentBet}
            playerPoints={currentPlayer?.points ?? 0}
            isBlind={currentPlayer?.status === 'blind'}
            previousPlayerStatus={game.previousPlayerStatus ?? null}
            counterTriggered={game.counterTriggered ?? false}
            onChaal={handleChaal}
            onRaise={handleRaise}
            onFold={handleFold}
            onSeeCards={peekCards}
            onSideshow={
              canSideshow && previousPlayer
                ? () => requestSideshow(previousPlayer.uid)
                : undefined
            }
            onShow={showHand}
            canSideshow={canSideshow}
            isDisabled={!isMyTurn || game.status !== 'playing'}
          />
        </SafeAreaView>
      )}

      {/* Modals */}
      <EmotePanel
        visible={showEmotes}
        onClose={() => setShowEmotes(false)}
        onSelectEmote={async (emote) => {
          await sendEmote(emote);
          setShowEmotes(false);
        }}
      />
      <ChatPanel
        visible={showChat}
        onClose={() => setShowChat(false)}
        roomId={roomId}
      />
      {isAdmin && (
        <AdminPanel
          visible={showAdmin}
          onClose={() => setShowAdmin(false)}
          roomId={roomId}
          gameId={gameId}
          players={players}
        />
      )}
      <ScoreBoard
        visible={showScores}
        onClose={() => setShowScores(false)}
        players={players}
        startingPoints={currentRoom?.startingPoints ?? 1000}
      />

      {/* Winner Overlay */}
      <Modal visible={winnerVisible} transparent animationType="fade">
        <View style={styles.winnerOverlay}>
          <View style={styles.winnerCard}>
            <Text style={styles.winnerEmoji}>🏆</Text>
            <Text style={styles.winnerTitle}>Winner!</Text>
            <Text style={styles.winnerAvatar}>{winnerPlayer?.avatar ?? '🃏'}</Text>
            <Text style={styles.winnerName}>{winnerPlayer?.name ?? 'Unknown'}</Text>
            {game.winnerHandName && (
              <Text style={styles.winnerHand}>{game.winnerHandName}</Text>
            )}
            <Text style={styles.winnerPot}>+{game.pot} pts</Text>

            {isAdmin ? (
              <TouchableOpacity
                style={[styles.nextRoundBtn, isRestarting && styles.btnDisabled]}
                disabled={isRestarting}
                onPress={async () => {
                  try {
                    setIsRestarting(true);
                    await restartGame();
                    // Room subscription will update currentGameId; the effect
                    // above will navigation.replace to the new game.
                  } catch (err) {
                    setIsRestarting(false);
                  }
                }}
              >
                <Text style={styles.nextRoundBtnText}>
                  {isRestarting ? 'Starting…' : '▶  Next Round'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.waitingText}>
                Waiting for admin to start the next round…
              </Text>
            )}

            <TouchableOpacity
              style={styles.lobbyBtn}
              onPress={() => navigation.replace('RoomLobby', { roomId })}
            >
              <Text style={styles.lobbyBtnText}>Back to Lobby</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.tableGreen },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: { color: COLORS.gold, fontSize: 18 },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableInner: {
    width: '85%',
    height: '85%',
    borderRadius: SCREEN_W * 0.5,
    borderWidth: 2,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(13,43,26,0.9)',
  },
  roundBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roundText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  potContainer: { alignItems: 'center' },
  potLabel: { color: COLORS.gold, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  potAmount: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  variantBadge: {
    backgroundColor: COLORS.tableGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  variantText: { color: COLORS.gold, fontSize: 12, fontWeight: '600' },
  seatWrapper: {
    position: 'absolute',
    width: 96,
    zIndex: 5,
    alignItems: 'center',
  },
  seatWrapperSelf: {
    width: 130,
  },
  floatingEmote: {
    fontSize: 32,
    position: 'absolute',
    top: -36,
    zIndex: 20,
  },
  betIndicator: {
    position: 'absolute',
    top: SCREEN_H * 0.36,
    alignSelf: 'center',
    left: SCREEN_W * 0.5 - 50,
    alignItems: 'center',
    zIndex: 6,
  },
  betLabel: {
    color: COLORS.gold,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  betValue: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  chatBubble: {
    position: 'absolute',
    bottom: 160,
    left: 16,
    right: 80,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    padding: 10,
    zIndex: 8,
  },
  chatBubbleText: { color: COLORS.white, fontSize: 13 },
  sideButtons: {
    position: 'absolute',
    right: 12,
    // The betting bar at the bottom is ~210px tall on iPhones with a home
    // indicator. Position the icon column above it so none get clipped.
    bottom: 260,
    gap: 10,
    zIndex: 8,
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sideBtnIcon: { fontSize: 20 },
  voiceBtn: {
    position: 'absolute',
    left: 12,
    bottom: 260,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 8,
  },
  voiceBtnIcon: { fontSize: 20 },
  sideshowBar: {
    position: 'absolute',
    bottom: 150,
    left: 16,
    right: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.sideshow,
    zIndex: 10,
  },
  sideshowText: { color: COLORS.white, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  sideshowBtns: { flexDirection: 'row', gap: 10 },
  sideshowAccept: {
    flex: 1,
    backgroundColor: COLORS.sideshow,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sideshowDecline: {
    flex: 1,
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sideshowBtnText: { color: COLORS.white, fontWeight: '700' },
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
  winnerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.gold,
    width: SCREEN_W * 0.8,
  },
  winnerEmoji: { fontSize: 48, marginBottom: 8 },
  winnerTitle: {
    color: COLORS.gold,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 16,
  },
  winnerAvatar: { fontSize: 52 },
  winnerName: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  winnerHand: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },
  winnerPot: {
    color: COLORS.gold,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
  },
  nextRoundBtn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  nextRoundBtnText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  waitingText: {
    color: COLORS.white,
    opacity: 0.7,
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  lobbyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 10,
  },
  lobbyBtnText: {
    color: COLORS.white,
    opacity: 0.6,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
