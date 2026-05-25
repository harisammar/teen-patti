/**
 * Unit tests — cardUtils
 *
 * Tests deck creation, dealing, ranking helpers and wild-card marking.
 * All pure functions — no Firebase / device mocks required.
 */
import {
  createDeck,
  shuffleDeck,
  dealCards,
  cardRank,
  markWildCards,
  sortCards,
  isRedSuit,
  pickJokerCard,
} from '../../utils/cardUtils';
import { Card, Suit } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal Card without going through createDeck (for isolated tests). */
function makeCard(value: string, suit: Suit = 'spades'): Card {
  return { id: `${value}_${suit}`, suit, value: value as any, rank: cardRank(value as any) };
}

// ─── createDeck ───────────────────────────────────────────────────────────────

describe('createDeck', () => {
  let deck: Card[];

  beforeEach(() => {
    deck = createDeck();
  });

  it('returns exactly 52 cards', () => {
    expect(deck).toHaveLength(52);
  });

  it('contains all four suits', () => {
    const suits = new Set(deck.map((c) => c.suit));
    expect(suits).toContain('spades');
    expect(suits).toContain('hearts');
    expect(suits).toContain('diamonds');
    expect(suits).toContain('clubs');
  });

  it('has exactly 13 cards per suit', () => {
    (['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]).forEach((suit) => {
      const count = deck.filter((c) => c.suit === suit).length;
      expect(count).toBe(13);
    });
  });

  it('contains no duplicate card IDs', () => {
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(52);
  });

  it('assigns the correct rank to every card', () => {
    const ace = deck.find((c) => c.value === 'A');
    const two = deck.find((c) => c.value === '2');
    expect(ace?.rank).toBe(14);
    expect(two?.rank).toBe(2);
  });
});

// ─── shuffleDeck ─────────────────────────────────────────────────────────────

describe('shuffleDeck', () => {
  it('returns a deck with the same 52 cards (just reordered)', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(52);
  });

  it('does not mutate the original array', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffleDeck(deck);
    expect(deck.map((c) => c.id)).toEqual(original.map((c) => c.id));
  });

  it('almost certainly changes the order (probabilistic — passes >99.999% of the time)', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const same = deck.every((c, i) => c.id === shuffled[i].id);
    // The chance that all 52 cards land in the same position is astronomically small
    expect(same).toBe(false);
  });
});

// ─── cardRank ─────────────────────────────────────────────────────────────────

describe('cardRank', () => {
  const cases: [string, number][] = [
    ['A', 14],
    ['K', 13],
    ['Q', 12],
    ['J', 11],
    ['10', 10],
    ['9', 9],
    ['8', 8],
    ['7', 7],
    ['6', 6],
    ['5', 5],
    ['4', 4],
    ['3', 3],
    ['2', 2],
  ];

  test.each(cases)('rank of %s is %i', (value, expected) => {
    expect(cardRank(value as any)).toBe(expected);
  });
});

// ─── dealCards ────────────────────────────────────────────────────────────────

describe('dealCards', () => {
  it('gives every player exactly 3 cards', () => {
    const deck = createDeck();
    [2, 3, 4, 5, 6].forEach((numPlayers) => {
      const hands = dealCards(deck, numPlayers);
      expect(hands).toHaveLength(numPlayers);
      hands.forEach((hand) => expect(hand).toHaveLength(3));
    });
  });

  it('deals unique cards — no card appears in two hands', () => {
    const deck = createDeck();
    const hands = dealCards(deck, 6);
    const allDealt = hands.flat().map((c) => c.id);
    expect(new Set(allDealt).size).toBe(allDealt.length);
  });

  it('deals in rotation: player 0 gets deck[0], player 1 gets deck[1], …', () => {
    const deck = createDeck();
    const hands = dealCards(deck, 3);
    // Round 1
    expect(hands[0][0].id).toBe(deck[0].id);
    expect(hands[1][0].id).toBe(deck[1].id);
    expect(hands[2][0].id).toBe(deck[2].id);
    // Round 2
    expect(hands[0][1].id).toBe(deck[3].id);
    expect(hands[1][1].id).toBe(deck[4].id);
  });
});

// ─── sortCards ────────────────────────────────────────────────────────────────

describe('sortCards', () => {
  it('sorts descending by rank', () => {
    const cards = [makeCard('5'), makeCard('A'), makeCard('9')];
    const sorted = sortCards(cards);
    expect(sorted.map((c) => c.rank)).toEqual([14, 9, 5]);
  });

  it('does not mutate the input array', () => {
    const cards = [makeCard('3'), makeCard('K')];
    const original = cards.map((c) => c.id);
    sortCards(cards);
    expect(cards.map((c) => c.id)).toEqual(original);
  });
});

// ─── isRedSuit ───────────────────────────────────────────────────────────────

describe('isRedSuit', () => {
  it('returns true for hearts', () => expect(isRedSuit('hearts')).toBe(true));
  it('returns true for diamonds', () => expect(isRedSuit('diamonds')).toBe(true));
  it('returns false for spades', () => expect(isRedSuit('spades')).toBe(false));
  it('returns false for clubs', () => expect(isRedSuit('clubs')).toBe(false));
});

// ─── markWildCards ───────────────────────────────────────────────────────────

describe('markWildCards', () => {
  it('marks A, K, 4, 7 as wild in AK47 mode', () => {
    const cards: Card[] = [makeCard('A'), makeCard('5'), makeCard('K')];
    const marked = markWildCards(cards);
    expect(marked[0].isWild).toBe(true);  // A
    expect(marked[1].isWild).toBe(false); // 5
    expect(marked[2].isWild).toBe(true);  // K
  });

  it('marks the joker card as wild', () => {
    const joker = makeCard('8', 'hearts');
    const cards: Card[] = [makeCard('2'), joker, makeCard('Q')];
    const marked = markWildCards(cards, joker);
    expect(marked[1].isWild).toBe(true);
  });

  it('does not mutate the original cards', () => {
    const cards: Card[] = [makeCard('A')];
    markWildCards(cards);
    expect(cards[0].isWild).toBeUndefined();
  });
});

// ─── pickJokerCard ───────────────────────────────────────────────────────────

describe('pickJokerCard', () => {
  it('returns a card that exists in the deck', () => {
    const deck = createDeck();
    const joker = pickJokerCard(deck);
    expect(deck.some((c) => c.id === joker.id)).toBe(true);
  });
});
