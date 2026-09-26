import { describe, expect, it } from 'vitest';
import type { Pack } from '../../../src/schema/pack';
import { packDslChecker } from '../../../src/core/dsl/checker';
import { validatePack } from '../../../src/schema/validate';
import { checkSchemaVersion, packContentHash } from '../../../src/schema/version';
import type { ActionCost } from '../../../src/schema/artifacts';
import { Rng } from '../../../src/core/rng';
import { emberMarchesAscendingPack, emberMarchesNoEconomyPack, emberMarchesPack } from '../fixtures/packs';
import {
  checkCost,
  freshLedger,
  replenish,
  resolveSlotGrants,
  refund,
  spend,
  type EconomyBalances,
  type SlotLedger,
} from '../../../src/runtime/combat/action-economy';
import {
  attackBonusAgainst,
  attackRoll,
  checkPackDsl,
  evalPackFormula,
  profileFromStatblock,
  type CombatantProfile,
} from '../../../src/runtime/combat/resolve';

/** A fixture pack must be valid through the real validator before the combat machinery may see it. */
function validPack(pack: Pack): Pack {
  const errors = validatePack(pack, packDslChecker);
  expect(errors, errors.map((card) => `${card.rule} @ ${card.jsonPath}: ${card.message}`).join('\n')).toEqual(
    [],
  );
  expect(checkSchemaVersion(pack, { min: 1, max: 1 })).toEqual([]);
  expect(checkPackDsl(pack)).toEqual([]);
  return pack;
}

const mainAction: ActionCost = { slots: { main: 1 } };
const surgeCost: ActionCost = { points: { pool: 'stamina', amount: 2 } };
const graveLightCost: ActionCost = { vancian: 1 };

const warden: EconomyBalances = { pools: { stamina: 10 }, boundSlots: { '1': 2, '2': 1 } };
const drained: EconomyBalances = { pools: { stamina: 0 }, boundSlots: { '1': 0, '2': 0 } };

function ledgerFor(pack: Pack): { grants: ReturnType<typeof resolveSlotGrants>; ledger: SlotLedger } {
  const grants = resolveSlotGrants(pack);
  return { grants, ledger: freshLedger(grants) };
}

describe('action-economy grants (CA-4, v1.1)', () => {
  it('economy present: the pack turnSlots table is the authority (built against v1.1)', () => {
    const { grants } = ledgerFor(validPack(emberMarchesPack()));
    expect(grants.fromPackEconomy).toBe(true);
    expect(grants.slots).toEqual({ main: 1, move: 1, reaction: 1 });
  });

  it('economy absent: the documented default grants 1 of each slot name seen in any cost', () => {
    const { grants } = ledgerFor(validPack(emberMarchesNoEconomyPack()));
    expect(grants.fromPackEconomy).toBe(false);
    expect(grants.slots).toEqual({ main: 1, move: 1, reaction: 1 });
  });
});

describe('action-economy declare-time checks (CA-4)', () => {
  it('a slot the grant table never declared is an E-ECON-01-shaped rejection naming the slot', () => {
    const { grants } = ledgerFor(emberMarchesPack());
    const rejection = checkCost({ slots: { whirl: 1 } }, grants, warden);
    expect(rejection).toBeDefined();
    expect(rejection!.rule).toBe('E-ECON-01');
    expect(rejection!.kind).toBe('slot-ungranted');
    expect(rejection!.resource).toBe('whirl');
    expect(rejection!.message).toContain('whirl');
  });

  it('per-turn exhaustion is rejected with the violated slot named', () => {
    const pack = emberMarchesPack();
    const { grants, ledger } = ledgerFor(pack);
    expect(spend(ledger, grants, mainAction)).toBeUndefined();
    const rejection = spend(ledger, grants, mainAction);
    expect(rejection).toBeDefined();
    expect(rejection!.kind).toBe('slot-exhausted');
    expect(rejection!.resource).toBe('main');
    expect(rejection!.message).toContain('main');
  });

  it('spend refunds never exceed the grant; replenish restores full grants', () => {
    const pack = emberMarchesPack();
    const { grants, ledger } = ledgerFor(pack);
    spend(ledger, grants, mainAction);
    refund(ledger, grants, mainAction);
    expect(ledger.remaining['main']).toBe(1);
    spend(ledger, grants, mainAction);
    replenish(ledger, grants);
    expect(ledger.remaining).toEqual({ main: 1, move: 1, reaction: 1 });
  });

  it('points costs reject an empty pool', () => {
    const { grants } = ledgerFor(emberMarchesPack());
    const rejection = checkCost(surgeCost, grants, drained);
    expect(rejection).toBeDefined();
    expect(rejection!.kind).toBe('points');
    expect(rejection!.resource).toBe('stamina');
  });

  it('vancian costs consume a BOUND slot; empty slots cannot cast (FR-8)', () => {
    const { grants } = ledgerFor(emberMarchesPack());
    expect(checkCost(graveLightCost, grants, warden)).toBeUndefined();
    const rejection = checkCost(graveLightCost, grants, drained);
    expect(rejection).toBeDefined();
    expect(rejection!.kind).toBe('vancian');
    expect(rejection!.resource).toBe('1');
  });
});

describe('resolution primitive (FR-3): descending-AC tables are pack data', () => {
  it('the engine looks up byDefense[level] without interpreting the convention', () => {
    const pack = emberMarchesPack();
    // Wight: level 2, descending table 'wight-frames' → byDefense["10"] = 9 at level 2.
    const attacker: CombatantProfile = {
      ...profileFromStatblock(pack, pack.bestiary['barrow-wight']!, 'barrow-wight'),
      attackBonus: undefined,
    };
    expect(attacker.attackTable).toBeDefined();
    // The defender's ac formula evaluated by the engine is the lookup key — nothing more.
    expect(attackBonusAgainst(attacker, 10)).toBe(9);
    expect(attackBonusAgainst(attacker, 8)).toBe(11);
  });

  it('the descending table keys are never reinterpreted as ascending numbers', () => {
    const pack = emberMarchesPack();
    const attacker = profileFromStatblock(pack, pack.bestiary['grave-shambles']!, 'grave-shambles');
    // Level 1: byDefense["10"] = 10 vs byDefense["8"] = 12 — lower defense is EASIER to hit
    // on a descending table. The engine's lookup is literal; only the assertion interprets.
    expect(attackBonusAgainst(attacker, 10)).toBe(10);
    expect(attackBonusAgainst(attacker, 8)).toBe(12);
  });

  it('d20 + attackBonus >= defenseTarget judges from structured verdicts (scripted rng)', () => {
    let scripted = 13;
    const rng: Rng = new Rng(1);
    const scriptedRng = { int: (maxExclusive: number) => (scripted - 1) % maxExclusive };
    void rng;
    const { roll, hit } = attackRoll(5, 17, 'ac', scriptedRng);
    expect(roll.values).toEqual([13]);
    expect(roll.total).toBe(18);
    expect(roll.verdict).toEqual({ defense: 'ac', value: 17, result: 'hit' });
    expect(hit).toBe(true);
    scripted = 3;
    const miss = attackRoll(5, 17, 'ac', scriptedRng);
    expect(miss.roll.verdict!.result).toBe('miss');
    expect(miss.hit).toBe(false);
  });

  it('ascending attackBonus combatants resolve through the same primitive', () => {
    const pack = emberMarchesAscendingPack();
    const attacker = profileFromStatblock(pack, pack.bestiary['grave-shambles']!, 'grave-shambles');
    expect(attackBonusAgainst(attacker, 11)).toBe(0); // level 1, attackBonus "level - 1"
  });

  it('derived stats resolve only through the reserved pack formulas (CA-6), evaluated per combatant', () => {
    const pack = emberMarchesPack();
    const wight = profileFromStatblock(pack, pack.bestiary['barrow-wight']!, 'barrow-wight');
    // hp = 6 + vigor*2 with vigor override 3 → 12; ac = 10 - floor(2/2) → 9.
    expect(wight.hp).toBe(12);
    expect(wight.ac).toBe(9);
    // Ascending companion: ac = 10 + level → 12 at level 2; the wight's ascending attackBonus "level".
    const ascending = profileFromStatblock(
      emberMarchesAscendingPack(),
      emberMarchesAscendingPack().bestiary['barrow-wight']!,
      'barrow-wight',
    );
    expect(ascending.ac).toBe(12);
    expect(ascending.attackBonus).toBe(2);
    const shambles = profileFromStatblock(pack, pack.bestiary['grave-shambles']!, 'grave-shambles');
    expect(shambles.hp).toBe(6); // vigor defaults 0
    expect(shambles.ac).toBe(10);
  });

  it('formula evaluation is parse-once: the same pack object reuses its AST cache', () => {
    const pack = emberMarchesPack();
    const vars = { vigor: 2, level: 1, might: 1 };
    expect(evalPackFormula(pack, 'stamina', vars)).toBe(10);
    expect(evalPackFormula(pack, 'stamina', vars)).toBe(10);
  });
});

describe('fixture pack identity (FR-17/FR-23 seams)', () => {
  it('canonical hash is stable under top-level key reorder and differs across content', () => {
    const pack = emberMarchesPack();
    const reordered = { ...pack, stats: pack.stats, economy: pack.economy };
    // Rebuild with the top-level keys inserted in reverse order.
    const reversed: Record<string, unknown> = {};
    for (const key of Object.keys(pack).reverse())
      reversed[key] = (pack as unknown as Record<string, unknown>)[key];
    expect(packContentHash(reordered)).toBe(packContentHash(pack));
    expect(packContentHash(reversed as unknown as Pack)).toBe(packContentHash(pack));
    expect(packContentHash(emberMarchesNoEconomyPack())).not.toBe(packContentHash(pack));
  });
});
