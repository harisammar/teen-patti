import { Card, CardValue, Suit } from '../types';
import { SUITS, VALUES, WILD_CARDS_AK47 } from './constants';

/**
 * Returns numeric rank for a card value.
 * Ace = 14 (highest), then K=13, Q=12, J=11, 10-2 face value.
 */
export function cardRank(value: CardValue): number {
  switch (value) {
    case 'A': return 14;
    case 'K': return 13;
    case 'Q': return 12;
    case 'J': return 11;
    default: return parseInt(value, 10);
  }
}

/**
 * Creates a full shuffled 52-card deck.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({
        id: `${value}_${suit}`,
        suit,
        value,
        rank: cardRank(value),
      });
    }
  }
  return shuffleDeck(deck);
}

/**
 * Fisher-Yates shuffle algorithm for randomizing deck order.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals 3 cards to each player from the deck.
 * Returns array of card arrays, one per player.
 */
export function dealCards(deck: Card[], numPlayers: number): Card[][] {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  // Deal one card at a time to each player (as in real Teen Patti)
  for (let round = 0; round < 3; round++) {
    for (let player = 0; player < numPlayers; player++) {
      const card = deck[round * numPlayers + player];
      if (card) {
        hands[player].push(card);
      }
    }
  }
  return hands;
}

/**
 * For AK47 variant: marks A, K, 4, 7 as wild cards.
 */
export function markWildCards(cards: Card[], jokerCard?: Card): Card[] {
  return cards.map((card) => ({
    ...card,
    isWild: WILD_CARDS_AK47.has(card.value) || (jokerCard ? card.id === jokerCard.id : false),
  }));
}

/**
 * Sorts cards by rank descending.
 */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.rank - a.rank);
}

/**
 * Returns the suit symbol for display.
 */
export function suitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
  };
  return symbols[suit];
}

/**
 * Returns true if a suit is red (hearts or diamonds).
 */
export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

/**
 * Picks a random card to be the joker for AK47 variant.
 */
export function pickJokerCard(deck: Card[]): Card {
  return deck[Math.floor(Math.random() * deck.length)];
}
