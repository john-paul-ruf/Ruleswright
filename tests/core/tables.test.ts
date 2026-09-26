import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { MAX_TABLE_DEPTH, rollTable, type TableDef, type TableOutcome } from '../../src/core/tables';

/**
 * Scripted 0-based bounds stream: `int(maxExclusive)` returns the next value
 * verbatim (mod maxExclusive), so tests can force exact selections and d100 faces.
 */
function scriptedBounds(values: number[]): { int(maxExclusive: number): number } {
  let next = 0;
  return {
    int(maxExclusive: number) {
      const value = values[next] ?? 0;
      next = (next + 1) % values.length;
      return value % maxExclusive;
    },
  };
}

function mustSelect(outcome: TableOutcome): unknown {
  if (!outcome.ok) throw new Error(`expected a selection, got failure: ${outcome.failure.message}`);
  return outcome.value;
}

function mustFail(outcome: TableOutcome): { reason: string; jsonPath: string; message: string } {
  if (outcome.ok) throw new Error('expected a typed failure, got a selection');
  return outcome.failure;
}

const LOOT: TableDef = {
  kind: 'weighted',
  entries: [
    { weight: 60, value: 'coins' },
    { weight: 30, value: 'rations' },
    { weight: 10, value: 'relic' },
  ],
};

const WEATHER: TableDef = {
  kind: 'ranged',
  entries: [
    { min: 1, max: 50, value: 'clear' },
    { min: 51, max: 100, value: 'storm' },
  ],
};

describe('seeded determinism (FR-15 / CAP-3)', () => {
  it('same seed ⇒ identical sequences for every table kind', () => {
    const nested: TableDef = {
      kind: 'nested',
      entries: [{ value: 'loot', weight: 1 }, { value: 'weather' }],
    };
    const resolve = (ref: unknown): TableDef | undefined =>
      ref === 'loot' ? LOOT : ref === 'weather' ? WEATHER : undefined;

    for (const [def, options] of [
      [LOOT, {}],
      [WEATHER, {}],
      [nested, { resolve }],
    ] as const) {
      const first: unknown[] = [];
      const second: unknown[] = [];
      const rngA = new Rng('table-seed');
      const rngB = new Rng('table-seed');
      for (let i = 0; i < 1_000; i++) {
        first.push(rollTable(def, rngA, { ...options, jsonPath: 'tables.t' }));
        second.push(rollTable(def, rngB, { ...options, jsonPath: 'tables.t' }));
      }
      expect(second).toEqual(first);
    }
  });

  it('weighted selection is uniform over total weight — a 99:1 arm dominates', () => {
    const skewed: TableDef = {
      kind: 'weighted',
      entries: [
        { weight: 99, value: 'common' },
        { weight: 1, value: 'rare' },
      ],
    };
    const rng = new Rng('skew');
    let rare = 0;
    for (let i = 0; i < 10_000; i++) {
      if (mustSelect(rollTable(skewed, rng)) === 'rare') rare++;
    }
    expect(rare).toBeGreaterThan(50);
    expect(rare).toBeLessThan(200);
  });

  it('a weighted roll consumes exactly one bounded draw', () => {
    const draws: number[] = [];
    const rng = {
      int(maxExclusive: number) {
        draws.push(maxExclusive);
        return 0;
      },
    };
    mustSelect(rollTable(LOOT, rng));
    expect(draws).toEqual([100]); // one rng.int(totalWeight) call — integer arithmetic only
  });
});

describe('weighted tables', () => {
  it('selects only declared values across many rolls', () => {
    const rng = new Rng('loot');
    const seen = new Set<unknown>();
    for (let i = 0; i < 1_000; i++) seen.add(mustSelect(rollTable(LOOT, rng, { jsonPath: 'tables.loot' })));
    expect([...seen].sort()).toEqual(['coins', 'rations', 'relic']);
  });

  it('forces the exact entry boundaries (cumulative-walk selection)', () => {
    const two: TableDef = {
      kind: 'weighted',
      entries: [
        { weight: 2, value: 'first' },
        { weight: 3, value: 'second' },
      ],
    };
    expect(mustSelect(rollTable(two, scriptedBounds([0])))).toBe('first');
    expect(mustSelect(rollTable(two, scriptedBounds([1])))).toBe('first');
    expect(mustSelect(rollTable(two, scriptedBounds([2])))).toBe('second');
    expect(mustSelect(rollTable(two, scriptedBounds([4])))).toBe('second');
  });

  it('rejects weights below 1 or non-integer, naming the entry', () => {
    for (const weight of [0, -2, 1.5, undefined]) {
      const bad: TableDef = { kind: 'weighted', entries: [{ weight, value: 'x' }] };
      const failure = mustFail(rollTable(bad, new Rng(1), { jsonPath: 'tables.bad' }));
      expect(failure.reason).toBe('malformed-entries');
      expect(failure.jsonPath).toBe('tables.bad.entries[0]');
    }
  });
});

describe('ranged tables (d100, dice.html: percentile is the table roll)', () => {
  it('rolls one d100 face; inclusive edges match', () => {
    expect(mustSelect(rollTable(WEATHER, scriptedBounds([0]), { jsonPath: 'tables.weather' }))).toBe('clear');
    expect(mustSelect(rollTable(WEATHER, scriptedBounds([49]), { jsonPath: 'tables.weather' }))).toBe(
      'clear',
    );
    expect(mustSelect(rollTable(WEATHER, scriptedBounds([50]), { jsonPath: 'tables.weather' }))).toBe(
      'storm',
    );
    expect(mustSelect(rollTable(WEATHER, scriptedBounds([99]), { jsonPath: 'tables.weather' }))).toBe(
      'storm',
    );
  });

  it('first matching range wins on overlapping ranges', () => {
    const overlap: TableDef = {
      kind: 'ranged',
      entries: [
        { min: 1, max: 100, value: 'catch-all' },
        { min: 90, max: 100, value: 'never' },
      ],
    };
    expect(mustSelect(rollTable(overlap, scriptedBounds([95])))).toBe('catch-all');
  });

  it('declared gaps fail loudly (negative control) — range-gap with the roll in the message', () => {
    const gapped: TableDef = {
      kind: 'ranged',
      entries: [
        { min: 1, max: 50, value: 'low' },
        { min: 61, max: 100, value: 'high' },
      ],
    };
    const failure = mustFail(rollTable(gapped, scriptedBounds([55]), { jsonPath: 'tables.gapped' }));
    expect(failure.reason).toBe('range-gap');
    expect(failure.jsonPath).toBe('tables.gapped');
    expect(failure.message).toContain('56');
  });

  it('rejects inverted, missing, or non-integer ranges', () => {
    for (const entry of [
      { min: 60, max: 10, value: 'x' },
      { min: 1, value: 'x' },
      { min: 1.5, max: 2, value: 'x' },
      { max: 9, value: 'x' },
    ]) {
      const bad: TableDef = { kind: 'ranged', entries: [entry] };
      const failure = mustFail(rollTable(bad, new Rng(1), { jsonPath: 'tables.bad' }));
      expect(failure.reason).toBe('malformed-entries');
      expect(failure.jsonPath).toBe('tables.bad.entries[0]');
    }
  });
});

describe('nested tables (depth-bounded, E-TBL-01 contract)', () => {
  function chain(length: number): Record<string, TableDef> {
    const tables: Record<string, TableDef> = {};
    for (let i = 0; i < length; i++) {
      tables[`t${i}`] =
        i + 1 < length
          ? { kind: 'nested', entries: [{ value: `t${i + 1}` }] }
          : { kind: 'weighted', entries: [{ weight: 1, value: `end-${i}` }] };
    }
    return tables;
  }

  const resolverFor =
    (tables: Record<string, TableDef>) =>
    (ref: unknown): TableDef | undefined =>
      typeof ref === 'string' ? tables[ref] : undefined;

  it('resolves references through the chain; mixed kinds compose mid-chain', () => {
    const tables = chain(8); // t0..t6 nested hops + t7 weighted terminal = 8 tables (root + 7 refs)
    const outcome = rollTable(tables['t0']!, new Rng('chain'), {
      resolve: resolverFor(tables),
      jsonPath: 'tables.chain',
    });
    expect(mustSelect(outcome)).toBe('end-7');
  });

  it('nine hops deep fails loudly — MAX_TABLE_DEPTH is 8 (negative control)', () => {
    expect(MAX_TABLE_DEPTH).toBe(8);
    const tables = chain(9); // t0..t8 nested = 9 tables entered = one past the bound into t9
    const failure = mustFail(
      rollTable(tables['t0']!, new Rng('deep'), { resolve: resolverFor(tables), jsonPath: 'tables.chain' }),
    );
    expect(failure.reason).toBe('depth-exceeded');
    expect(failure.jsonPath).toBe('tables.chain' + '->entries[0]'.repeat(8));
  });

  it('an unresolvable reference is a typed failure naming the entry (E-REF-01 territory)', () => {
    const dangling: TableDef = { kind: 'nested', entries: [{ value: 'no-such-table' }] };
    const failure = mustFail(
      rollTable(dangling, new Rng(1), { resolve: () => undefined, jsonPath: 'tables.dangling' }),
    );
    expect(failure.reason).toBe('unresolvable-ref');
    expect(failure.jsonPath).toBe('tables.dangling.entries[0]');
  });

  it('a missing resolver cannot silently pass as a selection', () => {
    const nested: TableDef = { kind: 'nested', entries: [{ value: 'anything' }] };
    const failure = mustFail(rollTable(nested, new Rng(1), { jsonPath: 'tables.nested' }));
    expect(failure.reason).toBe('unresolvable-ref');
  });

  it('rejects malformed nested weights', () => {
    for (const weight of [0, 2.5, -1]) {
      const bad: TableDef = { kind: 'nested', entries: [{ weight, value: 'x' }] };
      const failure = mustFail(rollTable(bad, new Rng(1), { jsonPath: 'tables.bad' }));
      expect(failure.reason).toBe('malformed-entries');
      expect(failure.jsonPath).toBe('tables.bad.entries[0]');
    }
  });

  it('nested selection honors declared weights', () => {
    const weighted: TableDef = {
      kind: 'nested',
      entries: [
        { weight: 1, value: 'rare-branch' },
        { weight: 99, value: 'common-branch' },
      ],
    };
    const tables: Record<string, TableDef> = {
      'rare-branch': { kind: 'weighted', entries: [{ weight: 1, value: 'rare-end' }] },
      'common-branch': { kind: 'weighted', entries: [{ weight: 1, value: 'common-end' }] },
    };
    expect(mustSelect(rollTable(weighted, scriptedBounds([0]), { resolve: resolverFor(tables) }))).toBe(
      'rare-end',
    );
    expect(mustSelect(rollTable(weighted, scriptedBounds([50]), { resolve: resolverFor(tables) }))).toBe(
      'common-end',
    );
  });
});

describe('failure shape for the validator seam (S01 → ErrorCard mapping)', () => {
  it('every failure carries exactly {reason, jsonPath, message}', () => {
    const gapped: TableDef = { kind: 'ranged', entries: [{ min: 1, max: 50, value: 'low' }] };
    const failure = mustFail(rollTable(gapped, scriptedBounds([80]), { jsonPath: 'tables.gap' }));
    expect(Object.keys(failure).sort()).toEqual(['jsonPath', 'message', 'reason']);
  });

  it('empty tables fail loudly for every kind', () => {
    for (const kind of ['weighted', 'ranged', 'nested'] as const) {
      const empty: TableDef = { kind, entries: [] };
      const failure = mustFail(rollTable(empty, new Rng(1), { jsonPath: 'tables.empty' }));
      expect(failure.reason).toBe('malformed-entries');
      expect(failure.jsonPath).toBe('tables.empty');
    }
  });

  it('defaults the root jsonPath when the caller omits it', () => {
    const failure = mustFail(rollTable({ kind: 'weighted', entries: [] }, new Rng(1)));
    expect(failure.jsonPath).toBe('(table)');
  });
});
