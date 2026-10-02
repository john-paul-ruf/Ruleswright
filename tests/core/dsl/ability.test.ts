/**
 * `ability(name)` (v1.7, DD-A4, CA-A3): the actor's ability, unshadowed by a
 * same-named save. Proved through the real checker (`packDslChecker`), the real
 * formula evaluator, the real executor (`executeAgainst` → `effectVars`) and the
 * real validator (`validatePack`, the M01 speed-scan mirror). The only stand-ins
 * are hand-built combatant profiles.
 */
import { describe, expect, it } from 'vitest';
import { packDslChecker } from '../../../src/core/dsl/checker';
import { evalFormula, parseFormula, valueOfFormula } from '../../../src/core/dsl/formula';
import { parseEffect } from '../../../src/core/dsl/effect';
import { Rng } from '../../../src/core/rng';
import {
  executeAgainst,
  type BoundCombatant,
  type CombatantProfile,
  type MutationRequest,
} from '../../../src/runtime/combat/resolve';
import { validatePack, type DslCheckRequest } from '../../../src/schema/validate';
import { clonePack } from '../../schema/fixtures';

function check(expr: string, kind: DslCheckRequest['kind'] = 'effect') {
  return packDslChecker({
    expr,
    kind,
    artifactId: 'med-kit',
    jsonPath: 'content.items.med-kit.use',
    abilities: ['vigor', 'might'],
    saves: ['vigor', 'reflex'],
  });
}

describe('ability(name) — checking (CA-A3)', () => {
  it('(a) is legal in an effect field', () => {
    expect(check('heal(2 + ability(vigor))')).toEqual([]);
    expect(check('damage(1d6 + ability(might))')).toEqual([]);
  });

  it('(b) is E-FORM-02 in every non-effect field', () => {
    for (const kind of ['formula', 'valid', 'passive', 'attackBonus'] as const) {
      const expr = kind === 'valid' ? 'ability(vigor) >= 10' : '2 + ability(vigor)';
      const cards = check(expr, kind);
      expect(
        cards.map((card) => card.rule),
        kind,
      ).toEqual(['E-FORM-02']);
      expect(cards[0]!.message, kind).toMatch(/legal only inside effects/);
    }
  });

  it('(c) an undeclared ability is E-FORM-03 with did-you-mean over the abilities', () => {
    const cards = check('heal(ability(vigr))');
    expect(cards.map((card) => card.rule)).toEqual(['E-FORM-03']);
    expect(cards[0]!.hint).toBe('did you mean "vigor"?');
  });

  it('(c) a declared save that is not an ability is still E-FORM-03', () => {
    expect(check('heal(ability(reflex))').map((card) => card.rule)).toEqual(['E-FORM-03']);
  });

  it('(d) a non-name argument or a wrong arity is E-FORM-02', () => {
    for (const expr of ['heal(ability(1))', 'heal(ability(vigor, might))', 'heal(ability())']) {
      expect(
        check(expr).map((card) => card.rule),
        expr,
      ).toEqual(['E-FORM-02']);
    }
  });
});

describe('ability(name) — evaluation (CA-A3)', () => {
  const ast = (() => {
    const parsed = parseFormula('2 + ability(vigor)');
    if (!parsed.ok) throw new Error(parsed.reason);
    return parsed.value;
  })();

  it('(e) reads the reserved ability:<name> key, not the bare (save-shadowed) name', () => {
    const value = evalFormula(ast, { vigor: 0, 'ability:vigor': 10 }, new Rng('ability'));
    expect(valueOfFormula(value)).toBe(12);
  });

  it('(e) a missing binding throws (fail closed)', () => {
    expect(() => evalFormula(ast, { vigor: 10 }, new Rng('ability'))).toThrow(
      /ability\("vigor"\) has no binding/,
    );
  });
});

describe('ability(name) — the combat binding (effectVars, CA-A3)', () => {
  function combatant(
    id: string,
    side: 'allies' | 'enemies',
    vigorAbility: number,
    vigorSave: number,
  ): BoundCombatant {
    const profile: CombatantProfile = {
      id,
      abilities: { vigor: vigorAbility, might: 10 },
      saves: { vigor: vigorSave },
      level: 1,
      hp: 20,
      ac: 10,
      initiativeBonus: 0,
      actions: [],
    };
    return { id, side, profile };
  }

  function healAmounts(
    effect: string,
    actor: BoundCombatant,
    target: BoundCombatant,
  ): (number | undefined)[] {
    const parsed = parseEffect(effect);
    if (!parsed.ok) throw new Error(parsed.reason);
    const requests: MutationRequest[] = [];
    executeAgainst(
      { id: 'mend', def: { cost: { slots: { action: 1 } }, effect }, ast: parsed.value },
      actor,
      target,
      new Rng('ability'),
      (request) => requests.push(request),
    );
    return requests.map((request) => request.amount);
  }

  const medic = combatant('medic', 'allies', 10, 0);

  it('(f) ability(vigor) reads the actor ability (10), not the same-named save (0)', () => {
    expect(healAmounts('heal(2 + ability(vigor))', medic, medic)).toEqual([-12]);
  });

  it('(f) the bare name keeps reading the save (the shadowing is unchanged)', () => {
    expect(healAmounts('heal(2 + vigor)', medic, medic)).toEqual([-2]);
  });

  it("(g) on an ally target, the actor's ability is read, never the target's", () => {
    const ally = combatant('ally', 'allies', 3, 7);
    expect(healAmounts('heal(2 + ability(vigor))', medic, ally)).toEqual([-12]);
  });
});

describe('ability(name) — the M01 speed-scan mirror (NON_FORMULA_ARGS.ability = [0])', () => {
  function itemUseCards(use: string) {
    const pack = clonePack();
    pack.stats.abilities = [...pack.stats.abilities, 'speed'];
    pack.content.items!['tonic'] = { name: 'Tonic', use };
    return validatePack(pack, packDslChecker).filter((card) => card.jsonPath === 'content.items.tonic.use');
  }

  it('(h) ability(speed) is a name position — no E-REF-01 without formulas.speed', () => {
    expect(itemUseCards('heal(ability(speed))')).toEqual([]);
  });

  it('(h) negative control: a bare speed reference still trips E-REF-01', () => {
    expect(itemUseCards('heal(speed)').map((card) => card.rule)).toEqual(['E-REF-01']);
  });
});
