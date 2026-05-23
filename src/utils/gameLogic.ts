import { Card, HandRank, HandResult, Player, GameVariant, CardValue, Suit } from '../types';
import { sortCards } from './cardUtils';
import { WILD_CARDS_AK47, HAND_NAMES } from './constants';

// ---------------------------------------------------------------------------
// Basic hand checkers
// ---------------------------------------------------------------------------

/**
 * Returns true if all three cards share the same suit.
 */
export function isColor(cards: Card[]): boolean {
  return cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
}

/**
 * Returns true if all three cards have the same value (three-of-a-kind).
 */
export function isTrail(cards: Card[]): boolean {
  return cards[0].value === cards[1].value && cards[1].value === cards[2].value;
}

/**
 * Returns true if exactly two cards share the same value.
 */
export function isPair(cards: Card[]): boolean {
  const sorted = sortCards(cards);
  return (
    sorted[0].value === sorted[1].value ||
    sorted[1].value === sorted[2].value
  );
}

/**
 * Returns true if the three cards form a consecutive sequence (any suit).
 * Special rule: A-2-3 is the highest sequence (treated as 3-2-A for scoring).
 * A-K-Q is second highest, then K-Q-J, etc.
 */
export function isValidSequence(cards: Card[]): boolean {
  const sorted = sortCards(cards);
  const ranks = sorted.map((c) => c.rank);

  // Check normal consecutive
  if (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) {
    return true;
  }

  // Special case: A-2-3 (ranks: 14, 3, 2)
  if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) {
    return true;
  }

  return false;
}

/**
 * Returns true if cards form a pure sequence (consecutive + same suit).
 */
export function isPureSequence(cards: Card[]): boolean {
  return isValidSequence(cards) && isColor(cards);
}

// ---------------------------------------------------------------------------
// Sequence scoring (higher = better within sequences)
// A-2-3 is the highest pure/regular sequence
// ---------------------------------------------------------------------------

function sequenceScore(cards: Card[]): number {
  const sorted = sortCards(cards);
  const ranks = sorted.map((c) => c.rank);

  // A-2-3 special case — highest sequence (score it above A-K-Q = 14-13-12)
  if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) {
    return 15; // Above A(14)
  }

  // Highest card in sequence determines score
  return ranks[0];
}

// ---------------------------------------------------------------------------
// Wild card logic for AK47
// ---------------------------------------------------------------------------

type ValueOption = CardValue;

const ALL_VALUES: CardValue[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const ALL_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function expandWildCards(cards: Card[]): Card[][] {
  // Replace each wild card with all possible non-wild values/suits and return best combos
  const wilds = cards.filter((c) => c.isWild);
  const naturals = cards.filter((c) => !c.isWild);

  if (wilds.length === 0) return [cards];

  // Generate candidate substitutions for each wild
  const substituteCandidates = (wild: Card): Card[] => {
    const candidates: Card[] = [];
    for (const val of ALL_VALUES) {
      for (const suit of ALL_SUITS) {
        candidates.push({
          id: `wild_${wild.id}_${val}_${suit}`,
          suit,
          value: val,
          rank: rankValue(val),
          isWild: false,
        });
      }
    }
    return candidates;
  };

  if (wilds.length === 1) {
    return substituteCandidates(wilds[0]).map((sub) => [...naturals, sub]);
  }

  if (wilds.length === 2) {
    const combos: Card[][] = [];
    const subs0 = substituteCandidates(wilds[0]);
    const subs1 = substituteCandidates(wilds[1]);
    for (const s0 of subs0) {
      for (const s1 of subs1) {
        combos.push([...naturals, s0, s1]);
      }
    }
    return combos;
  }

  // All 3 wild
  const combos: Card[][] = [];
  const subs0 = substituteCandidates(wilds[0]);
  for (const s0 of subs0) {
    const subs1 = substituteCandidates(wilds[1]);
    for (const s1 of subs1) {
      const subs2 = substituteCandidates(wilds[2]);
      for (const s2 of subs2) {
        combos.push([s0, s1, s2]);
      }
    }
  }
  return combos;
}

function rankValue(value: CardValue): number {
  switch (value) {
    case 'A': return 14;
    case 'K': return 13;
    case 'Q': return 12;
    case 'J': return 11;
    default: return parseInt(value, 10);
  }
}

// ---------------------------------------------------------------------------
// Classic hand evaluation
// ---------------------------------------------------------------------------

function evaluateClassicHand(cards: Card[]): HandResult {
  const sorted = sortCards(cards);

  if (isTrail(sorted)) {
    return {
      rank: HandRank.TRAIL,
      score: sorted[0].rank * 1000,
      name: HAND_NAMES[HandRank.TRAIL],
      cards: sorted,
    };
  }

  if (isPureSequence(sorted)) {
    return {
      rank: HandRank.PURE_SEQUENCE,
      score: sequenceScore(sorted) * 100,
      name: HAND_NAMES[HandRank.PURE_SEQUENCE],
      cards: sorted,
    };
  }

  if (isValidSequence(sorted)) {
    return {
      rank: HandRank.SEQUENCE,
      score: sequenceScore(sorted) * 100,
      name: HAND_NAMES[HandRank.SEQUENCE],
      cards: sorted,
    };
  }

  if (isColor(sorted)) {
    // Color score: primary card rank * 100 + secondary * 10 + tertiary
    return {
      rank: HandRank.COLOR,
      score: sorted[0].rank * 100 + sorted[1].rank * 10 + sorted[2].rank,
      name: HAND_NAMES[HandRank.COLOR],
      cards: sorted,
    };
  }

  if (isPair(sorted)) {
    // Find the pair rank and kicker
    let pairRank = 0;
    let kicker = 0;
    if (sorted[0].rank === sorted[1].rank) {
      pairRank = sorted[0].rank;
      kicker = sorted[2].rank;
    } else {
      pairRank = sorted[1].rank;
      kicker = sorted[0].rank;
    }
    return {
      rank: HandRank.PAIR,
      score: pairRank * 100 + kicker,
      name: HAND_NAMES[HandRank.PAIR],
      cards: sorted,
    };
  }

  // High card: rank by all three cards
  return {
    rank: HandRank.HIGH_CARD,
    score: sorted[0].rank * 100 + sorted[1].rank * 10 + sorted[2].rank,
    name: HAND_NAMES[HandRank.HIGH_CARD],
    cards: sorted,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluates a 3-card Teen Patti hand according to the game variant.
 * - classic: standard rankings
 * - muflis: inverted rankings (lower rank = better)
 * - ak47: wild cards (A/K/4/7 can be any card)
 */
export function evaluateHand(cards: Card[], variant: GameVariant): HandResult {
  if (variant === 'ak47') {
    const wildCards = cards.filter((c) => WILD_CARDS_AK47.has(c.value));
    if (wildCards.length > 0) {
      const markedCards = cards.map((c) => ({
        ...c,
        isWild: WILD_CARDS_AK47.has(c.value),
      }));
      const combos = expandWildCards(markedCards);
      let best: HandResult | null = null;
      for (const combo of combos) {
        const result = evaluateClassicHand(combo);
        if (!best || result.rank > best.rank || (result.rank === best.rank && result.score > best.score)) {
          best = result;
        }
      }
      return best!;
    }
  }

  const result = evaluateClassicHand(cards);

  if (variant === 'muflis') {
    // Invert the rank for muflis: HIGH_CARD becomes best, TRAIL becomes worst
    const invertedRank = (7 - result.rank) as HandRank;
    // Invert score so lower original scores win
    return {
      ...result,
      rank: invertedRank,
      score: 100000 - result.score,
      name: `${result.name} (Muflis)`,
    };
  }

  return result;
}

/**
 * Compares two evaluated hands.
 * Returns 1 if hand1 wins, -1 if hand2 wins, 0 if equal.
 */
export function compareHands(hand1: HandResult, hand2: HandResult): number {
  if (hand1.rank > hand2.rank) return 1;
  if (hand1.rank < hand2.rank) return -1;
  if (hand1.score > hand2.score) return 1;
  if (hand1.score < hand2.score) return -1;
  return 0;
}

/**
 * Determines the winner among active (non-folded) players.
 */
export function determineWinner(players: Player[], variant: GameVariant): Player {
  const activePlayers = players.filter((p) => p.status !== 'folded' && p.cards.length === 3);

  if (activePlayers.length === 1) {
    return activePlayers[0];
  }

  let winner = activePlayers[0];
  let winnerHand = evaluateHand(winner.cards, variant);

  for (let i = 1; i < activePlayers.length; i++) {
    const player = activePlayers[i];
    const hand = evaluateHand(player.cards, variant);
    if (compareHands(hand, winnerHand) > 0) {
      winner = player;
      winnerHand = hand;
    }
  }

  return winner;
}

/**
 * Calculates sideshow result between challenger (seen) and challenged (seen).
 * Returns 'challenger_wins', 'challenged_wins', or 'tie'.
 */
export function calculateSideshowResult(
  challenger: Player,
  challenged: Player,
  variant: GameVariant
): 'challenger_wins' | 'challenged_wins' | 'tie' {
  const challengerHand = evaluateHand(challenger.cards, variant);
  const challengedHand = evaluateHand(challenged.cards, variant);
  const comparison = compareHands(challengerHand, challengedHand);

  if (comparison > 0) return 'challenger_wins';
  if (comparison < 0) return 'challenged_wins';
  return 'tie';
}

// ---------------------------------------------------------------------------
// Chaal pricing state machine
// ---------------------------------------------------------------------------

export type PlayStatus = 'blind' | 'seen';

/**
 * Returns the amount the current player must pay to chaal (call).
 *
 * Rules (per house variant):
 *   blind → matches previousChaal (the "stake")
 *   seen after seen → matches previousChaal (no multiplier)
 *   seen after blind, no prior counter → 2 × previousChaal
 *   seen after blind, counter has triggered → 3 × previousChaal
 *
 * `counterTriggered` flips to true the first time any seen player chaals
 * after a blind. It stays true for the rest of the round.
 */
export function computeChaalAmount(
  currentStatus: PlayStatus,
  previousChaal: number,
  previousPlayerStatus: PlayStatus | null,
  counterTriggered: boolean
): number {
  if (currentStatus === 'blind') {
    return previousChaal;
  }
  // Current player is seen.
  if (previousPlayerStatus === 'seen') {
    return previousChaal;
  }
  // Seen after blind (or first chaal of the round — treat the implicit
  // pre-game state as "everyone played blind for the boot").
  const multiplier = counterTriggered ? 3 : 2;
  return multiplier * previousChaal;
}

/**
 * Returns the new counterTriggered value after the current player chaals.
 * Counter fires on the first seen-after-blind transition of the round.
 */
export function shouldTriggerCounter(
  currentStatus: PlayStatus,
  previousPlayerStatus: PlayStatus | null,
  counterTriggered: boolean
): boolean {
  if (counterTriggered) return true;
  return currentStatus === 'seen' && previousPlayerStatus === 'blind';
}
