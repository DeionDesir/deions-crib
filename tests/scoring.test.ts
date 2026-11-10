import { describe, expect, it } from 'vitest';
import { Card, parseCard } from '../src/engine/cards';
import { scoreHand, scorePegging } from '../src/engine/scoring';

const cards = (text: string): Card[] => text.split(' ').map(parseCard);
const hand = (text: string, starter: string, isCrib = false) =>
  scoreHand(cards(text), parseCard(starter), isCrib).total;
const peg = (text: string) => scorePegging(cards(text)).reduce((sum, item) => sum + item.points, 0);

describe('hand scoring', () => {
  it('scores the perfect 29 hand', () => {
    // Three fives and the jack of the starter's suit, with the fourth five cut.
    expect(hand('5C 5D 5S JH', '5H')).toBe(29);
  });

  it('scores 28 when the jack is the starter (no nobs)', () => {
    expect(hand('5C 5D 5S 5H', 'JH')).toBe(28);
  });

  it('scores zero for a hand with nothing', () => {
    expect(hand('2C 4D 6H 8S', 'KC')).toBe(0);
  });

  it('scores a double run', () => {
    // Two runs of three (6) + pair (2) + fifteens 3-3-4-5 and 5-K (4)
    expect(hand('3C 3D 4H 5S', 'KC')).toBe(12);
  });

  it('scores a double double run', () => {
    // Four runs of three (12) + two pairs (4) + two fifteens (4)
    expect(hand('3C 3D 4H 4S', '5C')).toBe(20);
  });

  it('scores a run of five as one run, not several shorter ones', () => {
    // Run of five (5) + fifteen A-2-3-4-5 (2)
    expect(hand('AC 2D 3H 4S', '5C')).toBe(7);
  });

  it('scores a run of four as one run', () => {
    // Run of four (4) + fifteens 7-8 and 6-9 (4)
    expect(hand('6C 7D 8H 9S', 'KC')).toBe(8);
  });

  it('counts three of a kind as three pairs', () => {
    expect(hand('9C 9D 9H 2S', 'KC')).toBe(6);
  });

  it('counts every fifteen', () => {
    // 5 with each of 10-J-Q-K (8) + run of four 10-J-Q-K (4)
    expect(hand('10C JD QH KS', '5C')).toBe(12);
  });

  it('gives nobs for the jack of the starter suit only', () => {
    expect(hand('JH 2C 4D 8S', '6H')).toBe(hand('JS 2C 4D 8S', '6H') + 1);
  });

  describe('flushes', () => {
    it('scores four for a hand flush when the starter differs', () => {
      expect(hand('2H 4H 6H 8H', 'KS')).toBe(4);
    });

    it('scores five when the starter matches', () => {
      expect(hand('2H 4H 6H 8H', 'KH')).toBe(5);
    });

    it('scores nothing for a four-card flush in the crib', () => {
      expect(hand('2H 4H 6H 8H', 'KS', true)).toBe(0);
    });

    it('scores five for a five-card flush in the crib', () => {
      expect(hand('2H 4H 6H 8H', 'KH', true)).toBe(5);
    });

    it('does not count three hand cards plus the starter', () => {
      expect(hand('2H 4H 6H 8S', 'KH')).toBe(0);
    });
  });

  it('lists what each score was for', () => {
    const score = scoreHand(cards('5C 5D 5S JH'), parseCard('5H'));
    const pointsFor = (kind: string) =>
      score.items.filter((i) => i.kind === kind).reduce((sum, i) => sum + i.points, 0);
    expect(pointsFor('fifteen')).toBe(16);
    expect(pointsFor('pair')).toBe(12);
    expect(pointsFor('nobs')).toBe(1);
  });
});

describe('pegging scoring', () => {
  it('scores two for fifteen', () => {
    expect(peg('7C 8D')).toBe(2);
  });

  it('scores two for thirty-one', () => {
    expect(peg('KC QD 9H 2S')).toBe(2);
  });

  it('scores pairs, three of a kind and four of a kind', () => {
    expect(peg('4C 4D')).toBe(2);
    expect(peg('4C 4D 4H')).toBe(6);
    expect(peg('4C 4D 4H 4S')).toBe(12);
  });

  it('does not count a pair that is interrupted', () => {
    expect(peg('4C 9D 4H')).toBe(0);
  });

  it('scores runs played out of order', () => {
    expect(peg('4C 6D 5H')).toBe(5); // run of three + fifteen
    expect(peg('2C 4D 3H')).toBe(3);
  });

  it('extends a run as cards are added', () => {
    expect(peg('2C 4D 3H AS')).toBe(4);
    expect(peg('2C 4D 3H AS 5C')).toBe(7); // run of five + fifteen
  });

  it('does not count a run broken by a duplicate', () => {
    expect(peg('3C 4D 4H 5S')).toBe(0);
  });

  it('counts only the run at the end of the sequence', () => {
    expect(peg('9C 2D 3H 4S')).toBe(3);
    expect(peg('2C 3D 4H 9S')).toBe(0);
  });

  it('scores a pair and a fifteen together', () => {
    expect(peg('5C 5D 5H')).toBe(8); // three of a kind + fifteen
  });
});
