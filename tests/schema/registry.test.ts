import { describe, expect, it } from 'vitest';
import { makeErrorCard, RULE_IDS } from '../../src/schema/error-card';

const DB_V1_REGISTRY = [
  'E-SCHEMA-01',
  'E-SCHEMA-02',
  'E-DUP-01',
  'E-REF-01',
  'E-REF-02',
  'E-REF-03',
  'E-FORM-01',
  'E-FORM-02',
  'E-FORM-03',
  'E-ECON-01',
  'E-TBL-01',
  'E-OVR-01',
  'E-SNAP-01',
  'E-SNAP-02',
  'E-SPAT-01',
] as const;

describe('rule-id registry (CA-1)', () => {
  it('lists the DB v1 ids verbatim, in registry order', () => {
    expect([...RULE_IDS]).toEqual([...DB_V1_REGISTRY]);
  });

  it('is frozen at exactly 15 ids (additive-only extension point)', () => {
    expect(RULE_IDS).toHaveLength(15);
    expect(Object.isFrozen(RULE_IDS)).toBe(true);
    expect(new Set(RULE_IDS).size).toBe(15);
  });

  it('contains the snapshot ids this module registers for S06', () => {
    expect(RULE_IDS).toContain('E-SNAP-01');
    expect(RULE_IDS).toContain('E-SNAP-02');
  });
});

describe('makeErrorCard', () => {
  it('emits the mock gallery shape (severity, artifactId, jsonPath, rule, message)', () => {
    const card = makeErrorCard('E-REF-01', 'claw', 'bestiary.barrow-wight.actions.claw', 'broken ref');
    expect(card).toEqual({
      severity: 'error',
      artifactId: 'claw',
      jsonPath: 'bestiary.barrow-wight.actions.claw',
      rule: 'E-REF-01',
      message: 'broken ref',
    });
    expect('hint' in card).toBe(false);
  });

  it('carries the hint when given', () => {
    const card = makeErrorCard('E-REF-01', 'claw', 'x', 'msg', 'nearest: "shaken-1round"');
    expect(card.hint).toBe('nearest: "shaken-1round"');
  });
});
