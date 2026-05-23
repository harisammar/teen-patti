import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useRoom } from '../hooks/useRoom';
import RoomCard from '../components/RoomCard';
import { Room } from '../types';
import { getMyRooms } from '../services/roomService';
import { subscribeFriends, subscribeInvites, dismissRoomInvite, RoomInvite } from '../services/friendsService';
import { COLORS } from '../utils/constants';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuth();
  const { getRooms, joinRoom, joinAsSpectator } = useRoom();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [roomInvites, setRoomInvites] = useState<RoomInvite[]>([]);

  const fetchRooms = useCallback(async () => {
    try {
      const [publicRooms, mine] = await Promise.all([
        getRooms(),
        user ? getMyRooms(user.uid) : Promise.resolve([] as Room[]),
      ]);
      setRooms(publicRooms);
      // Hide finished rooms from "Continue Playing" — only show active ones
      setMyRooms(mine.filter((r) => r.status !== 'finished'));
    } catch {
      // Silently fail on fetch errors; user can pull-to-refresh
    } finally {
      setLoadingRooms(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Live friend-request badge count
  useEffect(() => {
    if (!user) return;
    return subscribeFriends(user.uid, ({ incoming }) => setPendingFriendCount(incoming.length));
  }, [user?.uid]);

  // Live room invites
  useEffect(() => {
    if (!user) return;
    return subscribeInvites(user.uid, setRoomInvites);
  }, [user?.uid]);

  async function handleJoinInvite(invite: RoomInvite) {
    try {
      await dismissRoomInvite(user!.uid, invite.roomId);
      await joinRoom(invite.roomId);
      navigation.navigate('RoomLobby', { roomId: invite.roomId });
    } catch {
      // Room might be full or gone; just dismiss
      await dismissRoomInvite(user!.uid, invite.roomId).catch(() => {});
      Alert.alert('Could not join', 'The room may be full or no longer available.');
    }
  }

  async function handleDismissInvite(invite: RoomInvite) {
    await dismissRoomInvite(user!.uid, invite.roomId).catch(() => {});
  }

  function onRefresh() {
    setRefreshing(true);
    fetchRooms();
  }

  async function handleJoinRoom(room: Room) {
    try {
      await joinRoom(room.id);
      navigation.navigate('RoomLobby', { roomId: room.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not join room.';
      Alert.alert('Error', msg);
    }
  }

  async function handleSpectate(room: Room) {
    try {
      await joinAsSpectator(room.id);
      navigation.navigate('Spectator', { roomId: room.id, gameId: room.currentGameId || '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not spectate.';
      Alert.alert('Error', msg);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <LinearGradient colors={['#0d2b1a', '#1a4a2e']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.avatarText}>{user?.avatar ?? '👤'}</Text>
            <View>
              <Text style={styles.userName}>{user?.name ?? 'Player'}</Text>
              <Text style={styles.userPoints}>
                💰 {(user?.totalPoints ?? 0).toLocaleString()} pts
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate('Friends')}
            >
              <Text style={styles.headerIcon}>👥</Text>
              {pendingFriendCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {pendingFriendCount > 9 ? '9+' : pendingFriendCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate('Leaderboard')}
            >
              <Text style={styles.headerIcon}>🏆</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.headerIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>♠ Teen Patti</Text>
          <Text style={styles.pageSubtitle}>The Classic Indian Card Game</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.createBtn]}
            onPress={() => navigation.navigate('CreateRoom')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnIcon}>🎰</Text>
            <Text style={styles.actionBtnText}>Create Room</Text>
            <Text style={styles.actionBtnSub}>Start your own table</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.joinBtn]}
            onPress={() => navigation.navigate('JoinRoom')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnIcon}>🚪</Text>
            <Text style={styles.actionBtnText}>Join Room</Text>
            <Text style={styles.actionBtnSub}>Enter by code or browse</Text>
          </TouchableOpacity>
        </View>

        {loadingRooms ? (
          <ActivityIndicator color={COLORS.gold} style={styles.loader} />
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RoomCard
                room={item}
                onJoin={() => handleJoinRoom(item)}
                onSpectate={() => handleSpectate(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <>
                {/* Room Invites */}
                {roomInvites.length > 0 && (
                  <View style={styles.invitesSection}>
                    <Text style={styles.listTitle}>📨 Room Invites</Text>
                    {roomInvites.map((invite) => (
                      <View key={invite.roomId} style={styles.inviteCard}>
                        <Text style={styles.inviteAvatar}>{invite.fromAvatar}</Text>
                        <View style={styles.inviteInfo}>
                          <Text style={styles.inviteName}>{invite.fromName}</Text>
                          <Text style={styles.inviteRoom} numberOfLines={1}>
                            invited you to "{invite.roomName}"
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.inviteJoinBtn}
                          onPress={() => handleJoinInvite(invite)}
                        >
                          <Text style={styles.inviteJoinText}>Join</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.inviteDismissBtn}
                          onPress={() => handleDismissInvite(invite)}
                        >
                          <Text style={styles.inviteDismissText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {myRooms.length > 0 && (
                  <>
                    <View style={styles.listHeader}>
                      <Text style={styles.listTitle}>▶ Continue Playing</Text>
                    </View>
                    {myRooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        onJoin={() => navigation.navigate('RoomLobby', { roomId: room.id })}
                        onSpectate={() => handleSpectate(room)}
                        joinLabel="Resume"
                      />
                    ))}
                  </>
                )}
                <View style={styles.listHeader}>
                  <Text style={styles.listTitle}>Open Tables</Text>
                  <TouchableOpacity onPress={onRefresh}>
                    <Text style={styles.refreshText}>Refresh ↻</Text>
                  </TouchableOpacity>
                </View>
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🃏</Text>
                <Text style={styles.emptyText}>No open tables right now.</Text>
                <Text style={styles.emptySubText}>Be the first to create one!</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.gold}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarText: { fontSize: 36 },
  userName: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  userPoints: { color: COLORS.gold, fontSize: 13, marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  titleRow: { alignItems: 'center', paddingVertical: 12 },
  pageTitle: { fontSize: 34, fontWeight: '800', color: COLORS.white, letterSpacing: 2 },
  pageSubtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
  },
  createBtn: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.goldDark,
  },
  joinBtn: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  actionBtnIcon: { fontSize: 30, marginBottom: 6 },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.background,
  },
  actionBtnSub: {
    fontSize: 11,
    color: COLORS.background,
    opacity: 0.7,
    marginTop: 2,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  listTitle: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  refreshText: { color: COLORS.gold, fontSize: 14 },
  loader: { marginTop: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },

  // Room invites
  invitesSection: { marginBottom: 16 },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3a5c',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.info,
    gap: 10,
  },
  inviteAvatar: { fontSize: 26 },
  inviteInfo: { flex: 1 },
  inviteName: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  inviteRoom: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  inviteJoinBtn: {
    backgroundColor: COLORS.info,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  inviteJoinText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  inviteDismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteDismissText: { color: COLORS.textMuted, fontSize: 13 },
});
