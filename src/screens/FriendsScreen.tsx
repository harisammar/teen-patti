import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ViewStyle,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../utils/constants';
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  cancelFriendRequest,
  getFriendEntry,
  subscribeFriends,
} from '../services/friendsService';
import { FriendEntry, UserSearchResult } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SearchResultRowProps {
  result: UserSearchResult;
  relationship: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  onAction: () => void;
  loading: boolean;
}

function SearchResultRow({ result, relationship, onAction, loading }: SearchResultRowProps) {
  let btnLabel = '+ Add';
  let btnStyle: ViewStyle = styles.addBtn as ViewStyle;

  if (relationship === 'accepted') {
    btnLabel = 'Friends ✓';
    btnStyle = styles.friendsBtn as ViewStyle;
  } else if (relationship === 'pending_sent') {
    btnLabel = 'Requested';
    btnStyle = styles.requestedBtn as ViewStyle;
  } else if (relationship === 'pending_received') {
    btnLabel = 'Accept';
    btnStyle = styles.acceptBtn as ViewStyle;
  }

  return (
    <View style={styles.personRow}>
      <Text style={styles.personAvatar}>{result.avatar}</Text>
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{result.name}</Text>
        <Text style={styles.personEmail} numberOfLines={1}>{result.email}</Text>
      </View>
      <TouchableOpacity
        style={[styles.actionBtn, btnStyle]}
        onPress={onAction}
        disabled={loading || relationship === 'accepted'}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Text style={styles.actionBtnText}>{btnLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

interface FriendRowProps {
  friend: FriendEntry;
  onRemove: () => void;
  onInvite?: () => void;
  isIncoming?: boolean;
  onAccept?: () => void;
  loading: boolean;
}

function FriendRow({ friend, onRemove, onInvite, isIncoming, onAccept, loading }: FriendRowProps) {
  return (
    <View style={styles.personRow}>
      <Text style={styles.personAvatar}>{friend.avatar}</Text>
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{friend.name}</Text>
        {isIncoming && (
          <Text style={styles.pendingLabel}>Wants to be friends</Text>
        )}
      </View>
      <View style={styles.rowButtons}>
        {isIncoming && onAccept && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={onAccept}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.actionBtnText}>Accept</Text>
            )}
          </TouchableOpacity>
        )}
        {onInvite && (
          <TouchableOpacity style={[styles.actionBtn, styles.inviteBtn]} onPress={onInvite}>
            <Text style={styles.actionBtnText}>Invite</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, styles.removeBtn]}
          onPress={onRemove}
          disabled={loading}
        >
          <Text style={styles.actionBtnText}>{isIncoming ? 'Decline' : '✕'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

type Tab = 'friends' | 'requests' | 'search';

export default function FriendsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('friends');

  // Friends & requests — populated in real-time via onSnapshot
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendEntry[]>([]);
  const [sent, setSent] = useState<FriendEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchRelationships, setSearchRelationships] = useState<
    Record<string, 'none' | 'pending_sent' | 'pending_received' | 'accepted'>
  >({});
  const [actionLoadingUid, setActionLoadingUid] = useState<string | null>(null);

  // ---- Real-time friends subscription ----
  useEffect(() => {
    if (!user) return;
    setLoadingList(true);

    const unsub = subscribeFriends(
      user.uid,
      ({ friends: f, incoming: inc, sent: s }) => {
        setFriends(f);
        setIncoming(inc);
        setSent(s);
        setLoadingList(false);

        // Keep search relationship badges in sync with live data
        setSearchRelationships((prev) => {
          const next = { ...prev };
          [...f, ...inc, ...s].forEach((entry) => {
            if (entry.status === 'accepted') {
              next[entry.uid] = 'accepted';
            } else if (entry.initiatedBy === user.uid) {
              next[entry.uid] = 'pending_sent';
            } else {
              next[entry.uid] = 'pending_received';
            }
          });
          return next;
        });
      },
      () => setLoadingList(false)
    );

    return unsub; // clean up listener when screen unmounts
  }, [user?.uid]);

  // ---- search ----

  useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'search') {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (!user) return;
      setSearching(true);
      try {
        const results = await searchUsers(searchQuery.trim(), user.uid);
        setSearchResults(results);

        // Fetch relationship status for each result
        const rels: typeof searchRelationships = {};
        await Promise.all(
          results.map(async (r) => {
            const entry = await getFriendEntry(user.uid, r.uid);
            if (!entry) {
              rels[r.uid] = 'none';
            } else if (entry.status === 'accepted') {
              rels[r.uid] = 'accepted';
            } else if (entry.initiatedBy === user.uid) {
              rels[r.uid] = 'pending_sent';
            } else {
              rels[r.uid] = 'pending_received';
            }
          })
        );
        setSearchRelationships(rels);
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, user?.uid, activeTab]);

  // ---- actions ----

  async function handleSearchAction(result: UserSearchResult) {
    if (!user) return;
    const rel = searchRelationships[result.uid] ?? 'none';
    setActionLoadingUid(result.uid);
    try {
      if (rel === 'none') {
        await sendFriendRequest(
          user.uid, user.name, user.avatar,
          result.uid, result.name, result.avatar
        );
        setSearchRelationships((prev) => ({ ...prev, [result.uid]: 'pending_sent' }));
      } else if (rel === 'pending_sent') {
        await cancelFriendRequest(user.uid, result.uid);
        setSearchRelationships((prev) => ({ ...prev, [result.uid]: 'none' }));
      } else if (rel === 'pending_received') {
        await handleAccept({ uid: result.uid, name: result.name, avatar: result.avatar, status: 'pending', initiatedBy: result.uid, createdAt: 0 });
        setSearchRelationships((prev) => ({ ...prev, [result.uid]: 'accepted' }));
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionLoadingUid(null);
    }
  }

  async function handleAccept(friend: FriendEntry) {
    if (!user) return;
    setActionLoadingUid(friend.uid);
    try {
      await acceptFriendRequest(
        user.uid, user.name, user.avatar,
        friend.uid, friend.name, friend.avatar
      );
      // No need to reload — onSnapshot fires automatically
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not accept request.');
    } finally {
      setActionLoadingUid(null);
    }
  }

  async function handleRemove(friend: FriendEntry, label: string) {
    if (!user) return;
    Alert.alert(label, `${label === 'Remove Friend' ? 'Remove' : 'Decline'} ${friend.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label === 'Remove Friend' ? 'Remove' : 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActionLoadingUid(friend.uid);
          try {
            await removeFriend(user.uid, friend.uid);
            // No need to reload — onSnapshot fires automatically
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Action failed.');
          } finally {
            setActionLoadingUid(null);
          }
        },
      },
    ]);
  }

  async function handleCancelSent(friend: FriendEntry) {
    if (!user) return;
    setActionLoadingUid(friend.uid);
    try {
      await cancelFriendRequest(user.uid, friend.uid);
      // No need to reload — onSnapshot fires automatically
    } catch {
      // silent
    } finally {
      setActionLoadingUid(null);
    }
  }

  // ---- Invite to room (placeholder — opens JoinRoom for now) ----
  function handleInvite(friend: FriendEntry) {
    Alert.alert(
      'Invite Friend',
      `To invite ${friend.name}, share your room code with them directly in chat.`,
      [{ text: 'Got it' }]
    );
  }

  // ---- Render ----

  const pendingCount = incoming.length;

  return (
    <LinearGradient colors={['#0d2b1a', '#1a4a2e']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>👥 Friends</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
            onPress={() => setActiveTab('friends')}
          >
            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
              Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Requests
              {pendingCount > 0 ? (
                <Text style={styles.badge}> {pendingCount}</Text>
              ) : null}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            onPress={() => setActiveTab('search')}
          >
            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
              Find People
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab content */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ---- Friends list ---- */}
          {activeTab === 'friends' && (
            <>
              {loadingList ? (
                <ActivityIndicator color={COLORS.gold} style={styles.loader} />
              ) : (
                <FlatList
                  data={friends}
                  keyExtractor={(item) => item.uid}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <FriendRow
                      friend={item}
                      loading={actionLoadingUid === item.uid}
                      onRemove={() => handleRemove(item, 'Remove Friend')}
                      onInvite={() => handleInvite(item)}
                    />
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyIcon}>🤝</Text>
                      <Text style={styles.emptyText}>No friends yet</Text>
                      <Text style={styles.emptySubText}>
                        Search for players and send friend requests!
                      </Text>
                    </View>
                  }
                />
              )}
            </>
          )}

          {/* ---- Requests ---- */}
          {activeTab === 'requests' && (
            <>
              {loadingList ? (
                <ActivityIndicator color={COLORS.gold} style={styles.loader} />
              ) : (
                <FlatList
                  data={[
                    ...incoming.map((f) => ({ ...f, _type: 'incoming' as const })),
                    ...sent.map((f) => ({ ...f, _type: 'sent' as const })),
                  ]}
                  keyExtractor={(item) => `${item._type}-${item.uid}`}
                  contentContainerStyle={styles.listContent}
                  ListHeaderComponent={
                    incoming.length > 0 ? (
                      <Text style={styles.sectionHeader}>Incoming Requests</Text>
                    ) : null
                  }
                  renderItem={({ item }) => {
                    if (item._type === 'incoming') {
                      return (
                        <FriendRow
                          friend={item}
                          isIncoming
                          loading={actionLoadingUid === item.uid}
                          onAccept={() => handleAccept(item)}
                          onRemove={() => handleRemove(item, 'Decline Request')}
                        />
                      );
                    }
                    return (
                      <View style={styles.personRow}>
                        <Text style={styles.personAvatar}>{item.avatar}</Text>
                        <View style={styles.personInfo}>
                          <Text style={styles.personName}>{item.name}</Text>
                          <Text style={styles.pendingLabel}>Request sent</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.requestedBtn]}
                          onPress={() => handleCancelSent(item)}
                          disabled={actionLoadingUid === item.uid}
                        >
                          {actionLoadingUid === item.uid ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                          ) : (
                            <Text style={styles.actionBtnText}>Cancel</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyIcon}>📨</Text>
                      <Text style={styles.emptyText}>No pending requests</Text>
                    </View>
                  }
                />
              )}
            </>
          )}

          {/* ---- Search ---- */}
          {activeTab === 'search' && (
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name..."
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={styles.clearText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {searching ? (
                <ActivityIndicator color={COLORS.gold} style={styles.loader} />
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.uid}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <SearchResultRow
                      result={item}
                      relationship={searchRelationships[item.uid] ?? 'none'}
                      onAction={() => handleSearchAction(item)}
                      loading={actionLoadingUid === item.uid}
                    />
                  )}
                  ListEmptyComponent={
                    searchQuery.trim().length > 0 ? (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>😕</Text>
                        <Text style={styles.emptyText}>No players found</Text>
                        <Text style={styles.emptySubText}>
                          Try a different name
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>🔍</Text>
                        <Text style={styles.emptyText}>Start typing to search</Text>
                      </View>
                    )
                  }
                />
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
  },
  backText: { color: COLORS.gold, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: COLORS.gold, fontSize: 20, fontWeight: '800' },

  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: COLORS.tableGreen,
  },
  tabText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  badge: { color: COLORS.danger, fontWeight: '800' },

  // List
  loader: { marginTop: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Person row
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  personAvatar: { fontSize: 30 },
  personInfo: { flex: 1 },
  personName: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  personEmail: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  pendingLabel: { color: COLORS.warning, fontSize: 11, marginTop: 1 },
  rowButtons: { flexDirection: 'row', gap: 6 },

  // Action buttons
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  addBtn: { backgroundColor: '#1e3a20', borderColor: COLORS.success },
  acceptBtn: { backgroundColor: '#1e3a20', borderColor: COLORS.success },
  friendsBtn: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  requestedBtn: { backgroundColor: '#3d2e15', borderColor: COLORS.warning },
  removeBtn: { backgroundColor: '#3d1515', borderColor: COLORS.danger },
  inviteBtn: { backgroundColor: '#1a2e50', borderColor: COLORS.info },

  // Search
  searchContainer: { flex: 1, paddingHorizontal: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 15,
  },
  clearText: { color: COLORS.textMuted, fontSize: 16 },

  // Empty states
  emptyContainer: { alignItems: 'center', paddingTop: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: COLORS.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
});
