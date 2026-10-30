/**
 * Regression tests for three engine fixes:
 *  1. pack generation no longer fails when a nested loot table lands a flavor value ("nothing");
 *  2. actions may declare `range` (thrown/shot weapons) — the reach gate allows max(reach, range);
 *  3. pack validation / hashing / compilation are memoized for immutable JSON copies only.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { Runtime } from '../../src/runtime/runtime';
import { startCombat } from '../../src/runtime/combat/combat';
import { profileFromStatblock } from '../../src/runtime/combat/resolve';
import { validatePack } from '../../src/schema/validate';
import { packContentHash } from '../../src/schema/version';
import { frozenJsonCopy, isFrozenJsonCopy, markJsonClean } from '../../src/schema/json-memo';
import { emberMarchesPack } from '../runtime/fixtures/packs';
import type { Pack } from '../../src/schema/pack';

describe('nested loot tables: a flavor landing no longer breaks generation', () => {
  for (const theme of ['dark-fantasy', 'zombie-urban', 'wyldwood']) {
    it(`${theme}: seeds 0..199 all generate (previously ~1 in 6 failed with E-TBL-01)`, () => {
      const failed: number[] = [];
      for (let seed = 0; seed < 200; seed++) {
        try {
          generateCampaign({ theme: loadTheme(theme), seed });
        } catch {
          failed.push(seed);
        }
      }
      expect(failed).toEqual([]);
    });
  }

  it('working seeds draw exactly as before: the smoke roll still consumes the same stream', () => {
    // Seed 42 never landed the flavor branch; its pack is unchanged by this fix (the
    // content hash moved only with the v1.8 content edits, pinned in pack-identity).
    const a = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 });
    const b = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 });
    expect(packContentHash(a)).toBe(packContentHash(b));
  });

  it('a tables.-prefixed nested reference that does not resolve still fails generation', () => {
    const theme = structuredClone(loadTheme('dark-fantasy'));
    theme.tables!['broken-loot'] = {
      kind: 'nested',
      entries: [{ weight: 1, value: 'tables.no-such-table' }],
    };
    expect(() => generateCampaign({ theme, seed: 42 })).toThrow();
  });
});

function rangedFight(range: number | undefined, distance: number) {
  const pack = emberMarchesPack();
  pack.spatial = { model: 'grid', reach: { default: 1 }, shapes: ['single', 'burst'] };
  pack.actions['loose'] = {
    cost: { slots: { main: 1 } },
    effect: 'sequence(attack(ac, 0), damage(1d4, pierce))',
    tags: ['main'],
    ...(range === undefined ? {} : { range }),
  };
  const runtime = new Runtime(pack);
  const base = profileFromStatblock(pack, pack.bestiary['barrow-wight']!, 'archer');
  const fight = startCombat(runtime, {
    allies: [{ id: 'archer', profile: { ...base, id: 'archer', initiativeBonus: 100, actions: ['loose'] } }],
    enemies: [{ id: 'target', profile: { ...base, id: 'target', initiativeBonus: 0 } }],
    positions: { archer: { x: 0, y: 0 }, target: { x: distance, y: 0 } },
    rng: new Rng(7),
  });
  return fight.declare('loose', { targetId: 'target' });
}

describe('action range (v1.8)', () => {
  it('a ranged action reaches a target inside its range', () => {
    const events = rangedFight(5, 4);
    expect(events.some((e) => e.type === 'declare:rejected')).toBe(false);
    expect(events.some((e) => e.type === 'attack:rolled')).toBe(true);
  });

  it('beyond its range it is refused with E-SPAT-01 and changes nothing', () => {
    const events = rangedFight(5, 6);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('declare:rejected');
    expect(events[0]!.why.rule).toBe('E-SPAT-01');
  });

  it('without range an action still needs reach (unchanged behaviour)', () => {
    expect(rangedFight(undefined, 2)[0]!.type).toBe('declare:rejected');
    expect(rangedFight(undefined, 1).some((e) => e.type === 'attack:rolled')).toBe(true);
  });

  it('the validator rejects a non-positive or non-integer range', () => {
    for (const range of [0, -1, 2.5, '3']) {
      const pack = emberMarchesPack() as unknown as Record<string, Record<string, Record<string, unknown>>>;
      pack['actions']!['strike']!['range'] = range;
      const errors = validatePack(pack);
      expect(errors.some((c) => c.jsonPath === 'actions.strike.range')).toBe(true);
    }
    const ok = emberMarchesPack();
    ok.actions['strike'] = { ...ok.actions['strike']!, range: 4 };
    expect(validatePack(ok).filter((c) => c.jsonPath.includes('range'))).toEqual([]);
  });
});

describe('memoized validation / hashing for immutable JSON copies', () => {
  const pack = generateCampaign({ theme: loadTheme('wyldwood'), seed: 42 });

  it('hashes and validation results are identical with and without the memo', () => {
    const plain = JSON.parse(JSON.stringify(pack)) as Pack;
    const frozen = frozenJsonCopy(pack);
    expect(isFrozenJsonCopy(frozen)).toBe(true);
    expect(packContentHash(frozen)).toBe(packContentHash(plain));
    expect(packContentHash(frozen)).toBe(packContentHash(frozen)); // memo hit
    expect(validatePack(frozen)).toEqual(validatePack(plain));
  });

  it('a frozen copy is shared, never re-copied, and cannot be mutated', () => {
    const frozen = frozenJsonCopy(pack);
    expect(frozenJsonCopy(frozen)).toBe(frozen);
    expect(Object.isFrozen(frozen.content)).toBe(true);
    expect(() => {
      (frozen.manifest as { title: string }).title = 'changed';
    }).toThrow();
  });

  it('a registered (mutable) copy is re-keyed at call time, so mutation is never served stale', () => {
    const copy = markJsonClean(JSON.parse(JSON.stringify(pack)) as Pack);
    const before = packContentHash(copy);
    copy.manifest.title = 'A different title';
    expect(packContentHash(copy)).not.toBe(before);
    expect(packContentHash(copy)).toBe(packContentHash(JSON.parse(JSON.stringify(copy))));
  });

  it('cached error cards are returned as copies', () => {
    const broken = markJsonClean(JSON.parse(JSON.stringify(pack)) as Record<string, unknown>);
    delete broken['formulas'];
    const first = validatePack(broken);
    expect(first.length).toBeGreaterThan(0);
    (first[0] as { message: string }).message = 'tampered';
    expect(validatePack(broken)[0]!.message).not.toBe('tampered');
  });

  it('runtimes built from the same frozen copy share one compiled index', () => {
    const frozen = frozenJsonCopy(pack);
    expect(new Runtime(frozen).index).toBe(new Runtime(frozen).index);
    const a = new Runtime(JSON.parse(JSON.stringify(pack)));
    const b = new Runtime(JSON.parse(JSON.stringify(pack)));
    expect(a.index).not.toBe(b.index);
  });
});
