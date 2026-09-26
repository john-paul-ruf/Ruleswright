/**
 * CAP-7 checkpoint 2 — combat snapshots (FR-14): the envelope, the resume
 * proof, and the CA-1 refusal paths (no-mutation on refusal).
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { createCharacter } from '../../src/runtime/character';
import { serializeCombat, deserializeCombat, serializeCharacter, serializeParty } from '../../src/runtime/snapshots';
import type { CombatRestoreRequest } from '../../src/runtime/snapshots';
import { profileFromStatblock, type CombatantProfile } from '../../src/runtime/combat/resolve';
import { startCombat, type Combat } from '../../src/runtime/combat/combat';
import type { RuntimeEvent } from '../../src/runtime/events';
import { emberMarchesPack } from '../runtime/fixtures/packs';
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
  const brynn: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'), actions: ['strike', 'withdraw'] };
  const wight: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'), actions: ['wight-claw', 'parry'] };
  const fight = startCombat(runtime, { allies: [{ id: 'brynn', profile: brynn }], enemies: [{ id: 'wight', profile: wight }], rng: new Rng(seed) });
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
  throw new Error(`never reached ${id}'s declare phase (phase=${fight.state.phase}, active=${fight.state.active})`);
}

/** A restore request mirroring the journey fight's sides. */
function journeyRestore(runtime: Runtime): CombatRestoreRequest {
  const brynn: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'), actions: ['strike', 'withdraw'] };
  const wight: CombatantProfile = { ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'), actions: ['wight-claw', 'parry'] };
  return { allies: [{ id: 'brynn', profile: brynn }], enemies: [{ id: 'wight', profile: wight }] };
}

describe('combat snapshots (FR-14, CAP-7)', () => {
  it('the envelope carries exactly the contract fields — no extras, no omissions', () => {
    const { fight } = journeyFight('env');
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    expect(Object.keys(snap).sort()).toEqual(['combatants', 'kind', 'order', 'pack', 'pairsWith', 'rng', 'round', 'snapshotVersion', 'turn']);
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
    const resumableProfileBrynn: CombatantProfile = { ...profileFromStatblock(resumableRuntime.pack, resumableRuntime.pack.bestiary['barrow-wight']!, 'brynn'), actions: ['strike', 'withdraw'] };
    const resumableProfileWight: CombatantProfile = { ...profileFromStatblock(resumableRuntime.pack, resumableRuntime.pack.bestiary['barrow-wight']!, 'wight'), actions: ['wight-claw', 'parry'] };
    const resumable = startCombat(resumableRuntime, { allies: [{ id: 'brynn', profile: resumableProfileBrynn }], enemies: [{ id: 'wight', profile: resumableProfileWight }], rng: new Rng(seed) });

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
    const restored = deserializeCombat(freshRuntime, JSON.parse(JSON.stringify(snap)), journeyRestore(freshRuntime));

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
    expect(restored.state.combatants['brynn']!.hp.current).toBe(uninterrupted.state.combatants['brynn']!.hp.current);
  });
});

describe('combat restore refusal paths (CA-1: loud refusal, no mutation)', () => {
  it('a tampered contentHash refuses with E-SNAP-01 and the fresh runtime stays untouched', () => {
    const { fight } = journeyFight('refusal');
    const snap = serializeCombat(fight, { pairsWith: 'party-1' });
    const tampered = JSON.parse(JSON.stringify(snap)) as typeof snap;
    tampered.pack.contentHash = '9a02b1c4';
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
    expect(() => deserializeCombat(freshRuntime, JSON.parse(JSON.stringify(snap)), { allies: partial.allies, enemies: [] })).toThrow();
    try {
      deserializeCombat(freshRuntime, JSON.parse(JSON.stringify(snap)), { allies: partial.allies, enemies: [] });
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