/**
 * CAP-S4 — the spells-in-combat journey through the BUILT package (the
 * feature's first narrow journey). Every import is a direct dist path — the
 * artifact a consumer installs — never src/ (run `pnpm build` first; the
 * freshness test fails on a stale dist).
 *
 * No mocked boundary: the generated packs (seed 42) supply the content, and
 * every step runs through `Runtime`, the character verbs, `profileFromCharacter`,
 * `Combat`, the real serializers and `settleSpellCasts`.
 *
 * Harness facts (Planner probe, reviews F-P1/F-P2):
 * - `startCombat` without `rng` rolls `new Rng(0)` and the dist surface exports
 *   no `Rng`, so dice are SEEDED, not scripted: assert structure and spend,
 *   plus determinism (two runs, equal event streams).
 * - `step()` never passes a turn: every combatant between the caster's two
 *   turns declares; each in-between declare is named below.
 * - Initiative is pinned by profile `initiativeBonus` overrides (the
 *   grid-journey idiom).
 * - A seeded fight has no bounded guarantee of ending, so both legs end
 *   through the hp-0-via-restore harness: every enemy's `hp` is set to 0 in
 *   the snapshot JSON and `deserializeCombat` derives `combat-over`. Only HOW
 *   the fight ends is harnessed; the spend, the restore, the settlement and
 *   the character round-trip are the production path.
 * - The spell legs claim no ledger or turn continuity across a restore; the
 *   feat leg continues the frozen fight (the v1.6 envelope keeps `offers`,
 *   `offeredCount` and `phase`, DD-S14).
 *
 * Layout: freshness → vancian leg (dark-fantasy, grid) → pool leg (wyldwood,
 * hex) → determinism → feat leg (dark-fantasy, grid; CAP-S6).
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../dist/compiler.js';
import * as runtimeDist from '../../dist/runtime.js';
import {
  Runtime,
  deserializeCombat,
  knownSpells,
  prepareSpell,
  profileFromCharacter,
  restoreCharacter,
  serializeCharacter,
  serializeCombat,
  settleSpellCasts,
  spawnMonster,
  startCombat,
} from '../../dist/runtime.js';
import type { Combat, CombatRestoreRequest, CombatSnapshot, RuntimeEvent } from '../../dist/runtime.js';
import type { Pack } from '../../dist/schema.js';

const SEED = 42;

function packFor(themeId: string): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: SEED });
}

/** The events one call emitted (declare() returns the round window, not one call's events). */
function during(rt: Runtime, work: () => unknown): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  const sink = (event: RuntimeEvent) => events.push(event);
  rt.events.on(sink);
  try {
    work();
  } finally {
    rt.events.off(sink);
  }
  return events;
}

/** Serialize → JSON text → parse: the FR-14 freeze, storage included. */
function frozen(fight: Combat): CombatSnapshot {
  return JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) as CombatSnapshot;
}

/**
 * The end-of-fight harness: every enemy at hp 0 in the snapshot JSON, restored
 * with the same request — restore derives `combat-over` from the end rule.
 */
function endedThroughRestore(rt: Runtime, fight: Combat, request: CombatRestoreRequest): Combat {
  const snapshot = frozen(fight) as unknown as { combatants: { id: string; hp: number }[] };
  const enemies = new Set(request.enemies.map((entry) => entry.id));
  for (const combatant of snapshot.combatants) if (enemies.has(combatant.id)) combatant.hp = 0;
  const ended = deserializeCombat(rt, snapshot, request);
  expect(ended.state.phase).toBe('combat-over');
  return ended;
}

/** The standing combatants within `radius` (Chebyshev) of a grid cell, from the fight's own state. */
function standingWithin(fight: Combat, center: { x: number; y: number }, radius: number): string[] {
  return fight.state.order.filter((id) => {
    const combatant = fight.state.combatants[id]!;
    const at = combatant.position;
    return (
      combatant.hp.current > 0 &&
      at !== undefined &&
      Math.max(Math.abs(at.x - center.x), Math.abs(at.y - center.y)) <= radius
    );
  });
}

describe('CAP-S4 — dist freshness', () => {
  it('the built runtime exports settleSpellCasts and learnFeat, and the built compiler ships the v1.6 spell data', () => {
    expect(typeof runtimeDist.settleSpellCasts).toBe('function');
    expect(typeof runtimeDist.learnFeat).toBe('function');
    const bloom = packFor('dark-fantasy').content.spells!['ember-bloom']!;
    // `move: 1` is the whole-turn cost (DD-S9; a revert item if DD-S9 becomes main-only).
    expect(bloom.cost).toEqual({ vancian: 2, slots: { main: 1, move: 1 } });
    expect(bloom.targeting).toEqual({ shape: 'burst', radius: 2, range: 6 });
  });
});

/** The vancian leg (dark-fantasy, seed 42, grid): one level-3 hexer against two enemies. */
function vancianLeg(): { events: RuntimeEvent[]; wightHpAfterFirstBlast: number } {
  const rt = new Runtime(packFor('dark-fantasy'));
  const events: RuntimeEvent[] = [];
  rt.events.on((event) => events.push(event));

  // 1. Three level-2 slots; ember-bloom prepared twice.
  const hexer = rt.createCharacter({ name: 'hexer', race: 'hillfolk', classes: [{ id: 'hexer', level: 3 }] });
  expect(hexer.state.slots['2']).toEqual([null, null, null]);
  prepareSpell(rt, hexer.state, 'ember-bloom');
  prepareSpell(rt, hexer.state, 'ember-bloom');
  expect(hexer.state.slots['2']).toEqual(['ember-bloom', 'ember-bloom', null]);

  // 2. The character bridge.
  const pair = profileFromCharacter(rt, hexer, 'hexer');
  expect(pair.profile.hp).toBe(11); // v1.8 hexer array: vigor 1 → 6 + level 3 + 1·2
  expect(pair.profile.spells).toContain('ember-bloom');

  // 3. The wight stands 4 away; the shambles (a second enemy, hp 11) stands
  // outside every burst, so no blast can end the fight before the later steps.
  const request: CombatRestoreRequest = {
    allies: [{ id: 'hexer', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
    enemies: [
      { id: 'wight', profile: { ...spawnMonster(rt, 'barrow-wight', 'wight'), initiativeBonus: 0 } },
      {
        id: 'shambles',
        profile: { ...spawnMonster(rt, 'grave-shambles', 'shambles'), initiativeBonus: -100 },
      },
    ],
    positions: { hexer: { x: 0, y: 0 }, wight: { x: 4, y: 0 }, shambles: { x: 10, y: 0 } },
  };
  const fight = startCombat(rt, request);
  expect(fight.state.order).toEqual(['hexer', 'wight', 'shambles']);
  expect(fight.state.combatants['shambles']!.hp.current).toBe(11);
  expect(fight.step()).toMatchObject({ kind: 'turn-started', combatantId: 'hexer' });

  // 4. The real spell on the wight (distance 4, within range 6). The burst
  // around (4,0) misses the hexer (4 away) and the shambles (6 away).
  const cast = during(rt, () => fight.declare('ember-bloom', { targetId: 'wight' }));
  expect(cast[0]!.type).toBe('spell:cast');
  expect(cast[0]!.payload).toMatchObject({
    spellId: 'ember-bloom',
    targetId: 'wight',
    slotLevel: '2',
    slotIndex: 0,
  });
  expect(cast[0]!.why.rule).toBe('content.spells.ember-bloom');
  const firstHits = cast.filter((event) => event.type === 'damage:applied').map((event) => event.target);
  expect(firstHits.every((id) => id === 'wight')).toBe(true);
  expect(cast[cast.length - 1]!.type).toBe('action:resolved');
  // The cast took the whole turn (DD-S9; a revert item): a same-turn stride is refused, nothing changes.
  const beforeStride = fight.serialize();
  const stride = during(rt, () => fight.declare('stride', { to: { x: 0, y: 1 } }));
  expect(stride).toHaveLength(1);
  expect(stride[0]!.payload).toMatchObject({ kind: 'slot-exhausted', resource: 'move' });
  expect(stride[0]!.why.rule).toBe('E-ECON-01');
  expect(fight.serialize()).toEqual(beforeStride);

  // 5. The enemies' turns: each in-between declare is a dice-free stride.
  const wightHpAfterFirstBlast = fight.state.combatants['wight']!.hp.current;
  const wightStoodAfterFirstBlast = wightHpAfterFirstBlast > 0;
  expect(fight.step()).toMatchObject({ kind: 'turn-ended', combatantId: 'hexer' });
  if (wightStoodAfterFirstBlast) {
    expect(fight.step()).toMatchObject({ kind: 'turn-started', combatantId: 'wight' });
    // Its reach (2) cannot reach the hexer 4 away: a stride is its one legal declare.
    const rngBefore = fight.state.rng;
    const moved = during(rt, () => fight.declare('stride', { to: { x: 5, y: 0 } }));
    expect(moved.map((event) => event.type)).toEqual(['move:advanced', 'move:ended', 'action:resolved']);
    expect(fight.state.rng).toEqual(rngBefore);
    expect(fight.step()).toMatchObject({ kind: 'turn-ended', combatantId: 'wight' });
  }
  expect(fight.step()).toMatchObject({ kind: 'turn-started', combatantId: 'shambles' });
  const shambled = during(rt, () => fight.declare('stride', { to: { x: 10, y: 1 } }));
  expect(shambled[shambled.length - 1]!.type).toBe('action:resolved');
  expect(fight.step()).toMatchObject({ kind: 'round-completed', round: 1 });
  expect(fight.step()).toMatchObject({ kind: 'turn-started', combatantId: 'hexer' });

  // 6. An empty-cell blast on the hexer's next turn: (4,1) is 4 from the hexer.
  const cell = { x: 4, y: 1 };
  expect(Object.values(fight.state.combatants).some((c) => c.position?.x === 4 && c.position.y === 1)).toBe(
    false,
  );
  const expected = standingWithin(fight, cell, 2);
  expect(expected).not.toContain('hexer');
  expect(expected).not.toContain('shambles');
  const blast = during(rt, () => fight.declare('ember-bloom', { at: cell }));
  expect(blast[0]!.type).toBe('spell:cast');
  expect(blast[0]!.payload).toMatchObject({ spellId: 'ember-bloom', at: cell, slotLevel: '2', slotIndex: 1 });
  expect('targetId' in blast[0]!.payload).toBe(false);
  expect(blast[0]!.target).toBeUndefined();
  const blastHits = [
    ...new Set(blast.filter((event) => event.type === 'damage:applied').map((event) => event.target)),
  ];
  expect(blastHits).toEqual(expected);
  expect(blast[blast.length - 1]!.payload).toEqual({ actionId: 'ember-bloom', at: cell });
  // Beyond range: (8,0) is 8 away — refused before any cost, nothing changes.
  const beforeFar = fight.serialize();
  const far = during(rt, () => fight.declare('ember-bloom', { at: { x: 8, y: 0 } }));
  expect(far).toHaveLength(1);
  expect(far[0]!.payload).toMatchObject({ kind: 'out-of-range', resource: '8,0' });
  expect(far[0]!.why.rule).toBe('E-SPAT-01');
  expect(fight.serialize()).toEqual(beforeFar);

  // 7. Snapshot → JSON text → restore with the SAME fight-start request: the
  // spend is the snapshot's (CA-S2). No ledger/turn continuity is claimed here.
  const restored = deserializeCombat(rt, frozen(fight), request);
  expect(fight.state.combatants['hexer']!.slotsCast).toEqual({ '2': [0, 1] });
  expect(restored.state.combatants['hexer']!.slotsCast).toEqual({ '2': [0, 1] });
  expect(restored.state.combatants['hexer']!.boundSlots['2']).toBe(0);
  // No uncast slot is bound to it any more (the binding pick runs before the turn-slot spend).
  const again = during(rt, () => restored.declare('ember-bloom', { at: cell }));
  expect(again).toHaveLength(1);
  expect(again[0]!.payload['kind']).toBe('vancian');
  expect(again[0]!.why.rule).toBe('E-VANC-01');

  // 8. End of the fight through the restore harness (see the header).
  const ended = endedThroughRestore(rt, restored, request);

  // 9. Settle: both cast slots empty on the character.
  const settled = settleSpellCasts(rt, hexer, ended, 'hexer');
  expect(settled.map((event) => [event.type, event.payload['slotIndex']])).toEqual([
    ['slot:settled', 0],
    ['slot:settled', 1],
  ]);
  expect(hexer.state.slots['2']).toEqual([null, null, null]);

  // 10. The character snapshot round-trip keeps them empty.
  const back = restoreCharacter(rt, JSON.parse(JSON.stringify(serializeCharacter(rt, hexer.state))));
  expect(back.state.slots['2']).toEqual([null, null, null]);
  return { events, wightHpAfterFirstBlast };
}

/** The pool leg (wyldwood, seed 42, hex): a level-3 hexer casts hex-bolt from its motes. */
function poolLeg(): { events: RuntimeEvent[] } {
  const rt = new Runtime(packFor('wyldwood'));
  const events: RuntimeEvent[] = [];
  rt.events.on((event) => events.push(event));

  // The class/spell choice: the wyldwood hexer (spellLists ['hexer']) knows
  // hex-bolt; hedge-mage (spellLists ['hedge-mage']) knows its own 4 spells.
  const hexer = rt.createCharacter({
    name: 'hexer',
    race: 'verge-born',
    classes: [{ id: 'hexer', level: 3 }],
  });
  expect(rt.pack.content.classes!['hexer']!.spellLists).toEqual(['hexer']);
  expect(knownSpells(rt, hexer.state)).toEqual(
    expect.arrayContaining(['hex-bolt', 'cold-clasp', 'thorn-wake']),
  );
  expect(rt.pack.content.spells!['hex-bolt']).toMatchObject({
    cost: { points: { pool: 'motes', amount: 2 }, slots: { main: 1, move: 1 } },
    targeting: { shape: 'single', range: 6 },
  });
  expect(hexer.state.pools['motes']).toBe(9); // mote-base 6 + insight 3 (v1.8 hexer array)

  const pair = profileFromCharacter(rt, hexer, 'hexer');
  const request: CombatRestoreRequest = {
    allies: [{ id: 'hexer', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
    enemies: [
      { id: 'wolf', profile: { ...spawnMonster(rt, 'thorn-wolf', 'wolf'), initiativeBonus: 0 } },
      { id: 'shade', profile: { ...spawnMonster(rt, 'briar-shade', 'shade'), initiativeBonus: -100 } },
    ],
    // Axial hex: the wolf is 3 away (within range 6); the shade stands out of the way.
    positions: { hexer: { x: 0, y: 0 }, wolf: { x: 3, y: 0 }, shade: { x: 0, y: 8 } },
  };
  const fight = startCombat(rt, request);
  expect(fight.state.combatants['wolf']!.hp.current).toBe(7);
  expect(fight.state.combatants['shade']!.hp.current).toBe(9);
  expect(fight.step()).toMatchObject({ kind: 'turn-started', combatantId: 'hexer' });

  const cast = during(rt, () => fight.declare('hex-bolt', { targetId: 'wolf' }));
  expect(cast[0]!.payload).toEqual({
    spellId: 'hex-bolt',
    targetId: 'wolf',
    cost: 'points',
    pool: 'motes',
    amount: 2,
  });
  expect(fight.state.combatants['hexer']!.poolsSpent).toEqual({ motes: 2 });
  expect(fight.state.combatants['hexer']!.pools['motes']).toBe(7);

  // Snapshot → JSON → restore with the fight-start request keeps the spend.
  const snap = frozen(fight);
  expect(snap.combatants.find((combatant) => combatant.id === 'hexer')!.poolsSpent).toEqual({ motes: 2 });
  const restored = deserializeCombat(rt, snap, request);
  expect(restored.state.combatants['hexer']!.poolsSpent).toEqual({ motes: 2 });
  expect(restored.state.combatants['hexer']!.pools['motes']).toBe(9 - 2);

  // The same end harness (see the header), then settle and round-trip.
  const ended = endedThroughRestore(rt, restored, request);
  const settled = settleSpellCasts(rt, hexer, ended, 'hexer');
  expect(settled.map((event) => [event.type, event.payload])).toEqual([
    ['pool:settled', { combatantId: 'hexer', pool: 'motes', amount: 2 }],
  ]);
  expect(hexer.state.pools['motes']).toBe(7);
  const back = restoreCharacter(rt, JSON.parse(JSON.stringify(serializeCharacter(rt, hexer.state))));
  expect(back.state.pools['motes']).toBe(7);
  return { events };
}

describe('CAP-S4 — the vancian leg (dark-fantasy, seed 42, grid)', () => {
  it('prepare twice → profile → two enemies → real ember-bloom → named in-between strides → empty-cell blast → snapshot/restore → harnessed end → settle → character round-trip', () => {
    const { wightHpAfterFirstBlast } = vancianLeg();
    // The seeded run's branch, recorded: the wight stands (Planner's emulation: 15 → 10).
    expect(wightHpAfterFirstBlast).toBe(10);
  });
});

describe('CAP-S4 — the pool leg (wyldwood, seed 42, hex)', () => {
  it('hexer / hex-bolt: motes spent → snapshot/restore keeps poolsSpent → harnessed end → settle 9 → 7 → round-trip', () => {
    poolLeg();
  });
});

describe('CAP-S4 — determinism (FR-1)', () => {
  it('two runs of each leg with the same seed produce JSON-equal event streams', () => {
    expect(JSON.stringify(vancianLeg().events)).toBe(JSON.stringify(vancianLeg().events));
    expect(JSON.stringify(poolLeg().events)).toBe(JSON.stringify(poolLeg().events));
  });
});

/**
 * The feat leg (CAP-S6 end to end; dark-fantasy, seed 42, grid). A hexer who
 * learned `second-gust` is hexbound by an adjacent wight's `grave-gaze` (either
 * save branch applies it). The production path, no doubles: `learnFeat` →
 * `profileFromCharacter` → `startCombat` → a monster `declare` → the offer
 * queue → serialize/restore (DD-S14) → `respond`.
 */
describe('CAP-S6 — the feat leg (dark-fantasy, seed 42, grid)', () => {
  it('learnFeat → profile → grave-gaze offers second-gust → snapshot/restore keeps offers + offeredCount → take (braced, no chain) → hexbound blocks ember-bloom → character round-trip keeps feats', () => {
    const rt = new Runtime(packFor('dark-fantasy'));

    // 1. The hexer learns the reactive feat and binds ember-bloom.
    const hexer = rt.createCharacter({
      name: 'hexer',
      race: 'hillfolk',
      classes: [{ id: 'hexer', level: 3 }],
    });
    hexer.learnFeat('second-gust');
    expect(hexer.state.feats).toEqual(['second-gust']);
    prepareSpell(rt, hexer.state, 'ember-bloom');

    // 2. The bridge carries the held reactive feat; the wight stands adjacent and acts first.
    const pair = profileFromCharacter(rt, hexer, 'hexer');
    expect(pair.profile.feats).toEqual(['second-gust']);
    const request: CombatRestoreRequest = {
      allies: [{ id: 'hexer', profile: { ...pair.profile, initiativeBonus: -100 }, balances: pair.balances }],
      enemies: [
        { id: 'wight', profile: { ...spawnMonster(rt, 'barrow-wight', 'wight'), initiativeBonus: 100 } },
      ],
      positions: { hexer: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
    };
    const fight = startCombat(rt, request);
    expect(fight.state.order).toEqual(['wight', 'hexer']);
    expect(fight.step()).toMatchObject({ kind: 'turn-started', combatantId: 'wight' });

    // 3. grave-gaze hexbinds the hexer, and the held feat is offered (source feat).
    const gaze = during(rt, () => fight.declare('grave-gaze', { targetId: 'hexer' }));
    const hexbound = gaze.find((event) => event.type === 'condition:applied');
    expect(hexbound).toMatchObject({ target: 'hexer', payload: { conditionId: 'hexbound' } });
    const fired = gaze.filter((event) => event.type === 'trigger:fired');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({
      actor: 'hexer',
      payload: {
        triggerId: 'hexer.second-gust',
        actionId: 'second-gust',
        source: 'feat',
        on: 'condition:applied',
      },
      why: { rule: 'content.feats.second-gust.trigger' },
    });
    expect(gaze.indexOf(hexbound!)).toBeLessThan(gaze.indexOf(fired[0]!));

    // 4. Freeze → JSON → restore: the open feat offer and the offer counter survive.
    const snap = frozen(fight);
    expect(snap.offers).toEqual([
      { actorId: 'hexer', source: 'feat', id: 'second-gust', on: 'condition:applied' },
    ]);
    expect(snap.offeredCount).toBe((fired[0]!.payload['offerIndex'] as number) + 1);
    const restored = deserializeCombat(rt, snap, request);
    expect(restored.offeredCount).toBe(snap.offeredCount);
    expect(restored.pendingTriggers).toEqual(fight.pendingTriggers);
    expect(restored.state.phase).toBe(fight.state.phase);

    // 5. Take: braced on the hexer under the feat's rule, and no second offer (the no-chain rule).
    const taken = during(rt, () => restored.respond('hexer.second-gust', 'take'));
    expect(
      taken.map((event) => [event.type, event.target, event.payload['conditionId'], event.why.rule]),
    ).toEqual([['condition:applied', 'hexer', 'braced', 'content.feats.second-gust']]);
    expect(restored.pendingTriggers).toEqual([]);

    // 6. The wight's turn is over (it declared); the hexer is next. hexbound
    // restricts spells.tagged:casting (DD-S10): ember-bloom is refused, nothing spent.
    expect(restored.step()).toMatchObject({ kind: 'turn-ended', combatantId: 'wight' });
    expect(restored.step()).toMatchObject({ kind: 'turn-started', combatantId: 'hexer' });
    const before = restored.serialize();
    const blocked = during(rt, () => restored.declare('ember-bloom', { targetId: 'wight' }));
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.type).toBe('declare:rejected');
    expect(blocked[0]!.payload['kind']).toBe('restricted');
    expect(restored.serialize()).toEqual(before);

    // 7. The character snapshot keeps the learned feat.
    const back = restoreCharacter(rt, JSON.parse(JSON.stringify(serializeCharacter(rt, hexer.state))));
    expect(back.state.feats).toEqual(['second-gust']);
  });
});
