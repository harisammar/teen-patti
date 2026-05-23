import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card as CardType, Suit } from '../types';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../utils/constants';

type CardSize = 'sm' | 'md' | 'lg';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  size?: CardSize;
  style?: ViewStyle;
}

const SIZE_CONFIG: Record<CardSize, { width: number; height: number; fontSize: number; cornerFontSize: number }> = {
  sm: { width: 30, height: 42, fontSize: 14, cornerFontSize: 8 },
  md: { width: 44, height: 62, fontSize: 22, cornerFontSize: 11 },
  lg: { width: 60, height: 84, fontSize: 30, cornerFontSize: 14 },
};

export default function Card({ card, faceDown = false, size = 'md', style }: CardProps) {
  const config = SIZE_CONFIG[size];

  if (faceDown || !card) {
    return (
      <View
        style={[
          styles.card,
          styles.cardBack,
          { width: config.width, height: config.height },
          style,
        ]}
      >
        <Text style={styles.backPattern}>🃏</Text>
      </View>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const textColor = isRed ? '#e74c3c' : '#1a1a2e';
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  return (
    <View
      style={[
        styles.card,
        styles.cardFront,
        { width: config.width, height: config.height },
        style,
      ]}
    >
      {/* Top-left corner */}
      <View style={styles.corner}>
        <Text style={[styles.cornerValue, { color: textColor, fontSize: config.cornerFontSize }]}>
          {card.value}
        </Text>
        <Text style={[styles.cornerSuit, { color: textColor, fontSize: config.cornerFontSize }]}>
          {suitSymbol}
        </Text>
      </View>

      {/* Center suit */}
      <Text style={[styles.centerSuit, { color: textColor, fontSize: config.fontSize }]}>
        {suitSymbol}
      </Text>

      {/* Bottom-right corner (inverted) */}
      <View style={[styles.corner, styles.cornerBottomRight]}>
        <Text style={[styles.cornerValue, { color: textColor, fontSize: config.cornerFontSize }]}>
          {card.value}
        </Text>
        <Text style={[styles.cornerSuit, { color: textColor, fontSize: config.cornerFontSize }]}>
          {suitSymbol}
        </Text>
      </View>

      {/* Wild card indicator for AK47 */}
      {card.isWild && (
        <View style={styles.wildBadge}>
          <Text style={styles.wildText}>W</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative',
  },
  cardFront: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  cardBack: {
    backgroundColor: '#1a4a6e',
    borderWidth: 1,
    borderColor: '#2a6a9e',
  },
  backPattern: { fontSize: 18, opacity: 0.6 },
  corner: {
    position: 'absolute',
    top: 3,
    left: 4,
    alignItems: 'center',
  },
  cornerBottomRight: {
    top: undefined,
    left: undefined,
    bottom: 3,
    right: 4,
    transform: [{ rotate: '180deg' }],
  },
  cornerValue: { fontWeight: '800', lineHeight: 13 },
  cornerSuit: { lineHeight: 11 },
  centerSuit: { fontWeight: '400' },
  wildBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#c9a227',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wildText: { color: '#fff', fontSize: 8, fontWeight: '800' },
});
