/**
 * Unit tests — gameLogic
 *
 * Covers hand evaluation (all 6 ranks), winner determination, chaal pricing,
 * counter-trigger logic, and the special A-2-3 sequence rule.
 */
import {
  isColor,
  isTrail,
  isPair,
  isValidSequence,
  isPureSequence,
  evaluateHand,
  determineWinner,
  compareHands,
  computeChaalAmount,
  shouldTriggerCounter,
  calculateSideshowResult,
} from '../../utils/gameLogic';
import { Card, HandRank, Player } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const RANKS: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11,
  '10': 10, '9': 9, '8': 8, '7': 7,
  '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

function c(value: string, suit = 'spades'): Card {
  return { id: `${value}_${suit}`, suit: suit as any, value: value as any, rank: RANKS[value] };
}

function makePlayer(name: string, cards: Card[], status: 'blind' | 'seen' | 'folded' = 'seen'): Player {
  return {
    id: name, uid: name, name, avatar: '👤',
    points: 1000, status, cards,
    currentBet: 0, isDealer: false, isCurrentTurn: false, totalBetThisRound: 0,
  };
}

// ─── isColor ──────────────────────────────────────────────────────────────────

describe('isColor', () => {
  it('returns true when all three cards share the same suit', () => {
    expect(isColor([c('A', 'hearts'), c('5', 'hearts'), c('9', 'hearts')])).toBe(true);
  });
  it('returns false when suits differ', () => {
    expect(isColor([c('A', 'hearts'), c('5', 'spades'), c('9', 'hearts')])).toBe(false);
  });
});

// ─── isTrail ──────────────────────────────────────────────────────────────────

describe('isTrail', () => {
  it('returns true for three of a kind', () => {
    expect(isTrail([c('K', 'spades'), c('K', 'hearts'), c('K', 'diamonds')])).toBe(true);
  });
  it('returns false when values differ', () => {
    expect(isTrail([c('K'), c('K'), c('Q')])).toBe(false);
  });
});

// ─── isPair ───────────────────────────────────────────────────────────────────

describe('isPair', () => {
  it('detects a pair in positions 0+1', () => {
    expect(isPair([c('J'), c('J'), c('3')])).toBe(true);
  });
  it('detects a pair in positions 1+2', () => {
    expect(isPair([c('9'), c('5'), c('5')])).toBe(true);
  });
  it('returns false for three different values', () => {
    expect(isPair([c('2'), c('7'), c('K')])).toBe(false);
  });
});

// ─── isValidSequence ─────────────────────────────────────────────────────────

describe('isValidSequence', () => {
  it('accepts a normal consecutive run', () => {
    expect(isValidSequence([c('7'), c('6'), c('5')])).toBe(true);
  });
  it('accepts A-K-Q', () => {
    expect(isValidSequence([c('A'), c('K'), c('Q')])).toBe(true);
  });
  it('accepts the special A-2-3 sequence', () => {
    expect(isValidSequence([c('A'), c('3'), c('2')])).toBe(true);
  });
  it('rejects a gap in the sequence', () => {
    expect(isValidSequence([c('A'), c('Q'), c('J')])).toBe(false);
  });
  it('rejects cards that share a value (not consecutive)', () => {
    expect(isValidSequence([c('5'), c('5'), c('4')])).toBe(false);
  });
});

// ─── isPureSequence ──────────────────────────────────────────────────────────

describe('isPureSequence', () => {
  it('requires consecutive AND same suit', () => {
    expect(isPureSequence([
      c('9', 'clubs'), c('8', 'clubs'), c('7', 'clubs'),
    ])).toBe(true);
  });
  it('returns false when same sequence but mixed suits', () => {
    expect(isPureSequence([
      c('9', 'clubs'), c('8', 'hearts'), c('7', 'clubs'),
    ])).toBe(false);
  });
});

// ─── evaluateHand — classic variant ──────────────────────────────────────────

describe('evaluateHand (classic)', () => {
  it('identifies a Trail (three of a kind)', () => {
    const result = evaluateHand([c('Q'), c('Q', 'hearts'), c('Q', 'diamonds')], 'classic');
    expect(result.rank).toBe(HandRank.TRAIL);
    expect(result.name).toMatch(/trail/i);
  });

  it('identifies a Pure Sequence', () => {
    const result = evaluateHand([
      c('J', 'hearts'), c('10', 'hearts'), c('9', 'hearts'),
    ], 'classic');
    expect(result.rank).toBe(HandRank.PURE_SEQUENCE);
  });

  it('identifies a Sequence (mixed suits)', () => {
    const result = evaluateHand([c('J'), c('10', 'hearts'), c('9', 'clubs')], 'classic');
    expect(result.rank).toBe(HandRank.SEQUENCE);
  });

  it('identifies a Color (same suit, not consecutive)', () => {
    const result = evaluateHand([
      c('A', 'diamonds'), c('7', 'diamonds'), c('3', 'diamonds'),
    ], 'classic');
    expect(result.rank).toBe(HandRank.COLOR);
  });

  it('identifies a Pair', () => {
    const result = evaluateHand([c('6'), c('6', 'hearts'), c('K')], 'classic');
    expect(result.rank).toBe(HandRank.PAIR);
  });

  it('identifies High Card when nothing matches', () => {
    const result = evaluateHand([c('A'), c('7', 'hearts'), c('3', 'diamonds')], 'classic');
    expect(result.rank).toBe(HandRank.HIGH_CARD);
  });

  it('A-2-3 is a sequence (highest sequence)', () => {
    const result = evaluateHand([c('A'), c('2', 'hearts'), c('3', 'clubs')], 'classic');
    expect(result.rank).toBe(HandRank.SEQUENCE);
    // A-2-3 scores higher than A-K-Q
    const akq = evaluateHand([c('A'), c('K', 'hearts'), c('Q', 'clubs')], 'classic');
    expect(result.score).toBeGreaterThan(akq.score);
  });
});

// ─── evaluateHand — muflis variant ───────────────────────────────────────────

describe('evaluateHand (muflis)', () => {
  it('inverts ranks so High Card beats Trail', () => {
    const trail = evaluateHand([c('A'), c('A', 'hearts'), c('A', 'diamonds')], 'muflis');
    const highCard = evaluateHand([c('2'), c('7', 'hearts'), c('9', 'clubs')], 'muflis');
    expect(highCard.rank).toBeGreaterThan(trail.rank);
  });
});

// ─── evaluateHand — AK47 variant (wild cards) ────────────────────────────────

describe('evaluateHand (ak47)', () => {
  it('uses wild cards to make the best possible hand', () => {
    // A is wild in AK47 — A + 2♥ + 3♦ could form a Trail of Aces if A is wild
    const result = evaluateHand([
      { ...c('A'), isWild: true },
      c('Q', 'hearts'),
      c('Q', 'diamonds'),
    ], 'ak47');
    // Wild A can become Q → Trail of Queens
    expect(result.rank).toBe(HandRank.TRAIL);
  });
});

// ─── compareHands ─────────────────────────────────────────────────────────────

describe('compareHands', () => {
  it('returns 1 when hand1 rank is higher', () => {
    const trail = evaluateHand([c('A'), c('A', 'hearts'), c('A', 'diamonds')], 'classic');
    const pair = evaluateHand([c('K'), c('K', 'hearts'), c('7')], 'classic');
    expect(compareHands(trail, pair)).toBe(1);
  });

  it('returns -1 when hand2 rank is higher', () => {
    const pair = evaluateHand([c('K'), c('K', 'hearts'), c('7')], 'classic');
    const trail = evaluateHand([c('A'), c('A', 'hearts'), c('A', 'diamonds')], 'classic');
    expect(compareHands(pair, trail)).toBe(-1);
  });

  it('returns 0 for identical hands', () => {
    const h1 = evaluateHand([c('A'), c('7', 'hearts'), c('3', 'diamonds')], 'classic');
    const h2 = evaluateHand([c('A', 'hearts'), c('7'), c('3', 'clubs')], 'classic');
    expect(compareHands(h1, h2)).toBe(0);
  });

  it('breaks ties within the same rank using score', () => {
    const highK = evaluateHand([c('K'), c('9', 'hearts'), c('3', 'diamonds')], 'classic');
    const highA = evaluateHand([c('A'), c('2', 'hearts'), c('8', 'diamonds')], 'classic');
    // Both are High Card; Ace-high beats King-high
    expect(compareHands(highA, highK)).toBe(1);
  });
});

// ─── determineWinner ─────────────────────────────────────────────────────────

describe('determineWinner', () => {
  it('returns the player with the best hand', () => {
    const alice = makePlayer('alice', [c('A'), c('A', 'hearts'), c('A', 'diamonds')]); // trail
    const bob   = makePlayer('bob',   [c('K'), c('Q', 'hearts'), c('J', 'clubs')]);    // sequence
    const winner = determineWinner([alice, bob], 'classic');
    expect(winner.uid).toBe('alice');
  });

  it('skips folded players', () => {
    const alice = makePlayer('alice', [c('A'), c('A', 'hearts'), c('A', 'diamonds')], 'folded');
    const bob   = makePlayer('bob',   [c('2'), c('7', 'hearts'), c('9', 'clubs')], 'seen');
    const winner = determineWinner([alice, bob], 'classic');
    expect(winner.uid).toBe('bob');
  });

  it('returns the sole remaining player when everyone else folded', () => {
    const alice = makePlayer('alice', [c('2'), c('3', 'hearts'), c('8')], 'seen');
    const winner = determineWinner([alice], 'classic');
    expect(winner.uid).toBe('alice');
  });

  it('picks the higher pair when both players have a pair', () => {
    const alice = makePlayer('alice', [c('K'), c('K', 'hearts'), c('2')]);
    const bob   = makePlayer('bob',   [c('5'), c('5', 'hearts'), c('A')]);
    const winner = determineWinner([alice, bob], 'classic');
    expect(winner.uid).toBe('alice');
  });
});

// ─── calculateSideshowResult ─────────────────────────────────────────────────

describe('calculateSideshowResult', () => {
  it('returns challenger_wins when challenger has a better hand', () => {
    const ch = makePlayer('ch', [c('A'), c('A', 'hearts'), c('A', 'diamonds')]);
    const cd = makePlayer('cd', [c('2'), c('7', 'hearts'), c('9', 'clubs')]);
    expect(calculateSideshowResult(ch, cd, 'classic')).toBe('challenger_wins');
  });

  it('returns challenged_wins when challenged has a better hand', () => {
    const ch = makePlayer('ch', [c('2'), c('3', 'hearts'), c('7', 'clubs')]);
    const cd = makePlayer('cd', [c('A'), c('K', 'hearts'), c('Q', 'clubs')]);
    expect(calculateSideshowResult(ch, cd, 'classic')).toBe('challenged_wins');
  });

  it('returns tie when hands are equal', () => {
    const ch = makePlayer('ch', [c('A'), c('7', 'hearts'), c('3', 'diamonds')]);
    const cd = makePlayer('cd', [c('A', 'hearts'), c('7'), c('3', 'clubs')]);
    expect(calculateSideshowResult(ch, cd, 'classic')).toBe('tie');
  });
});

// ─── computeChaalAmount ──────────────────────────────────────────────────────

describe('computeChaalAmount', () => {
  it('blind player always pays the current bet (1×)', () => {
    expect(computeChaalAmount('blind', 100, null, false)).toBe(100);
    expect(computeChaalAmount('blind', 200, 'seen', true)).toBe(200);
  });

  it('seen after seen pays the current bet (1×)', () => {
    expect(computeChaalAmount('seen', 100, 'seen', false)).toBe(100);
  });

  it('seen after blind (first time) pays 2× current bet', () => {
    expect(computeChaalAmount('seen', 100, 'blind', false)).toBe(200);
  });

  it('seen after blind (after counter triggered) pays 3× current bet', () => {
    expect(computeChaalAmount('seen', 100, 'blind', true)).toBe(300);
  });
});

// ─── shouldTriggerCounter ────────────────────────────────────────────────────

describe('shouldTriggerCounter', () => {
  it('triggers when a seen player chaals after a blind player', () => {
    expect(shouldTriggerCounter('seen', 'blind', false)).toBe(true);
  });

  it('stays false when both are seen', () => {
    expect(shouldTriggerCounter('seen', 'seen', false)).toBe(false);
  });

  it('stays true once already triggered', () => {
    expect(shouldTriggerCounter('blind', 'seen', true)).toBe(true);
  });

  it('does not trigger when current player is blind', () => {
    expect(shouldTriggerCounter('blind', 'blind', false)).toBe(false);
  });
});
