import { describe, expect, it } from 'vitest';
import { parseRecipe, rollRecipe, type DiceRecipe } from '../../src/core/dice';
import { Rng } from '../../src/core/rng';

function mustParse(source: string): DiceRecipe {
  const parsed = parseRecipe(source);
  if (!parsed.ok) throw new Error(`"${source}" must parse`);
  return parsed.recipe;
}

/**
 * A scripted source — the injection point (dice.html: rigged streams for tests).
 * Takes die FACES (1-based, as written); RandomSource.int() returns 0-based
 * bounds, so the helper converts like a real bounded stream would.
 */
function scripted(values: number[]): { int(maxExclusive: number): number } {
  let next = 0;
  return {
    int(maxExclusive: number) {
      const face = values[next] ?? 1;
      next = (next + 1) % values.length;
      return (face - 1) % maxExclusive;
    },
  };
}

describe('recipe parsing (dice.html recipes table)', () => {
  it('parses every row of the vocabulary', () => {
    const sources = ['d20 + attackBonus', '4d6kh3', '2d20kh1', '1d8 + might', 'd100', '3d6kl2'];
    for (const source of sources) {
      const parsed = parseRecipe(source);
      expect(parsed.ok, `${source} must parse`).toBe(true);
    }
    expect(mustParse('d20 + attackBonus')).toEqual({
      source: 'd20 + attackBonus',
      die: { count: 1, sides: 20 },
      flat: 0,
      vars: [{ name: 'attackBonus', sign: 1 }],
    });
    expect(mustParse('4d6kh3').die.keep).toEqual({ mode: 'kh', count: 3 });
    expect(mustParse('2d20kh1').die).toEqual({ count: 2, sides: 20, keep: { mode: 'kh', count: 1 } });
    expect(mustParse('1d8 + might').die).toEqual({ count: 1, sides: 8 });
    expect(mustParse('1d8 + might').vars).toEqual([{ name: 'might', sign: 1 }]);
    expect(mustParse('d100').die).toEqual({ count: 1, sides: 100 });
    expect(mustParse('3d6kl2').die.keep).toEqual({ mode: 'kl', count: 2 });
  });

  it('rejects malformed recipes loudly with the reason', () => {
    for (const source of [
      '',
      '2d6+3d4',
      'd0',
      '0d6',
      '2d6kh0',
      '-d6',
      'd6 + (2)',
      '2xd6',
      'd6 + attack-bonus!',
    ]) {
      const parsed = parseRecipe(source);
      expect(parsed.ok, `"${source}" must be rejected`).toBe(false);
      if (!parsed.ok) expect(parsed.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('rollRecipe (CA-2 RollResult shape)', () => {
  it('emits the dice.html roll anatomy with the values+modifier total invariant', () => {
    const roll = rollRecipe(mustParse('d20 + 3'), new Rng(7), {}, 'attack');
    expect(Object.keys(roll).sort()).toEqual(['modifier', 'purpose', 'sides', 'total', 'values']);
    expect(roll.purpose).toBe('attack');
    expect(roll.sides).toBe(20);
    expect(roll.values).toHaveLength(1);
    expect(roll.total).toBe(roll.values[0]! + 3);
    expect('verdict' in roll).toBe(false);
  });

  it('rolls the d20+bonus resolution primitive', () => {
    const roll = rollRecipe(mustParse('d20 + attackBonus'), new Rng('attack'), { attackBonus: 5 }, 'attack');
    expect(roll.sides).toBe(20);
    expect(roll.modifier).toBe(5);
    expect(roll.total).toBe(roll.values[0]! + 5);
  });

  it('rolls 4d6kh3: drops the lowest die, keeps roll order', () => {
    const roll = rollRecipe(mustParse('4d6kh3'), scripted([2, 5, 4, 3]), {}, 'stat-line');
    expect(roll.values).toEqual([5, 4, 3]);
    expect(roll.modifier).toBe(0);
    expect(roll.total).toBe(12);
  });

  it('rolls 2d20kh1 and 3d6kl2 (advantage / keep-lowest)', () => {
    const khRoll = rollRecipe(mustParse('2d20kh1'), scripted([14, 9]), {}, 'advantage');
    expect(khRoll.values).toEqual([14]);
    expect(khRoll.total).toBe(14);

    const klRoll = rollRecipe(mustParse('3d6kl2'), scripted([6, 2, 4]), {}, 'grim');
    expect(klRoll.values).toEqual([2, 4]);
    expect(klRoll.total).toBe(6);
  });

  it('rolls 1d8 + might and d100 (ability terms, percentile)', () => {
    const damage = rollRecipe(mustParse('1d8 + might'), scripted([6]), { might: 4 }, 'damage');
    expect(damage.values).toEqual([6]);
    expect(damage.modifier).toBe(4);
    expect(damage.total).toBe(10);

    const percentile = rollRecipe(mustParse('d100'), scripted([63]), {}, 'table-roll');
    expect(percentile.sides).toBe(100);
    expect(percentile.values).toEqual([63]);
  });

  it('is deterministic: same seed + same call sequence ⇒ identical rolls', () => {
    const first = rollRecipe(mustParse('4d6kh3'), new Rng('same-seed'), {}, 'stat');
    const second = rollRecipe(mustParse('4d6kh3'), new Rng('same-seed'), {}, 'stat');
    expect(second).toEqual(first);
  });

  it('carries negative modifiers and multiple variables with signs', () => {
    const roll = rollRecipe(
      mustParse('d6 - 1 - fatigue + fury'),
      scripted([4]),
      { fatigue: 2, fury: 3 },
      'weary-blow',
    );
    expect(roll.modifier).toBe(0);
    expect(roll.total).toBe(4);
  });

  it('throws on unresolved variables (E-FORM-03 territory: load-time validation rejects them)', () => {
    expect(() => rollRecipe(mustParse('d20 + attackBonus'), new Rng(1), {}, 'attack')).toThrow(/attackBonus/);
  });
});

describe('verdicts belong to the caller', () => {
  it('core computes rolls only — the caller attaches verdict', () => {
    const roll = rollRecipe(mustParse('d20 + 3'), scripted([14]), {}, 'attack');
    const judged = {
      ...roll,
      verdict: { defense: 'ac', value: 15, result: roll.total >= 15 ? 'hit' : 'miss' },
    };
    expect(roll.total).toBe(17);
    expect(judged.verdict).toEqual({ defense: 'ac', value: 15, result: 'hit' });
    expect(judged.purpose).toBe('attack');
  });
});
