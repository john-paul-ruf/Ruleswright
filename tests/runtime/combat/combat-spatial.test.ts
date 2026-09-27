/**
 * CAP-G2/G3/G4 checkpoint-2/3 suites — spatial integration (FR-11):
 * ck2 — positions + the reach gate (CA-G2/CA-G3):
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
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emberMarchesPack, withSpatial } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import {
  startCombat,
  Combat,
  type CombatantState,
  type StartCombatRequest,
} from '../../../src/runtime/combat/combat';
import type { Position } from '../../../src/runtime/combat/spatial';
import type { RuntimeEvent } from '../../../src/runtime/events';
import { Rng } from '../../../src/core/rng';

/**
 * A scripted dice stream: the queue holds INTENDED die faces (1..sides);
 * int(n) returns face - 1 because dice.ts rollRecipe adds the +1 itself —
 * the reconstructed RollResult shows exactly the queued face. The queue
 * throws on exhaustion, so a drifted scenario fails loudly instead of
 * silently rolling an unpinned stream. It extends Rng because Combat's
 * constructor binds the concrete class (snapshot state words are unused in
 * these scenarios — none of them serialize).
 */
class ScriptedRng extends Rng {
  private readonly queue: number[];
  private cursor = 0;

  constructor(faces: readonly number[]) {
    super(0);
    this.queue = [...faces];
  }

  override int(maxExclusive: number): number {
    const face = this.queue[this.cursor];
    if (face === undefined) throw new Error('dice script exhausted — pin one face per roll');
    this.cursor += 1;
    if (face < 1 || face > maxExclusive) {
      throw new Error('dice script face ' + face + ' out of range 1..' + maxExclusive);
    }
    return face - 1;
  }
}

function diceScript(faces: readonly number[]): ScriptedRng {
  return new ScriptedRng(faces);
}

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
  seed: string | ScriptedRng,
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
    rng: typeof seed === 'string' ? new Rng(seed) : seed,
  };
  if (positions !== undefined) Object.assign(request, { positions });
  const started = startCombat(runtime, request);
  // startCombat records the dice stream's state words and Combat rebuilds an
  // Rng from them — a host-injected script would only drive initiative. For
  // scripted scenarios, rebuild the Combat so the script drives play rolls.
  const brawl = typeof seed === 'string' ? started : new Combat(runtime, started.state, seed);
  return { fight: brawl, events: seen };
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

describe('burst resolution through the executor (CAP-G3, CA-G4)', () => {
  /** Burst/validity actors: hp floors keep resolved claws from ending the fight mid-scenario. */
  const CASTER: Actor = {
    id: 'hexer',
    statblock: 'barrow-wight',
    actions: ['ember-bloom-rite'],
    initiativeBonus: 100,
    hp: 40,
  };
  const BURST_BRYNN: Actor = { ...BRYNN, hp: 40 };
  const BURST_WIGHT: Actor = { ...WIGHT, hp: 40 };

  it('burst-2 around the primary target hits multiple combatants across both sides; per-target save branches', () => {
    // The spell rides the normal action pipeline (FR-9): a pack action declaring
    // target(burst-2, save(reason, 12, damage(3d6, fire), damage(half))).
    // hexer @ (4,2) aims at wight @ (4,3): the burst covers wight (0), brynn (1),
    // hexer itself (1); shambles @ (8,8) is far outside.
    const positions = {
      hexer: { x: 4, y: 2 },
      wight: { x: 4, y: 3 },
      brynn: { x: 4, y: 4 },
      shambles: { x: 8, y: 8 },
    };
    // Initiative ties break by declared order, so hexer (declared first,
    // +100) leads wight (+100); bonuses pin the order, the script pins play.
    // Burst scope follows initiative order: [hexer, wight, brynn]. execSave
    // interleaves save → branch per target, so the stream is
    // save(hexer) damage(hexer) save(wight) damage(wight) … — all saves land
    // on 6 (+3 reason < 12): every branch is the FAIL side, full 3d6 fire.
    const dice = diceScript([
      2,
      1,
      1,
      1, // initiatives: hexer 2, wight 1, brynn −99, shambles −99
      6,
      6,
      5,
      4, // hexer: save 6 (fail), then 3d6 = 15
      6,
      5,
      4,
      4, // wight: save 6 (fail), then 3d6 = 13
      6,
      2,
      2,
      2, // brynn: save 6 (fail), then 3d6 = 6
    ]);
    const { fight: brawl, events } = fight(
      spatialRuntime(),
      [CASTER, BURST_BRYNN],
      [BURST_WIGHT, SHAMBLES],
      positions,
      dice,
    );
    expect(brawl.state.active).toBe('hexer');
    const declared = brawl.declare('ember-bloom-rite', { targetId: 'wight' });
    expect(declared.some((event) => event.type === 'declare:rejected')).toBe(false);
    // The executor resolved the shape through the combat layer: three saves rolled
    // (side-blind — an ally and the caster itself are in radius, the mock's anatomy).
    const damage = events.filter((event) => event.type === 'damage:applied');
    const damagedIds = damage.map((event) => event.target);
    expect(new Set(damagedIds)).toEqual(new Set(['wight', 'brynn', 'hexer']));
    expect(damagedIds).not.toContain('shambles');
    // The scripted stream lands every save on 6 (+3 reason < 12) — the FAIL
    // branch fires per target with full 3d6 fire. Branch shape asserted per
    // target, not by count: hexer 15, wight 13, brynn 6.
    const totalOf = (id: string): number =>
      damage
        .filter((event) => event.target === id)
        .map((event) => event.payload['amount'] as number)
        .reduce((sum, amount) => sum + amount, 0);
    expect(totalOf('hexer')).toBe(15);
    expect(totalOf('wight')).toBe(13);
    expect(totalOf('brynn')).toBe(6);
    // Each mutation carries its own target's damage dice (the save d20 is the
    // executor's verdict, not a why.rolls entry) — the mock's per-row anatomy.
    expect(damage[0]!.target).toBe('hexer');
    expect(damage[0]!.why.rolls[0]).toBe('d6[6,5,4]=15');
    expect(damage[1]!.target).toBe('wight');
    expect(damage[1]!.why.rolls).toEqual(['d6[6,5,4]=15', 'd6[5,4,4]=13']);
  });

  it('the burst center is the declared target, not the actor (Design Decision 2)', () => {
    // Aiming at wight @ (4,6) — the caster stands adjacent to the declared
    // target (the reach gate consults the declared target). shambles @ (4,4)
    // is 2 from the CENTER but 3 from the ACTOR: its inclusion proves the
    // burst centers on the target (Design Decision 2); actor-centered
    // resolution would exclude it. brynn @ (2,6) — the caster's ally — is
    // caught too: bursts are side-blind (the mock's anatomy).
    const positions = {
      hexer: { x: 4, y: 5 },
      wight: { x: 4, y: 6 },
      brynn: { x: 2, y: 6 },
      shambles: { x: 4, y: 4 },
    };
    // Burst scope follows initiative order: [hexer, wight, brynn, shambles]
    // (shambles and brynn tie at −100; the tie breaks by declared order —
    // allies before enemies). execSave interleaves save → branch per target.
    const dice = diceScript([
      2,
      1,
      1,
      1, // initiatives: hexer 2, brynn 1, wight 1, shambles 1
      6,
      6,
      5,
      4, // hexer: save 6 (fail), 3d6 = 15
      6,
      5,
      4,
      4, // wight: save 6 (fail), 3d6 = 13
      6,
      2,
      2,
      2, // brynn: save 6 (fail), 3d6 = 6
      6,
      4,
      4,
      4, // shambles: save 6 (fail), 3d6 = 12
    ]);
    const { fight: brawl, events } = fight(
      spatialRuntime(),
      [CASTER, BURST_BRYNN],
      [BURST_WIGHT, SHAMBLES],
      positions,
      dice,
    );
    expect(brawl.state.active).toBe('hexer');
    const declared = brawl.declare('ember-bloom-rite', { targetId: 'wight' });
    expect(declared.some((event) => event.type === 'declare:rejected')).toBe(false);
    const damagedIds = events.filter((event) => event.type === 'damage:applied').map((event) => event.target);
    // Side-blind, centered on the TARGET: the caster's ally brynn is caught
    // (the mock's anatomy), the far shambles is not.
    expect(new Set(damagedIds)).toEqual(new Set(['brynn', 'hexer', 'shambles', 'wight']));
    // Scripted saves all fail → full 3d6 fire per target, in scope order.
    const totalOf = (id: string): number =>
      events
        .filter((event) => event.type === 'damage:applied' && event.target === id)
        .map((event) => event.payload['amount'] as number)
        .reduce((sum, amount) => sum + amount, 0);
    expect(totalOf('hexer')).toBe(15);
    expect(totalOf('wight')).toBe(13);
    expect(totalOf('brynn')).toBe(6);
    expect(totalOf('shambles')).toBe(12);
  });
});

describe('the validity gate (CAP-G4, CA-G5)', () => {
  const SEIZE_ADJACENT: Readonly<Record<string, Position>> = { wight: { x: 0, y: 0 }, brynn: { x: 1, y: 0 } };
  const SEIZE_FAR: Readonly<Record<string, Position>> = { wight: { x: 0, y: 0 }, brynn: { x: 3, y: 0 } };

  function seizeFight(
    spatial: boolean,
    positions: Readonly<Record<string, Position>> | undefined,
  ): { fight: Combat; events: RuntimeEvent[] } {
    const runtime = spatial ? spatialRuntime() : new Runtime(emberMarchesPack());
    const actor: Actor = {
      id: 'wight',
      statblock: 'barrow-wight',
      actions: ['seize-opening'],
      initiativeBonus: 100,
    };
    const victim: Actor = {
      id: 'brynn',
      statblock: 'barrow-wight',
      actions: ['strike'],
      initiativeBonus: -100,
      hp: 40,
    };
    return fight(runtime, [actor], [victim], positions, 'validity');
  }

  it('hasTarget(adjacent) rejects out-of-reach in a spatial pack (kind valid, no state change)', () => {
    const { fight: brawl } = seizeFight(true, SEIZE_FAR);
    expect(brawl.state.active).toBe('wight');
    const before = brawl.serialize();
    const rejected = brawl.declare('seize-opening', { targetId: 'brynn' });
    expect(rejected[0]!.type).toBe('declare:rejected');
    expect(rejected[0]!.payload['kind']).toBe('valid');
    expect(rejected[0]!.why.rule).toBe('E-REF-01');
    expect(String(rejected[0]!.payload['resource'])).toBe('seize-opening');
    expect(brawl.serialize()).toEqual(before);
  });

  it('hasTarget(adjacent) passes within reach in a spatial pack', () => {
    const { fight: brawl } = seizeFight(true, SEIZE_ADJACENT);
    expect(brawl.state.active).toBe('wight');
    const declared = brawl.declare('seize-opening', { targetId: 'brynn' });
    expect(declared.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(brawl.state.phase).toBe('resolved');
  });

  it('theater-of-mind: the same valid clause passes (the mock absent-column — the no-op discipline)', () => {
    const { fight: brawl } = seizeFight(false, undefined);
    expect(brawl.state.active).toBe('wight');
    const declared = brawl.declare('seize-opening', { targetId: 'brynn' });
    expect(declared.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(brawl.state.phase).toBe('resolved');
  });

  it('a falsy comparator clause rejects declaratively (evalValidity scalars delegate to evalFormula)', () => {
    const runtime = new Runtime(emberMarchesPack());
    const veteran: Actor = {
      id: 'wight',
      statblock: 'barrow-wight',
      actions: ['veterans-censure'],
      initiativeBonus: 100,
    };
    const victim: Actor = {
      id: 'brynn',
      statblock: 'barrow-wight',
      actions: ['strike'],
      initiativeBonus: -100,
      hp: 40,
    };
    const { fight: brawl } = fight(runtime, [veteran], [victim], undefined, 'censure');
    expect(brawl.state.active).toBe('wight');
    // The statblock is level 2: `level >= 3` is false → kind valid, move slot unspent.
    const rejected = brawl.declare('veterans-censure');
    expect(rejected[0]!.type).toBe('declare:rejected');
    expect(rejected[0]!.payload['kind']).toBe('valid');
    expect(brawl.state.combatants['wight']!.slots.remaining['move']).toBe(1);
  });

  it('CA-2 discipline: no parse at play time — the declare path reads only the precompiled ASTs', () => {
    // parseFormula/parseEffect are load-time machinery (runtime.ts, resolve.ts);
    // the combat loop itself must never import them — asserted against the source.
    const combatSource = readFileSync('src/runtime/combat/combat.ts', 'utf8');
    expect(combatSource).not.toMatch(/parseFormula/);
    expect(combatSource).not.toMatch(/parseEffect/);
    // The gate reads the parse-once index, exactly as CA-2 prescribes.
    expect(combatSource).toContain('this.runtime.index.validAsts[actionId]');
  });
});
