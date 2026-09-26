import { describe, expect, it } from 'vitest';
import { applyOverrides, type OverrideDocument } from '../../src/schema/overrides';
import { validatePack } from '../../src/schema/validate';
import { packContentHash } from '../../src/schema/version';
import { clonePack, stubDslChecker, VALID_PACK } from './fixtures';

/** The full load discipline: apply overrides, then revalidate the merged document (FR-2 holds for merged packs). */
function mergedCards(doc: OverrideDocument): string[] {
  const { pack, errors } = applyOverrides(VALID_PACK, doc);
  return [...errors, ...validatePack(pack, stubDslChecker)].map((card) => card.rule);
}

describe('applyOverrides (FR-19)', () => {
  it('merges patches at their dotted paths, deep', () => {
    const { pack, errors } = applyOverrides(VALID_PACK, {
      overrides: [
        { target: 'barrow-wight', patch: { 'abilityOverrides.might': 16, name: 'Barrow Wight Ascendant' } },
      ],
    });
    expect(errors).toEqual([]);
    const wight = pack.bestiary['barrow-wight']!;
    expect(wight.abilityOverrides).toEqual({ might: 16 });
    expect(wight.name).toBe('Barrow Wight Ascendant');
    expect(wight.actions).toEqual(['strike']);
  });

  it('applies patches in array order — the later patch wins', () => {
    const { pack, errors } = applyOverrides(VALID_PACK, {
      overrides: [
        { target: 'barrow-wight', patch: { name: 'first' } },
        { target: 'barrow-wight', patch: { name: 'second' } },
      ],
    });
    expect(errors).toEqual([]);
    expect(pack.bestiary['barrow-wight']!.name).toBe('second');
  });

  it('replaces non-object values wholesale and deep-merges object values', () => {
    const { pack } = applyOverrides(VALID_PACK, {
      overrides: [{ target: 'sapped', patch: { restricts: ['actions.tagged:casting'] } }],
    });
    expect(pack.content.conditions!.sapped!.restricts).toEqual(['actions.tagged:casting']);
  });

  it('does not mutate the input pack', () => {
    const before = packContentHash(VALID_PACK);
    applyOverrides(VALID_PACK, { overrides: [{ target: 'barrow-wight', patch: { threat: 9 } }] });
    expect(packContentHash(VALID_PACK)).toBe(before);
    expect(VALID_PACK.bestiary['barrow-wight']!.threat).toBe(2);
  });

  it('E-OVR-01: an unknown target is reported with nearest-id hints and skipped', () => {
    const { pack, errors } = applyOverrides(VALID_PACK, {
      overrides: [{ target: 'barrow-wiggt', patch: { threat: 9 } }],
    });
    expect(errors).toHaveLength(1);
    const card = errors[0]!;
    expect(card.rule).toBe('E-OVR-01');
    expect(card.jsonPath).toBe('overrides[0].target');
    expect(card.hint).toContain('nearest ids:');
    expect(card.hint).toContain('"barrow-wight"');
    expect(pack.bestiary['barrow-wight']!.threat).toBe(2);
  });

  it('a patch that breaks the pack shape yields structural cards on revalidation, never a throw', () => {
    const rules = mergedCards({
      overrides: [{ target: 'barrow-wight', patch: { hdi: 'd20' } }],
    });
    expect(rules).toContain('E-SCHEMA-02');
    expect(() =>
      mergedCards({ overrides: [{ target: 'barrow-wight', patch: { threat: 'not-a-number' } }] }),
    ).not.toThrow();
  });

  it('patch paths are artifact-relative — they cannot touch the pack root', () => {
    const { pack } = applyOverrides(VALID_PACK, {
      overrides: [{ target: 'barrow-wight', patch: { 'economy.turnSlots.main': 5 } }],
    });
    expect(pack.economy).toEqual({ turnSlots: { main: 1, move: 1 } });
    const cards = validatePack(pack, stubDslChecker);
    expect(
      cards.some(
        (card) => card.rule === 'E-SCHEMA-02' && card.jsonPath.startsWith('bestiary.barrow-wight.economy'),
      ),
    ).toBe(true);
  });

  it('a full valid round trip: patched pack revalidates clean', () => {
    const pack = clonePack();
    const { pack: merged, errors } = applyOverrides(pack, {
      overrides: [{ target: 'strike', patch: { tags: ['main', 'attack'] } }],
    });
    expect(errors).toEqual([]);
    expect(validatePack(merged, stubDslChecker)).toEqual([]);
  });
});
