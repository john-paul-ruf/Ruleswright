/**
 * CAP-G7 — the grid-combat journey (FR-11) across the real transport: the
 * generated dark-fantasy campaign (seed 42, the established fixture seed — no
 * hand-built fixture stands in for production data) → Runtime load (stage-8
 * validation inside the constructor is the load gate, CAP-G1/CA-G1) →
 * host-declared grid positions → the reach gate's declarative rejection → the
 * v1 movement seam (serialize → restore with updated positions — the engine
 * ships no move verb, so a gap closes only by restore, Design Decision 16) →
 * a burst shape resolving both sides through the executor with per-target
 * saves (CAP-G3/CA-G4) → the validity clause (CAP-G4/CA-G5) → snapshot
 * round-trip (CAP-G5/CA-G3) → the theater-of-mind parity leg on the same
 * generated content minus its spatial section.
 *
 * Dice are scripted (S03's ScriptedRng idiom): the queue holds intended die
 * faces and throws on exhaustion, so a drifted scenario fails loudly. The
 * burst's save d20s surface as executor outcomes (not why.rolls entries); the
 * branch damage rolls are the why.rolls trail. Scripted scenarios rebuild the
 * Combat over the injected stream (startCombat consumes it for initiative and
 * snapshots its state words; only the rebuild lets the script drive play).
 * `declare()` returns the round's event window (sinceRound), not one call's
 * events — resumed and post-restore legs therefore read a fresh local sink.
 *
 * The burst shape rides a data-only pack action added at test setup (FR-12's
 * proof-1 discipline — pack data, public surface only, zero engine diffs):
 * the generated themes ship burst spells in `content.spells` and the combat
 * loop declares `pack.actions`, so the action carries the generated spell's
 * verbatim cost + effect on the caster's action list. Dark-fantasy is
 * vancian: the spell is bound through the approved `prepareSpell` surface
 * first (the E-VANC-01 gate reads the bound slot). Wyldwood is pool-based:
 * no binding — the pool cost rides the balances, the session's alternative
 * cost family.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import {
  Runtime,
  knownSpells,
  prepareSpell,
  profileFromCharacter,
  spawnMonster,
  deserializeCombat,
  serializeCombat,
  type Position,
  type RuntimeEvent,
} from '../../src/runtime';
import { Combat, startCombat, type StartCombatRequest } from '../../src/runtime/combat/combat';
import { Rng } from '../../src/core/rng';
import type { Pack } from '../../src/schema/pack';

/**
 * A scripted dice stream (S03's idiom): the queue holds intended die faces
 * (1..sides); int(n) returns face − 1 because rollRecipe adds the +1 itself.
 * Throws on exhaustion — a drifted scenario fails loudly, never silently.
 * Extends Rng because Combat's constructor binds the concrete class.
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
      throw new Error(`dice script face ${face} out of range 1..${maxExclusive}`);
    }
    return face - 1;
  }
}

/** Seed 42 dark-fantasy — generated fresh at run time (no stale dist; FR-17). */
function darkFantasyPack(): Pack {
  return generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 });
}

/**
 * FR-12 proof-1 shape: the burst shape as pack data — the generated spell's
 * verbatim cost + effect on an action the combat loop can declare.
 */
function packWithBurstAction(base: Pack, spellId: string, actionId: string): Pack {
  const spell = base.content.spells?.[spellId];
  if (spell === undefined) throw new Error(`the generated pack lost its ${spellId} spell`);
  return {
    ...base,
    actions: { ...base.actions, [actionId]: { cost: spell.cost, effect: spell.effect, tags: ['casting'] } },
  };
}

/** The same generated pack, theater-of-mind: the optional spatial section is pack data — remove it and the pack never declared a grid. */
function stripSpatial(base: Pack): Pack {
  const stripped: Pack = { ...base };
  delete stripped.spatial;
  return stripped;
}

interface HeroOptions {
  readonly race?: string;
  readonly extraAction?: string;
}

/** A hero on a side: the approved character path, its instance id, a pinned initiative bonus, and its balances. */
function heroEntry(
  rt: Runtime,
  classId: string,
  instanceId: string,
  initiativeBonus: number,
  options: HeroOptions = {},
): StartCombatRequest['allies'][number] {
  const hero = rt.createCharacter({
    name: instanceId,
    race: options.race ?? 'hillfolk',
    classes: [{ id: classId, level: 3 }],
  });
  const pair = profileFromCharacter(rt, hero, instanceId);
  return {
    id: instanceId,
    profile: {
      ...pair.profile,
      initiativeBonus,
      ...(options.extraAction !== undefined
        ? { actions: [...pair.profile.actions, options.extraAction] }
        : {}),
    },
    balances: pair.balances,
  };
}

/**
 * The vancian caster: a hexer who has bound ember-bloom through the approved
 * `prepareSpell` surface — the E-VANC-01 gate reads the bound slot — with the
 * burst action on its action list.
 */
function boundBurstEntry(
  rt: Runtime,
  instanceId: string,
  burstAction: string,
): StartCombatRequest['allies'][number] {
  const hero = rt.createCharacter({
    name: instanceId,
    race: 'hillfolk',
    classes: [{ id: 'hexer', level: 3 }],
  });
  if (!knownSpells(rt, hero.state).includes('ember-bloom')) {
    throw new Error('the hexer cannot know ember-bloom — pack data drifted');
  }
  prepareSpell(rt, hero.state, 'ember-bloom');
  const entry = heroEntry(rt, 'hexer', instanceId, 100, { extraAction: burstAction });
  return { ...entry, balances: profileFromCharacter(rt, hero, instanceId).balances };
}

/** The bestiary path (FR-16): the same machinery characters use, instance id keyed. */
function foeEntry(
  rt: Runtime,
  statblock: string,
  instanceId: string,
  initiativeBonus = -100,
): StartCombatRequest['enemies'][number] {
  const profile = spawnMonster(rt, statblock, instanceId);
  return { id: instanceId, profile: { ...profile, initiativeBonus } };
}

/**
 * Start the fight and, for a scripted stream, rebuild the Combat over it:
 * startCombat consumes the stream for initiative and snapshots its state
 * words; the rebuild binds the same stream to play rolls (S03's harness
 * mechanics — otherwise the script would never drive a declare).
 */
function startFight(
  rt: Runtime,
  sides: { allies: StartCombatRequest['allies']; enemies: StartCombatRequest['enemies'] },
  positions: Record<string, Position> | undefined,
  rng: Rng | ScriptedRng,
): { fight: Combat; events: RuntimeEvent[] } {
  const seen: RuntimeEvent[] = [];
  rt.events.on((event) => seen.push(event));
  const request: StartCombatRequest = {
    allies: [...sides.allies],
    enemies: [...sides.enemies],
    ...(positions !== undefined ? { positions } : {}),
    rng,
  };
  const started = startCombat(rt, request);
  const fight = rng instanceof ScriptedRng ? new Combat(rt, started.state, rng) : started;
  return { fight, events: seen };
}

/** A fresh sink for one fight leg (declare() returns the round's window, not one call's events). */
function capture(rt: Runtime): { events: RuntimeEvent[]; release: () => void } {
  const events: RuntimeEvent[] = [];
  const sink = (event: RuntimeEvent) => events.push(event);
  rt.events.on(sink);
  return { events, release: () => rt.events.off(sink) };
}

/** Serialize → JSON text → parse: the FR-10 between-steps freeze, storage included. */
function roundTripSnapshot(fight: Combat): ReturnType<typeof serializeCombat> {
  return JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) as ReturnType<
    typeof serializeCombat
  >;
}

describe('CAP-G7 — the grid journey on the real generated pack (dark-fantasy, seed 42)', () => {
  it('generate → load: the pack ships the theme spatial model and loads through stage-8 validation (CAP-G1/G6, CA-G1)', () => {
    const rt = new Runtime(darkFantasyPack());
    expect(rt.pack.manifest.id).toBe('dark-fantasy');
    expect(rt.pack.spatial).toEqual({
      model: 'grid',
      reach: { default: 1, 'barrow-wight': 2 },
      shapes: ['single', 'burst'],
    });
    expect(rt.spatial.enabled).toBe(true);
    // The other generated themes carry their committed spatial declarations too (S04's record).
    expect(generateCampaign({ theme: loadTheme('zombie-urban'), seed: 42 }).spatial).toEqual({
      model: 'grid',
      reach: { default: 1, 'slab-brute': 2 },
      shapes: ['single', 'burst'],
    });
    expect(generateCampaign({ theme: loadTheme('wyldwood'), seed: 42 }).spatial).toEqual({
      model: 'grid',
      reach: { default: 1, 'hollow-wight': 2 },
      shapes: ['single', 'burst'],
    });
  });

  it('adjacency rejects: a 3-step hurl is refused declaratively (CAP-G2, CA-G2) with no state change', () => {
    const rt = new Runtime(darkFantasyPack());
    const hero = heroEntry(rt, 'hexer', 'brynn', 100);
    const foe = foeEntry(rt, 'barrow-wight', 'wight');
    const { fight } = startFight(
      rt,
      { allies: [hero], enemies: [foe] },
      { brynn: { x: 0, y: 0 }, wight: { x: 3, y: 0 } },
      new ScriptedRng([1, 1]),
    );
    expect(fight.state.active).toBe('brynn');
    const before = fight.serialize();
    // `hurl` carries no valid clause, so the SPATIAL gate is what fires
    // (the recorded declare gate order: validity → spatial → cost).
    const rejected = fight.declare('hurl', { targetId: 'wight' });
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.type).toBe('declare:rejected');
    expect(rejected[0]!.payload['kind']).toBe('spatial');
    expect(rejected[0]!.why.rule).toBe('E-SPAT-01');
    expect(String(rejected[0]!.payload['resource'])).toBe('wight');
    expect(String(rejected[0]!.payload['message'])).toContain('within reach 1');
    // Rejection with no durable change: hp untouched, ledger unspent, state identical.
    expect(fight.state.combatants['brynn']!.hp.current).toBe(hero.profile.hp);
    expect(fight.state.combatants['brynn']!.slots.remaining['main']).toBe(1);
    expect(fight.serialize()).toEqual(before);
  });

  it('the reach override extends the barrow-wight instance to 2 steps; a non-override instance stays at the default 1 (DD4)', () => {
    const rt = new Runtime(darkFantasyPack());
    const hero = heroEntry(rt, 'hexer', 'brynn', -100);
    // The override keys the combatant INSTANCE id: this instance is named
    // `barrow-wight`, the theme's override key, and reaches 2.
    const overrideFoe = foeEntry(rt, 'barrow-wight', 'barrow-wight', 100);
    const { fight } = startFight(
      rt,
      { allies: [hero], enemies: [overrideFoe] },
      { brynn: { x: 0, y: 0 }, 'barrow-wight': { x: 2, y: 0 } },
      new ScriptedRng([1, 1, 20, 3]),
    );
    // The override-bearing wight leads and reaches back 2: its cut-down
    // resolves through the gate (reach[profile.id] ?? reach.default, DD4).
    expect(fight.state.active).toBe('barrow-wight');
    const reachTwo = fight.declare('cut-down', { targetId: 'brynn' });
    expect(reachTwo.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(fight.state.phase).toBe('resolved');
    expect(fight.state.combatants['brynn']!.hp.current).toBe(hero.profile.hp - 3);
    // The hero's own default reach 1 cannot answer across those 2 steps.
    fight.step(); // the wight's turn ends → the hero's
    fight.step(); // the hero's turn begins
    expect(fight.state.active).toBe('brynn');
    const heroReject = fight.declare('hurl', { targetId: 'barrow-wight' });
    expect(heroReject[0]!.payload['kind']).toBe('spatial');
    // The same statblock under a non-override instance id falls back to the
    // default: its hasTarget(adjacent) resolves empty at distance 2 (the
    // validity gate reports it — the recorded order: validity → spatial).
    const plainFoe = foeEntry(rt, 'barrow-wight', 'wight', 100);
    const { fight: fallback } = startFight(
      rt,
      { allies: [hero], enemies: [plainFoe] },
      { brynn: { x: 0, y: 0 }, wight: { x: 2, y: 0 } },
      new ScriptedRng([1, 1]),
    );
    expect(fallback.state.active).toBe('wight');
    const validityReject = fallback.declare('cut-down', { targetId: 'brynn' });
    expect(validityReject[0]!.type).toBe('declare:rejected');
    expect(validityReject[0]!.payload['kind']).toBe('valid');
    expect(validityReject[0]!.why.rule).toBe('E-REF-01');
  });

  it('restore-close distance: serialize → restore with the target moved adjacent re-opens the gate (the v1 movement seam, DD16)', () => {
    const rt = new Runtime(darkFantasyPack());
    const hero = heroEntry(rt, 'hexer', 'brynn', 100);
    const foe = foeEntry(rt, 'barrow-wight', 'wight');
    const { fight } = startFight(
      rt,
      { allies: [hero], enemies: [foe] },
      { brynn: { x: 0, y: 0 }, wight: { x: 3, y: 0 } },
      new ScriptedRng([1, 1, 20, 3]),
    );
    expect(fight.state.active).toBe('brynn');
    expect(fight.declare('hurl', { targetId: 'wight' })[0]!.payload['kind']).toBe('spatial');
    // The FR-10 between-steps boundary: freeze the fight, and the host moves
    // the combatant by restoring with updated positions — no move verb exists.
    const snapshot = roundTripSnapshot(fight);
    const resumed = deserializeCombat(rt, snapshot, {
      allies: [hero],
      enemies: [foe],
      positions: { brynn: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
    });
    expect(resumed.state.active).toBe('brynn');
    expect(resumed.state.phase).toBe('awaiting-declare');
    expect(resumed.state.combatants['wight']!.position).toEqual({ x: 1, y: 0 });
    // The same declare now resolves: the gate re-enforced against the NEW
    // positions. (declare() returns the round window — the fresh leg's own
    // sink is the per-call evidence.)
    const leg = capture(rt);
    try {
      resumed.declare('hurl', { targetId: 'wight' });
      expect(resumed.state.phase).toBe('resolved');
      expect(leg.events.map((event) => event.type)).toEqual([
        'damage:applied',
        'attack:rolled',
        'action:resolved',
      ]);
    } finally {
      leg.release();
    }
  });

  it('burst: every in-radius combatant on both sides takes a per-target save with mixed branches; the out-of-radius one is untouched (CAP-G3, CA-G4)', () => {
    const rt = new Runtime(packWithBurstAction(darkFantasyPack(), 'ember-bloom', 'barrow-bloom-rite'));
    const caster = boundBurstEntry(rt, 'hexer', 'barrow-bloom-rite');
    const ally = heroEntry(rt, 'warden', 'brynn', -100);
    const foe = foeEntry(rt, 'barrow-wight', 'wight', 100);
    const bystander = foeEntry(rt, 'grave-shambles', 'shambles');
    // hexer @ (4,2) aims at wight @ (4,3): the burst-2 covers wight (0),
    // hexer itself (1), ally brynn (1) — side-blind (Design Decision 2);
    // shambles @ (8,8) is far outside. Burst scope follows initiative order
    // [hexer, wight, brynn] (the +100 foe ties the caster, allies break ties
    // first); execSave interleaves save → branch per target. The script lands
    // a MIX: hexer PASSES (20 + 3 ≥ 12 → damage(half) re-rolls 3d6[4,2,3]=9
    // → 5), wight and brynn FAIL (full 3d6 each).
    const dice = new ScriptedRng([
      1,
      1,
      1,
      1, // initiatives: hexer 1, brynn 1, wight 1, shambles 1 (pinned by the ±100 bonuses)
      20,
      4,
      2,
      3, // hexer: save 23 ≥ 12 → pass branch → damage(half) of 3d6[4,2,3]=9 → 5
      6,
      6,
      5,
      4, // wight: save 9 < 12 → fail branch → 3d6 = 15
      6,
      2,
      2,
      2, // brynn: save 6 < 12 → fail branch → 3d6 = 6
    ]);
    const { fight, events } = startFight(
      rt,
      { allies: [caster, ally], enemies: [foe, bystander] },
      { hexer: { x: 4, y: 2 }, wight: { x: 4, y: 3 }, brynn: { x: 4, y: 4 }, shambles: { x: 8, y: 8 } },
      dice,
    );
    expect(fight.state.active).toBe('hexer');
    const declared = fight.declare('barrow-bloom-rite', { targetId: 'wight' });
    expect(declared.some((event) => event.type === 'declare:rejected')).toBe(false);
    const damage = events.filter((event) => event.type === 'damage:applied');
    const damagedIds = damage.map((event) => event.target);
    // Side-blind burst: the caster's ally and the caster itself are in radius.
    expect(new Set(damagedIds)).toEqual(new Set(['wight', 'brynn', 'hexer']));
    expect(damagedIds).not.toContain('shambles');
    expect(fight.state.combatants['shambles']!.hp.current).toBe(11);
    // Mixed branches are the effect's data: the pass branch halves (5), the
    // fail branches roll full 3d6 (15, 6) — asserted per target, not by count.
    const totalOf = (id: string): number =>
      damage
        .filter((event) => event.target === id)
        .map((event) => event.payload['amount'] as number)
        .reduce((sum, amount) => sum + amount, 0);
    expect(totalOf('hexer')).toBe(5);
    expect(totalOf('wight')).toBe(15);
    expect(totalOf('brynn')).toBe(6);
    // The save d20s are executor outcomes (not why.rolls); the damage dice are
    // the per-target roll trail — the mock's anatomy (history accumulates).
    expect(damage[0]!.target).toBe('hexer');
    expect(damage[0]!.why.rolls).toEqual(['d6[4,2,3]-4=5']);
    expect(damage[1]!.target).toBe('wight');
    expect(damage[1]!.why.rolls[1]).toBe('d6[6,5,4]=15');
    expect(damage[2]!.target).toBe('brynn');
    expect(damage[2]!.why.rolls[2]).toBe('d6[2,2,2]=6');
    // The spell rode the normal action pipeline (FR-9): the vancian cost
    // consumed the bound level-2 slot; the burst costs no turn slots.
    expect(fight.state.combatants['hexer']!.boundSlots['2']).toBe(0);
    expect(fight.state.combatants['hexer']!.slots.remaining['main']).toBe(1);
  });

  it('the vancian gate: an unbound burst spell rejects E-VANC-01 with no durable change', () => {
    const rt = new Runtime(packWithBurstAction(darkFantasyPack(), 'ember-bloom', 'barrow-bloom-rite'));
    // The hero never prepares the spell — no level-2 binding, no cast.
    const unbound = heroEntry(rt, 'hexer', 'hexer', 100, { extraAction: 'barrow-bloom-rite' });
    const foe = foeEntry(rt, 'barrow-wight', 'wight');
    // Adjacent placement isolates the cost gate (spatial passes; the recorded
    // gate order is validity → spatial → cost).
    const { fight } = startFight(
      rt,
      { allies: [unbound], enemies: [foe] },
      { hexer: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
      new ScriptedRng([1, 1]),
    );
    expect(fight.state.active).toBe('hexer');
    const before = fight.serialize();
    const rejected = fight.declare('barrow-bloom-rite', { targetId: 'wight' });
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.type).toBe('declare:rejected');
    expect(rejected[0]!.payload['kind']).toBe('vancian');
    expect(rejected[0]!.why.rule).toBe('E-VANC-01');
    // No durable change: the ledger is unspent and the state is identical.
    expect(fight.state.combatants['hexer']!.slots.remaining['main']).toBe(1);
    expect(fight.serialize()).toEqual(before);
  });

  it('validity: hasTarget(adjacent) rejects when the shape resolves empty and passes once the target is in reach (CAP-G4, CA-G5)', () => {
    const rt = new Runtime(darkFantasyPack());
    const hero = heroEntry(rt, 'warden', 'brynn', -100);
    // The plain-statblock instance (no reach override): its cut-down carries
    // valid: 'hasTarget(adjacent)' — at distance 3 the shape resolves empty
    // and the clause rejects BEFORE the spatial gate.
    const foe = foeEntry(rt, 'barrow-wight', 'wight', 100);
    const { fight } = startFight(
      rt,
      { allies: [hero], enemies: [foe] },
      { brynn: { x: 0, y: 0 }, wight: { x: 3, y: 0 } },
      new ScriptedRng([1, 1]),
    );
    expect(fight.state.active).toBe('wight');
    const before = fight.serialize();
    const invalid = fight.declare('cut-down', { targetId: 'brynn' });
    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.type).toBe('declare:rejected');
    expect(invalid[0]!.payload['kind']).toBe('valid');
    expect(invalid[0]!.why.rule).toBe('E-REF-01');
    expect(String(invalid[0]!.payload['resource'])).toBe('cut-down');
    expect(fight.serialize()).toEqual(before);
    // Close the distance through the approved seam and the same action passes:
    // the resumed fight is active at the frozen turn (the wight's), and its
    // declare resolves — cut-down's d6 cannot down the 29-hp hero, so the leg
    // ends resolved, never combat-over.
    const snapshot = roundTripSnapshot(fight);
    const resumed = deserializeCombat(rt, snapshot, {
      allies: [hero],
      enemies: [foe],
      positions: { brynn: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
    });
    expect(resumed.state.active).toBe('wight');
    const leg = capture(rt);
    try {
      resumed.declare('cut-down', { targetId: 'brynn' });
      expect(resumed.state.phase).toBe('resolved');
      expect(leg.events.some((event) => event.type === 'declare:rejected')).toBe(false);
      expect(leg.events.some((event) => event.type === 'attack:rolled')).toBe(true);
      expect(leg.events.some((event) => event.type === 'action:resolved')).toBe(true);
    } finally {
      leg.release();
    }
  });

  it('round-trip: mid-fight snapshot → JSON → restore keeps the gates, the rng words, and the positions (CAP-G5, CA-G3)', () => {
    const rt = new Runtime(darkFantasyPack());
    const hero = heroEntry(rt, 'hexer', 'brynn', 100);
    const foe = foeEntry(rt, 'barrow-wight', 'wight');
    const { fight } = startFight(
      rt,
      { allies: [hero], enemies: [foe] },
      { brynn: { x: 0, y: 0 }, wight: { x: 3, y: 0 } },
      new ScriptedRng([2, 2, 20, 1]),
    );
    expect(fight.state.active).toBe('brynn');
    expect(fight.declare('hurl', { targetId: 'wight' })[0]!.payload['kind']).toBe('spatial');
    const snapshot = roundTripSnapshot(fight);
    // Same positions on restore → the gate holds against the restored grid.
    const resumed = deserializeCombat(rt, snapshot, {
      allies: [hero],
      enemies: [foe],
      positions: { brynn: { x: 0, y: 0 }, wight: { x: 3, y: 0 } },
    });
    expect(resumed.state.combatants['brynn']!.position).toEqual({ x: 0, y: 0 });
    expect(resumed.state.combatants['wight']!.position).toEqual({ x: 3, y: 0 });
    expect(resumed.state.rng).toEqual(fight.state.rng);
    const leg = capture(rt);
    try {
      const stillRejected = resumed.declare('hurl', { targetId: 'wight' });
      expect(stillRejected[0]!.payload['kind']).toBe('spatial');
      expect(stillRejected[0]!.why.rule).toBe('E-SPAT-01');
      // The restored gate refused with no durable change: one rejection card,
      // no resolution, the dice stream untouched by the refusal.
      expect(leg.events).toHaveLength(1);
      expect(resumed.state.phase).toBe('awaiting-declare');
      expect(resumed.state.rng).toEqual(fight.state.rng);
    } finally {
      leg.release();
    }
  });

  it('perf budget: the spatial round-loop (declare + step over 10 combatants) completes inside the documented budget', () => {
    const rt = new Runtime(darkFantasyPack());
    const hero = heroEntry(rt, 'hexer', 'hero', 100);
    const enemies = Array.from({ length: 9 }, (_, i) => foeEntry(rt, 'barrow-wight', `foe-${i}`, -100));
    // Adjacency is the working shape (Design Decision 16): a gap a declare can
    // never close would stalemate the loop, so every foe stands within reach.
    const positions: Record<string, Position> = { hero: { x: 0, y: 0 } };
    const ring: readonly Position[] = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ];
    enemies.forEach((entry, i) => {
      positions[entry.id] = ring[i % ring.length]!;
    });
    const started = performance.now();
    const fight = startCombat(rt, { allies: [hero], enemies, positions, rng: new Rng('grid-perf') });
    let guard = 0;
    let resolvedActions = 0;
    while (fight.state.round === 1 && guard < 200) {
      guard += 1;
      if (fight.state.phase === 'awaiting-declare') {
        const active = fight.state.combatants[fight.state.active]!;
        const target = fight.state.order.find(
          (id) =>
            fight.state.combatants[id]!.side !== active.side && fight.state.combatants[id]!.hp.current > 0,
        );
        if (target !== undefined) {
          for (const actionId of active.actions) {
            const events = fight.declare(actionId, { targetId: target });
            if (!events.some((event) => event.type === 'declare:rejected')) {
              resolvedActions += 1;
              break;
            }
          }
        }
      }
      const outcome = fight.step();
      if (outcome.kind === 'combat-over') break;
    }
    const elapsedMs = performance.now() - started;
    expect(resolvedActions).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(500);
  });

  it('determinism: two identical seeded journeys produce byte-equal event streams and state (FR-1)', () => {
    const runOnce = (): { events: RuntimeEvent[]; state: unknown } => {
      const rt = new Runtime(darkFantasyPack());
      const hero = heroEntry(rt, 'hexer', 'brynn', 100);
      const foe = foeEntry(rt, 'barrow-wight', 'wight');
      const { fight, events } = startFight(
        rt,
        { allies: [hero], enemies: [foe] },
        { brynn: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
        new Rng('grid-det'),
      );
      fight.step(); // brynn's turn begins
      fight.declare('hurl', { targetId: 'wight' });
      fight.step(); // end brynn's turn → the wight's turn
      fight.step(); // the wight's turn begins
      fight.declare('cut-down', { targetId: 'brynn' });
      return { events, state: fight.serialize() };
    };
    const first = runOnce();
    const second = runOnce();
    expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
    expect(second.state).toEqual(first.state);
    expect(first.events.some((event) => event.type === 'attack:rolled')).toBe(true);
  });
});

describe('theater-of-mind parity (the same journey on the generated content minus its spatial section: wyldwood, seed 42)', () => {
  it('no positions demanded, no reach rejections, hasTarget(adjacent) passes, the burst shape resolves to the bound target only', () => {
    const base = generateCampaign({ theme: loadTheme('wyldwood'), seed: 42 });
    const rt = new Runtime(packWithBurstAction(stripSpatial(base), 'ember-halo', 'thorn-bloom-rite'));
    expect(rt.spatial.enabled).toBe(false);
    const caster = heroEntry(rt, 'warden', 'caster', 100, {
      race: 'verge-born',
      extraAction: 'thorn-bloom-rite',
    });
    const ally = heroEntry(rt, 'hexer', 'ally', -100, { race: 'verge-born' });
    const foe = foeEntry(rt, 'thorn-wolf', 'foe');
    // No positions at all — a theater-of-mind fight never demands them (CA-G3).
    // Faces: initiatives ×3; the wolf's save 20 (19 + 0 presence ≥ dc 13 → the
    // PASS branch); its halved damage re-rolls 3d6[4,2,3]=9 → 5; the strike's
    // attack 5 (15 ≥ ac 12 → hit) and its d8+might damage 6 (+10 = 16).
    const dice = new ScriptedRng([1, 1, 1, 20, 4, 2, 3, 5, 6]);
    const { fight, events } = startFight(rt, { allies: [caster, ally], enemies: [foe] }, undefined, dice);
    expect(fight.state.active).toBe('caster');
    const motesBefore = fight.state.combatants['caster']!.pools['motes']!;
    expect(motesBefore).toBeGreaterThanOrEqual(4);
    // The burst shape (burst-2 around the bound target) resolves to the BOUND
    // TARGET ONLY — the no-op geometry answers every shape with the bound
    // targets and never rejects (Design Decision 3, the absent-column gate).
    const bloom = fight.declare('thorn-bloom-rite', { targetId: 'foe' });
    expect(bloom.some((event) => event.type === 'declare:rejected')).toBe(false);
    const bloomDamage = events.filter(
      (event) => event.type === 'damage:applied' && event.why.rule === 'actions.thorn-bloom-rite',
    );
    expect(bloomDamage.map((event) => event.target)).toEqual(['foe']);
    expect(bloomDamage[0]!.payload['amount']).toBe(5); // the pass branch's halved 3d6=9
    // The pool cost rode the balances (the pool-based theme needs no binding).
    expect(fight.state.combatants['caster']!.pools['motes']).toBe(motesBefore - 4);
    // hasTarget(adjacent) passes without any geometry — `strike` resolves at a
    // distance no spatial pack would allow (the wolf stands at hp 2: the blow
    // ends the fight through the engine's own side-defeated rule).
    const strike = fight.declare('strike', { targetId: 'foe' });
    expect(strike.some((event) => event.type === 'declare:rejected')).toBe(false);
    const strikeDamage = events.find(
      (event) => event.type === 'damage:applied' && event.why.rule === 'actions.strike',
    );
    expect(strikeDamage).toBeDefined();
    expect(strikeDamage!.target).toBe('foe');
    expect(fight.state.phase).toBe('combat-over');
    expect(events.filter((event) => event.type === 'combat:ended').map((event) => event.payload)).toEqual([
      { winner: 'allies', defeated: 'enemies' },
    ]);
  });
});
