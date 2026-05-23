import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Player } from '../types';
import { COLORS } from '../utils/constants';
import { useAuthStore } from '../store/authStore';

interface ScoreBoardProps {
  visible: boolean;
  onClose: () => void;
  players: Player[];
  startingPoints: number;
}

export default function ScoreBoard({
  visible,
  onClose,
  players,
  startingPoints,
}: ScoreBoardProps) {
  const { user } = useAuthStore();

  // Sort players by current points descending
  const sorted = [...players].sort((a, b) => b.points - a.points);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📊 Scoreboard</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Column headers */}
          <View style={styles.colHeader}>
            <Text style={[styles.colText, styles.colRank]}>#</Text>
            <Text style={[styles.colText, styles.colName]}>Player</Text>
            <Text style={[styles.colText, styles.colStart]}>Start</Text>
            <Text style={[styles.colText, styles.colCurrent]}>Now</Text>
            <Text style={[styles.colText, styles.colChange]}>+/-</Text>
          </View>

          <FlatList
            data={sorted}
            keyExtractor={(item) => item.uid}
            renderItem={({ item, index }) => {
              const change = item.points - startingPoints;
              const isCurrentUser = item.uid === user?.uid;
              const isFolded = item.status === 'folded';
              const isWinner = item.status === 'winner';

              return (
                <View
                  style={[
                    styles.row,
                    isCurrentUser && styles.rowHighlighted,
                    isWinner && styles.rowWinner,
                    isFolded && styles.rowFolded,
                  ]}
                >
                  <Text style={[styles.cellText, styles.colRank, styles.rankText]}>
                    {index + 1}
                  </Text>

                  <View style={[styles.colName, styles.nameCell]}>
                    <Text style={styles.avatarText}>{item.avatar}</Text>
                    <Text style={[styles.nameText, isCurrentUser && styles.nameYou]} numberOfLines={1}>
                      {item.name}{isCurrentUser ? ' (You)' : ''}
                    </Text>
                  </View>

                  <Text style={[styles.cellText, styles.colStart]}>
                    {startingPoints}
                  </Text>

                  <Text style={[styles.cellText, styles.colCurrent, styles.currentText]}>
                    {item.points.toLocaleString()}
                  </Text>

                  <Text
                    style={[
                      styles.cellText,
                      styles.colChange,
                      change >= 0 ? styles.changePositive : styles.changeNegative,
                    ]}
                  >
                    {change >= 0 ? '+' : ''}{change}
                  </Text>
                </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: COLORS.textMuted, fontSize: 14 },
  colHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.inputBg,
  },
  colText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  colRank: { width: 28 },
  colName: { flex: 1 },
  colStart: { width: 50, textAlign: 'right' },
  colCurrent: { width: 60, textAlign: 'right' },
  colChange: { width: 50, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowHighlighted: { backgroundColor: '#1e3a2a' },
  rowWinner: { backgroundColor: '#2a3a1a' },
  rowFolded: { opacity: 0.5 },
  cellText: { color: COLORS.white, fontSize: 13 },
  rankText: { color: COLORS.textMuted, fontWeight: '700' },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarText: { fontSize: 18 },
  nameText: { color: COLORS.white, fontSize: 13, fontWeight: '600', flex: 1 },
  nameYou: { color: COLORS.gold },
  currentText: { fontWeight: '700' },
  changePositive: { color: COLORS.success, fontWeight: '700' },
  changeNegative: { color: COLORS.danger, fontWeight: '700' },
});
