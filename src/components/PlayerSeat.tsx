import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Player, Card as CardType } from '../types';
import Card from './Card';
import Timer from './Timer';
import { COLORS } from '../utils/constants';

interface PlayerSeatProps {
  player: Player;
  isCurrentTurn: boolean;
  position: number;
  isCurrentUser: boolean;
  showCards: boolean;
  timerSeconds?: number;
  turnDuration?: number;
  cardSize?: 'sm' | 'md' | 'lg';
}

const STATUS_COLOR: Record<string, string> = {
  blind: COLORS.blind,
  seen: COLORS.seen,
  folded: COLORS.folded,
  active: COLORS.white,
  winner: COLORS.gold,
};

const STATUS_LABEL: Record<string, string> = {
  blind: 'Blind',
  seen: 'Seen',
  folded: 'Folded',
  active: 'Active',
  winner: 'Winner!',
};

export default function PlayerSeat({
  player,
  isCurrentTurn,
  position,
  isCurrentUser,
  showCards,
  timerSeconds,
  turnDuration = 30,
  cardSize = 'sm',
}: PlayerSeatProps) {
  const isFolded = player.status === 'folded';
  const isWinner = player.status === 'winner';
  const [expandedCard, setExpandedCard] = useState<CardType | null>(null);
  const canExpand = showCards && !isFolded;

  return (
    <View style={[styles.seat, isCurrentUser && styles.seatSelf]}>
      {/* Timer bar for current turn */}
      {isCurrentTurn && timerSeconds !== undefined && (
        <Timer
          seconds={timerSeconds}
          maxSeconds={turnDuration}
          size={56}
          style={styles.timer}
        />
      )}

      {/* Turn highlight ring */}
      <View
        style={[
          styles.avatarContainer,
          isCurrentTurn && styles.avatarTurn,
          isWinner && styles.avatarWinner,
          isFolded && styles.avatarFolded,
        ]}
      >
        {/* Dealer chip */}
        {player.isDealer && (
          <View style={styles.dealerChip}>
            <Text style={styles.dealerText}>D</Text>
          </View>
        )}

        <Text style={[styles.avatar, isFolded && styles.avatarFoldedText]}>
          {player.avatar}
        </Text>
      </View>

      {/* Name */}
      <Text style={[styles.name, isFolded && styles.nameFolded]} numberOfLines={1}>
        {player.name}
      </Text>

      {/* Points */}
      <Text style={styles.points}>{player.points.toLocaleString()}</Text>

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[player.status] + '33' }]}>
        <Text style={[styles.statusText, { color: STATUS_COLOR[player.status] }]}>
          {STATUS_LABEL[player.status]}
        </Text>
      </View>

      {/* Current bet */}
      {player.currentBet > 0 && !isFolded && (
        <View style={styles.betChip}>
          <Text style={styles.betChipText}>{player.currentBet}</Text>
        </View>
      )}

      {/* Cards */}
      <View style={styles.cards}>
        {player.cards.length > 0
          ? player.cards.map((card, i) => (
              <TouchableOpacity
                key={card.id}
                style={{ marginLeft: i > 0 ? (cardSize === 'sm' ? -6 : -10) : 0 }}
                onPress={() => canExpand && setExpandedCard(card)}
                activeOpacity={canExpand ? 0.7 : 1}
                disabled={!canExpand}
              >
                <Card
                  card={card}
                  faceDown={!showCards || isFolded}
                  size={cardSize}
                />
              </TouchableOpacity>
            ))
          : [0, 1, 2].map((i) => (
              <Card
                key={i}
                faceDown
                size={cardSize}
                style={{ marginLeft: i > 0 ? (cardSize === 'sm' ? -6 : -10) : 0 }}
              />
            ))}
      </View>

      {/* Fold overlay */}
      {isFolded && <View style={styles.foldOverlay} />}

      {/* Full-screen card expand modal — only for current user's face-up cards */}
      <Modal
        visible={!!expandedCard}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setExpandedCard(null)}
      >
        <TouchableOpacity
          style={styles.expandOverlay}
          activeOpacity={1}
          onPress={() => setExpandedCard(null)}
        >
          {expandedCard && (
            <Card card={expandedCard} faceDown={false} size="xl" />
          )}
          <Text style={styles.expandHint}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    alignItems: 'center',
    width: 96,
    position: 'relative',
  },
  seatSelf: {
    width: 130,
  },
  timer: {
    position: 'absolute',
    top: -8,
    zIndex: 10,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    position: 'relative',
  },
  avatarTurn: {
    borderColor: COLORS.gold,
    borderWidth: 3,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarWinner: {
    borderColor: COLORS.gold,
    backgroundColor: '#3a5a2e',
  },
  avatarFolded: {
    borderColor: COLORS.folded,
    opacity: 0.5,
  },
  avatarFoldedText: { opacity: 0.4 },
  dealerChip: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  dealerText: { color: COLORS.background, fontSize: 9, fontWeight: '800' },
  avatar: { fontSize: 24 },
  name: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
    maxWidth: 90,
  },
  nameFolded: { color: COLORS.folded },
  points: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  statusText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  betChip: {
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  betChipText: { color: COLORS.background, fontSize: 9, fontWeight: '700' },
  cards: {
    flexDirection: 'row',
    marginTop: 4,
    justifyContent: 'center',
  },
  card: {},
  expandOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 28,
    letterSpacing: 0.5,
  },
  foldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
  },
});
