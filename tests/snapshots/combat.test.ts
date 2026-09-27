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
import { emberMarchesPack, withSpatial } from '../runtime/fixtures/packs';
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
      'order',
      'pack',
      'pairsWith',
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
    expect(Object.keys(snap.combatants[0]!).sort()).toEqual(['conditions', 'hp', 'id', 'slotsUsed']);
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
    const offered = snap.combatants.find((combatant) => combatant.pendingTrigger !== undefined);
    expect(offered).toBeDefined();
    expect(offered!.pendingTrigger).toBe('parry');
    expect(offered!.id).toBe(victim);
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
});
