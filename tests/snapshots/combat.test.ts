/**
 * CAP-7 checkpoint 2 — combat snapshots (FR-14): the envelope, the resume
 * proof, and the CA-1 refusal paths (no-mutation on refusal).
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { createCharacter } from '../../src/runtime/character';
import {
  serializeCombat,
  deserializeCombat,
  serializeCharacter,
  serializeParty,
} from '../../src/runtime/snapshots';
import type { CombatRestoreRequest, CombatSnapshot } from '../../src/runtime/snapshots';
import { profileFromStatblock, type CombatantProfile } from '../../src/runtime/combat/resolve';
import { startCombat, Combat, type CombatantState } from '../../src/runtime/combat/combat';
import type { RuntimeEvent } from '../../src/runtime/events';
import { emberMarchesHexPack, emberMarchesPack, withSpatial } from '../runtime/fixtures/packs';
import type { Position } from '../../src/runtime/combat/spatial';
import { Rng } from '../../src/core/rng';

/**
 * The journey fight (S05's shape, production path): fixture pack → Runtime →
 * profiles from the bestiary → stepwise combat with declared actions.
 */
function journeyFight(seed: string): { runtime: Runtime; fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(emberMarchesPack());
  const seen: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    seen.push(event);
  });
  const brynn: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
    actions: ['strike', 'withdraw'],
  };
  const wight: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
    actions: ['wight-claw', 'parry'],
  };
  const fight = startCombat(runtime, {
    allies: [{ id: 'brynn', profile: brynn }],
    enemies: [{ id: 'wight', profile: wight }],
    rng: new Rng(seed),
  });
  return { runtime, fight, events: seen };
}

/** Step until the named combatant may declare, skipping other turns harmlessly. */
function stepToDeclare(fight: Combat, id: string): void {
  for (let guard = 0; guard < 24; guard += 1) {
    if (fight.state.phase === 'awaiting-declare' && fight.state.active === id) return;
    if (fight.state.phase === 'awaiting-declare') {
      fight.declare(fight.state.active === 'brynn' ? 'withdraw' : 'wight-claw');
    }
    if (fight.step().kind === 'combat-over') throw new Error('combat ended before the awaited turn');
  }
  throw new Error(
    `never reached ${id}'s declare phase (phase=${fight.state.phase}, active=${fight.state.active})`,
  );
}

/** A restore request mirroring the journey fight's sides. */
function journeyRestore(runtime: Runtime): CombatRestoreRequest {
  const brynn: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
    actions: ['strike', 'withdraw'],
  };
  const wight: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
    actions: ['wight-claw', 'parry'],
  };
  return { allies: [{ id: 'brynn', profile: brynn }], enemies: [{ id: 'wight', profile: wight }] };
}

describe('combat snapshots (FR-14, CAP-7)', () => {
  it('the envelope carries exactly the contract fields — no extras, no omissions', () => {
    const { fight } = journeyFight('env');
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    expect(Object.keys(snap).sort()).toEqual([
      'combatants',
      'kind',
      'offeredCount',
      'order',
      'pack',
      'pairsWith',
      'phase',
      'rng',
      'round',
      'snapshotVersion',
      'turn',
    ]);
    expect(snap.kind).toBe('combat');
    expect(snap.snapshotVersion).toBe(1);
    expect(snap.pairsWith).toBe('party-1');
    expect(snap.round).toBe(1);
    expect(snap.turn).toBe(0);
    expect(snap.order.length).toBe(2);
    expect(Object.keys(snap.rng).sort()).toEqual(['a', 'b', 'c', 'd']);
    for (const word of Object.values(snap.rng)) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThanOrEqual(4294967295);
    }
    // v1.4 (CA-EG6): maxHp is always emitted; itemsUsed only once something is spent.
    expect(Object.keys(snap.combatants[0]!).sort()).toEqual(['conditions', 'hp', 'id', 'maxHp', 'slotsUsed']);
  });

  it('the combatants array follows initiative order and carries the CA-4 transients', () => {
    const { fight } = journeyFight('order');
    fight.step(); // first combatant's turn begins (ledger replenished)
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    expect(snap.combatants.map((combatant) => combatant.id)).toEqual(snap.order);
    const first = snap.combatants[0]!;
    expect(first.slotsUsed).toEqual({ main: 1, move: 1, reaction: 1 });
    expect(fight.state.combatants[first.id]!.slots.remaining).toEqual({ main: 1, move: 1, reaction: 1 });
  });

  it('a frozen trigger offer restores as a pending offer (FR-13 pacing across restarts)', () => {
    const { fight } = journeyFight('offer');
    fight.step(); // turn begins
    const attacker = fight.state.active;
    const victim = attacker === 'wight' ? 'brynn' : 'wight';
    fight.declare(attacker === 'wight' ? 'wight-claw' : 'strike'); // the attack offers the victim's parry
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    expect(snap.offers).toEqual([{ actorId: victim, source: 'action', id: 'parry', on: 'attack:rolled' }]);
    expect(snap.combatants.some((combatant) => 'pendingTrigger' in combatant)).toBe(false);
  });
});

describe('the FR-14 resume proof (RNG state is the whole trick)', () => {
  it('a resumed fight rolls the same future as an uninterrupted one', () => {
    const seed = 'resume-proof';
    const { fight: uninterrupted, events: uninterruptedEvents } = journeyFight(seed);
    const resumableRuntime = new Runtime(emberMarchesPack());
    const resumableSeen: RuntimeEvent[] = [];
    resumableRuntime.events.on((event) => {
      resumableSeen.push(event);
    });
    const resumableProfileBrynn: CombatantProfile = {
      ...profileFromStatblock(
        resumableRuntime.pack,
        resumableRuntime.pack.bestiary['barrow-wight']!,
        'brynn',
      ),
      actions: ['strike', 'withdraw'],
    };
    const resumableProfileWight: CombatantProfile = {
      ...profileFromStatblock(
        resumableRuntime.pack,
        resumableRuntime.pack.bestiary['barrow-wight']!,
        'wight',
      ),
      actions: ['wight-claw', 'parry'],
    };
    const resumable = startCombat(resumableRuntime, {
      allies: [{ id: 'brynn', profile: resumableProfileBrynn }],
      enemies: [{ id: 'wight', profile: resumableProfileWight }],
      rng: new Rng(seed),
    });

    // Run N steps in lockstep, then freeze the resumable fight mid-fight.
    for (let i = 0; i < 3; i += 1) {
      uninterrupted.step();
      resumable.step();
    }
    const snap = serializeCombat(resumable, { pairsWith: 'party-1' });
    // Simulated restart: fresh runtime from the same pack content.
    const freshRuntime = new Runtime(emberMarchesPack());
    const freshSeen: RuntimeEvent[] = [];
    freshRuntime.events.on((event) => {
      freshSeen.push(event);
    });
    const restored = deserializeCombat(
      freshRuntime,
      JSON.parse(JSON.stringify(snap)),
      journeyRestore(freshRuntime),
    );

    // Drive both fights to wight's declare and fire the claw.
    stepToDeclare(uninterrupted, 'wight');
    uninterrupted.step();
    uninterrupted.declare('wight-claw');
    stepToDeclare(restored, 'wight');
    restored.step();
    restored.declare('wight-claw');

    const uninterruptedDamage = uninterruptedEvents.filter((event) => event.type === 'damage:applied').pop();
    const resumedDamage = freshSeen.filter((event) => event.type === 'damage:applied').pop();
    expect(resumedDamage).toBeDefined();
    expect(resumedDamage!.payload).toEqual(uninterruptedDamage!.payload);
    // The resumed fight's hp reflects the identical roll too.
    expect(restored.state.combatants['brynn']!.hp.current).toBe(
      uninterrupted.state.combatants['brynn']!.hp.current,
    );
  });
});

describe('combat restore refusal paths (CA-1: loud refusal, no mutation)', () => {
  it('a tampered contentHash refuses with E-SNAP-01 and the fresh runtime stays untouched', () => {
    const { fight } = journeyFight('refusal');
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const tampered = {
      ...snap,
      pack: { ...snap.pack, contentHash: '9a02b1c4' },
    } as unknown as CombatSnapshot;
    const freshRuntime = new Runtime(emberMarchesPack());
    expect(() => deserializeCombat(freshRuntime, tampered, journeyRestore(freshRuntime))).toThrow();
    try {
      deserializeCombat(freshRuntime, tampered, journeyRestore(freshRuntime));
    } catch (error) {
      expect((error as Error).name).toBe('RuntimeRuleError');
      expect(String(error)).toMatch(/E-SNAP-01/);
      expect(String(error)).toMatch(/content hash/);
    }
    expect(freshRuntime.nextCharacterId).toBe(1);
  });

  it('a stale snapshotVersion refuses with E-SNAP-02 and the fresh runtime stays untouched', () => {
    const { fight } = journeyFight('stale');
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const stale = JSON.parse(JSON.stringify(snap)) as typeof snap;
    (stale as { snapshotVersion: number }).snapshotVersion = 2;
    const freshRuntime = new Runtime(emberMarchesPack());
    expect(() => deserializeCombat(freshRuntime, stale, journeyRestore(freshRuntime))).toThrow();
    try {
      deserializeCombat(freshRuntime, stale, journeyRestore(freshRuntime));
    } catch (error) {
      expect(String(error)).toMatch(/E-SNAP-02/);
      expect(String(error)).toMatch(/snapshotVersion 2/);
    }
    expect(freshRuntime.nextCharacterId).toBe(1);
  });

  it('a snapshot from a different pack refuses with E-SNAP-01 (identity includes the pack id)', () => {
    const { fight } = journeyFight('wrongpack');
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const foreign = JSON.parse(JSON.stringify(snap)) as typeof snap;
    (foreign.pack as { id: string }).id = 'some-other-pack';
    const freshRuntime = new Runtime(emberMarchesPack());
    expect(() => deserializeCombat(freshRuntime, foreign, journeyRestore(freshRuntime))).toThrow();
    try {
      deserializeCombat(freshRuntime, foreign, journeyRestore(freshRuntime));
    } catch (error) {
      expect(String(error)).toMatch(/E-SNAP-01/);
      expect(String(error)).toMatch(/pack id/);
    }
    expect(freshRuntime.nextCharacterId).toBe(1);
  });

  it('a snapshot whose frozen fight disagrees with the restore request refuses (E-SNAP-01)', () => {
    const { fight } = journeyFight('mismatch');
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const freshRuntime = new Runtime(emberMarchesPack());
    // Restore names only one side of the two-combatant fight.
    const partial = journeyRestore(freshRuntime);
    expect(() =>
      deserializeCombat(freshRuntime, JSON.parse(JSON.stringify(snap)), {
        allies: partial.allies,
        enemies: [],
      }),
    ).toThrow();
    try {
      deserializeCombat(freshRuntime, JSON.parse(JSON.stringify(snap)), {
        allies: partial.allies,
        enemies: [],
      });
    } catch (error) {
      expect(String(error)).toMatch(/E-SNAP-01/);
      expect(String(error)).toMatch(/restore request/);
    }
    expect(freshRuntime.nextCharacterId).toBe(1);
  });
});

describe('snapshot pairing (FR-14: combat names the party snapshot)', () => {
  it('the combat snapshot rides the same pack identity as its paired party snapshot', () => {
    const runtime = new Runtime(emberMarchesPack());
    const character = createCharacter(runtime, { name: 'Brynn', race: 'ashling', classes: ['warden'] });
    const partySnap = serializeParty(runtime, [character.state]);
    const characterSnap = serializeCharacter(runtime, character.state);
    const { fight } = journeyFight('pair');
    const combatSnap = serializeCombat(fight, { pairsWith: `${partySnap.pack.id}:${partySnap.kind}` });
    expect(combatSnap.pack).toEqual(partySnap.pack);
    expect(combatSnap.pack).toEqual(characterSnap.pack);
    expect(combatSnap.pairsWith.length).toBeGreaterThan(0);
  });
});

describe('spatial snapshots (CAP-G5, CA-G3)', () => {
  const SPATIAL = { model: 'grid', reach: { default: 1, 'barrow-wight': 2 } } as const;
  const POSITIONS: Readonly<Record<string, Position>> = {
    brynn: { x: 0, y: 0 },
    wight: { x: 3, y: 0 },
  };

  /** A spatial fight whose actor under test always declares first. */
  function spatialFight(): { runtime: Runtime; fight: Combat } {
    const runtime = new Runtime(withSpatial(emberMarchesPack(), SPATIAL));
    const brynn: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
      actions: ['strike', 'withdraw'],
      initiativeBonus: 100,
    };
    const wight: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
      actions: ['wight-claw', 'parry'],
      initiativeBonus: -100,
    };
    const fight = startCombat(runtime, {
      allies: [{ id: 'brynn', profile: brynn }],
      enemies: [{ id: 'wight', profile: wight }],
      positions: POSITIONS,
      rng: new Rng('spatial-snap'),
    });
    return { runtime, fight };
  }

  /** The restore request for the spatial fight, with re-stated positions. */
  function spatialRestore(
    runtime: Runtime,
    positions?: Readonly<Record<string, Position>>,
  ): CombatRestoreRequest {
    const brynn: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
      actions: ['strike', 'withdraw'],
      initiativeBonus: 100,
    };
    const wight: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
      actions: ['wight-claw', 'parry'],
      initiativeBonus: -100,
    };
    return {
      allies: [{ id: 'brynn', profile: brynn }],
      enemies: [{ id: 'wight', profile: wight }],
      ...(positions !== undefined ? { positions } : {}),
    };
  }

  it('positions round-trip: emitted only when set, restored onto combatant state, never null', () => {
    const { fight } = spatialFight();
    fight.step();
    fight.declare('withdraw'); // a state change, so the ledger differs too
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    expect(snap.combatants[0]!.position).toEqual({ x: 0, y: 0 });
    expect(snap.combatants[1]!.position).toEqual({ x: 3, y: 0 });
    // The envelope is plain JSON and survives a stringify round trip verbatim.
    const json = JSON.parse(JSON.stringify(snap));
    expect(json.combatants[0]!.position).toEqual({ x: 0, y: 0 });

    const fresh = new Runtime(withSpatial(emberMarchesPack(), SPATIAL));
    const restored = deserializeCombat(fresh, json, spatialRestore(fresh, POSITIONS));
    expect(restored.state.combatants['brynn']!.position).toEqual({ x: 0, y: 0 });
    expect(restored.state.combatants['wight']!.position).toEqual({ x: 3, y: 0 });
  });

  it('restored fights re-enforce geometry: out-of-reach still rejects after resume (movement = serialize → restore)', () => {
    const { fight } = spatialFight();
    fight.step();
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    // The host moved the fight: positions re-stated FAR apart on restore (FR-10 between-steps).
    const moved: Readonly<Record<string, Position>> = { brynn: { x: 0, y: 0 }, wight: { x: 4, y: 0 } };
    const fresh = new Runtime(withSpatial(emberMarchesPack(), SPATIAL));
    const restored = deserializeCombat(fresh, JSON.parse(JSON.stringify(snap)), spatialRestore(fresh, moved));
    expect(restored.state.active).toBe('brynn');
    const rejected = restored.declare('strike', { targetId: 'wight' });
    expect(rejected[0]!.type).toBe('declare:rejected');
    expect(rejected[0]!.payload['kind']).toBe('spatial');
    expect(rejected[0]!.why.rule).toBe('E-SPAT-01');
    expect(String(rejected[0]!.payload['message'])).toContain('within reach 1');
  });

  it('restore refuses a spatial fight missing a position — E-SPAT-01 family, artifactId (snapshot), jsonPath restore.<id>.position', () => {
    const { fight } = spatialFight();
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const fresh = new Runtime(withSpatial(emberMarchesPack(), SPATIAL));
    const oneMissing = spatialRestore(fresh, { wight: { x: 3, y: 0 } });
    expect(() => deserializeCombat(fresh, JSON.parse(JSON.stringify(snap)), oneMissing)).toThrow();
    try {
      deserializeCombat(fresh, JSON.parse(JSON.stringify(snap)), oneMissing);
    } catch (error) {
      expect((error as Error).name).toBe('RuntimeRuleError');
      expect(String(error)).toMatch(/E-SPAT-01/);
      const cards = (error as { errors: readonly { rule: string; artifactId: string; jsonPath: string }[] })
        .errors;
      expect(cards).toHaveLength(1);
      expect(cards[0]!.rule).toBe('E-SPAT-01');
      expect(cards[0]!.artifactId).toBe('(snapshot)');
      expect(cards[0]!.jsonPath).toBe('restore.brynn.position');
    }
    // No state mutated: the fresh runtime's serial is untouched (fail-closed discipline).
    expect(fresh.nextCharacterId).toBe(1);
  });

  it('every missing position is one card, all at once, before anything rebuilds', () => {
    const { fight } = spatialFight();
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const fresh = new Runtime(withSpatial(emberMarchesPack(), SPATIAL));
    const request = spatialRestore(fresh);
    // A restore that names only the enemies side ALSO fails the existing
    // describe-the-same-fight refusals — assert the aggregate carries both
    // families when both apply.
    try {
      deserializeCombat(fresh, JSON.parse(JSON.stringify(snap)), { allies: [], enemies: request.enemies });
      throw new Error('expected refusal');
    } catch (error) {
      const cards = (error as { errors: readonly { rule: string; jsonPath: string }[] }).errors;
      expect(cards.some((card) => card.rule === 'E-SNAP-01' && card.jsonPath === 'combatants')).toBe(true);
      expect(
        cards.some((card) => card.rule === 'E-SPAT-01' && card.jsonPath === 'restore.wight.position'),
      ).toBe(true);
    }
  });

  it('theater fight round-trips unchanged: positions absent → field absent, not null', () => {
    const { fight } = journeyFight('theater-snap');
    fight.step();
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    for (const combatant of snap.combatants) {
      expect('position' in combatant).toBe(false);
      expect(combatant.position).toBeUndefined();
    }
    const fresh = new Runtime(emberMarchesPack());
    const restored = deserializeCombat(fresh, JSON.parse(JSON.stringify(snap)), journeyRestore(fresh));
    for (const combatant of Object.values(restored.state.combatants)) {
      expect(combatant.position).toBeUndefined();
    }
    // The gates never consult positions in a theater pack: declares resolve.
    restored.step();
    const declared = restored.declare(restored.state.active === 'brynn' ? 'strike' : 'wight-claw');
    expect(declared.some((event) => event.type === 'declare:rejected')).toBe(false);
  });

  it('a spatial resume keeps gates against a combatant whose restore position was dropped mid-fight', () => {
    // The host restores with positions, then one combatant's position is lost
    // from state between steps: the declare-time gate still fails closed.
    const { fight } = spatialFight();
    fight.step();
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const fresh = new Runtime(withSpatial(emberMarchesPack(), SPATIAL));
    const restored = deserializeCombat(
      fresh,
      JSON.parse(JSON.stringify(snap)),
      spatialRestore(fresh, POSITIONS),
    );
    const combatants = restored.state.combatants as Record<string, CombatantState>;
    delete (combatants['brynn'] as { position?: Position }).position;
    const rejected = restored.declare('strike', { targetId: 'wight' });
    expect(rejected[0]!.payload['kind']).toBe('spatial');
    expect(String(rejected[0]!.payload['message'])).toContain('positions are missing');
  });

  it('v1.5: restore re-states terrain — an unknown kind or a combatant on a blocking cell refuses (E-SPAT-01 aggregate), nothing built', () => {
    const hexSides = (runtime: Runtime): CombatRestoreRequest => ({
      allies: [
        {
          id: 'brynn',
          profile: profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
        },
      ],
      enemies: [
        {
          id: 'wight',
          profile: profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
        },
      ],
    });
    const runtime = new Runtime(emberMarchesHexPack());
    const fight = startCombat(runtime, {
      ...hexSides(runtime),
      positions: POSITIONS,
      rng: new Rng('terrain'),
    });
    const snap = JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' })));

    const fresh = new Runtime(emberMarchesHexPack());
    const seen: RuntimeEvent[] = [];
    fresh.events.on((event) => {
      seen.push(event);
    });
    let cards: readonly { rule: string; jsonPath: string; artifactId: string }[] = [];
    try {
      deserializeCombat(fresh, snap, {
        ...hexSides(fresh),
        positions: POSITIONS,
        terrain: [
          { at: { x: 1, y: 0 }, kind: 'lava' },
          { at: { x: 3, y: 0 }, kind: 'standing-stone' },
        ],
      });
      throw new Error('expected a refusal');
    } catch (error) {
      expect((error as Error).name).toBe('RuntimeRuleError');
      cards = (error as { errors: typeof cards }).errors;
    }
    expect(cards.map((card) => [card.rule, card.artifactId, card.jsonPath])).toEqual([
      ['E-SPAT-01', '(snapshot)', 'restore.terrain[0].kind'],
      ['E-SPAT-01', '(snapshot)', 'restore.wight.position'],
    ]);
    expect(seen).toEqual([]);
    expect(fresh.nextCharacterId).toBe(1);

    // The same terrain, legally placed, rebuilds onto the restored state (never frozen in the envelope).
    const terrain = [{ at: { x: 1, y: 0 }, kind: 'bramble' }];
    expect(JSON.stringify(snap)).not.toContain('bramble');
    const restored = deserializeCombat(fresh, snap, { ...hexSides(fresh), positions: POSITIONS, terrain });
    expect(restored.state.terrain).toEqual(terrain);
  });

  /**
   * CA-M5 (ck4): a move paused by a leaving-reach offer survives serialize →
   * JSON → restore. brynn (barrow-wight statblock, speed 3 + level 2 = 5)
   * strides from (0,0) toward (-3,0) and leaves the adjacent wight's reach on
   * its first step. Fight A runs on uninterrupted; fight B is restored from
   * A's snapshot on a fresh runtime, and both answer the same way.
   */
  describe('v1.5 paused-move snapshots (CA-M5)', () => {
    const MOVE_POSITIONS: Readonly<Record<string, Position>> = {
      brynn: { x: 0, y: 0 },
      wight: { x: 1, y: 0 },
    };
    const MOVE_TERRAIN = [{ at: { x: -2, y: 1 }, kind: 'bramble' }];
    const DESTINATION = { x: -3, y: 0 };

    function moveSides(runtime: Runtime): CombatRestoreRequest {
      const block = (id: string) =>
        profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, id);
      return {
        allies: [
          {
            id: 'brynn',
            profile: { ...block('brynn'), actions: ['strike', 'stride'], initiativeBonus: 100 },
          },
        ],
        enemies: [
          {
            id: 'wight',
            profile: { ...block('wight'), actions: ['wight-claw', 'opportunist'], initiativeBonus: -100 },
          },
        ],
      };
    }

    function recorded(runtime: Runtime): RuntimeEvent[] {
      const seen: RuntimeEvent[] = [];
      runtime.events.on((event) => {
        seen.push(event);
      });
      return seen;
    }

    /** Fight A paused mid-move, plus fight B restored from A's JSON snapshot with re-stated positions and terrain. */
    function pausedPair() {
      const runtimeA = new Runtime(emberMarchesHexPack());
      const eventsA = recorded(runtimeA);
      const fightA = startCombat(runtimeA, {
        ...moveSides(runtimeA),
        positions: MOVE_POSITIONS,
        terrain: MOVE_TERRAIN,
        rng: new Rng('paused-move'),
      });
      fightA.step();
      fightA.declare('stride', { to: DESTINATION });
      const snap = JSON.parse(
        JSON.stringify(serializeCombat(fightA, { pairsWith: 'party-1' })),
      ) as CombatSnapshot;
      const positions: Record<string, Position> = {};
      for (const frozen of snap.combatants) positions[frozen.id] = frozen.position!;
      const runtimeB = new Runtime(emberMarchesHexPack());
      const eventsB = recorded(runtimeB);
      const fightB = deserializeCombat(runtimeB, snap, {
        ...moveSides(runtimeB),
        positions,
        terrain: MOVE_TERRAIN,
      });
      return { fightA, eventsA, fightB, eventsB, snap };
    }

    const COMPARED = [
      'move:advanced',
      'move:ended',
      'attack:rolled',
      'damage:applied',
      'trigger:declined',
      'turn:ended',
    ];
    function compared(events: readonly RuntimeEvent[], from: number): unknown[] {
      return events
        .slice(from)
        .filter((event) => COMPARED.includes(event.type))
        .map((event) => ({
          type: event.type,
          at: event.at,
          actor: event.actor,
          target: event.target,
          payload: event.payload,
        }));
    }

    it('pendingMove serializes only when set, and restore derives the resolved phase and the event-type offer', () => {
      const { fightA, fightB, snap } = pausedPair();
      const brynn = snap.combatants.find((combatant) => combatant.id === 'brynn')!;
      const wight = snap.combatants.find((combatant) => combatant.id === 'wight')!;
      expect(brynn.pendingMove).toEqual({
        actionId: 'stride',
        to: DESTINATION,
        remaining: 5,
        offeredDepartures: [{ from: { x: 0, y: 0 }, to: { x: -1, y: 0 }, reactorId: 'wight' }],
      });
      expect('pendingMove' in wight).toBe(false);
      expect(snap.offers).toEqual([
        { actorId: 'wight', source: 'action', id: 'opportunist', on: 'move:leaving-reach' },
      ]);
      expect('pendingTrigger' in wight).toBe(false);
      expect(brynn.position).toEqual({ x: 0, y: 0 });

      expect(fightA.state.phase).toBe('resolved');
      expect(fightB.state.phase).toBe('resolved');
      expect(fightB.state.combatants['brynn']!.pendingMove).toEqual(brynn.pendingMove);
      expect(fightB.pendingTriggers).toEqual(fightA.pendingTriggers);
      expect(fightB.pendingTriggers[0]!.matchingEvent).toBe('move:leaving-reach');
    });

    it.each(['duplicate', 'ally', 'unknown', 'nonadjacent', 'wrong-edge', 'wrong-source', 'malformed'])(
      'rejects invalid departure history: %s',
      (variant) => {
        const { snap } = pausedPair();
        const bad = JSON.parse(JSON.stringify(snap));
        const mover = bad.combatants.find((c: { id: string }) => c.id === 'brynn');
        const history = mover.pendingMove.offeredDepartures;
        if (variant === 'duplicate') history.push({ ...history[0] });
        if (variant === 'ally') history[0].reactorId = 'brynn';
        if (variant === 'unknown') history[0].reactorId = 'missing';
        if (variant === 'nonadjacent') history[0].to.x = -20;
        if (variant === 'wrong-edge') {
          history[0].from = { x: 10, y: 0 };
          history[0].to = { x: 11, y: 0 };
        }
        if (variant === 'wrong-source') bad.offers[0].on = 'attack:rolled';
        if (variant === 'malformed') history[0].from.x = 0.5;
        const runtime = new Runtime(emberMarchesHexPack());
        expect(() =>
          deserializeCombat(runtime, bad, {
            ...moveSides(runtime),
            positions: Object.fromEntries(snap.combatants.map((c) => [c.id, c.position!])),
            terrain: MOVE_TERRAIN,
          }),
        ).toThrow();
      },
    );

    it('resume parity (take): respond in both fights yields identical move/attack/damage payloads and positions', () => {
      const { fightA, eventsA, fightB, eventsB } = pausedPair();
      const [fromA, fromB] = [eventsA.length, eventsB.length];
      fightA.respond('wight.opportunist', 'take', 'brynn');
      fightB.respond('wight.opportunist', 'take', 'brynn');
      const tail = compared(eventsA, fromA);
      const types = tail.map((event) => (event as { type: string }).type);
      expect(types).toContain('attack:rolled');
      expect(types.slice(-2)).toEqual(['move:advanced', 'move:ended']);
      expect(compared(eventsB, fromB)).toEqual(tail);
      expect(fightB.state.combatants['brynn']!.position).toEqual(DESTINATION);
      expect(fightB.state.combatants['brynn']!.position).toEqual(fightA.state.combatants['brynn']!.position);
      expect(fightB.state.combatants['brynn']!.hp).toEqual(fightA.state.combatants['brynn']!.hp);
      expect(fightB.pendingTriggers).toEqual([]);
      expect(fightB.state.combatants['brynn']!.pendingMove).toBeUndefined();
    });

    it('resume parity (decline): identical trigger:declined payloads (on included) and move payloads', () => {
      const { fightA, eventsA, fightB, eventsB } = pausedPair();
      const [fromA, fromB] = [eventsA.length, eventsB.length];
      fightA.respond('wight.opportunist', 'decline');
      const answeredB = fightB.respond('wight.opportunist', 'decline');
      // A restored fight's decline returns the declined event (stamped with the fight clock, not round 0).
      expect(answeredB.map((event) => event.type)).toEqual([
        'trigger:declined',
        'move:advanced',
        'move:ended',
      ]);
      const tail = compared(eventsA, fromA);
      expect(tail.map((event) => (event as { type: string }).type)).toEqual([
        'trigger:declined',
        'move:advanced',
        'move:ended',
      ]);
      expect((tail[0] as { payload: Record<string, unknown> }).payload['on']).toBe('move:leaving-reach');
      expect(compared(eventsB, fromB)).toEqual(tail);
      expect(fightB.state.combatants['brynn']!.position).toEqual(fightA.state.combatants['brynn']!.position);
    });

    it('F-P2 forfeit parity: step() in both fights forfeits then ends the turn with identical payloads, no turn:began', () => {
      const { fightA, eventsA, fightB, eventsB } = pausedPair();
      const [fromA, fromB] = [eventsA.length, eventsB.length];
      expect(fightA.step()).toEqual({ kind: 'turn-ended', combatantId: 'brynn' });
      expect(fightB.step()).toEqual({ kind: 'turn-ended', combatantId: 'brynn' });
      const tail = compared(eventsA, fromA);
      expect(tail).toEqual([
        {
          type: 'move:ended',
          at: { round: 1, turn: 0 },
          actor: 'brynn',
          target: undefined,
          payload: { reason: 'forfeited', at: { x: 0, y: 0 } },
        },
        {
          type: 'turn:ended',
          at: { round: 1, turn: 0 },
          actor: 'brynn',
          target: undefined,
          payload: { turn: 0, round: 1 },
        },
      ]);
      expect(compared(eventsB, fromB)).toEqual(tail);
      expect(eventsA.slice(fromA).some((event) => event.type === 'turn:began')).toBe(false);
      expect(eventsB.slice(fromB).some((event) => event.type === 'turn:began')).toBe(false);
    });

    it('a pendingMove naming an unknown or a non-move action refuses with E-SNAP-01, before anything is rebuilt', () => {
      const { snap } = pausedPair();
      const index = snap.combatants.findIndex((combatant) => combatant.id === 'brynn');
      for (const actionId of ['fly', 'strike']) {
        const tampered = JSON.parse(JSON.stringify(snap)) as {
          combatants: { pendingMove?: { actionId: string } }[];
        };
        tampered.combatants[index]!.pendingMove!.actionId = actionId;
        const fresh = new Runtime(emberMarchesHexPack());
        const seen = recorded(fresh);
        let cards: readonly { rule: string; jsonPath: string; message: string }[] = [];
        try {
          deserializeCombat(fresh, tampered, {
            ...moveSides(fresh),
            positions: MOVE_POSITIONS,
            terrain: MOVE_TERRAIN,
          });
          throw new Error('expected a refusal');
        } catch (error) {
          cards = (error as { errors: typeof cards }).errors;
        }
        expect(cards.map((card) => [card.rule, card.jsonPath])).toEqual([
          ['E-SNAP-01', `combatants[${index}].pendingMove.actionId`],
        ]);
        expect(cards[0]!.message).toContain(`"${actionId}"`);
        expect(seen).toEqual([]);
      }
    });
  });
});

/**
 * CA-EG6 combat leg (equipment-consumables S05 ck4): the combatant's item spend
 * (`itemsUsed`, SPENT units) and heal cap (`maxHp`) survive a snapshot; the
 * host re-states the fight-start `balances.items`, the snapshot wins for the
 * spend, and a spend the restated balances cannot cover refuses (E-SNAP-01).
 */
describe('item spend + maxHp snapshots (CA-EG6)', () => {
  function itemSides(runtime: Runtime, charges: number, maxHp?: number): CombatRestoreRequest {
    const base = profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn');
    const brynn: CombatantProfile = { ...base, actions: ['strike', 'withdraw'], initiativeBonus: 100, maxHp };
    const wight: CombatantProfile = { ...base, actions: ['wight-claw', 'parry'], initiativeBonus: -100 };
    return {
      allies: [{ id: 'brynn', profile: brynn, balances: { items: { 'mend-salve': charges } } }],
      enemies: [{ id: 'wight', profile: wight }],
    };
  }

  function usedOnce(): { fight: Combat; snap: CombatSnapshot } {
    const runtime = new Runtime(emberMarchesPack());
    const fight = startCombat(runtime, { ...itemSides(runtime, 2, 30), rng: new Rng('items') });
    fight.step();
    expect(fight.use('mend-salve')[0]!.type).toBe('item:used');
    return { fight, snap: JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) };
  }

  function refusal(run: () => unknown): { rule: string; jsonPath: string }[] {
    try {
      run();
    } catch (error) {
      return (error as { errors: readonly { rule: string; jsonPath: string }[] }).errors.map((card) => ({
        rule: card.rule,
        jsonPath: card.jsonPath,
      }));
    }
    throw new Error('expected a refusal');
  }

  it('serializes itemsUsed (spent) and maxHp; restore rebuilds balances from the request and the spend from the snapshot', () => {
    const { fight, snap } = usedOnce();
    const brynn = snap.combatants.find((combatant) => combatant.id === 'brynn')!;
    const wight = snap.combatants.find((combatant) => combatant.id === 'wight')!;
    expect(brynn.itemsUsed).toEqual({ 'mend-salve': 1 });
    expect(brynn.maxHp).toBe(30);
    expect('itemsUsed' in wight).toBe(false);
    expect(wight.maxHp).toBe(fight.state.combatants['wight']!.maxHp);

    const fresh = new Runtime(emberMarchesPack());
    const sink: RuntimeEvent[] = [];
    fresh.events.on((event) => {
      sink.push(event);
    });
    const restored = deserializeCombat(fresh, snap, itemSides(fresh, 2));
    const state = restored.state.combatants['brynn']!;
    expect(state.itemBalances).toEqual({ 'mend-salve': 2 });
    expect(state.itemsUsed).toEqual({ 'mend-salve': 1 });
    expect(state.maxHp).toBe(30);
    expect(state.hp.current).toBe(fight.state.combatants['brynn']!.hp.current);

    // The resumed leg (fresh sink, DD17e): one charge left, then no-charges.
    expect(restored.use('mend-salve')[0]!.payload).toEqual({ itemId: 'mend-salve', remaining: 0 });
    expect(restored.use('mend-salve')[0]!.payload['kind']).toBe('no-charges');
    expect(sink.map((event) => event.type)).toEqual(['item:used', 'damage:applied', 'declare:rejected']);
  });

  it('maxHp precedence: snapshot, else profile.maxHp, else max(0, profile.hp) (R-9)', () => {
    const { snap } = usedOnce();
    const fresh = new Runtime(emberMarchesPack());
    expect(deserializeCombat(fresh, snap, itemSides(fresh, 2, 12)).state.combatants['brynn']!.maxHp).toBe(30);

    const legacy = JSON.parse(JSON.stringify(snap)) as { combatants: { maxHp?: number }[] };
    for (const combatant of legacy.combatants) delete combatant.maxHp;
    expect(deserializeCombat(fresh, legacy, itemSides(fresh, 2, 12)).state.combatants['brynn']!.maxHp).toBe(
      12,
    );

    const sides = itemSides(fresh, 2);
    const uncapped: CombatRestoreRequest = {
      ...sides,
      allies: sides.allies.map((entry) => ({
        ...entry,
        profile: { ...entry.profile, maxHp: undefined, hp: -4 },
      })),
    };
    expect(deserializeCombat(fresh, legacy, uncapped).state.combatants['brynn']!.maxHp).toBe(0);
  });

  it('an over-spend and an unknown item id refuse with E-SNAP-01, all cards before any rebuild', () => {
    const { snap } = usedOnce();
    const tampered = JSON.parse(JSON.stringify(snap)) as {
      combatants: { id: string; itemsUsed?: Record<string, number>; maxHp?: number }[];
    };
    const brynn = tampered.combatants.find((combatant) => combatant.id === 'brynn')!;
    brynn.itemsUsed = { 'mend-salve': 3, 'moon-rock': 1 };
    brynn.maxHp = -1;
    const index = tampered.combatants.indexOf(brynn);
    const fresh = new Runtime(emberMarchesPack());
    expect(refusal(() => deserializeCombat(fresh, tampered, itemSides(fresh, 2)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: `combatants[${index}].maxHp` },
      { rule: 'E-SNAP-01', jsonPath: `combatants[${index}].itemsUsed.mend-salve` },
      { rule: 'E-SNAP-01', jsonPath: `combatants[${index}].itemsUsed.moon-rock` },
    ]);
    // A host that forgets to re-state the balances cannot cover the recorded spend either.
    const forgot = itemSides(fresh, 2);
    expect(
      refusal(() =>
        deserializeCombat(fresh, snap, {
          ...forgot,
          allies: forgot.allies.map(({ id, profile }) => ({ id, profile })),
        }),
      ),
    ).toEqual([{ rule: 'E-SNAP-01', jsonPath: `combatants[${index}].itemsUsed.mend-salve` }]);
    expect(fresh.nextCharacterId).toBe(1);
  });
});

/**
 * CA-S2 (spells-in-combat S02 ck4): the spell spend survives a snapshot. The
 * combatant records `poolsSpent`/`slotsCast`; the host re-states the
 * FIGHT-START balances, and restore = re-stated − spend. A spend the
 * re-stated balances cannot carry refuses (E-SNAP-01), all cards before any
 * rebuild.
 */
describe('spell spend snapshots (CA-S2)', () => {
  function spendSides(runtime: Runtime, bindings = true): CombatRestoreRequest {
    const base = profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'hexer');
    const hexer: CombatantProfile = {
      ...base,
      actions: ['strike', 'surge'],
      spells: ['grave-light'],
      initiativeBonus: 100,
      hp: 40,
    };
    const wight: CombatantProfile = {
      ...base,
      id: 'wight',
      actions: ['wight-claw'],
      initiativeBonus: -100,
      hp: 40,
    };
    return {
      allies: [
        {
          id: 'hexer',
          profile: hexer,
          balances: {
            pools: { stamina: 6 },
            boundSlots: { '1': 1 },
            ...(bindings ? { bindings: { '1': ['grave-light', null] } } : {}),
          },
        },
      ],
      enemies: [{ id: 'wight', profile: wight }],
    };
  }

  /** Cast grave-light (slot 0) and surge (2 stamina) mid-turn, then freeze through JSON text. */
  function spentFight(): { runtime: Runtime; fight: Combat; snap: CombatSnapshot } {
    const runtime = new Runtime(emberMarchesPack());
    const fight = startCombat(runtime, { ...spendSides(runtime), rng: new Rng('spend') });
    fight.step();
    expect(fight.declare('grave-light', { targetId: 'wight' }).some((e) => e.type === 'spell:cast')).toBe(
      true,
    );
    fight.declare('surge', { targetId: 'wight' });
    return {
      runtime,
      fight,
      snap: JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))),
    };
  }

  function refusal(run: () => unknown): { rule: string; jsonPath: string }[] {
    try {
      run();
    } catch (error) {
      return (error as { errors: readonly { rule: string; jsonPath: string }[] }).errors.map((card) => ({
        rule: card.rule,
        jsonPath: card.jsonPath,
      }));
    }
    throw new Error('expected a refusal');
  }

  /** Tamper with the hexer's frozen spend and return its index. */
  function tampered(
    snap: CombatSnapshot,
    spend: { poolsSpent?: Record<string, number>; slotsCast?: Record<string, number[]> },
  ): { snap: unknown; index: number } {
    const copy = JSON.parse(JSON.stringify(snap)) as { combatants: Record<string, unknown>[] };
    const index = copy.combatants.findIndex((combatant) => combatant['id'] === 'hexer');
    Object.assign(copy.combatants[index]!, spend);
    return { snap: copy, index };
  }

  it('round-trip: restored with the fight-start balances, pools/boundSlots/spend equal the live fight', () => {
    const { fight, snap } = spentFight();
    const frozen = snap.combatants.find((combatant) => combatant.id === 'hexer')!;
    expect(frozen.poolsSpent).toEqual({ stamina: 2 });
    expect(frozen.slotsCast).toEqual({ '1': [0] });
    const wightFrozen = snap.combatants.find((combatant) => combatant.id === 'wight')!;
    expect('poolsSpent' in wightFrozen || 'slotsCast' in wightFrozen).toBe(false);

    const fresh = new Runtime(emberMarchesPack());
    const restored = deserializeCombat(fresh, snap, spendSides(fresh));
    const live = fight.state.combatants['hexer']!;
    const back = restored.state.combatants['hexer']!;
    expect(back.pools).toEqual({ stamina: 4 });
    expect(back.pools).toEqual(live.pools);
    expect(back.boundSlots).toEqual({ '1': 0 });
    expect(back.boundSlots).toEqual(live.boundSlots);
    expect(back.slotsCast).toEqual(live.slotsCast);
    expect(back.poolsSpent).toEqual(live.poolsSpent);
    expect(back.bindings).toEqual({ '1': ['grave-light', null] });
    expect(back.spells).toEqual(['grave-light']);

    // The same cast is spent on both sides of the restore.
    for (const side of [fight, restored]) {
      const again = side.declare('grave-light', { targetId: 'wight' });
      expect(again[again.length - 1]!.payload['kind']).toBe('vancian');
    }
    // The next roll equals the uninterrupted fight's (FR-14): the same strike, the same dice.
    const strikeOf = (target: Combat, runtime: Runtime) => {
      const seen: RuntimeEvent[] = [];
      runtime.events.on((event) => {
        seen.push(event);
      });
      target.declare('strike', { targetId: 'wight' });
      return seen.filter((event) => event.type === 'attack:rolled').map((event) => event.payload);
    };
    const liveRoll = strikeOf(fight, fight.runtime);
    expect(liveRoll).toHaveLength(1);
    expect(strikeOf(restored, fresh)).toEqual(liveRoll);
  });

  it('an envelope without the v1.6 fields restores exactly as v1.5: nothing spent', () => {
    const runtime = new Runtime(emberMarchesPack());
    const fight = startCombat(runtime, { ...spendSides(runtime), rng: new Rng('unspent') });
    const snap = JSON.parse(
      JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' })),
    ) as CombatSnapshot;
    expect(
      snap.combatants.every((combatant) => !('poolsSpent' in combatant) && !('slotsCast' in combatant)),
    ).toBe(true);
    const back = deserializeCombat(runtime, snap, spendSides(runtime)).state.combatants['hexer']!;
    expect(back.pools).toEqual({ stamina: 6 });
    expect(back.boundSlots).toEqual({ '1': 1 });
    expect(back.poolsSpent).toEqual({});
    expect(back.slotsCast).toEqual({});
  });

  it('refuses an over-spend of a re-stated pool', () => {
    const { snap } = spentFight();
    const fresh = new Runtime(emberMarchesPack());
    const bad = tampered(snap, { poolsSpent: { stamina: 7 } });
    expect(refusal(() => deserializeCombat(fresh, bad.snap, spendSides(fresh)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: `combatants[${bad.index}].poolsSpent.stamina` },
    ]);
  });

  it('refuses a pool the restore request does not state', () => {
    const { snap } = spentFight();
    const fresh = new Runtime(emberMarchesPack());
    const bad = tampered(snap, { poolsSpent: { stamina: 2, motes: 1 } });
    expect(refusal(() => deserializeCombat(fresh, bad.snap, spendSides(fresh)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: `combatants[${bad.index}].poolsSpent.motes` },
    ]);
  });

  it('refuses a cast level with no re-stated slots', () => {
    const { snap } = spentFight();
    const fresh = new Runtime(emberMarchesPack());
    const bad = tampered(snap, { slotsCast: { '1': [0], '2': [0] } });
    expect(refusal(() => deserializeCombat(fresh, bad.snap, spendSides(fresh)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: `combatants[${bad.index}].slotsCast.2` },
    ]);
  });

  it('refuses an index past the re-stated bindings (or past the count without bindings)', () => {
    const { snap } = spentFight();
    const fresh = new Runtime(emberMarchesPack());
    const bad = tampered(snap, { slotsCast: { '1': [2] } });
    expect(refusal(() => deserializeCombat(fresh, bad.snap, spendSides(fresh)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: `combatants[${bad.index}].slotsCast.1[0]` },
    ]);
    const countOnly = tampered(snap, { slotsCast: { '1': [1] } });
    expect(refusal(() => deserializeCombat(fresh, countOnly.snap, spendSides(fresh, false)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: `combatants[${countOnly.index}].slotsCast.1[0]` },
    ]);
  });

  it('refuses an index whose re-stated binding is null', () => {
    const { snap } = spentFight();
    const fresh = new Runtime(emberMarchesPack());
    const bad = tampered(snap, { slotsCast: { '1': [1] } });
    expect(refusal(() => deserializeCombat(fresh, bad.snap, spendSides(fresh)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: `combatants[${bad.index}].slotsCast.1[0]` },
    ]);
  });

  it('refuses a duplicate index; all spend cards come together before any rebuild', () => {
    const { snap } = spentFight();
    const fresh = new Runtime(emberMarchesPack());
    const bad = tampered(snap, { slotsCast: { '1': [0, 0] }, poolsSpent: { stamina: 9 } });
    expect(refusal(() => deserializeCombat(fresh, bad.snap, spendSides(fresh)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: `combatants[${bad.index}].poolsSpent.stamina` },
      { rule: 'E-SNAP-01', jsonPath: `combatants[${bad.index}].slotsCast.1[1]` },
    ]);
  });
});

describe('the v1.6 envelope: offers, offeredCount, phase (DD-S14, CAP-S8)', () => {
  function refusal(run: () => unknown): { rule: string; jsonPath: string }[] {
    try {
      run();
    } catch (error) {
      return (error as { errors: readonly { rule: string; jsonPath: string }[] }).errors.map((card) => ({
        rule: card.rule,
        jsonPath: card.jsonPath,
      }));
    }
    throw new Error('expected a refusal');
  }

  /** brynn holds a reactive action and a reactive feat on the same event; the wight acts first. */
  function reactivePack() {
    const pack = emberMarchesPack();
    pack.actions['shrug-off'] = {
      cost: { slots: { reaction: 1 } },
      trigger: { on: 'condition:applied[target=self]' },
      effect: 'applyCondition(braced, 1)',
      tags: ['reaction'],
    };
    pack.actions['jeer'] = {
      cost: { slots: { reaction: 1 } },
      trigger: { on: 'damage:applied[target=brynn]' },
      effect: 'applyCondition(shaken, 1)',
      tags: ['reaction'],
    };
    return pack;
  }

  function reactiveSides(runtime: Runtime, brynnFirst = false): CombatRestoreRequest {
    const frame = (id: string): CombatantProfile =>
      profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, id);
    return {
      allies: [
        {
          id: 'brynn',
          profile: {
            ...frame('brynn'),
            actions: ['strike', 'shrug-off'],
            feats: ['second-gust'],
            initiativeBonus: brynnFirst ? 100 : -100,
          },
          balances: { items: { 'mend-salve': 1 } },
        },
      ],
      enemies: [
        {
          id: 'wight',
          profile: {
            ...frame('wight'),
            actions: ['grave-gaze', 'parry', 'jeer'],
            initiativeBonus: brynnFirst ? -100 : 100,
          },
        },
      ],
    };
  }

  function reactiveFight(brynnFirst = false): { runtime: Runtime; fight: Combat } {
    const runtime = new Runtime(reactivePack());
    const fight = startCombat(runtime, { ...reactiveSides(runtime, brynnFirst), rng: new Rng('envelope') });
    fight.step();
    return { runtime, fight };
  }

  function restored(fight: Combat, mutate: (snap: Record<string, unknown>) => void = () => undefined) {
    const snap = JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) as Record<
      string,
      unknown
    >;
    mutate(snap);
    const runtime = new Runtime(reactivePack());
    return deserializeCombat(runtime, snap, reactiveSides(runtime, fight.state.order[0] === 'brynn'));
  }

  it('two open offers for one combatant — an action and a feat — survive the round-trip in order, with the counter', () => {
    const { fight } = reactiveFight();
    fight.declare('grave-gaze', { targetId: 'brynn' });
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    expect(snap.offers).toEqual([
      { actorId: 'brynn', source: 'action', id: 'shrug-off', on: 'condition:applied' },
      { actorId: 'brynn', source: 'feat', id: 'second-gust', on: 'condition:applied' },
    ]);
    expect(snap.offeredCount).toBe(2);
    expect(snap.phase).toBe('resolved');
    const back = restored(fight);
    expect(back.pendingTriggers).toEqual(fight.pendingTriggers);
    expect(back.offeredCount).toBe(2);
    expect(back.state.phase).toBe('resolved');

    // The next offer continues the frozen count in both fights (R-GM-1).
    const nextIndex = (live: Combat) => {
      const seen: RuntimeEvent[] = [];
      live.runtime.events.on((event) => {
        seen.push(event);
      });
      live.respond('brynn.shrug-off', 'decline');
      live.respond('brynn.second-gust', 'decline');
      live.step(); // the wight's turn ends
      live.step(); // brynn's turn begins
      live.declare('strike', { targetId: 'wight' }); // attack:rolled offers the wight's parry
      return seen
        .filter((event) => event.type === 'trigger:fired')
        .map((event) => event.payload['offerIndex']);
    };
    expect(nextIndex(back)).toEqual([2]);
    expect(nextIndex(fight)).toEqual([2]);
  });

  it('R-GM-2: a use-raised offer restores into the live phase (awaiting-declare), not resolved', () => {
    const { fight } = reactiveFight(true);
    expect(fight.state.active).toBe('brynn');
    fight.use('mend-salve');
    expect(fight.pendingTriggers.map((offer) => offer.triggerId)).toEqual(['wight.jeer']);
    expect(fight.state.phase).toBe('awaiting-declare');
    const back = restored(fight);
    expect(back.state.phase).toBe('awaiting-declare');
    expect(back.pendingTriggers).toEqual(fight.pendingTriggers);
    // Without the envelope phase, the v1.5 derivation would say resolved.
    expect(restored(fight, (snap) => delete snap['phase']).state.phase).toBe('resolved');
  });

  it('a v1.5-shaped envelope (per-combatant pendingTrigger, no phase/offers/offeredCount) restores as before', () => {
    const { fight } = journeyFight('offer');
    fight.step();
    const attacker = fight.state.active;
    const victim = attacker === 'wight' ? 'brynn' : 'wight';
    fight.declare(attacker === 'wight' ? 'wight-claw' : 'strike');
    const legacy = JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) as {
      combatants: { id: string; pendingTrigger?: string }[];
    } & Record<string, unknown>;
    delete legacy['phase'];
    delete legacy['offeredCount'];
    delete legacy['offers'];
    legacy.combatants.find((combatant) => combatant.id === victim)!.pendingTrigger = 'parry';
    const fresh = new Runtime(emberMarchesPack());
    const back = deserializeCombat(fresh, legacy, journeyRestore(fresh));
    expect(back.state.phase).toBe('resolved');
    expect(back.offeredCount).toBe(0);
    expect(back.pendingTriggers).toEqual([
      {
        triggerId: `${victim}.parry`,
        actorId: victim,
        actionId: 'parry',
        source: 'action',
        matchingEvent: 'attack:rolled',
      },
    ]);
  });

  it('refuses, all cards at once: offers beside a pendingTrigger, an unknown actor, an id the source does not hold, combat-over with no side down, a bad counter', () => {
    const { fight } = reactiveFight();
    fight.declare('grave-gaze', { targetId: 'brynn' });
    const snap = JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) as {
      combatants: { id: string; pendingTrigger?: string }[];
    } & Record<string, unknown>;
    snap['offers'] = [
      { actorId: 'ghost', source: 'action', id: 'parry', on: 'attack:rolled' },
      { actorId: 'brynn', source: 'feat', id: 'shrug-off', on: 'condition:applied' },
      { actorId: 'brynn', source: 'action', id: 'second-gust', on: 'condition:applied' },
      { actorId: 'wight', source: 'action', id: 'grave-gaze', on: 'condition:applied' },
      { actorId: 'brynn', source: 'feat', id: 'second-gust', on: 'condition:applied' },
    ];
    snap.combatants.find((combatant) => combatant.id === 'wight')!.pendingTrigger = 'parry';
    snap['phase'] = 'combat-over';
    snap['offeredCount'] = -1;
    const fresh = new Runtime(reactivePack());
    const seen = fresh.events.sinceRound(0).length;
    expect(refusal(() => deserializeCombat(fresh, snap, reactiveSides(fresh)))).toEqual([
      { rule: 'E-SNAP-01', jsonPath: 'offers' },
      { rule: 'E-SNAP-01', jsonPath: 'offers[0].actorId' },
      { rule: 'E-SNAP-01', jsonPath: 'offers[1].id' },
      { rule: 'E-SNAP-01', jsonPath: 'offers[2].id' },
      { rule: 'E-SNAP-01', jsonPath: 'offers[3].id' },
      { rule: 'E-SNAP-01', jsonPath: 'phase' },
      { rule: 'E-SNAP-01', jsonPath: 'offeredCount' },
    ]);
    expect(fresh.events.sinceRound(0)).toHaveLength(seen);
  });

  it('combat-over in the envelope is accepted when the frozen hp do defeat a side', () => {
    const { fight } = reactiveFight();
    const back = restored(fight, (snap) => {
      snap['phase'] = 'combat-over';
      for (const combatant of snap['combatants'] as { id: string; hp: number }[]) {
        if (combatant.id === 'wight') combatant.hp = 0;
      }
    });
    expect(back.state.phase).toBe('combat-over');
  });
});
