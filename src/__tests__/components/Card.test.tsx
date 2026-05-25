/**
 * Component tests — Card
 *
 * Tests the Card UI component in all its rendering states.
 * Uses React Native Testing Library to render and query elements.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import CardComponent from '../../components/Card';
import { Card } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const ACE_OF_SPADES: Card = { id: 'A_spades', suit: 'spades', value: 'A', rank: 14 };
const KING_OF_HEARTS: Card = { id: 'K_hearts', suit: 'hearts', value: 'K', rank: 13 };
const WILD_FOUR: Card = { id: '4_clubs', suit: 'clubs', value: '4', rank: 4, isWild: true };

// ─── face-down rendering ──────────────────────────────────────────────────────

describe('Card — face-down', () => {
  it('shows the card-back emoji when faceDown=true', () => {
    const { getByText } = render(<CardComponent faceDown />);
    expect(getByText('🃏')).toBeTruthy();
  });

  it('shows the card-back emoji when no card is supplied', () => {
    const { getByText } = render(<CardComponent />);
    expect(getByText('🃏')).toBeTruthy();
  });

  it('does NOT display any card value when face-down', () => {
    const { queryByText } = render(<CardComponent card={ACE_OF_SPADES} faceDown />);
    expect(queryByText('A')).toBeNull();
  });
});

// ─── face-up rendering ───────────────────────────────────────────────────────

describe('Card — face-up', () => {
  it('displays the card value', () => {
    const { getAllByText } = render(<CardComponent card={ACE_OF_SPADES} faceDown={false} />);
    // Value appears in both corners
    expect(getAllByText('A').length).toBeGreaterThanOrEqual(1);
  });

  it('displays the suit symbol for spades (♠)', () => {
    const { getAllByText } = render(<CardComponent card={ACE_OF_SPADES} faceDown={false} />);
    expect(getAllByText('♠').length).toBeGreaterThanOrEqual(1);
  });

  it('displays the suit symbol for hearts (♥)', () => {
    const { getAllByText } = render(<CardComponent card={KING_OF_HEARTS} faceDown={false} />);
    expect(getAllByText('♥').length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT show the card-back emoji when face-up', () => {
    const { queryByText } = render(<CardComponent card={ACE_OF_SPADES} faceDown={false} />);
    expect(queryByText('🃏')).toBeNull();
  });
});

// ─── wild card badge ──────────────────────────────────────────────────────────

describe('Card — wild badge', () => {
  it('shows the "W" badge when card.isWild is true', () => {
    const { getByText } = render(<CardComponent card={WILD_FOUR} faceDown={false} />);
    expect(getByText('W')).toBeTruthy();
  });

  it('does NOT show "W" badge for non-wild cards', () => {
    const { queryByText } = render(<CardComponent card={ACE_OF_SPADES} faceDown={false} />);
    expect(queryByText('W')).toBeNull();
  });
});

// ─── size variants ───────────────────────────────────────────────────────────

describe('Card — size prop', () => {
  (['sm', 'md', 'lg', 'xl'] as const).forEach((size) => {
    it(`renders without error in size="${size}"`, () => {
      expect(() =>
        render(<CardComponent card={ACE_OF_SPADES} faceDown={false} size={size} />)
      ).not.toThrow();
    });
  });

  it('default size is "md" (renders without size prop)', () => {
    expect(() =>
      render(<CardComponent card={ACE_OF_SPADES} faceDown={false} />)
    ).not.toThrow();
  });
});
