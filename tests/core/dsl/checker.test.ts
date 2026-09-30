import { describe, expect, it } from 'vitest';
import { packDslChecker } from '../../../src/core/dsl/checker';
import {
  EFFECT_VOCABULARY,
  FORMULA_VOCABULARY,
  REGISTRY,
  VALIDITY_VOCABULARY,
} from '../../../src/core/dsl/registry';
import { validatePack } from '../../../src/schema/validate';

describe('registry freeze (CA-2: extension is a schema event, never a code change)', () => {
  it('asserts the exact v1.5 membership (14: move joined as the v1.5 schema event, after heal in v1.4) — additive id check, mirroring CA-1 discipline', () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([
      'applyCondition',
      'attack',
      'ceil',
      'damage',
      'floor',
      'half',
      'hasTarget',
      'heal',
      'max',
      'min',
      'move',
      'save',
      'sequence',
      'target',
    ]);
  });

  it('covers the mock-pinned vocabularies completely', () => {
    for (const name of EFFECT_VOCABULARY) expect(REGISTRY[name]).toBeDefined();
    for (const name of VALIDITY_VOCABULARY) expect(REGISTRY[name]).toBeDefined();
    for (const name of FORMULA_VOCABULARY) expect(REGISTRY[name]).toBeDefined();
  });

  it('the effect vocabulary includes move (v1.5)', () => {
    expect(EFFECT_VOCABULARY).toContain('move');
    expect(REGISTRY['move']).toEqual({ arity: 1, kind: 'effect', signature: ['formula'] });
  });

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(REGISTRY)).toBe(true);
  });
});

describe('S01 wiring — validatePack with the real checker (CA-2 producer proof)', () => {
  /** A minimal pack that clears structural validation, carrying the DSL strings under test. The progression attackBonus field exercises the `attackBonus` kind in every run. */
  function pack(effect: string, valid?: string) {
    return {
      manifest: { id: 'wiring-pack', schemaVersion: 1, title: 'Wiring Pack' },
      stats: { abilities: ['vigor', 'might'], saves: ['reason', 'grit'] },
      actions: {
        strike: { cost: { slots: { action: 1 } }, effect, ...(valid !== undefined ? { valid } : {}) },
      },
      economy: { turnSlots: { action: 1 } },
      formulas: {
        hp: { expr: '8 + vigor * 2' },
        ac: { expr: '10' },
      },
      content: { classes: { warden: { name: 'Warden' } } },
      progression: { warden: { hd: 'd8', attackBonus: 'level / 2', saves: { reason: [2, 3, 4] } } },
      bestiary: { 'grave-shambles': { name: 'Grave Shambles', threat: 1, actions: ['strike'] } },
      tables: { 'loot-table': { kind: 'weighted', entries: [{ weight: 1, value: 'nothing' }] } },
    };
  }

  it('a valid pack yields zero E-FORM cards (deferred default replaced)', () => {
    const cards = validatePack(pack('attack(ac, might)'), packDslChecker);
    expect(cards.filter((card) => card.rule.startsWith('E-FORM'))).toEqual([]);
  });

  it('broken effect → E-FORM-02 through the whole validator', () => {
    const cards = validatePack(pack('smash(goblin)'), packDslChecker);
    const form = cards.filter((card) => card.rule === 'E-FORM-02');
    expect(form).toHaveLength(1);
    expect(form[0]!.artifactId).toBe('strike');
    expect(form[0]!.jsonPath).toBe('actions.strike.effect');
  });

  it('broken formula argument → E-FORM-03 with did-you-mean through the whole validator', () => {
    const cards = validatePack(pack('attack(ac, migh)'), packDslChecker);
    const form = cards.filter((card) => card.rule === 'E-FORM-03');
    expect(form).toHaveLength(1);
    expect(form[0]!.hint).toBe('did you mean "might"?');
  });

  it('parse failure → E-FORM-01 with the offset, through the whole validator', () => {
    const cards = validatePack(pack('attack(ac'), packDslChecker);
    const form = cards.filter((card) => card.rule === 'E-FORM-01');
    expect(form).toHaveLength(1);
    expect(form[0]!.message).toMatch(/offset/);
  });

  it('move is root-only and dice-free through the whole validator (E-FORM-02)', () => {
    const clean = validatePack(pack('move(3)'), packDslChecker);
    expect(clean.filter((card) => card.rule.startsWith('E-FORM'))).toEqual([]);
    for (const effect of ['sequence(move(3), damage(1))', 'move(1d6)', 'move(2 + 1d4)']) {
      const cards = validatePack(pack(effect), packDslChecker);
      expect(
        cards.filter((card) => card.rule === 'E-FORM-02').map((card) => card.jsonPath),
        effect,
      ).toEqual(['actions.strike.effect']);
    }
  });

  it('valid-field expressions are checked with the validity grammar', () => {
    const good = validatePack(pack('attack(ac, might)', 'hasTarget(adjacent)'), packDslChecker);
    expect(good.filter((card) => card.rule.startsWith('E-FORM'))).toEqual([]);
    const broken = validatePack(pack('attack(ac, might)', 'hasTarget(adjacent'), packDslChecker);
    expect(broken.filter((card) => card.rule === 'E-FORM-01').length).toBeGreaterThan(0);
  });
});
