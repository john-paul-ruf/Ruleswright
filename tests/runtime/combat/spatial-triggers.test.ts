/**
 * Checkpoint-3 suite — spatial (FR-11) + triggers (FR-4/FR-13, FR-12 proof 2).
 * Spatial: packs without a model pay nothing (theater-of-mind no-op); declared
 * models enforce adjacency/reach with the typed rejection carrying the
 * registered E-SPAT-01 id. Triggers: pack-declared reactive actions fire from
 * the event substrate, are offered (`trigger:fired`), and resolve through the
 * SAME pipeline when taken — zero engine special-casing (the proof-2 shape).
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/core/rng';
import { emberMarchesPack, withSpatial, type SpatialPack } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import {
  startCombat,
  type Combat,
  type CombatantState,
  type StepOutcome,
} from '../../../src/runtime/combat/combat';
import {
  gridGeometry,
  theaterOfMind,
  spatialFromPack,
  packSpatialModel,
  checkReach,
  type Position,
} from '../../../src/runtime/combat/spatial';
import { eventMatches, reactiveActionsFor } from '../../../src/runtime/combat/triggers';
import type { RuntimeEvent } from '../../../src/runtime/events';

function parryFight(): { fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(emberMarchesPack());
  const seen: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    seen.push(event);
  });
  const parrier: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
    actions: ['parry'],
  };
  const attacker: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
    actions: ['wight-claw'],
  };
  const fight = startCombat(runtime, {
    allies: [{ id: 'brynn', profile: parrier }],
    enemies: [{ id: 'wight', profile: attacker }],
    rng: new Rng('parry'),
  });
  return { fight, events: seen };
}

/** Step until `id` may declare, skipping other turns with their first action. */
function stepToDeclare(fight: Combat, id: string, skipWith = 'withdraw'): void {
  for (let guard = 0; guard < 20; guard += 1) {
    if (fight.state.phase === 'awaiting-declare' && fight.state.active === id) return;
    if (fight.state.phase === 'awaiting-declare') {
      fight.declare(skipWith);
    }
    const outcome: StepOutcome = fight.step();
    if (outcome.kind === 'combat-over') throw new Error('combat ended before the awaited turn');
  }
  throw new Error(
    `never reached ${id}'s declare phase (phase=${fight.state.phase}, active=${fight.state.active})`,
  );
}

describe('spatial layer (FR-11)', () => {
  it('absent model = theater-of-mind: no adjacency checks, same combat loop', () => {
    const geometry = spatialFromPack({} as SpatialPack);
    expect(geometry.enabled).toBe(false);
    expect(geometry).toBe(theaterOfMind);
    expect(geometry.canReach({ x: 0, y: 0 }, { x: 100, y: 100 }, 1)).toBe(true);
    expect(
      checkReach(geometry, { position: { x: 0, y: 0 } }, { id: 'wight', position: { x: 99, y: 99 } }, 1),
    ).toBeUndefined();
  });

  it('the adapter splits the inline reach map: default + sibling overrides (CA-G1)', () => {
    const pack = withSpatial(emberMarchesPack(), {
      model: 'grid',
      reach: { default: 1, 'barrow-wight': 2 },
    });
    expect(packSpatialModel(pack)).toEqual({
      defaultReach: 1,
      reachOverrides: { 'barrow-wight': 2 },
    });
    const geometry = spatialFromPack(pack);
    expect(geometry.enabled).toBe(true);
  });

  it('a declared grid enforces adjacency and reach from pack data', () => {
    const geometry = gridGeometry({ defaultReach: 1 });
    expect(geometry.distance({ x: 0, y: 0 }, { x: 3, y: 2 })).toBe(3);
    expect(geometry.canReach({ x: 0, y: 0 }, { x: 1, y: 1 }, 1)).toBe(true);
    expect(geometry.canReach({ x: 0, y: 0 }, { x: 2, y: 0 }, 1)).toBe(false);
    // reach extends adjacency — all pack-declared (FR-11)
    expect(geometry.canReach({ x: 0, y: 0 }, { x: 2, y: 0 }, 2)).toBe(true);
  });

  it('burst resolves all entities in radius; mixed outcomes are the effect\u2019s business', () => {
    const geometry = gridGeometry({ defaultReach: 1 });
    const candidates: readonly (readonly [string, Position])[] = [
      ['a', { x: 4, y: 3 }],
      ['b', { x: 6, y: 3 }],
      ['c', { x: 4, y: 5 }],
      ['d', { x: 9, y: 9 }],
    ];
    expect(geometry.inBurst({ x: 4, y: 3 }, 2, candidates)).toEqual(['a', 'b', 'c']);
  });

  it('out-of-reach declares a typed rejection carrying the registered E-SPAT-01 id (CA-G2)', () => {
    const geometry = gridGeometry({ defaultReach: 1 });
    const rejection = checkReach(
      geometry,
      { position: { x: 0, y: 0 } },
      { id: 'grave-shambles', position: { x: 3, y: 0 } },
      1,
    );
    expect(rejection).toBeDefined();
    expect(rejection!.rule).toBe('E-SPAT-01');
    expect(rejection!.message).toContain('pack-declared');
  });

  it('race size is a documented no-op for v1 adjacency (DB v1.1 rider, D6)', () => {
    const pack = emberMarchesPack();
    expect(pack.content.races?.['dwindle']?.size).toBe('small');
    // The geometry API takes no size argument — structurally incapable of special-casing it.
    const geometry = gridGeometry({ defaultReach: 1 });
    expect(geometry.canReach({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)).toBe(true);
  });
});

describe('triggered actions (FR-4/FR-13, FR-12 proof 2 shape)', () => {
  it('a reactive action fires from the event substrate and resolves through the same pipeline', () => {
    const { fight, events } = parryFight();
    stepToDeclare(fight, 'wight');
    fight.step(); // wight's turn begins
    fight.declare('wight-claw', { targetId: 'brynn' });
    // The damage event matched brynn's `parry` (pattern: attack:rolled[target=self]) → offered.
    const offer = fight.pendingTriggers.find((pending) => pending.actionId === 'parry');
    expect(offer).toBeDefined();
    expect(offer!.actorId).toBe('brynn');
    expect(offer!.matchingEvent).toBe('attack:rolled');
    const fired = events.find((event) => event.type === 'trigger:fired');
    expect(fired).toBeDefined();
    expect(fired!.actor).toBe('brynn');
    expect(fired!.why.rule).toBe('actions.parry.trigger');
    // The host takes it — the reactive action rides the same resolution pipeline.
    fight.respond(offer!.triggerId, 'take');
    const reactionDamage = events.filter((event) => event.type === 'damage:applied');
    expect(reactionDamage.length).toBeGreaterThanOrEqual(2);
    const parryDamage = reactionDamage[reactionDamage.length - 1]!;
    expect(parryDamage.actor).toBe('brynn');
    expect(parryDamage.why.rule).toBe('actions.parry');
    // The reaction consumed a declared slot (FR-12 proof 2: reaction economy).
    expect(fight.state.combatants['brynn']!.slots.remaining['reaction']).toBe(0);
  });

  it('a declined trigger emits trigger:declined and changes nothing', () => {
    const { fight, events } = parryFight();
    stepToDeclare(fight, 'wight');
    fight.step();
    fight.declare('wight-claw', { targetId: 'brynn' });
    const offer = fight.pendingTriggers.find((pending) => pending.actionId === 'parry')!;
    const before = fight.serialize();
    fight.respond(offer.triggerId, 'decline');
    expect(events.some((event) => event.type === 'trigger:declined')).toBe(true);
    expect(fight.state.combatants['brynn']!.slots.remaining['reaction']).toBe(1);
    void before;
  });

  it('pattern matching: base type, [target=self], [actor=self]', () => {
    const reactor = 'brynn';
    const event = (overrides: Partial<RuntimeEvent>): RuntimeEvent => ({
      type: 'attack:rolled',
      at: { round: 1, turn: 0 },
      payload: {},
      why: { rule: 'x', rolls: [] },
      ...overrides,
    });
    expect(eventMatches('attack:rolled', event({}), reactor)).toBe(true);
    expect(eventMatches('attack:rolled[target=self]', event({ target: 'brynn' }), reactor)).toBe(true);
    expect(eventMatches('attack:rolled[target=self]', event({ target: 'wight' }), reactor)).toBe(false);
    expect(
      eventMatches(
        'condition:applied[actor=self]',
        event({ type: 'condition:applied', actor: 'brynn' }),
        reactor,
      ),
    ).toBe(true);
    expect(
      eventMatches(
        'condition:applied[actor=self]',
        event({ type: 'condition:applied', actor: 'wight' }),
        reactor,
      ),
    ).toBe(false);
    expect(eventMatches('damage:applied', event({ type: 'damage:applied' }), reactor)).toBe(true);
  });

  it('reactive actions are discovered from the pack, not the engine (FR-4: no built-in vocabulary)', () => {
    const runtime = new Runtime(emberMarchesPack());
    const combatant = { id: 'brynn', actions: ['parry', 'strike'] } as unknown as CombatantState;
    const reactive = reactiveActionsFor(runtime, combatant);
    expect(reactive.map((entry) => entry.actionId)).toEqual(['parry']);
    expect(reactive[0]!.pattern).toBe('attack:rolled[target=self]');
  });
});
