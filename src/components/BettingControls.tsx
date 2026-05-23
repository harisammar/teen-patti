import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { COLORS } from '../utils/constants';
import { computeChaalAmount, PlayStatus } from '../utils/gameLogic';

interface BettingControlsProps {
  currentBet: number;
  playerPoints: number;
  isBlind: boolean;
  /** Status of the last player who chaaled/raised. null if no one yet. */
  previousPlayerStatus: PlayStatus | null;
  /** True once any seen player has chaaled after a blind in this round. */
  counterTriggered: boolean;
  onChaal: () => Promise<void>;
  onRaise: (amount: number) => Promise<void>;
  onFold: () => Promise<void>;
  onSeeCards: () => Promise<void>;
  onSideshow?: () => Promise<void>;
  onShow: () => Promise<void>;
  canSideshow: boolean;
  isDisabled: boolean;
}

export default function BettingControls({
  currentBet,
  playerPoints,
  isBlind,
  previousPlayerStatus,
  counterTriggered,
  onChaal,
  onRaise,
  onFold,
  onSeeCards,
  onSideshow,
  onShow,
  canSideshow,
  isDisabled,
}: BettingControlsProps) {
  const [raiseModalVisible, setRaiseModalVisible] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const myStatus: PlayStatus = isBlind ? 'blind' : 'seen';
  const chaalCost = computeChaalAmount(
    myStatus,
    currentBet,
    previousPlayerStatus,
    counterTriggered
  );
  // Minimum raise must exceed your chaal cost, and at least 2x the stake.
  const minRaise = Math.max(chaalCost + 1, currentBet * 2);

  async function handleAction(action: () => Promise<void>) {
    if (loading) return;
    setLoading(true);
    try {
      await action();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmRaise() {
    const amount = parseInt(raiseAmount, 10);
    if (isNaN(amount) || amount < minRaise) {
      Alert.alert('Invalid Amount', `Minimum raise is ${minRaise} pts.`);
      return;
    }
    if (amount > playerPoints) {
      Alert.alert('Insufficient Points', `You only have ${playerPoints} pts.`);
      return;
    }
    setRaiseModalVisible(false);
    setRaiseAmount('');
    await handleAction(() => onRaise(amount));
  }

  return (
    <View style={styles.container}>
      {/* Top row: See Cards (if blind) + status */}
      <View style={styles.infoRow}>
        <Text style={styles.infoText}>
          {isBlind ? '🙈 Playing Blind' : '👁 Seen'}
          {counterTriggered && !isBlind ? '  ⚡3×' : ''}
        </Text>
        <Text style={styles.infoPoints}>
          💰 {playerPoints.toLocaleString()} pts
        </Text>
        <Text style={styles.infoBet}>
          Chaal: {chaalCost} pts
        </Text>
      </View>

      {/* Main controls */}
      <View style={styles.mainRow}>
        {/* Fold */}
        <TouchableOpacity
          style={[styles.btn, styles.foldBtn, (isDisabled || loading) && styles.btnDisabled]}
          onPress={() => handleAction(onFold)}
          disabled={isDisabled || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>✖</Text>
          <Text style={[styles.btnText, styles.foldText]}>Fold</Text>
        </TouchableOpacity>

        {/* Chaal (Call) */}
        <TouchableOpacity
          style={[styles.btn, styles.chaalBtn, (isDisabled || loading || playerPoints < chaalCost) && styles.btnDisabled]}
          onPress={() => handleAction(onChaal)}
          disabled={isDisabled || loading || playerPoints < chaalCost}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>✓</Text>
          <Text style={[styles.btnText, styles.chaalText]}>
            Chaal{'\n'}({chaalCost})
          </Text>
        </TouchableOpacity>

        {/* Raise */}
        <TouchableOpacity
          style={[styles.btn, styles.raiseBtn, (isDisabled || loading) && styles.btnDisabled]}
          onPress={() => {
            if (!isDisabled) {
              setRaiseAmount(String(minRaise));
              setRaiseModalVisible(true);
            }
          }}
          disabled={isDisabled || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>↑</Text>
          <Text style={[styles.btnText, styles.raiseText]}>Raise</Text>
        </TouchableOpacity>
      </View>

      {/* Secondary row */}
      <View style={styles.secondaryRow}>
        {/* See Cards (blind only) */}
        {isBlind && (
          <TouchableOpacity
            style={[styles.secBtn, styles.seeBtn, (isDisabled || loading) && styles.btnDisabled]}
            onPress={() => handleAction(onSeeCards)}
            disabled={isDisabled || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.secBtnText}>👁 See Cards</Text>
          </TouchableOpacity>
        )}

        {/* Sideshow (seen players, when applicable) */}
        {!isBlind && canSideshow && onSideshow && (
          <TouchableOpacity
            style={[styles.secBtn, styles.sideshowBtn, (isDisabled || loading) && styles.btnDisabled]}
            onPress={() => handleAction(onSideshow)}
            disabled={isDisabled || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.secBtnText}>⚔ Sideshow</Text>
          </TouchableOpacity>
        )}

        {/* Show (seen players, triggers showdown) */}
        {!isBlind && (
          <TouchableOpacity
            style={[styles.secBtn, styles.showBtn, (isDisabled || loading) && styles.btnDisabled]}
            onPress={() => handleAction(onShow)}
            disabled={isDisabled || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.secBtnText}>🃏 Show</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Raise amount modal */}
      <Modal visible={raiseModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter Raise Amount</Text>
            <Text style={styles.modalSubtitle}>
              Minimum: {minRaise} pts · You have: {playerPoints} pts
            </Text>
            <TextInput
              style={styles.modalInput}
              value={raiseAmount}
              onChangeText={setRaiseAmount}
              keyboardType="number-pad"
              autoFocus
              placeholder={`Min ${minRaise}`}
              placeholderTextColor={COLORS.textMuted}
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setRaiseModalVisible(false); setRaiseAmount(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmRaise}
              >
                <Text style={styles.modalConfirmText}>Raise</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  infoText: { color: COLORS.textSecondary, fontSize: 12 },
  infoPoints: { color: COLORS.gold, fontSize: 12, fontWeight: '600' },
  infoBet: { color: COLORS.textMuted, fontSize: 12 },
  mainRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnDisabled: { opacity: 0.35 },
  btnIcon: { fontSize: 16 },
  btnText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  foldBtn: {
    backgroundColor: '#3d1515',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  foldText: { color: COLORS.danger },
  chaalBtn: {
    backgroundColor: '#153d1e',
    borderWidth: 1,
    borderColor: COLORS.call,
    flex: 1.4,
  },
  chaalText: { color: COLORS.call },
  raiseBtn: {
    backgroundColor: '#3d2e0a',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  raiseText: { color: COLORS.gold },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  secBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
  },
  seeBtn: {
    backgroundColor: '#3d2800',
    borderColor: COLORS.seeCards,
  },
  sideshowBtn: {
    backgroundColor: '#2a1040',
    borderColor: COLORS.sideshow,
  },
  showBtn: {
    backgroundColor: '#102840',
    borderColor: COLORS.show,
  },
  secBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: { color: COLORS.textMuted, fontSize: 13, marginBottom: 16 },
  modalInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 16 },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: { color: COLORS.background, fontWeight: '700', fontSize: 16 },
});
