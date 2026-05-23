import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../store/authStore';
import { UserProfile } from '../types';
import { COLORS } from '../utils/constants';

type Tab = 'allTime' | 'session';

const RANK_BADGES: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export default function LeaderboardScreen() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('allTime');
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [tab]);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('totalPoints', 'desc'), limit(50));
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => d.data() as UserProfile);
      setPlayers(fetched);
    } finally {
      setLoading(false);
    }
  }

  function winRate(p: UserProfile): string {
    if (p.gamesPlayed === 0) return '—';
    return `${Math.round((p.gamesWon / p.gamesPlayed) * 100)}%`;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'allTime' && styles.tabActive]}
          onPress={() => setTab('allTime')}
        >
          <Text style={[styles.tabText, tab === 'allTime' && styles.tabTextActive]}>
            All Time
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'session' && styles.tabActive]}
          onPress={() => setTab('session')}
        >
          <Text style={[styles.tabText, tab === 'session' && styles.tabTextActive]}>
            This Session
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={players}
          keyExtractor={(item) => item.uid}
          renderItem={({ item, index }) => {
            const rank = index + 1;
            const isCurrentUser = item.uid === user?.uid;
            const isTopThree = rank <= 3;

            return (
              <View
                style={[
                  styles.row,
                  isCurrentUser && styles.rowHighlighted,
                  isTopThree && styles.rowTop,
                ]}
              >
                {/* Rank */}
                <View style={styles.rankCell}>
                  {RANK_BADGES[rank] ? (
                    <Text style={styles.rankBadge}>{RANK_BADGES[rank]}</Text>
                  ) : (
                    <Text style={styles.rankNum}>{rank}</Text>
                  )}
                </View>

                {/* Avatar + Name */}
                <Text style={styles.avatar}>{item.avatar}</Text>
                <View style={styles.nameCol}>
                  <Text style={[styles.name, isCurrentUser && styles.nameYou]}>
                    {item.name}{isCurrentUser ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.gamesText}>
                    {item.gamesPlayed} games · {item.gamesWon} wins
                  </Text>
                </View>

                {/* Stats */}
                <View style={styles.statsCol}>
                  <Text style={styles.points}>{item.totalPoints.toLocaleString()}</Text>
                  <Text style={styles.winRateText}>{winRate(item)} WR</Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              Top Players by Total Points
            </Text>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No players found.</Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.tableGreen },
  tabText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: COLORS.gold },
  loader: { marginTop: 60 },
  listHeader: {
    color: COLORS.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
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
  rowHighlighted: {
    borderColor: COLORS.gold,
    backgroundColor: '#1e3a2a',
  },
  rowTop: {
    borderColor: '#8b6914',
  },
  rankCell: { width: 36, alignItems: 'center' },
  rankBadge: { fontSize: 22 },
  rankNum: { color: COLORS.textMuted, fontSize: 16, fontWeight: '700' },
  avatar: { fontSize: 28 },
  nameCol: { flex: 1 },
  name: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  nameYou: { color: COLORS.gold },
  gamesText: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  statsCol: { alignItems: 'flex-end' },
  points: { color: COLORS.gold, fontSize: 16, fontWeight: '700' },
  winRateText: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});
