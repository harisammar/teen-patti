import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Share,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoom } from '../hooks/useRoom';
import { useGame } from '../hooks/useGame';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import ChatPanel from '../components/ChatPanel';
import { COLORS, GAME_VARIANTS } from '../utils/constants';
import { RootStackParamList } from '../navigation/AppNavigator';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile } from '../types';
import {
  subscribeFriends,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendEntry,
  sendRoomInvite,
  FriendsSnapshot,
} from '../services/friendsService';
import { FriendEntry } from '../types';

type Route = RouteProp<RootStackParamList, 'RoomLobby'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface LobbyPlayer {
  uid: string;
  name: string;
  avatar: string;
  isSpectator: boolean;
}

type FriendRelationship = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

// ---------------------------------------------------------------------------
// Invite Friends Modal
// ---------------------------------------------------------------------------

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  friends: FriendEntry[];
  roomId: string;
  roomCode: string;
  roomName: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
}

function InviteFriendsModal({
  visible, onClose, friends, roomId, roomCode, roomName,
  fromUid, fromName, fromAvatar,
}: InviteModalProps) {
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  // Reset sent state when modal opens
  useEffect(() => {
    if (visible) setSentTo(new Set());
  }, [visible]);

  async function handleInvite(friend: FriendEntry) {
    setLoading(friend.uid);
    try {
      await sendRoomInvite(friend.uid, {
        roomId, roomCode, roomName, fromUid, fromName, fromAvatar,
      });
      setSentTo((prev) => new Set(prev).add(friend.uid));
    } catch {
      Alert.alert('Error', 'Could not send invite.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={invStyles.backdrop}>
        <View style={invStyles.sheet}>
          <View style={invStyles.header}>
            <Text style={invStyles.title}>📨 Invite Friends</Text>
            <TouchableOpacity onPress={onClose} style={invStyles.closeBtn}>
              <Text style={invStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {friends.length === 0 ? (
            <View style={invStyles.empty}>
              <Text style={invStyles.emptyIcon}>🤝</Text>
              <Text style={invStyles.emptyText}>No friends to invite yet</Text>
              <Text style={invStyles.emptySubText}>Add friends from the 👥 menu on the home screen</Text>
            </View>
          ) : (
            <ScrollView style={invStyles.list}>
              {friends.map((friend) => {
                const invited = sentTo.has(friend.uid);
                return (
                  <View key={friend.uid} style={invStyles.row}>
                    <Text style={invStyles.avatar}>{friend.avatar}</Text>
                    <Text style={invStyles.name}>{friend.name}</Text>
                    <TouchableOpacity
                      style={[invStyles.inviteBtn, invited && invStyles.invitedBtn]}
                      onPress={() => !invited && handleInvite(friend)}
                      disabled={loading === friend.uid || invited}
                    >
                      {loading === friend.uid ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={invStyles.inviteBtnText}>
                          {invited ? 'Invited ✓' : 'Invite'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function RoomLobbyScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { roomId } = route.params;

  const { user } = useAuthStore();
  const { room, leaveRoom, kickPlayer, subscribeToCurrentRoom } = useRoom();
  const { startGame, isLoading: gameLoading } = useGame();
  const { joinVoiceChat, leaveVoiceChat, isMuted, toggleMute, isConnected, connectedPeers } = useVoiceChat();
  const { messages } = useGameStore();

  const [chatVisible, setChatVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Friends data for Add/Invite buttons
  const [friendsSnap, setFriendsSnap] = useState<FriendsSnapshot>({ friends: [], incoming: [], sent: [] });
  const [addLoadingUid, setAddLoadingUid] = useState<string | null>(null);

  const isAdmin = user?.uid === room?.adminId;
  const canStart = (lobbyPlayers.filter((p) => !p.isSpectator).length >= 2) && isAdmin;

  // Subscribe to room updates
  useEffect(() => {
    const unsub = subscribeToCurrentRoom(roomId);
    return unsub;
  }, [roomId]);

  // Subscribe to friends for real-time relationship status
  useEffect(() => {
    if (!user) return;
    return subscribeFriends(user.uid, setFriendsSnap);
  }, [user?.uid]);

  // Fetch players list
  useEffect(() => {
    if (!room) return;
    fetchPlayers();
  }, [room?.currentPlayers]);

  // Navigate to game when it starts
  useEffect(() => {
    if (room?.status === 'playing' && room.currentGameId) {
      navigation.replace('Game', { roomId, gameId: room.currentGameId });
    }
  }, [room?.status, room?.currentGameId]);

  // Join voice chat
  useEffect(() => {
    if (user) {
      joinVoiceChat(roomId, user.uid).catch(() => {});
    }
    return () => leaveVoiceChat();
  }, [user, roomId]);

  async function fetchPlayers() {
    setLoadingPlayers(true);
    try {
      const snap = await getDocs(collection(db, 'rooms', roomId, 'players'));
      const players: LobbyPlayer[] = [];
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const profileSnap = await getDoc(doc(db, 'users', docSnap.id));
        if (profileSnap.exists()) {
          const p = profileSnap.data() as UserProfile;
          players.push({
            uid: docSnap.id,
            name: p.name,
            avatar: p.avatar,
            isSpectator: data.isSpectator ?? false,
          });
        }
      }
      setLobbyPlayers(players);
    } finally {
      setLoadingPlayers(false);
    }
  }

  // Determine friendship relationship for a given UID
  function getRelationship(uid: string): FriendRelationship {
    if (friendsSnap.friends.some((f) => f.uid === uid)) return 'accepted';
    if (friendsSnap.sent.some((f) => f.uid === uid)) return 'pending_sent';
    if (friendsSnap.incoming.some((f) => f.uid === uid)) return 'pending_received';
    return 'none';
  }

  async function handleAddFriend(player: LobbyPlayer) {
    if (!user) return;
    const rel = getRelationship(player.uid);
    setAddLoadingUid(player.uid);
    try {
      if (rel === 'none') {
        await sendFriendRequest(user.uid, user.name, user.avatar, player.uid, player.name, player.avatar);
      } else if (rel === 'pending_received') {
        const entry = friendsSnap.incoming.find((f) => f.uid === player.uid);
        if (entry) {
          await acceptFriendRequest(user.uid, user.name, user.avatar, player.uid, player.name, player.avatar);
        }
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setAddLoadingUid(null);
    }
  }

  async function handleStartGame() {
    if (!room) return;
    try {
      await startGame(roomId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not start game.');
    }
  }

  async function handleLeave() {
    Alert.alert('Leave Room', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          leaveVoiceChat();
          await leaveRoom();
          navigation.replace('Home');
        },
      },
    ]);
  }

  async function handleKick(targetId: string, targetName: string) {
    Alert.alert('Kick Player', `Remove ${targetName} from the room?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Kick', style: 'destructive', onPress: () => kickPlayer(targetId) },
    ]);
  }

  async function handleCopyCode() {
    if (room?.roomCode) {
      await Clipboard.setStringAsync(room.roomCode);
      Alert.alert('Copied!', `Room code ${room.roomCode} copied to clipboard.`);
    }
  }

  async function handleShareCode() {
    if (room?.roomCode) {
      await Share.share({ message: `Join my Teen Patti room! Use code: ${room.roomCode}` });
    }
  }

  if (!room) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Room header */}
      <View style={styles.roomHeader}>
        <View>
          <Text style={styles.roomName}>{room.name}</Text>
          <View style={styles.variantBadge}>
            <Text style={styles.variantText}>
              {GAME_VARIANTS[room.gameVariant].emoji} {GAME_VARIANTS[room.gameVariant].label}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.voiceBtn} onPress={toggleMute}>
            <Text style={styles.voiceBtnIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
            <Text style={styles.voiceBtnText}>{isConnected ? `${connectedPeers.length + 1}` : '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Room Code */}
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>ROOM CODE</Text>
        <Text style={styles.codeValue}>{room.roomCode}</Text>
        <View style={styles.codeActions}>
          <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode}>
            <Text style={styles.codeBtnText}>📋 Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.codeBtn} onPress={handleShareCode}>
            <Text style={styles.codeBtnText}>↗ Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.codeBtn, styles.inviteCodeBtn]}
            onPress={() => setInviteVisible(true)}
          >
            <Text style={[styles.codeBtnText, { color: COLORS.white }]}>👥 Invite</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Players list */}
      <Text style={styles.playersTitle}>
        Players ({lobbyPlayers.filter((p) => !p.isSpectator).length}/{room.maxPlayers})
      </Text>

      {loadingPlayers ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={lobbyPlayers}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => {
            const isMe = item.uid === user?.uid;
            const rel = isMe ? 'accepted' : getRelationship(item.uid);

            return (
              <View style={styles.playerRow}>
                <Text style={styles.playerAvatar}>{item.avatar}</Text>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {item.name}
                    {isMe ? ' (You)' : ''}
                    {item.uid === room.adminId ? ' 👑' : ''}
                  </Text>
                  <Text style={styles.playerStatus}>
                    {item.isSpectator ? '👁 Spectating' : '✓ Ready'}
                  </Text>
                </View>
                {connectedPeers.includes(item.uid) && (
                  <View style={styles.voiceIndicator} />
                )}
                {/* Add Friend button — only for other players */}
                {!isMe && rel !== 'accepted' && (
                  <TouchableOpacity
                    style={[
                      styles.addFriendBtn,
                      rel === 'pending_sent' && styles.addFriendBtnSent,
                      rel === 'pending_received' && styles.addFriendBtnAccept,
                    ]}
                    onPress={() => handleAddFriend(item)}
                    disabled={addLoadingUid === item.uid || rel === 'pending_sent'}
                  >
                    {addLoadingUid === item.uid ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.addFriendBtnText}>
                        {rel === 'none' ? '+ Add' : rel === 'pending_sent' ? 'Sent' : 'Accept'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                {!isMe && rel === 'accepted' && (
                  <View style={styles.friendsBadge}>
                    <Text style={styles.friendsBadgeText}>Friends</Text>
                  </View>
                )}
                {isAdmin && !isMe && (
                  <TouchableOpacity
                    style={styles.kickBtn}
                    onPress={() => handleKick(item.uid, item.name)}
                  >
                    <Text style={styles.kickBtnText}>Kick</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          contentContainerStyle={styles.playerList}
        />
      )}

      {/* Room settings summary */}
      <View style={styles.settings}>
        <Text style={styles.settingItem}>Boot: {room.bootAmount} pts</Text>
        <Text style={styles.settingItem}>Start: {room.startingPoints} pts</Text>
        <Text style={styles.settingItem}>Timer: {room.turnTimer}s</Text>
      </View>

      {/* Bottom actions */}
      <View style={styles.bottom}>
        <TouchableOpacity style={styles.chatBtn} onPress={() => setChatVisible(true)}>
          <Text style={styles.chatBtnText}>
            💬 Chat{messages.length > 0 ? ` (${messages.length})` : ''}
          </Text>
        </TouchableOpacity>

        {isAdmin ? (
          <TouchableOpacity
            style={[styles.startBtn, (!canStart || gameLoading) && styles.startBtnDisabled]}
            onPress={handleStartGame}
            disabled={!canStart || gameLoading}
          >
            {gameLoading ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.startBtnText}>
                {canStart ? 'Start Game' : `Need ${2 - lobbyPlayers.filter((p) => !p.isSpectator).length} more`}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingMsg}>
            <ActivityIndicator color={COLORS.gold} size="small" />
            <Text style={styles.waitingText}>Waiting for host to start...</Text>
          </View>
        )}
      </View>

      <ChatPanel visible={chatVisible} onClose={() => setChatVisible(false)} roomId={roomId} />

      {user && room && (
        <InviteFriendsModal
          visible={inviteVisible}
          onClose={() => setInviteVisible(false)}
          friends={friendsSnap.friends}
          roomId={roomId}
          roomCode={room.roomCode}
          roomName={room.name}
          fromUid={user.uid}
          fromName={user.name}
          fromAvatar={user.avatar}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  roomName: { color: COLORS.white, fontSize: 20, fontWeight: '700' },
  variantBadge: {
    backgroundColor: COLORS.tableGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  variantText: { color: COLORS.gold, fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  voiceBtn: {
    backgroundColor: COLORS.tableGreen,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  voiceBtnIcon: { fontSize: 18 },
  voiceBtnText: { color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
  leaveBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  leaveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  // Code card
  codeCard: {
    backgroundColor: COLORS.tableGreen,
    margin: 16,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  codeLabel: { color: COLORS.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  codeValue: { color: COLORS.white, fontSize: 36, fontWeight: '800', letterSpacing: 10 },
  codeActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  codeBtn: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inviteCodeBtn: { backgroundColor: '#1a3a5c', borderColor: COLORS.info },
  codeBtnText: { color: COLORS.gold, fontWeight: '600', fontSize: 13 },

  // Players
  playersTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  playerList: { paddingHorizontal: 16 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  playerAvatar: { fontSize: 28 },
  playerInfo: { flex: 1 },
  playerName: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  playerStatus: { color: COLORS.success, fontSize: 12, marginTop: 2 },
  voiceIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },

  // Add friend button
  addFriendBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#1e3a20',
    borderColor: COLORS.success,
    minWidth: 52,
    alignItems: 'center',
  },
  addFriendBtnSent: { backgroundColor: '#3d2e15', borderColor: COLORS.warning },
  addFriendBtnAccept: { backgroundColor: '#1e3a20', borderColor: COLORS.success },
  addFriendBtnText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },

  // Friends badge
  friendsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  friendsBadgeText: { color: COLORS.textMuted, fontSize: 11 },

  kickBtn: {
    backgroundColor: COLORS.dangerDark,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  kickBtnText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },

  // Settings
  settings: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingItem: { color: COLORS.textMuted, fontSize: 13 },

  // Bottom
  bottom: { padding: 16, flexDirection: 'row', gap: 12 },
  chatBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chatBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
  startBtn: {
    flex: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: { color: COLORS.background, fontWeight: '800', fontSize: 16 },
  waitingMsg: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  waitingText: { color: COLORS.textSecondary, fontSize: 14 },
});

// ---------------------------------------------------------------------------
// Invite modal styles
// ---------------------------------------------------------------------------

const invStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
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
  title: { color: COLORS.gold, fontSize: 17, fontWeight: '700' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: COLORS.textMuted, fontSize: 14 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  avatar: { fontSize: 28 },
  name: { flex: 1, color: COLORS.white, fontSize: 15, fontWeight: '600' },
  inviteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1a3a5c',
    borderWidth: 1,
    borderColor: COLORS.info,
    minWidth: 70,
    alignItems: 'center',
  },
  invitedBtn: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  inviteBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: COLORS.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center' },
});
