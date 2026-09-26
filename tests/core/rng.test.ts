import { describe, expect, it } from 'vitest';
import { Rng, type RngState } from '../../src/core/rng';

const UINT32_MAX = 4294967296;

function sequence(rng: Rng, count: number, maxExclusive: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) values.push(rng.int(maxExclusive));
  return values;
}

describe('Rng determinism (FR-1 / CAP-2)', () => {
  it('produces identical 10,000-value sequences for the same seed', () => {
    expect(sequence(new Rng('dark-fantasy'), 10_000, 1000)).toEqual(
      sequence(new Rng('dark-fantasy'), 10_000, 1000),
    );
  });

  it('diverges on different seeds', () => {
    const a = new Rng('seed-one');
    const b = new Rng('seed-two');
    let diverged = false;
    for (let i = 0; i < 100; i++) {
      if (a.int(6) !== b.int(6)) diverged = true;
    }
    expect(diverged).toBe(true);
  });

  it('seeds numbers and their string spelling identically (one canonical key)', () => {
    expect(sequence(new Rng(42), 1_000, 1_000_000)).toEqual(sequence(new Rng('42'), 1_000, 1_000_000));
  });

  it('draws stay within [0, maxExclusive) and cover every d20 face', () => {
    const rng = new Rng('coverage');
    const draws = sequence(rng, 10_000, 20);
    for (const draw of draws) {
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThan(20);
    }
    const faces = new Set(draws.map((draw) => draw + 1));
    expect(faces.size).toBe(20);
  });

  it('float() stays in [0, 1)', () => {
    const rng = new Rng('floats');
    for (let i = 0; i < 10_000; i++) {
      const value = rng.float();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is unbiased across the range', () => {
    const rng = new Rng('bias');
    const draws = sequence(rng, 100_000, 2);
    const mean = draws.reduce((sum, value) => sum + value, 0) / draws.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.01);
  });
});

describe('Rng state export/import (FR-14 snapshot contract)', () => {
  it('getState returns exactly {a,b,c,d} uint32 — the snapshots.schema.json rngState shape', () => {
    const state = new Rng('state-shape').getState();
    expect(Object.keys(state).sort()).toEqual(['a', 'b', 'c', 'd']);
    for (const word of Object.values(state)) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThan(UINT32_MAX);
    }
  });

  it('export → new Rng → setState → next values identical to the uninterrupted stream', () => {
    const source = new Rng(12345);
    for (let i = 0; i < 500; i++) source.int(20);
    const state = source.getState();

    const viaConstructor = new Rng(state);
    const viaSetter = new Rng('discarded');
    viaSetter.setState(state);

    const expected = sequence(source, 1_000, 6);
    expect(sequence(viaConstructor, 1_000, 6)).toEqual(expected);
    expect(sequence(viaSetter, 1_000, 6)).toEqual(expected);
  });

  it('state survives a JSON round trip (plain JSON, no hidden state)', () => {
    const source = new Rng('serialize-me');
    for (let i = 0; i < 100; i++) source.int(100);
    const revived: RngState = JSON.parse(JSON.stringify(source.getState())) as RngState;
    const resumed = new Rng('discarded');
    resumed.setState(revived);
    expect(sequence(resumed, 500, 100)).toEqual(sequence(source, 500, 100));
  });
});

describe('Rng malformed-state and argument rejection', () => {
  it('rejects non-uint32 words loudly', () => {
    const bad = (word: Partial<RngState>): RngState => ({ a: 1, b: 2, c: 3, d: 4, ...word });
    expect(() => new Rng(bad({ a: -1 }))).toThrow(RangeError);
    expect(() => new Rng(bad({ b: UINT32_MAX }))).toThrow(RangeError);
    expect(() => new Rng(bad({ c: 1.5 }))).toThrow(RangeError);
  });

  it('rejects extra keys — rngState is exactly {a,b,c,d} (additionalProperties: false)', () => {
    const padded = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    expect(() => new Rng(padded as RngState)).toThrow(RangeError);
    const setter = new Rng(1);
    expect(() => setter.setState(padded as RngState)).toThrow(RangeError);
  });

  it('rejects int() arguments that cannot bound a draw', () => {
    const rng = new Rng('bounds');
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
    expect(() => rng.int(-3)).toThrow(RangeError);
  });
});