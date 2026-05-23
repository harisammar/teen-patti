import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoom } from '../hooks/useRoom';
import { GameVariant, GameSettings } from '../types';
import { COLORS, GAME_VARIANTS } from '../utils/constants';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BOOT_STEPS = [10, 20, 30, 50, 100, 200, 500];
const TIMER_OPTIONS: (15 | 30 | 60)[] = [15, 30, 60];
const PLAYER_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export default function CreateRoomScreen() {
  const navigation = useNavigation<Nav>();
  const { createRoom, isLoading } = useRoom();

  const [roomName, setRoomName] = useState('');
  const [variant, setVariant] = useState<GameVariant>('classic');
  const [bootIndex, setBootIndex] = useState(2); // 30
  const [startingPoints, setStartingPoints] = useState('1000');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [turnTimer, setTurnTimer] = useState<15 | 30 | 60>(30);
  const [hasPotLimit, setHasPotLimit] = useState(false);
  const [potLimit, setPotLimit] = useState('5000');
  const [isPublic, setIsPublic] = useState(true);

  const bootAmount = BOOT_STEPS[bootIndex];

  async function handleCreate() {
    const name = roomName.trim() || `${variant.charAt(0).toUpperCase() + variant.slice(1)} Table`;
    const spPoints = parseInt(startingPoints, 10);

    if (isNaN(spPoints) || spPoints < 500) {
      Alert.alert('Invalid Settings', 'Starting points must be at least 500.');
      return;
    }
    if (hasPotLimit) {
      const limit = parseInt(potLimit, 10);
      if (isNaN(limit) || limit < bootAmount * 10) {
        Alert.alert('Invalid Settings', `Pot limit must be at least ${bootAmount * 10}.`);
        return;
      }
    }

    const settings: GameSettings = {
      name,
      gameVariant: variant,
      bootAmount,
      maxPlayers,
      startingPoints: spPoints,
      turnTimer,
      potLimit: hasPotLimit ? parseInt(potLimit, 10) : null,
      isPublic,
    };

    try {
      const room = await createRoom(settings);
      navigation.replace('RoomLobby', { roomId: room.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create room.';
      Alert.alert('Error', msg);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Room Name */}
        <Section title="Room Name">
          <TextInput
            style={styles.input}
            value={roomName}
            onChangeText={setRoomName}
            placeholder="e.g. High Stakes Club"
            placeholderTextColor={COLORS.textMuted}
            maxLength={40}
          />
        </Section>

        {/* Game Variant */}
        <Section title="Game Variant">
          {(Object.keys(GAME_VARIANTS) as GameVariant[]).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.variantCard, variant === v && styles.variantCardActive]}
              onPress={() => setVariant(v)}
              activeOpacity={0.8}
            >
              <View style={styles.variantHeader}>
                <Text style={styles.variantEmoji}>{GAME_VARIANTS[v].emoji}</Text>
                <Text style={[styles.variantLabel, variant === v && styles.variantLabelActive]}>
                  {GAME_VARIANTS[v].label}
                </Text>
                {variant === v && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.variantDesc}>{GAME_VARIANTS[v].description}</Text>
            </TouchableOpacity>
          ))}
        </Section>

        {/* Boot Amount */}
        <Section title={`Boot Amount: ${bootAmount} pts`}>
          <View style={styles.stepRow}>
            <TouchableOpacity
              style={[styles.stepBtn, bootIndex === 0 && styles.stepBtnDisabled]}
              onPress={() => setBootIndex(Math.max(0, bootIndex - 1))}
              disabled={bootIndex === 0}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.stepValueContainer}>
              {BOOT_STEPS.map((val, idx) => (
                <View
                  key={val}
                  style={[styles.stepDot, idx === bootIndex && styles.stepDotActive]}
                />
              ))}
            </View>
            <TouchableOpacity
              style={[styles.stepBtn, bootIndex === BOOT_STEPS.length - 1 && styles.stepBtnDisabled]}
              onPress={() => setBootIndex(Math.min(BOOT_STEPS.length - 1, bootIndex + 1))}
              disabled={bootIndex === BOOT_STEPS.length - 1}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.stepValues}>
            {BOOT_STEPS.join(' · ')}
          </Text>
        </Section>

        {/* Starting Points */}
        <Section title="Starting Points per Player">
          <TextInput
            style={styles.input}
            value={startingPoints}
            onChangeText={setStartingPoints}
            keyboardType="number-pad"
            placeholder="Min 500"
            placeholderTextColor={COLORS.textMuted}
          />
          <Text style={styles.hint}>Minimum 500 points</Text>
        </Section>

        {/* Max Players */}
        <Section title={`Max Players: ${maxPlayers}`}>
          <View style={styles.chipRow}>
            {PLAYER_OPTIONS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, maxPlayers === n && styles.chipActive]}
                onPress={() => setMaxPlayers(n)}
              >
                <Text style={[styles.chipText, maxPlayers === n && styles.chipTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Turn Timer */}
        <Section title="Turn Timer">
          <View style={styles.chipRow}>
            {TIMER_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, turnTimer === t && styles.chipActive]}
                onPress={() => setTurnTimer(t)}
              >
                <Text style={[styles.chipText, turnTimer === t && styles.chipTextActive]}>
                  {t}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Pot Limit */}
        <Section title="Pot Limit">
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable Pot Limit</Text>
            <Switch
              value={hasPotLimit}
              onValueChange={setHasPotLimit}
              trackColor={{ false: COLORS.border, true: COLORS.gold }}
              thumbColor={COLORS.white}
            />
          </View>
          {hasPotLimit && (
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              value={potLimit}
              onChangeText={setPotLimit}
              keyboardType="number-pad"
              placeholder="e.g. 5000"
              placeholderTextColor={COLORS.textMuted}
            />
          )}
        </Section>

        {/* Public/Private */}
        <Section title="Room Visibility">
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>{isPublic ? 'Public Room' : 'Private Room'}</Text>
              <Text style={styles.hint}>
                {isPublic ? 'Anyone can find and join' : 'Join by code only'}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: COLORS.border, true: COLORS.gold }}
              thumbColor={COLORS.white}
            />
          </View>
        </Section>

        {/* Preview */}
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Variant</Text>
            <Text style={styles.previewValue}>{GAME_VARIANTS[variant].label}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Boot</Text>
            <Text style={styles.previewValue}>{bootAmount} pts</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Players</Text>
            <Text style={styles.previewValue}>2–{maxPlayers}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Timer</Text>
            <Text style={styles.previewValue}>{turnTimer}s</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Starting</Text>
            <Text style={styles.previewValue}>{startingPoints} pts</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Visibility</Text>
            <Text style={styles.previewValue}>{isPublic ? 'Public' : 'Private'}</Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createBtn, isLoading && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.createBtnText}>Create Room</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 16,
  },
  hint: { color: COLORS.textMuted, fontSize: 12, marginTop: 5 },
  variantCard: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  variantCardActive: {
    borderColor: COLORS.gold,
    backgroundColor: '#1e3a2a',
  },
  variantHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  variantEmoji: { fontSize: 20 },
  variantLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, flex: 1 },
  variantLabelActive: { color: COLORS.gold },
  checkmark: { color: COLORS.gold, fontSize: 18, fontWeight: '700' },
  variantDesc: { color: COLORS.textMuted, fontSize: 12, lineHeight: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.tableGreen,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { color: COLORS.gold, fontSize: 22, fontWeight: '700' },
  stepValueContainer: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'center' },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  stepDotActive: { backgroundColor: COLORS.gold },
  stepValues: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.tableGreen, borderColor: COLORS.gold },
  chipText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: COLORS.gold },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  preview: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewTitle: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  previewLabel: { color: COLORS.textMuted, fontSize: 14 },
  previewValue: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  createBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
