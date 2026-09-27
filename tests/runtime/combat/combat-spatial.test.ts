/**
 * CAP-G2 checkpoint-2 suite — positions + the reach gate (FR-11, CA-G2/CA-G3):
 * a spatial pack's declares fail declaratively out of reach (registered
 * E-SPAT-01, kind `spatial`) with no state mutation, reach overrides extend
 * adjacency while the default still binds for everyone else, theater-of-mind
 * packs keep the pre-feature behavior with positions carried but never
 * consulted, and startCombat refuses a positionless spatial fight loudly
 * (fail-closed, all cards at once).
 *
 * Initiative is pinned through profile.initiativeBonus (the combat.test.ts
 * ruleSides pattern) so every scenario is seed-independent: the actor under
 * test (+100) always takes the first turn. Reach overrides key the combatant
 * id (Design Decision 4: `reach[profile.id] ?? reach.default`) — the
 * override-bearing instance below is *named* `barrow-wight`, the pack's
 * override key, while the same statblock under another instance id (`brynn`)
 * falls back to the default.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/core/rng';
import { emberMarchesPack, withSpatial } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import {
  startCombat,
  type Combat,
  type CombatantState,
  type StartCombatRequest,
} from '../../../src/runtime/combat/combat';
import type { Position } from '../../../src/runtime/combat/spatial';
import type { RuntimeEvent } from '../../../src/runtime/events';

/** The v1.3 inline reach map: default 1, the barrow-wight frame reaches 2 (spatial.html). */
const SPATIAL = { model: 'grid', reach: { default: 1, 'barrow-wight': 2 } } as const;

interface Actor {
  readonly id: string;
  readonly statblock: string;
  readonly actions: readonly string[];
  readonly initiativeBonus: number;
  /** Optional hp floor so resolved claws cannot end the fight mid-scenario. */
  readonly hp?: number;
}

const SPEAR: Actor = {
  id: 'barrow-wight',
  statblock: 'barrow-wight',
  actions: ['wight-claw'],
  initiativeBonus: 100,
};
const WIGHT: Actor = {
  id: 'wight',
  statblock: 'barrow-wight',
  actions: ['wight-claw'],
  initiativeBonus: 100,
};
const BRYNN: Actor = { id: 'brynn', statblock: 'barrow-wight', actions: ['strike'], initiativeBonus: -100 };
const SHAMBLES: Actor = {
  id: 'shambles',
  statblock: 'grave-shambles',
  actions: ['shamble-swing'],
  initiativeBonus: -100,
  hp: 40,
};

function profileFor(runtime: Runtime, actor: Actor): CombatantProfile {
  const base = profileFromStatblock(runtime.pack, runtime.pack.bestiary[actor.statblock]!, actor.id);
  return {
    ...base,
    actions: [...actor.actions],
    initiativeBonus: actor.initiativeBonus,
    ...(actor.hp !== undefined ? { hp: actor.hp } : {}),
  };
}

function spatialRuntime(): Runtime {
  return new Runtime(withSpatial(emberMarchesPack(), SPATIAL));
}

function fight(
  runtime: Runtime,
  allies: readonly Actor[],
  enemies: readonly Actor[],
  positions: Readonly<Record<string, Position>> | undefined,
  seed: string,
): { fight: Combat; events: RuntimeEvent[] } {
  const seen: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    seen.push(event);
  });
  const side = (members: readonly Actor[]): StartCombatRequest['allies'] =>
    members.map((actor) => ({ id: actor.id, profile: profileFor(runtime, actor) }));
  const request: StartCombatRequest = {
    allies: side(allies),
    enemies: side(enemies),
    rng: new Rng(seed),
  };
  if (positions !== undefined) Object.assign(request, { positions });
  return { fight: startCombat(runtime, request), events: seen };
}

const FAR: Readonly<Record<string, Position>> = {
  brynn: { x: 0, y: 0 },
  wight: { x: 3, y: 0 },
  'barrow-wight': { x: 3, y: 0 },
};
const ADJACENT: Readonly<Record<string, Position>> = {
  brynn: { x: 0, y: 0 },
  wight: { x: 1, y: 0 },
  'barrow-wight': { x: 1, y: 0 },
};

describe('the reach gate (CAP-G2, CA-G2)', () => {
  it('out-of-reach melee rejects declaratively — kind spatial, registered E-SPAT-01, no state mutation', () => {
    const { fight: brawl } = fight(spatialRuntime(), [SPEAR], [BRYNN], FAR, 'gate');
    expect(brawl.state.active).toBe('barrow-wight');
    const before = brawl.serialize();
    const events = brawl.declare('wight-claw', { targetId: 'brynn' });
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('declare:rejected');
    expect(events[0]!.payload['kind']).toBe('spatial');
    expect(events[0]!.why.rule).toBe('E-SPAT-01');
    expect(String(events[0]!.payload['message'])).toContain('within reach 2');
    // Rejection with no durable change: hp untouched, ledger unspent, state identical.
    expect(brawl.state.combatants['barrow-wight']!.hp.current).toBe(12);
    expect(brawl.state.combatants['barrow-wight']!.slots.remaining['main']).toBe(1);
    expect(brawl.serialize()).toEqual(before);
  });

  it('within-reach melee resolves through the normal pipeline', () => {
    const { fight: brawl, events } = fight(spatialRuntime(), [SPEAR], [BRYNN], ADJACENT, 'adjacent');
    expect(brawl.state.active).toBe('barrow-wight');
    const declared = brawl.declare('wight-claw', { targetId: 'brynn' });
    expect(declared.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(brawl.state.phase).toBe('resolved');
    expect(events.some((event) => event.type === 'action:resolved' && event.actor === 'barrow-wight')).toBe(
      true,
    );
  });

  it('a reach override extends adjacency; the default still binds for combatants without one', () => {
    // The barrow-wight instance (override 2, keyed by its id) reaches distance 2;
    // the shambles instance (default 1) does not.
    const positions = { 'barrow-wight': { x: 0, y: 0 }, shambles: { x: 2, y: 0 } };
    const { fight: brawl } = fight(spatialRuntime(), [SHAMBLES], [SPEAR], positions, 'override');
    expect(brawl.state.active).toBe('barrow-wight');
    expect(
      brawl.declare('wight-claw', { targetId: 'shambles' }).some((event) => event.type === 'action:resolved'),
    ).toBe(true);
    brawl.step(); // end the barrow-wight's turn
    brawl.step(); // shambles' turn begins
    expect(brawl.state.active).toBe('shambles');
    const rejected = brawl.declare('shamble-swing', { targetId: 'barrow-wight' });
    expect(rejected[0]!.type).toBe('declare:rejected');
    expect(rejected[0]!.payload['kind']).toBe('spatial');
    expect(rejected[0]!.why.rule).toBe('E-SPAT-01');
  });

  it('the override is a per-key lookup, not a global raise: distance 3 exceeds even reach 2', () => {
    const positions = { 'barrow-wight': { x: 0, y: 0 }, shambles: { x: 3, y: 0 } };
    const { fight: brawl } = fight(spatialRuntime(), [SHAMBLES], [SPEAR], positions, 'override-far');
    expect(brawl.state.active).toBe('barrow-wight');
    const rejected = brawl.declare('wight-claw', { targetId: 'shambles' });
    expect(rejected[0]!.payload['kind']).toBe('spatial');
    expect(String(rejected[0]!.payload['message'])).toContain('within reach 2');
  });

  it('a combatant missing its position mid-fight fails closed with a distinct message from out-of-reach', () => {
    const { fight: brawl } = fight(spatialRuntime(), [WIGHT], [BRYNN], ADJACENT, 'missing');
    expect(brawl.state.active).toBe('wight');
    // The host lost the actor's position between steps (plain-JSON state; tests mutate it directly).
    const combatants = brawl.state.combatants as Record<string, CombatantState>;
    delete (combatants['wight'] as { position?: Position }).position;
    const rejected = brawl.declare('wight-claw', { targetId: 'brynn' });
    expect(rejected[0]!.type).toBe('declare:rejected');
    expect(rejected[0]!.payload['kind']).toBe('spatial');
    expect(String(rejected[0]!.payload['message'])).toContain('positions are missing');
  });
});

describe('startCombat fail-closed gate (CA-G3: loud refusal, all cards)', () => {
  it('a spatial pack refuses a fight where any combatant lacks a position — one card each, nothing built', () => {
    const runtime = spatialRuntime();
    try {
      startCombat(runtime, {
        allies: [{ id: 'brynn', profile: profileFor(runtime, BRYNN) }],
        enemies: [
          { id: 'barrow-wight', profile: profileFor(runtime, SPEAR) },
          { id: 'shambles', profile: profileFor(runtime, SHAMBLES) },
        ],
        positions: { 'barrow-wight': { x: 0, y: 0 }, brynn: { x: 1, y: 0 } },
        rng: new Rng('refuse'),
      });
      throw new Error('expected startCombat to refuse the positionless fight');
    } catch (error) {
      expect((error as Error).name).toBe('RuntimeRuleError');
      const cards = (error as { errors: readonly { rule: string; jsonPath: string; artifactId: string }[] })
        .errors;
      expect(cards.map((card) => card.artifactId).sort()).toEqual(['shambles']);
      expect(cards.every((card) => card.rule === 'E-SPAT-01')).toBe(true);
      expect(cards[0]!.jsonPath).toBe('positions.shambles');
    }
  });

  it('a theater-of-mind pack never demands positions (absent section = no gate)', () => {
    const runtime = new Runtime(emberMarchesPack());
    expect(() =>
      startCombat(runtime, {
        allies: [{ id: 'brynn', profile: profileFor(runtime, BRYNN) }],
        enemies: [{ id: 'wight', profile: profileFor(runtime, WIGHT) }],
        rng: new Rng('theater-refuse'),
      }),
    ).not.toThrow();
  });
});

describe('theater-of-mind parity (the hard gate: pre-feature behavior with positions present)', () => {
  it('positions are stored but never consulted — declares resolve identically to the baseline fight', () => {
    const withPositions = fight(new Runtime(emberMarchesPack()), [WIGHT], [BRYNN], FAR, 'parity');
    const baseline = fight(new Runtime(emberMarchesPack()), [WIGHT], [BRYNN], undefined, 'parity');
    expect(withPositions.fight.state.combatants['wight']!.position).toEqual({ x: 3, y: 0 });
    expect(withPositions.fight.state.combatants['brynn']!.position).toEqual({ x: 0, y: 0 });
    expect(baseline.fight.state.combatants['wight']!.position).toBeUndefined();
    expect(baseline.fight.state.active).toBe('wight');
    expect(withPositions.fight.state.active).toBe('wight');
    // Identical declares: same actor, same action, same dice — the gate never fires.
    const carried = withPositions.fight.declare('wight-claw', { targetId: 'brynn' });
    const plain = baseline.fight.declare('wight-claw', { targetId: 'brynn' });
    expect(carried.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(plain.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(withPositions.fight.state.phase).toBe('resolved');
    expect(baseline.fight.state.phase).toBe('resolved');
    // The same rolls produced the same outcomes: damage payloads match exactly.
    const carriedDamage = withPositions.events.filter((event) => event.type === 'damage:applied');
    const plainDamage = baseline.events.filter((event) => event.type === 'damage:applied');
    expect(carriedDamage.map((event) => event.payload)).toEqual(plainDamage.map((event) => event.payload));
    expect(withPositions.fight.state.combatants['brynn']!.hp.current).toBe(
      baseline.fight.state.combatants['brynn']!.hp.current,
    );
  });
});
