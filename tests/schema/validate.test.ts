import { describe, expect, it } from 'vitest';
import { clonePack, errorsFor, firstRule, nestedChain, stubDslChecker, VALID_PACK } from './fixtures';
import {
  deferredDslChecker,
  MAX_TABLE_DEPTH,
  validatePack,
  type DslChecker,
} from '../../src/schema/validate';
import type { Pack } from '../../src/schema/pack';

/** Accepts only expressions that mention "might" — used to prove the checker is invoked with the right context. */
const pickyChecker: DslChecker = (request) =>
  request.expr.includes('might')
    ? []
    : [
        {
          severity: 'error',
          artifactId: request.artifactId,
          jsonPath: request.jsonPath,
          rule: 'E-FORM-01',
          message: 'picky',
        },
      ];

describe('structural pass', () => {
  it('a valid minimal pack produces zero cards (FR-2)', () => {
    expect(validatePack(VALID_PACK, stubDslChecker)).toEqual([]);
  });

  it('rejects a non-object document', () => {
    const cards = validatePack('nope', stubDslChecker);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ rule: 'E-SCHEMA-01', jsonPath: '(root)' });
  });

  it('a missing section is reported', () => {
    const cards = errorsFor((pack) => delete (pack as unknown as Record<string, unknown>).tables);
    expect(firstRule(cards, 'E-SCHEMA-01')?.jsonPath).toBe('tables');
  });

  it('an unknown top-level section is rejected (E-SCHEMA-02)', () => {
    const cards = errorsFor((pack) => ((pack as unknown as Record<string, unknown>).extra = {}));
    expect(cards.some((card) => card.rule === 'E-SCHEMA-02' && card.jsonPath === 'extra')).toBe(true);
  });

  it('unknown nested fields are rejected (E-SCHEMA-02)', () => {
    const cards = errorsFor((pack) => ((pack.actions.strike as unknown as Record<string, unknown>).oops = 1));
    expect(cards.some((card) => card.rule === 'E-SCHEMA-02' && card.jsonPath === 'actions.strike.oops')).toBe(
      true,
    );
  });

  it('bad map keys violate the id grammar', () => {
    const cards = errorsFor(
      (pack) =>
        ((pack as unknown as Record<string, unknown>).actions = {
          'BigStrike!': { cost: { vancian: 1 }, effect: 'x' },
        }),
    );
    expect(cards.some((card) => card.jsonPath.startsWith('actions.BigStrike!'))).toBe(true);
  });

  it('an id field repeated inside a def that mismatches the map key is E-SCHEMA-02 (map-as-namespace)', () => {
    const cards = errorsFor(
      (pack) => ((pack.actions.strike as unknown as Record<string, unknown>).id = 'other'),
    );
    expect(firstRule(cards, 'E-SCHEMA-02')?.jsonPath).toBe('actions.strike.id');
  });

  it('cost must declare at least one of slots/points/vancian', () => {
    const cards = errorsFor(
      (pack) => ((pack.actions.strike as unknown as Record<string, unknown>).cost = undefined),
    );
    expect(
      cards.some((card) => card.jsonPath === 'actions.strike.cost' && card.message.includes('at least one')),
    ).toBe(true);
  });

  it('burst radius is required iff shape is burst', () => {
    const missing = errorsFor((pack) => {
      const targeting = pack.content.spells?.['grave-light']?.targeting;
      if (targeting === undefined) throw new Error('fixture missing targeting');
      delete targeting.radius;
    });
    expect(firstRule(missing, 'E-SCHEMA-01')?.jsonPath).toBe('content.spells.grave-light.targeting.radius');
    const stray = errorsFor((pack) => {
      const targeting = pack.content.spells?.['grave-light']?.targeting;
      if (targeting === undefined) throw new Error('fixture missing targeting');
      (targeting as unknown as { shape: string }).shape = 'single';
    });
    expect(
      stray.some((card) => card.rule === 'E-SCHEMA-02' && card.jsonPath.endsWith('targeting.radius')),
    ).toBe(true);
  });

  it('both attack conventions on one class violates the XOR rule', () => {
    const cards = errorsFor((pack) => {
      const warden = pack.progression.warden;
      if (warden === undefined) throw new Error('fixture missing warden');
      (warden as unknown as Record<string, unknown>).attackBonus = 'level';
    });
    expect(cards.some((card) => card.message.includes('exactly one attack convention'))).toBe(true);
  });

  it('neither attack convention violates the XOR rule too', () => {
    const cards = errorsFor((pack) => {
      const warden = pack.progression.warden;
      if (warden === undefined) throw new Error('fixture missing warden');
      delete warden.attackTable;
    });
    expect(cards.some((card) => card.message.includes('exactly one attack convention'))).toBe(true);
  });
});

describe('semantic pass — one purpose-built fixture per rule id', () => {
  it('E-DUP-01: an id reused across sections is a pack-wide duplicate', () => {
    const cards = errorsFor(
      (pack) => ((pack.content.items as unknown as Record<string, unknown>).strike = { name: 'Strike' }),
    );
    const card = firstRule(cards, 'E-DUP-01');
    expect(card?.artifactId).toBe('strike');
    expect(card?.message).toContain('also defined at');
  });

  it('E-REF-01: statblock action ids must resolve', () => {
    const cards = errorsFor((pack) => {
      const wight = pack.bestiary['barrow-wight'];
      if (wight === undefined) throw new Error('fixture missing wight');
      wight.actions = ['missing-action'];
    });
    const card = firstRule(cards, 'E-REF-01');
    expect(card?.jsonPath).toBe('bestiary.barrow-wight.actions[0]');
    expect(card?.hint).toContain('did you mean');
  });

  it('E-REF-01 (v1.2): class action ids must resolve, with a nearest-id hint', () => {
    const cards = errorsFor((pack) => {
      pack.content.classes!.warden!.actions = ['strike', 'nope'];
    });
    const refs = cards.filter((card) => card.rule === 'E-REF-01');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ artifactId: 'warden', jsonPath: 'content.classes.warden.actions[1]' });
    expect(refs[0]?.hint).toContain('did you mean');
  });

  it('E-SCHEMA-01 (v1.2): class actions are unique (uniqueItems)', () => {
    const cards = errorsFor((pack) => {
      pack.content.classes!.warden!.actions = ['strike', 'strike'];
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ rule: 'E-SCHEMA-01', jsonPath: 'content.classes.warden.actions[1]' });
    expect(cards[0]?.message).toContain('uniqueItems');
  });

  it('E-SCHEMA-01 (v1.2): class actions must be an array of kebab ids', () => {
    const notArray = errorsFor((pack) => {
      (pack.content.classes!.warden! as unknown as Record<string, unknown>).actions = 'strike';
    });
    expect(notArray).toHaveLength(1);
    expect(notArray[0]).toMatchObject({ rule: 'E-SCHEMA-01', jsonPath: 'content.classes.warden.actions' });
    const badId = errorsFor((pack) => {
      (pack.content.classes!.warden! as unknown as Record<string, unknown>).actions = ['Strike!', 7];
    });
    expect(badId.map((card) => [card.rule, card.jsonPath])).toEqual([
      ['E-SCHEMA-01', 'content.classes.warden.actions[0]'],
      ['E-SCHEMA-01', 'content.classes.warden.actions[1]'],
    ]);
  });

  it('v1.2 class actions are optional: absent or resolving lists produce no card', () => {
    expect(VALID_PACK.content.classes?.hexer?.actions).toBeUndefined();
    expect(errorsFor(() => undefined)).toEqual([]);
    expect(errorsFor((pack) => (pack.content.classes!.warden!.actions = ['strike', 'step-aside']))).toEqual(
      [],
    );
    expect(errorsFor((pack) => (pack.content.classes!.warden!.actions = []))).toEqual([]);
  });

  it('E-REF-01: skill ability names must resolve', () => {
    const cards = errorsFor((pack) => {
      const climb = pack.content.skills?.climb;
      if (climb === undefined) throw new Error('fixture missing climb');
      (climb as unknown as Record<string, unknown>).ability = 'wisdom';
    });
    expect(firstRule(cards, 'E-REF-01')?.jsonPath).toBe('content.skills.climb.ability');
  });

  it('E-REF-01: spell lists name declared classes', () => {
    const cards = errorsFor((pack) => {
      const spell = pack.content.spells?.['grave-light'];
      if (spell === undefined) throw new Error('fixture missing grave-light');
      spell.magic.lists = ['phantom'];
    });
    expect(firstRule(cards, 'E-REF-01')?.jsonPath).toBe('content.spells.grave-light.magic.lists[0]');
  });

  it('E-REF-01: statblock attackTable must reference a progression entry', () => {
    const cards = errorsFor((pack) => {
      const wight = pack.bestiary['barrow-wight'];
      if (wight === undefined) throw new Error('fixture missing wight');
      (wight as unknown as Record<string, unknown>).attackTable = 'nope';
    });
    expect(firstRule(cards, 'E-REF-01')?.jsonPath).toBe('bestiary.barrow-wight.attackTable');
  });

  it('E-REF-01: nested table references must resolve', () => {
    const cards = errorsFor((pack) => {
      const entry = pack.tables['loot-chain']?.entries[0];
      if (entry === undefined) throw new Error('fixture missing loot-chain entry');
      (entry as unknown as { value: string }).value = 'tables.nowhere';
    });
    expect(firstRule(cards, 'E-REF-01')?.jsonPath).toBe('tables.loot-chain.entries[0].value');
  });

  it('E-REF-01 (CA-6): missing reserved formula ids hp and ac, with the optional-initiative hint', () => {
    const cards = errorsFor((pack) => delete pack.formulas.hp);
    const card = firstRule(cards, 'E-REF-01');
    expect(card?.artifactId).toBe('hp');
    expect(card?.hint).toContain('initiative');
    const bothGone = errorsFor((pack) => {
      delete pack.formulas.hp;
      delete pack.formulas.ac;
    });
    expect(
      bothGone.filter((c) => c.rule === 'E-REF-01' && (c.artifactId === 'hp' || c.artifactId === 'ac')),
    ).toHaveLength(2);
  });

  it('E-REF-01 (v1.1): restricts patterns must reference a declared action/spell tag', () => {
    const cards = errorsFor((pack) => {
      const sapped = pack.content.conditions?.sapped;
      if (sapped === undefined) throw new Error('fixture missing sapped');
      (sapped as unknown as { restricts: string[] }).restricts = ['actions.tagged:phantom-tag'];
    });
    const card = firstRule(cards, 'E-REF-01');
    expect(card?.jsonPath).toBe('content.conditions.sapped.restricts[0]');
    expect(card?.message).toContain('v1.1 tag integrity');
  });

  it('v1.1 tag integrity accepts a tag declared only by a spell (no false-positive)', () => {
    const cards = errorsFor((pack) => {
      const sapped = pack.content.conditions?.sapped;
      if (sapped === undefined) throw new Error('fixture missing sapped');
      (sapped as unknown as { restricts: string[] }).restricts = ['actions.tagged:casting'];
    });
    expect(
      cards.filter((c) => c.rule === 'E-REF-01' && c.jsonPath.startsWith('content.conditions.sapped')),
    ).toHaveLength(0);
  });

  it('E-REF-02: race caps name declared classes (mock gallery card)', () => {
    const cards = errorsFor((pack) => {
      const hillfolk = pack.content.races?.hillfolk;
      if (hillfolk === undefined) throw new Error('fixture missing hillfolk');
      (hillfolk.caps as unknown as Record<string, unknown>).hexblade = 4;
    });
    const card = firstRule(cards, 'E-REF-02');
    expect(card?.artifactId).toBe('hillfolk');
    expect(card?.hint).toContain('did you mean');
  });

  it('E-REF-03: progression is required for every declared class', () => {
    const cards = errorsFor((pack) => delete pack.progression.hexer);
    const card = firstRule(cards, 'E-REF-03');
    expect(card?.artifactId).toBe('hexer');
    expect(card?.jsonPath).toBe('progression.hexer');
  });

  it('E-REF-03: orphaned progression is the same failure from the other side', () => {
    const cards = errorsFor((pack) => delete pack.content.classes!.hexer);
    const card = firstRule(cards, 'E-REF-03');
    expect(card?.message).toContain('orphaned progression');
  });

  it('E-FORM-01: parse failures surface through the wired checker', () => {
    const cards = errorsFor((pack) => {
      const spell = pack.content.spells?.['grave-light'];
      if (spell === undefined) throw new Error('fixture missing grave-light');
      (spell as unknown as Record<string, unknown>).effect = 42;
    }, stubDslChecker);
    expect(
      cards.some(
        (card) =>
          card.jsonPath === 'content.spells.grave-light.effect' &&
          card.message.includes('non-empty DSL string'),
      ),
    ).toBe(true);
  });

  it('E-FORM-01: a throwing checker is contained as a card, not a crash (never throws, FR-2)', () => {
    const explode: DslChecker = () => {
      throw new Error('boom');
    };
    const cards = errorsFor(() => undefined, explode);
    expect(
      cards.some((card) => card.rule === 'E-FORM-01' && card.message.includes('dsl checker failed')),
    ).toBe(true);
  });

  it('E-FORM-02/-03 ids reach the validator through the checker seam (S03 contract)', () => {
    const checker: DslChecker = (request) =>
      request.expr !== 'smite(everything)'
        ? []
        : [
            {
              severity: 'error',
              artifactId: request.artifactId,
              jsonPath: request.jsonPath,
              rule: 'E-FORM-02',
              message: 'unknown function',
            },
            {
              severity: 'error',
              artifactId: request.artifactId,
              jsonPath: request.jsonPath,
              rule: 'E-FORM-03',
              message: 'did you mean …',
            },
          ];
    const cards = errorsFor((pack) => {
      const strike = pack.actions.strike;
      if (strike === undefined) throw new Error('fixture missing strike');
      (strike as unknown as Record<string, unknown>).effect = 'smite(everything)';
    }, checker);
    expect(cards.filter((card) => card.rule === 'E-FORM-02' || card.rule === 'E-FORM-03')).toHaveLength(2);
  });

  it('E-ECON-01: with economy present, cost slot keys must resolve to turnSlots (v1.1)', () => {
    const cards = errorsFor((pack) => {
      const strike = pack.actions.strike;
      if (strike === undefined) throw new Error('fixture missing strike');
      (strike.cost.slots as unknown as Record<string, number>).quick = 1;
    });
    const card = firstRule(cards, 'E-ECON-01');
    expect(card?.jsonPath).toBe('actions.strike.cost.slots.quick');
    expect(card?.message).toContain('no built-in slot vocabulary');
  });

  it('E-ECON-01: without economy, slot names are pack-free at validation (engine default at play time)', () => {
    const cards = errorsFor((pack) => delete pack.economy);
    expect(cards.filter((card) => card.rule === 'E-ECON-01')).toHaveLength(0);
  });

  it('E-ECON-01: pool ids resolve against the formulas map', () => {
    const cards = errorsFor((pack) => {
      const strike = pack.actions.strike;
      if (strike === undefined) throw new Error('fixture missing strike');
      (strike.cost as unknown as Record<string, unknown>).points = { pool: 'mana', amount: 2 };
    });
    const card = firstRule(cards, 'E-ECON-01');
    expect(card?.jsonPath).toBe('actions.strike.cost.points.pool');
  });

  it('E-TBL-01: weighted entries require a weight >= 1', () => {
    const cards = errorsFor((pack) => {
      const entry = pack.tables['district-scavenge']?.entries[0];
      if (entry === undefined) throw new Error('fixture missing scavenge entry');
      (entry as unknown as Record<string, unknown>).weight = undefined;
    });
    expect(firstRule(cards, 'E-TBL-01')?.jsonPath).toBe('tables.district-scavenge.entries[0].weight');
  });

  it('E-TBL-01: ranged entries require min <= max', () => {
    const cards = errorsFor((pack) => {
      const entry = pack.tables.weather?.entries[0];
      if (entry === undefined) throw new Error('fixture missing weather entry');
      (entry as unknown as Record<string, unknown>).max = 0;
    });
    expect(firstRule(cards, 'E-TBL-01')?.message).toContain('min (1) > max (0)');
  });

  it('E-TBL-01: nesting deeper than the documented bound fails at load, bounded (MAX_TABLE_DEPTH)', () => {
    const pack = clonePack();
    pack.tables = nestedChain(MAX_TABLE_DEPTH) as Pack['tables'];
    const cards = validatePack(pack, stubDslChecker);
    const card = firstRule(cards, 'E-TBL-01');
    expect(card?.message).toContain(`exceeds the documented depth limit (${MAX_TABLE_DEPTH})`);
  });

  it('E-TBL-01: a nesting cycle is caught, not a hang', () => {
    const pack = clonePack();
    pack.tables = {
      'loop-a': { kind: 'nested', entries: [{ value: 'tables.loop-b' }] },
      'loop-b': { kind: 'nested', entries: [{ value: 'tables.loop-a' }] },
    } as Pack['tables'];
    const cards = validatePack(pack, stubDslChecker);
    expect(firstRule(cards, 'E-TBL-01')?.message).toContain('cycle');
  });

  it('the deferred checker (S03 seam default) marks E-FORM-01 with the expression as hint', () => {
    const pack = clonePack();
    const cards = validatePack(pack, deferredDslChecker);
    const deferred = cards.filter((card) => card.rule === 'E-FORM-01' && card.message.includes('deferred'));
    expect(deferred.length).toBeGreaterThanOrEqual(8);
    expect(deferred[0]?.hint).toBeTruthy();
  });

  it('the checker receives abilities/saves vocabulary and expression kind', () => {
    const seen: string[] = [];
    const checker: DslChecker = (request) => {
      seen.push(`${request.kind}:${request.abilities.join(',')}:${request.saves.includes('luck')}`);
      return [];
    };
    errorsFor(() => undefined, checker);
    expect(seen.some((entry) => entry.startsWith('formula:'))).toBe(true);
    expect(seen.some((entry) => entry.startsWith('effect:'))).toBe(true);
  });

  it('picky checker: expressions are routed with their kind and pack vocabulary', () => {
    const cards = errorsFor(() => undefined, pickyChecker);
    const nonFormulaFields = cards.filter(
      (card) =>
        card.jsonPath.endsWith('.effect') ||
        card.jsonPath.endsWith('.passive') ||
        card.jsonPath.includes('attackBonus'),
    );
    expect(nonFormulaFields.length).toBeGreaterThan(0);
    expect(firstRule(cards, 'E-FORM-01')?.artifactId).toBeDefined();
  });
});

describe('all-at-once, never partial (FR-2)', () => {
  it('a pack broken in three places yields all three cards in one pass', () => {
    const cards = errorsFor((pack) => {
      (pack.content.items as unknown as Record<string, unknown>).strike = { name: 'Strike' };
      delete pack.progression.hexer;
      const strike = pack.actions.strike;
      if (strike === undefined) throw new Error('fixture missing strike');
      (strike.cost as unknown as Record<string, unknown>).points = { pool: 'ghost', amount: 2 };
    });
    expect(cards.some((c) => c.rule === 'E-DUP-01')).toBe(true);
    expect(cards.some((c) => c.rule === 'E-REF-03')).toBe(true);
    expect(cards.some((c) => c.rule === 'E-ECON-01')).toBe(true);
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('every card carries the gallery shape (artifactId, jsonPath, rule, message)', () => {
    const cards = errorsFor((pack) => {
      const strike = pack.actions.strike;
      if (strike === undefined) throw new Error('fixture missing strike');
      (strike.cost as unknown as Record<string, unknown>).vancian = 12;
    });
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(typeof card.artifactId).toBe('string');
      expect(card.jsonPath.length).toBeGreaterThan(0);
      expect(card.rule).toMatch(/^E-[A-Z]+-\d\d$/);
      expect(card.message.length).toBeGreaterThan(0);
      expect(card.severity).toBe('error');
    }
  });
});
