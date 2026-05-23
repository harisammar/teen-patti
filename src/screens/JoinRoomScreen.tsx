import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoom } from '../hooks/useRoom';
import RoomCard from '../components/RoomCard';
import { Room } from '../types';
import { COLORS } from '../utils/constants';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function JoinRoomScreen() {
  const navigation = useNavigation<Nav>();
  const { joinRoomByCode, joinRoom, joinAsSpectator, getRooms, isLoading } = useRoom();

  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const fetched = await getRooms();
      setRooms(fetched);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleJoinByCode() {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Room code must be exactly 6 characters.');
      return;
    }
    try {
      const room = await joinRoomByCode(code.trim());
      navigation.replace('RoomLobby', { roomId: room.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not find room.';
      Alert.alert('Error', msg);
    }
  }

  async function handleJoinRoom(room: Room) {
    try {
      await joinRoom(room.id);
      navigation.replace('RoomLobby', { roomId: room.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not join room.';
      Alert.alert('Error', msg);
    }
  }

  async function handleSpectate(room: Room) {
    try {
      await joinAsSpectator(room.id);
      navigation.replace('Spectator', {
        roomId: room.id,
        gameId: room.currentGameId || '',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not spectate.';
      Alert.alert('Error', msg);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Join by Code */}
      <View style={styles.codeSection}>
        <Text style={styles.sectionTitle}>Enter Room Code</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor={COLORS.textMuted}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
          />
          <TouchableOpacity
            style={[styles.joinCodeBtn, (isLoading || code.length !== 6) && styles.btnDisabled]}
            onPress={handleJoinByCode}
            disabled={isLoading || code.length !== 6}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <Text style={styles.joinCodeBtnText}>Join</Text>
            )}
          </TouchableOpacity>
        </View>
        {/* Character boxes for code */}
        <View style={styles.charBoxRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[styles.charBox, code[i] ? styles.charBoxFilled : null]}
            >
              <Text style={styles.charBoxText}>{code[i] || ''}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR BROWSE PUBLIC TABLES</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search rooms..."
          placeholderTextColor={COLORS.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Rooms List */}
      {loadingRooms ? (
        <ActivityIndicator color={COLORS.gold} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RoomCard
              room={item}
              onJoin={() => handleJoinRoom(item)}
              onSpectate={() => handleSpectate(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🃏</Text>
              <Text style={styles.emptyText}>
                {search ? 'No rooms match your search.' : 'No open tables right now.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  codeSection: {
    backgroundColor: COLORS.surface,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  codeRow: { flexDirection: 'row', gap: 10 },
  codeInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  joinCodeBtn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 22,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  joinCodeBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 16 },
  charBoxRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    justifyContent: 'center',
  },
  charBox: {
    width: 40,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  charBoxFilled: { borderColor: COLORS.gold, backgroundColor: COLORS.tableGreen },
  charBoxText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 0.5 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 16, marginRight: 6 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 15,
  },
  clearBtn: { color: COLORS.textMuted, fontSize: 16, padding: 4 },
  loader: { marginTop: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
});
