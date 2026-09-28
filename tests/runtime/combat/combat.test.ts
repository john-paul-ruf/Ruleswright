import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/core/rng';
import { emberMarchesPack } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import {
  startCombat,
  Combat,
  displayRoll,
  type CombatantState,
  type StepOutcome,
} from '../../../src/runtime/combat/combat';
import type { RuntimeEvent } from '../../../src/runtime/events';
import {
  serializeCombat,
  deserializeCombat,
  type CombatRestoreRequest,
} from '../../../src/runtime/snapshots';

/**
 * The first narrow journey (program-level, CAP-6): generate (fixture pack) →
 * validate (real validatePack through Runtime) → character (profile
 * machinery) → combat (stepwise loop) → event-with-why. The full
 * `generateCampaign` journey runs in S08 against the built package.
 */
function journeyFight(): { fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(emberMarchesPack());
  const seen: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    seen.push(event);
  });
  // Brynn: a warden-frame combatant with the strike action; wight: the bestiary's claw.
  const brynn: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
    actions: ['strike'],
  };
  const wight: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
    actions: ['wight-claw'],
  };
  const fight = startCombat(runtime, {
    allies: [{ id: 'brynn', profile: brynn }],
    enemies: [{ id: 'wight', profile: wight }],
    rng: new Rng('journey'),
  });
  return { fight, events: seen };
}

function combatant(fight: Combat, id: string): CombatantState {
  return fight.state.combatants[id]!;
}

/** Step until the named combatant may declare. */
function stepToDeclare(fight: Combat, id: string, skipWith = 'withdraw'): void {
  for (let guard = 0; guard < 20; guard += 1) {
    if (fight.state.phase === 'awaiting-declare' && fight.state.active === id) return;
    if (fight.state.phase === 'awaiting-declare') {
      fight.declare(skipWith); // harmless skip: advances the loop without touching the awaited turn
    }
    const outcome: StepOutcome = fight.step();
    if (outcome.kind === 'combat-over') throw new Error('combat ended before the awaited turn');
  }
  throw new Error(
    `never reached ${id}'s declare phase (phase=${fight.state.phase}, active=${fight.state.active})`,
  );
}
describe('the first narrow journey (program-level, CAP-6)', () => {
  it('runs fixture pack → validate → profiles → stepwise combat → event-with-why through the real production path', () => {
    const { fight, events } = journeyFight();
    // Validate: Runtime(emberMarchesPack()) passed the real validator at load — reaching here proves it.
    expect(fight.state.order.length).toBe(2);
    // Combat: step to a turn, declare through the real pack data, resolve through S03's executor.
    stepToDeclare(fight, 'wight');
    fight.step(); // turn:began
    fight.declare('wight-claw');
    // The event stream carries the provenanced damage event (combat-loop.html's anatomy, verbatim fields).
    const damage = events.find((event) => event.type === 'damage:applied');
    expect(damage).toBeDefined();
    expect(Object.keys(damage!).sort()).toEqual(['actor', 'at', 'payload', 'target', 'type', 'why']);
    expect(damage!.actor).toBe('wight');
    expect(damage!.target).toBe('brynn');
    expect(damage!.payload['amount']).toBeTypeOf('number');
    expect(String(damage!.payload['hp'])).toMatch(/→/);
    expect(damage!.why.rule).toBe('actions.wight-claw');
    expect(damage!.why.rolls.length).toBeGreaterThan(0);
    expect(damage!.why.rolls[0]).toMatch(/^d6\[\d+\]=\d+$/);
    // The attack roll preceded it with its verdict (combat-loop.html's attack:rolled row).
    const attack = events.find((event) => event.type === 'attack:rolled');
    expect(attack).toBeDefined();
    expect(attack!.why.rule).toBe('actions.wight-claw.attackBonus');
    expect(attack!.why.rolls[0]).toMatch(/≥ ac\d+|< ac\d+/);
    // Damage actually mutated state: brynn started at the reserved formula's 12 hp.
    expect(combatant(fight, 'brynn').hp.current).toBeLessThan(12);
  });

  it('events.at increments per round/turn (CA-3 clock discipline)', () => {
    const { fight, events } = journeyFight();
    fight.step();
    stepToDeclare(fight, 'wight');
    fight.step();
    fight.declare('wight-claw');
    const began = events.find((event) => event.type === 'turn:began');
    expect(began!.at).toEqual({ round: 1, turn: 0 });
    const damage = events.find((event) => event.type === 'damage:applied');
    expect(damage!.at.round).toBe(1);
  });
});

describe('stepwise boundaries (FR-10)', () => {
  it('step() advances one phase at a time; the host may act between any two steps', () => {
    const { fight } = journeyFight();
    const first = fight.step();
    expect(first.kind).toBe('turn-started');
    // Idempotence boundary: the state is whole between steps; serialize → the same shape.
    const snap = fight.serialize();
    expect(snap.phase).toBe('awaiting-declare');
    expect(snap.order).toEqual(fight.state.order);
    expect(() => fight.step()).not.toThrow();
  });

  it('a full round advances every combatant once and completes', () => {
    const { fight, events } = journeyFight();
    const actors: string[] = [];
    for (let guard = 0; guard < 12 && fight.state.round === 1; guard += 1) {
      if (fight.state.phase === 'awaiting-declare') {
        if (fight.state.active === 'wight') fight.declare('wight-claw');
        else fight.declare('strike');
        actors.push(fight.state.active);
      }
      fight.step();
    }
    expect(actors.length).toBe(2);
    expect(new Set(actors)).toEqual(new Set(['wight', 'brynn']));
    expect(fight.state.round).toBe(2);
    expect(events.some((event) => event.type === 'round:completed')).toBe(true);
  });

  it('slot exhaustion across a turn is rejected with the violated slot; replenish restores next turn', () => {
    const { fight, events } = journeyFight();
    fight.step();
    fight.declare('wight-claw');
    // Same turn again: main is spent.
    const second = fight.declare('wight-claw');
    expect(second[0]!.type).toBe('declare:rejected');
    expect(second[0]!.payload['kind']).toBe('slot-exhausted');
    expect(String(second[0]!.payload['resource'])).toBe('main');
    // Advance to brynn and back to wight: round 2 replenishes (fresh ledger at turn start).
    fight.step(); // end wight's turn
    fight.step(); // brynn's turn begins
    fight.declare('strike');
    expect(fight.state.combatants['brynn']!.slots.remaining['main']).toBe(0);
    fight.step(); // end brynn's turn → round 2
    fight.step(); // wight's turn 2 begins
    expect(fight.state.combatants['wight']!.slots.remaining['main']).toBe(1);
    expect(events.some((event) => event.type === 'round:completed')).toBe(true);
  });
});

describe('combat state is plain JSON (FR-14)', () => {
  it('deep-clones and round-trips through JSON verbatim', () => {
    const { fight } = journeyFight();
    fight.step();
    fight.declare('wight-claw');
    const snap = fight.serialize();
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    expect(snap.combatants['wight']!.slots).toBeDefined();
    expect(snap.rng).toEqual({
      a: expect.any(Number),
      b: expect.any(Number),
      c: expect.any(Number),
      d: expect.any(Number),
    });
  });

  it('a resumed fight rolls the same future as an uninterrupted one (FR-14 resume discipline)', () => {
    const runtime = new Runtime(emberMarchesPack());
    const brynn: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
      actions: ['strike', 'withdraw'],
    };
    const wight: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
      actions: ['wight-claw'],
    };
    const make = () =>
      startCombat(runtime, {
        allies: [{ id: 'brynn', profile: brynn }],
        enemies: [{ id: 'wight', profile: wight }],
        rng: new Rng(77),
      });
    const uninterrupted = make();
    const resumable = make();
    for (let i = 0; i < 3; i += 1) {
      uninterrupted.step();
      resumable.step();
    }
    // Freeze mid-fight and resume from the snapshot's rng state: the next
    // roll must equal the uninterrupted fight's next roll (FR-14, testable).
    const snap = resumable.serialize();
    const resumed = new Combat(runtime, snap, new Rng(snap.rng));
    stepToDeclare(uninterrupted, 'wight');
    uninterrupted.step();
    uninterrupted.declare('wight-claw');
    stepToDeclare(resumed, 'wight');
    resumed.step();
    resumed.declare('wight-claw');
    const damageA = uninterrupted.eventsSince(1).find((event) => event.type === 'damage:applied');
    const damageB = resumed
      .eventsSince(1)
      .filter((event) => event.type === 'damage:applied')
      .pop();
    expect(damageB).toBeDefined();
    expect(damageA!.payload).toEqual(damageB!.payload);
  });
});

describe('declare-time gates (CA-4 at play)', () => {
  it('rejects an action the combatant does not have', () => {
    const { fight } = journeyFight();
    fight.step();
    const events = fight.declare('shamble-swing');
    expect(events[0]!.type).toBe('declare:rejected');
    expect(events[0]!.payload['kind']).toBe('no-action');
  });

  it('rejects a slotted action with an exhausted ledger before any mutation', () => {
    const { fight } = journeyFight();
    fight.step();
    fight.declare('wight-claw');
    const before = fight.serialize();
    const events = fight.declare('wight-claw');
    expect(events[0]!.type).toBe('declare:rejected');
    expect(fight.serialize()).toEqual(before);
  });

  it('the restricts matcher blocks tagged actions through the pack index (v1.1, FR-9 spells included)', () => {
    const runtime = new Runtime(emberMarchesPack());
    const caster: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'hexling'),
      actions: ['grave-gaze'],
    };
    const victim: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['grave-shambles']!, 'hexling'),
      actions: ['withdraw'],
    };
    const fight = startCombat(runtime, {
      allies: [{ id: 'hexling', profile: caster }],
      enemies: [{ id: 'dummy', profile: victim }],
      rng: new Rng(3),
    });
    fight.step();
    // grave-gaze applies hexbound on a failed save; hexbound restricts actions.tagged:casting.
    fight.declare('grave-gaze');
    expect(fight.state.combatants['dummy']!.conditions.length).toBeGreaterThan(0);
    // Now a casting action on the hexbound combatant must be blocked... but the
    // condition landed on the dummy. Apply it to the actor to prove the teeth:
    fight.state.combatants['hexling']!.conditions.push({ conditionId: 'hexbound', duration: 3 });
    fight.step(); // end turn
    stepToDeclare(fight, 'hexling');
    fight.step(); // turn:began
    const blocked = fight.declare('grave-gaze');
    expect(blocked[0]!.type).toBe('declare:rejected');
    expect(blocked[0]!.payload['kind']).toBe('restricted');
  });
});

describe('displayRoll — the mock\u2019s roll anatomy', () => {
  it('renders the combat-loop.html roll strings verbatim', () => {
    expect(
      displayRoll({
        purpose: 'attack',
        sides: 20,
        values: [14],
        modifier: 3,
        total: 17,
        verdict: { defense: 'ac', value: 15, result: 'hit' },
      }),
    ).toBe('d20[14]+3=17 ≥ ac15');
    expect(displayRoll({ purpose: 'damage', sides: 6, values: [4], modifier: 2, total: 6 })).toBe(
      'd6[4]+2=6',
    );
  });
});

/**
 * The end-of-combat rule (D-26, engine-universal): after any resolution, when
 * every combatant on one side is at hp ≤ 0 the fight is `combat-over` and one
 * `combat:ended` event names the winner; downed combatants take no turns and
 * are offered no triggers. `surge` (unconditional 2d6) makes the killing blow
 * deterministic; initiative bonuses pin the turn order.
 */
interface RuleCombatant {
  readonly id: string;
  readonly actions: readonly string[];
  readonly hp?: number;
  readonly initiativeBonus: number;
}

function ruleProfile(
  runtime: Runtime,
  member: RuleCombatant,
): { id: string; profile: CombatantProfile; balances: { pools: Record<string, number> } } {
  const base = profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, member.id);
  return {
    id: member.id,
    profile: {
      ...base,
      actions: [...member.actions],
      hp: member.hp ?? base.hp,
      initiativeBonus: member.initiativeBonus,
    },
    balances: { pools: { stamina: 10 } },
  };
}

function ruleSides(
  runtime: Runtime,
  allies: readonly RuleCombatant[],
  enemies: readonly RuleCombatant[],
): CombatRestoreRequest {
  return {
    allies: allies.map((member) => ruleProfile(runtime, member)),
    enemies: enemies.map((member) => ruleProfile(runtime, member)),
  };
}

function ruleFight(
  allies: readonly RuleCombatant[],
  enemies: readonly RuleCombatant[],
): { runtime: Runtime; fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(emberMarchesPack());
  const events: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    events.push(event);
  });
  const fight = startCombat(runtime, { ...ruleSides(runtime, allies, enemies), rng: new Rng('end-rule') });
  return { runtime, fight, events };
}

const BRYNN: RuleCombatant = { id: 'brynn', actions: ['surge'], initiativeBonus: 100 };
const WIGHT_AT_1: RuleCombatant = { id: 'wight', actions: ['wight-claw'], hp: 1, initiativeBonus: 0 };
const GHOUL: RuleCombatant = { id: 'ghoul', actions: ['wight-claw'], hp: 40, initiativeBonus: 50 };

function lastSideDefeated(): ReturnType<typeof ruleFight> {
  const setup = ruleFight([BRYNN], [WIGHT_AT_1]);
  expect(setup.fight.step().kind).toBe('turn-started');
  expect(setup.fight.state.active).toBe('brynn');
  setup.fight.declare('surge');
  return setup;
}

describe('the end-of-combat rule (D-26: combat.sideDefeated)', () => {
  it('the last standing enemy downed → combat-over, one combat:ended naming the winner, guards hold', () => {
    const { fight, events } = lastSideDefeated();
    expect(fight.state.combatants['wight']!.hp.current).toBeLessThanOrEqual(0);
    expect(fight.state.phase).toBe('combat-over');
    const ended = events.filter((event) => event.type === 'combat:ended');
    expect(ended).toHaveLength(1);
    expect(ended[0]!.why).toEqual({ rule: 'combat.sideDefeated', rolls: [] });
    expect(ended[0]!.payload).toEqual({ winner: 'allies', defeated: 'enemies' });
    expect(events[events.length - 2]!.type).toBe('action:resolved');
    expect(events[events.length - 1]).toBe(ended[0]);
    expect(fight.pendingTriggers).toEqual([]);

    const count = events.length;
    expect(fight.step()).toEqual({ kind: 'combat-over' });
    expect(fight.step()).toEqual({ kind: 'combat-over' });
    expect(() => fight.declare('surge')).toThrow('combat is over');
    expect(events).toHaveLength(count);
  });

  it('no-change path: a downed enemy with a standing ally leaves the fight running, and the downed turn is skipped', () => {
    const { fight, events } = ruleFight([BRYNN], [WIGHT_AT_1, GHOUL]);
    expect(fight.state.order).toEqual(['brynn', 'ghoul', 'wight']);
    fight.step();
    fight.declare('surge', { targetId: 'wight' });
    expect(fight.state.combatants['wight']!.hp.current).toBeLessThanOrEqual(0);
    expect(fight.state.phase).toBe('resolved');
    expect(events.some((event) => event.type === 'combat:ended')).toBe(false);

    expect(fight.step()).toEqual({ kind: 'turn-ended', combatantId: 'brynn' });
    expect(fight.state.active).toBe('ghoul');
    fight.step();
    fight.declare('wight-claw');
    // Ghoul's turn ends and the downed wight is passed over: the round completes.
    expect(fight.step()).toEqual({ kind: 'round-completed', round: 1 });
    expect(fight.state.active).toBe('brynn');
    expect(fight.state.phase).toBe('awaiting-declare');
    expect(events.filter((event) => event.type === 'turn:began').map((event) => event.actor)).toEqual([
      'brynn',
      'ghoul',
    ]);
  });

  it('a downed combatant is offered no trigger; the same attack on a standing one is', () => {
    const attackSentry = (sentryHp: number | undefined) => {
      const setup = ruleFight(
        [
          { id: 'sentry', actions: ['parry'], hp: sentryHp, initiativeBonus: 50 },
          { id: 'brynn', actions: ['surge'], initiativeBonus: 0 },
        ],
        [{ id: 'wight', actions: ['wight-claw'], initiativeBonus: 100 }],
      );
      expect(setup.fight.state.order).toEqual(['wight', 'sentry', 'brynn']);
      setup.fight.step();
      setup.fight.declare('wight-claw', { targetId: 'sentry' });
      return setup;
    };

    const standing = attackSentry(undefined);
    expect(standing.fight.pendingTriggers.map((offer) => offer.triggerId)).toEqual(['sentry.parry']);

    const downed = attackSentry(0);
    expect(downed.fight.pendingTriggers).toEqual([]);
    expect(downed.events.some((event) => event.type === 'trigger:fired')).toBe(false);
    expect(downed.fight.state.phase).toBe('resolved');
    // The downed sentry's turn is skipped: the wight hands straight to brynn.
    expect(downed.fight.step()).toEqual({ kind: 'turn-ended', combatantId: 'wight' });
    expect(downed.fight.state.active).toBe('brynn');
  });

  it('serialize at combat-over → deserialize → still combat-over', () => {
    const { fight } = lastSideDefeated();
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const fresh = new Runtime(emberMarchesPack());
    const restored = deserializeCombat(
      fresh,
      JSON.parse(JSON.stringify(snap)),
      ruleSides(fresh, [BRYNN], [WIGHT_AT_1]),
    );
    expect(restored.state.phase).toBe('combat-over');
    expect(restored.step()).toEqual({ kind: 'combat-over' });
    expect(() => restored.declare('surge')).toThrow('combat is over');
    expect(new Combat(fresh, fight.serialize()).state.phase).toBe('combat-over');
  });

  it('a mid-fight snapshot (one side partly downed) restores exactly as before: awaiting-declare at the frozen turn', () => {
    const { fight } = ruleFight([BRYNN], [WIGHT_AT_1, GHOUL]);
    fight.step();
    fight.declare('surge', { targetId: 'wight' });
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const fresh = new Runtime(emberMarchesPack());
    const restored = deserializeCombat(
      fresh,
      JSON.parse(JSON.stringify(snap)),
      ruleSides(fresh, [BRYNN], [WIGHT_AT_1, GHOUL]),
    );
    expect(restored.state.phase).toBe('awaiting-declare');
    expect(restored.state.round).toBe(1);
    expect(restored.state.turn).toBe(0);
    expect(restored.state.active).toBe('brynn');
    expect(restored.state.order).toEqual(fight.state.order);
    for (const id of fight.state.order) {
      expect(restored.state.combatants[id]!.hp.current).toBe(fight.state.combatants[id]!.hp.current);
    }
    expect(restored.state.rng).toEqual(fight.state.rng);
  });
});

/**
 * CAP-E4 combat leg / CA-EG4 / CA-EG5 (equipment-consumables S05 ck2): `fight.use`
 * spends a host-stated item charge and runs the item's `use` effect through the
 * executor; a heal is a negative-amount damage mutation clamped at `maxHp` (R-2).
 * `field-dose` (heal(5)) is added in-test; `mend-salve` (heal(1d6 + 2)) and
 * `scale-coat` (no use) are the fixture's.
 */
interface ItemSide {
  readonly id: string;
  readonly hp?: number;
  readonly maxHp?: number;
  readonly actions?: readonly string[];
  readonly initiativeBonus: number;
  readonly items?: Readonly<Record<string, number>>;
}

function itemFight(
  allies: readonly ItemSide[],
  enemies: readonly ItemSide[] = [{ id: 'wight', actions: ['wight-claw'], initiativeBonus: 0 }],
): { fight: Combat; events: RuntimeEvent[] } {
  const pack = emberMarchesPack();
  pack.content.items!['field-dose'] = { name: 'Field Dose', kind: 'consumable', use: 'heal(5)' };
  const runtime = new Runtime(pack);
  const events: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    events.push(event);
  });
  const side = (member: ItemSide) => {
    const base = profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, member.id);
    return {
      id: member.id,
      profile: {
        ...base,
        actions: [...(member.actions ?? ['withdraw'])],
        hp: member.hp ?? base.hp,
        maxHp: member.maxHp ?? base.maxHp,
        initiativeBonus: member.initiativeBonus,
      },
      balances: { pools: { stamina: 10 }, items: { ...(member.items ?? {}) } },
    };
  };
  const fight = startCombat(runtime, {
    allies: allies.map(side),
    enemies: enemies.map(side),
    rng: new Rng('item-use'),
  });
  fight.step(); // the first ally's turn begins
  return { fight, events };
}

const MEDIC: ItemSide = { id: 'brynn', initiativeBonus: 100, items: { 'field-dose': 2, 'mend-salve': 1 } };

describe('fight.use — consumables in combat (CAP-E4, CA-EG4, CA-EG5)', () => {
  it('heals a damaged ally by the roll, clamped at maxHp, with exact before→after', () => {
    const { fight, events } = itemFight([MEDIC, { id: 'sera', hp: 4, maxHp: 12, initiativeBonus: 50 }]);
    expect(fight.state.active).toBe('brynn');
    const first = fight.use('field-dose', { target: 'sera' });
    expect(first.map((event) => event.type)).toEqual(['item:used', 'damage:applied']);
    expect(first[0]!.payload).toEqual({ itemId: 'field-dose', remaining: 1 });
    expect(first[1]!.actor).toBe('brynn');
    expect(first[1]!.target).toBe('sera');
    expect(first[1]!.payload).toEqual({ amount: -5, type: undefined, hp: '4→9' });
    const second = fight.use('field-dose', { target: 'sera' });
    expect(second[1]!.payload['amount']).toBe(-5);
    expect(second[1]!.payload['hp']).toBe('9→12');
    expect(fight.state.combatants['sera']!.hp.current).toBe(12);
    expect(fight.state.combatants['brynn']!.itemsUsed).toEqual({ 'field-dose': 2 });
    expect(events.filter((event) => event.type === 'item:used')).toHaveLength(2);
  });

  it('a heal at full hp leaves hp unchanged (X→X)', () => {
    const { fight } = itemFight([{ ...MEDIC, hp: 12, maxHp: 12 }]);
    const [, healed] = fight.use('field-dose');
    expect(healed!.target).toBe('brynn');
    expect(healed!.payload['hp']).toBe('12→12');
    expect(fight.state.combatants['brynn']!.hp.current).toBe(12);
  });

  it('over-cap (R-2): a combatant above maxHp is healed → hp unchanged, event X→X, never lowered', () => {
    const { fight } = itemFight([{ ...MEDIC, hp: 15, maxHp: 12 }]);
    const [, healed] = fight.use('field-dose');
    expect(healed!.payload).toEqual({ amount: -5, type: undefined, hp: '15→15' });
    expect(fight.state.combatants['brynn']!.hp.current).toBe(15);
    expect(fight.state.combatants['brynn']!.itemsUsed).toEqual({ 'field-dose': 1 });
  });

  it('use after combat-over (R-3) throws like declare: no event, no ledger change', () => {
    const { fight, events } = itemFight(
      [{ ...MEDIC, actions: ['surge'] }],
      [{ id: 'wight', actions: ['wight-claw'], hp: 1, initiativeBonus: 0 }],
    );
    fight.declare('surge');
    expect(fight.state.phase).toBe('combat-over');
    const count = events.length;
    const sink: RuntimeEvent[] = [];
    fight.runtime.events.on((event) => {
      sink.push(event);
    });
    expect(() => fight.use('field-dose')).toThrow('combat is over');
    expect(sink).toEqual([]);
    expect(events).toHaveLength(count);
    expect(fight.state.combatants['brynn']!.itemsUsed).toEqual({});
  });

  it('the maxHp fallback floors at 0 (R-9): no profile maxHp and hp −3 → maxHp 0', () => {
    const runtime = new Runtime(emberMarchesPack());
    const base = profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn');
    const uncapped: CombatantProfile = { ...base, hp: -3 };
    delete (uncapped as { maxHp?: number }).maxHp;
    const fight = startCombat(runtime, {
      allies: [{ id: 'brynn', profile: uncapped }],
      enemies: [{ id: 'wight', profile: { ...base, maxHp: undefined, hp: 7 } }],
    });
    expect(fight.state.combatants['brynn']!.maxHp).toBe(0);
    expect(fight.state.combatants['wight']!.maxHp).toBe(7);
  });

  it('charge exhaustion → no-charges; no item:used, no heal, ledger unchanged', () => {
    const { fight, events } = itemFight([{ ...MEDIC, hp: 3, items: { 'field-dose': 1 } }]);
    fight.use('field-dose');
    const hp = fight.state.combatants['brynn']!.hp.current;
    const count = events.length;
    const rejected = fight.use('field-dose');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.type).toBe('declare:rejected');
    expect(rejected[0]!.payload['kind']).toBe('no-charges');
    expect(rejected[0]!.payload['resource']).toBe('field-dose');
    expect(events.slice(count).map((event) => event.type)).toEqual(['declare:rejected']);
    expect(fight.state.combatants['brynn']!.hp.current).toBe(hp);
    expect(fight.state.combatants['brynn']!.itemsUsed).toEqual({ 'field-dose': 1 });
    // An item the host never stated has no charges either.
    expect(
      itemFight([{ id: 'brynn', initiativeBonus: 100 }]).fight.use('field-dose')[0]!.payload['kind'],
    ).toBe('no-charges');
  });

  it('not-consumable and unknown-item reject with no change', () => {
    const { fight } = itemFight([MEDIC]);
    const before = fight.serialize();
    const worn = fight.use('scale-coat');
    expect(worn.map((event) => [event.type, event.payload['kind']])).toEqual([
      ['declare:rejected', 'not-consumable'],
    ]);
    const unknown = fight.use('moon-rock');
    expect(unknown.map((event) => [event.type, event.payload['kind']])).toEqual([
      ['declare:rejected', 'unknown-item'],
    ]);
    const lost = fight.use('field-dose', { target: 'nobody' });
    expect(lost[0]!.payload['kind']).toBe('unknown-target');
    expect(fight.serialize()).toEqual(before);
  });

  it('provenance: why.rule content.items.<id>, why.rolls carry the negated heal roll; no slot spent, turn kept', () => {
    const { fight } = itemFight([{ ...MEDIC, hp: 1, maxHp: 30 }]);
    const slots = { ...fight.state.combatants['brynn']!.slots.remaining };
    const [used, healed] = fight.use('mend-salve');
    expect(used!.why).toEqual({ rule: 'content.items.mend-salve', rolls: [] });
    expect(healed!.why.rule).toBe('content.items.mend-salve');
    expect(healed!.why.rolls).toHaveLength(1);
    const amount = healed!.payload['amount'] as number;
    expect(amount).toBeLessThanOrEqual(-3);
    expect(amount).toBeGreaterThanOrEqual(-8);
    expect(healed!.why.rolls[0]).toBe(`d6[${amount + 2}]-2=${amount}`);
    expect(healed!.payload['hp']).toBe(`1→${1 - amount}`);
    expect(fight.state.phase).toBe('awaiting-declare');
    expect(fight.state.active).toBe('brynn');
    expect(fight.state.combatants['brynn']!.slots.remaining).toEqual(slots);
    expect(fight.declare('withdraw').some((event) => event.type === 'declare:rejected')).toBe(false);
  });

  it('regression: an attack’s damage display is unchanged (positive amount, before→before−amount)', () => {
    const { fight, events } = journeyFight();
    stepToDeclare(fight, 'wight');
    fight.step();
    const before = fight.state.combatants['brynn']!.hp.current;
    fight.declare('wight-claw');
    const damage = events.find((event) => event.type === 'damage:applied');
    expect(damage).toBeDefined(); // the journey seed's claw hits (see the first journey test)
    const amount = damage!.payload['amount'] as number;
    expect(amount).toBeGreaterThan(0);
    expect(damage!.payload['hp']).toBe(`${before}→${before - amount}`);
    expect(damage!.why.rolls[0]).toMatch(/^d6\[\d+\]=\d+$/);
  });
});
