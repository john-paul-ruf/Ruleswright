import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/core/rng';
import { emberMarchesPack } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import { startCombat, Combat, displayRoll, type CombatantState, type StepOutcome } from '../../../src/runtime/combat/combat';
import type { RuntimeEvent } from '../../../src/runtime/events';

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
  const brynn: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'), actions: ['strike'] };
  const wight: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'), actions: ['wight-claw'] };
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
  throw new Error(`never reached ${id}'s declare phase (phase=${fight.state.phase}, active=${fight.state.active})`);
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
    expect(snap.rng).toEqual({ a: expect.any(Number), b: expect.any(Number), c: expect.any(Number), d: expect.any(Number) });
  });

  it('a resumed fight rolls the same future as an uninterrupted one (FR-14 resume discipline)', () => {
    const runtime = new Runtime(emberMarchesPack());
    const brynn: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'), actions: ['strike', 'withdraw'] };
    const wight: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'), actions: ['wight-claw'] };
    const make = () =>
      startCombat(runtime, { allies: [{ id: 'brynn', profile: brynn }], enemies: [{ id: 'wight', profile: wight }], rng: new Rng(77) });
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
    const damageB = resumed.eventsSince(1).filter((event) => event.type === 'damage:applied').pop();
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
    const caster: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'hexling'), actions: ['grave-gaze'] };
    const victim: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['grave-shambles']!, 'hexling'), actions: ['withdraw'] };
    const fight = startCombat(runtime, { allies: [{ id: 'hexling', profile: caster }], enemies: [{ id: 'dummy', profile: victim }], rng: new Rng(3) });
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
    expect(displayRoll({ purpose: 'attack', sides: 20, values: [14], modifier: 3, total: 17, verdict: { defense: 'ac', value: 15, result: 'hit' } })).toBe('d20[14]+3=17 ≥ ac15');
    expect(displayRoll({ purpose: 'damage', sides: 6, values: [4], modifier: 2, total: 6 })).toBe('d6[4]+2=6');
  });
});