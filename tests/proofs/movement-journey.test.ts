/**
 * CAP-M6 — the grid-movement journey on generated content, across the real
 * transport: `generateCampaign({theme, seed: 42})` (no hand-built fixture
 * stands in for production data) → `new Runtime(pack)` (stage-8 validation is
 * the load gate) → `profileFromCharacter` / `spawnMonster` (profiles carry the
 * theme's `formulas.speed`) → `startCombat({positions, terrain})` →
 * `fight.declare('<move>', {to})` → movement gate → walk (`move:*` events) →
 * leaving-reach offers → `respond` → resume → serialize → JSON → restore with
 * positions and terrain re-stated (DD-M12's derived `resolved` phase).
 *
 * Wyldwood is the hex theme (DD-M3): `glide` moves, `bramble-snap` punishes a
 * mover leaving reach, `bramble` costs 2 and a `standing-stone` blocks.
 * Dark-fantasy stays on the square grid (`stride`, `opportunist`, DD-M4).
 *
 * Dice: unlike grid-journey this suite runs on seeded `Rng` streams, not a
 * ScriptedRng — a restored fight rebuilds its stream from the snapshot's state
 * words, so only a real stream keeps the paused-move parity leg honest. A
 * move consumes no dice; where an outcome depends on a roll, the seed is
 * pinned and the rolled outcome asserted, so a drifted stream fails loudly.
 * `declare()`/`respond()` return the round window, not one call's events, so
 * every leg reads the runtime's own sink.
 *
 * At seed 42: a level-1 wyldwood warden and a thorn-wolf both have speed 5
 * (`5 + floor(grace / 4)`); a dark-fantasy warden has speed 4. Every class
 * also carries an `attack:rolled[target=self]` reaction (ward-step / parry),
 * so a taken opportunity attack raises a second offer the host answers.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import {
  Runtime,
  profileFromCharacter,
  spawnMonster,
  deserializeCombat,
  serializeCombat,
  startCombat,
  type Combat,
  type CombatRestoreRequest,
  type Position,
  type RuntimeEvent,
  type TerrainCell,
} from '../../src/runtime';
import { Rng } from '../../src/core/rng';
import type { Pack } from '../../src/schema/pack';

const SEED = 42;

function generated(themeId: 'wyldwood' | 'dark-fantasy'): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: SEED });
}

/** The same generated pack, theater-of-mind: remove the optional spatial section. */
function stripSpatial(base: Pack): Pack {
  const stripped: Pack = { ...base };
  delete stripped.spatial;
  return stripped;
}

type Sides = Pick<CombatRestoreRequest, 'allies' | 'enemies'>;

/** A level-1 hero of the theme's first class (the approved character path) plus one statblock foe. */
function duel(rt: Runtime, statblock: string): Sides {
  const race = Object.keys(rt.pack.content.races ?? {})[0]!;
  const classId = Object.keys(rt.pack.content.classes ?? {})[0]!;
  const hero = rt.createCharacter({ name: 'hero', race, classes: [{ id: classId, level: 1 }] });
  const pair = profileFromCharacter(rt, hero, 'hero');
  return {
    allies: [{ id: 'hero', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
    enemies: [{ id: 'foe', profile: { ...spawnMonster(rt, statblock, 'foe'), initiativeBonus: -100 } }],
  };
}

interface Fight {
  readonly rt: Runtime;
  readonly fight: Combat;
  readonly events: RuntimeEvent[];
}

function recorded(rt: Runtime): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  rt.events.on((event) => {
    events.push(event);
  });
  return events;
}

/** Start a duel on a generated pack; the hero's turn has begun. */
function duelFight(
  pack: Pack,
  statblock: string,
  positions: Readonly<Record<string, Position>> | undefined,
  terrain: readonly TerrainCell[] = [],
  seed = 'movement-journey',
): Fight {
  const rt = new Runtime(pack);
  const events = recorded(rt);
  const fight = startCombat(rt, {
    ...duel(rt, statblock),
    ...(positions !== undefined ? { positions } : {}),
    terrain,
    rng: new Rng(seed),
  });
  fight.step();
  return { rt, fight, events };
}

function ofType(events: readonly RuntimeEvent[], type: string): RuntimeEvent[] {
  return events.filter((event) => event.type === type);
}

/** Serialize → JSON text → parse: the between-steps freeze, storage included. */
function roundTrip(fight: Combat): ReturnType<typeof serializeCombat> {
  return JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) as ReturnType<
    typeof serializeCombat
  >;
}

/** A wall and a bramble patch between the hero at (0,0) and (2,0) on the hex grid. */
const WALL_AND_BRAMBLE: readonly TerrainCell[] = [
  { at: { x: 1, y: 0 }, kind: 'standing-stone' },
  { at: { x: 1, y: -1 }, kind: 'standing-stone' },
  { at: { x: 1, y: 1 }, kind: 'bramble' },
];
const FAR = { hero: { x: 0, y: 0 }, foe: { x: 8, y: 0 } } as const;

describe('CAP-M6 — generated themes move (wyldwood hex, seed 42)', () => {
  it('step 1 — load: hex model, terrain kinds, formulas.speed; glide + bramble-snap on every class and statblock (CAP-M1, CA-M6/F-P4)', () => {
    const rt = new Runtime(generated('wyldwood'));
    expect(rt.pack.spatial?.model).toBe('hex');
    expect(rt.pack.spatial?.terrain).toEqual({ bramble: { cost: 2 }, 'standing-stone': { blocks: true } });
    expect(rt.pack.formulas['speed']).toEqual({ expr: '5 + floor(grace / 4)' });
    expect(rt.pack.actions['glide']).toEqual({
      cost: { slots: { move: 1 } },
      effect: 'move(speed)',
      tags: ['move'],
    });
    expect(rt.pack.actions['bramble-snap']!.trigger).toEqual({ on: 'move:leaving-reach[target=self]' });
    expect(rt.pack.actions['bramble-snap']!.effect).toBe(rt.pack.actions['strike']!.effect);
    for (const [classId, def] of Object.entries(rt.pack.content.classes ?? {}))
      expect(def.actions, classId).toEqual(expect.arrayContaining(['glide', 'bramble-snap']));
    for (const [statblock, block] of Object.entries(rt.pack.bestiary)) {
      expect(block.actions, statblock).toEqual(expect.arrayContaining(['glide', 'bramble-snap']));
      expect(spawnMonster(rt, statblock).speed, statblock).toBeGreaterThanOrEqual(5);
    }
  });

  it('step 2 — a hex glide walks around a standing-stone wall and pays 2 for bramble (CAP-M1/M2/M3)', () => {
    const { fight, events } = duelFight(generated('wyldwood'), 'thorn-wolf', FAR, WALL_AND_BRAMBLE);
    const hero = () => fight.state.combatants['hero']!;
    expect(hero().speed).toBe(5);
    expect(fight.state.combatants['foe']!.speed).toBe(5);

    fight.declare('glide', { to: { x: 2, y: 0 } });
    expect(ofType(events, 'declare:rejected')).toEqual([]);
    const advanced = ofType(events, 'move:advanced');
    expect(advanced.map((event) => event.payload)).toEqual([
      {
        from: { x: 0, y: 0 },
        to: { x: 2, y: 0 },
        path: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: 2, y: 0 },
        ],
        cost: 4,
        remaining: 1,
      },
    ]);
    expect(ofType(events, 'move:ended').map((event) => event.payload)).toEqual([
      { reason: 'arrived', at: { x: 2, y: 0 } },
    ]);
    expect(advanced[0]!.why.rule).toBe('actions.glide');
    expect(hero().position).toEqual({ x: 2, y: 0 });
    expect(hero().slots.remaining['move']).toBe(0);
  });

  it('step 3 — the five rejection kinds are one E-SPAT-01 declare:rejected each and change nothing (CA-M3)', () => {
    const ring: TerrainCell[] = [
      { x: 1, y: 0 },
      { x: 1, y: -1 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
    ].map((offset) => ({ at: { x: 4 + offset.x, y: -4 + offset.y }, kind: 'standing-stone' }));
    const cases: readonly [string, Position | undefined][] = [
      ['no-destination', undefined],
      ['blocked', { x: 1, y: 0 }],
      ['occupied', { x: 8, y: 0 }],
      ['unreachable', { x: 4, y: -4 }],
      ['out-of-range', { x: -6, y: 0 }],
    ];
    for (const [kind, to] of cases) {
      const { fight } = duelFight(generated('wyldwood'), 'thorn-wolf', FAR, [...WALL_AND_BRAMBLE, ...ring]);
      const before = JSON.stringify(fight.serialize());
      const answered = fight.declare('glide', to === undefined ? {} : { to });
      expect(
        answered.map((event) => [event.type, event.why.rule, event.payload['kind']]),
        kind,
      ).toEqual([['declare:rejected', 'E-SPAT-01', kind]]);
      expect(JSON.stringify(fight.serialize()), kind).toBe(before);
      expect(fight.state.combatants['hero']!.slots.remaining['move'], kind).toBe(1);
    }
  });

  it('step 4 — leaving reach: bramble-snap pauses the glide; a JSON snapshot restores it; take resumes identically in both fights (CAP-M4/M5, CA-M4/M5)', () => {
    const terrain: readonly TerrainCell[] = [{ at: { x: -2, y: 1 }, kind: 'bramble' }];
    const adjacent = { hero: { x: 0, y: 0 }, foe: { x: 1, y: 0 } };
    const destination = { x: -3, y: 0 };
    const a = duelFight(generated('wyldwood'), 'thorn-wolf', adjacent, terrain, 'leaving-reach');
    a.fight.declare('glide', { to: destination });

    expect(
      ofType(a.events, 'move:leaving-reach').map((event) => [event.actor, event.target, event.payload]),
    ).toEqual([['hero', 'foe', { at: { x: 0, y: 0 }, next: { x: -1, y: 0 } }]]);
    expect(a.fight.pendingTriggers).toEqual([
      {
        triggerId: 'foe.bramble-snap',
        actorId: 'foe',
        actionId: 'bramble-snap',
        source: 'action',
        matchingEvent: 'move:leaving-reach',
      },
    ]);
    expect(a.fight.state.combatants['hero']!.pendingMove).toEqual({
      actionId: 'glide',
      to: destination,
      remaining: 5,
    });

    // Snapshot here → JSON → restore on a fresh runtime (positions from the snapshot, same terrain).
    const snap = roundTrip(a.fight);
    const positions: Record<string, Position> = {};
    for (const frozen of snap.combatants) positions[frozen.id] = frozen.position!;
    const rtB = new Runtime(generated('wyldwood'));
    const eventsB = recorded(rtB);
    const fightB = deserializeCombat(rtB, snap, { ...duel(rtB, 'thorn-wolf'), positions, terrain });
    const b = { rt: rtB, fight: fightB, events: eventsB };
    expect(b.fight.state.phase).toBe('resolved');
    expect(b.fight.pendingTriggers).toEqual(a.fight.pendingTriggers);
    expect(b.fight.pendingTriggers[0]!.matchingEvent).toBe('move:leaving-reach');
    expect(b.fight.state.combatants['hero']!.pendingMove).toEqual(
      a.fight.state.combatants['hero']!.pendingMove,
    );

    const from = { a: a.events.length, b: b.events.length };
    for (const side of [a, b]) {
      side.fight.respond('foe.bramble-snap', 'take', 'hero');
      // The opportunity attack raised the hero's own attack:rolled reaction; the host declines it.
      expect(side.fight.pendingTriggers.map((offer) => offer.triggerId)).toEqual(['hero.ward-step']);
      expect(side.fight.state.combatants['hero']!.pendingMove).toBeDefined();
      side.fight.respond('hero.ward-step', 'decline');
      expect(side.fight.pendingTriggers).toEqual([]);
      expect(side.fight.state.combatants['hero']!.pendingMove).toBeUndefined();
      expect(side.fight.state.combatants['hero']!.position).toEqual(destination);
    }

    const tail = (events: readonly RuntimeEvent[], start: number) =>
      events.slice(start).map((event) => ({
        type: event.type,
        at: event.at,
        actor: event.actor,
        target: event.target,
        // R-GM-1: offerIndex restarts at 0 after a restore — compare trigger:fired without it.
        payload: event.type === 'trigger:fired' ? { ...event.payload, offerIndex: undefined } : event.payload,
      }));
    const tailA = tail(a.events, from.a);
    expect(tail(b.events, from.b)).toEqual(tailA);
    const types = tailA.map((event) => event.type);
    expect(types).toContain('attack:rolled');
    expect(types).toContain('damage:applied');
    expect(types.slice(-2)).toEqual(['move:advanced', 'move:ended']);
    const attack = tailA.find((event) => event.type === 'attack:rolled')!;
    expect([attack.actor, attack.target]).toEqual(['foe', 'hero']);
    // F-P1: no offer is re-raised — the only offers after the answer are the hero's own reaction, once.
    expect(tailA.filter((event) => event.type === 'trigger:fired').map((event) => event.actor)).toEqual([
      'hero',
    ]);
    expect(ofType(a.events, 'move:leaving-reach')).toHaveLength(1);
    expect(b.fight.state.combatants['hero']!.hp).toEqual(a.fight.state.combatants['hero']!.hp);
    expect(b.fight.state.combatants['foe']!.slots).toEqual(a.fight.state.combatants['foe']!.slots);
  });

  it('step 5 — rooted restricts the move tag: glide is rejected as restricted (CA-M6: no new code)', () => {
    const { fight } = duelFight(generated('wyldwood'), 'thorn-wolf', FAR);
    fight.state.combatants['hero']!.conditions.push({ conditionId: 'rooted', duration: 1 });
    const before = JSON.stringify(fight.serialize());
    const answered = fight.declare('glide', { to: { x: -2, y: 0 } });
    expect(answered.map((event) => [event.type, event.payload['kind'], event.payload['resource']])).toEqual([
      ['declare:rejected', 'restricted', 'move'],
    ]);
    expect(JSON.stringify(fight.serialize())).toBe(before);
  });

  it('step 6 — square parity (dark-fantasy): stride diagonals cost 1; a monster’s opportunist fires the same way (DD-M4)', () => {
    const pack = generated('dark-fantasy');
    expect(pack.spatial?.model).toBe('grid');
    const diagonal = duelFight(pack, 'grave-shambles', { hero: { x: 0, y: 0 }, foe: { x: 8, y: 0 } });
    expect(diagonal.fight.state.combatants['hero']!.speed).toBe(4);
    diagonal.fight.declare('stride', { to: { x: 3, y: 3 } });
    expect(ofType(diagonal.events, 'move:advanced').map((event) => event.payload)).toEqual([
      {
        from: { x: 0, y: 0 },
        to: { x: 3, y: 3 },
        path: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
        cost: 3,
        remaining: 1,
      },
    ]);

    const { fight, events } = duelFight(pack, 'grave-shambles', {
      hero: { x: 0, y: 0 },
      foe: { x: 1, y: 0 },
    });
    fight.declare('stride', { to: { x: -3, y: 0 } });
    expect(ofType(events, 'move:leaving-reach').map((event) => [event.actor, event.target])).toEqual([
      ['hero', 'foe'],
    ]);
    expect(fight.pendingTriggers.map((offer) => [offer.triggerId, offer.matchingEvent])).toEqual([
      ['foe.opportunist', 'move:leaving-reach'],
    ]);
    expect(fight.state.combatants['hero']!.position).toEqual({ x: 0, y: 0 });
    fight.respond('foe.opportunist', 'take', 'hero');
    const attack = ofType(events, 'attack:rolled').pop()!;
    expect([attack.actor, attack.target]).toEqual(['foe', 'hero']);
    expect(attack.why.rule).toMatch(/^actions\.opportunist\b/);
    for (const offer of [...fight.pendingTriggers]) fight.respond(offer.triggerId, 'decline');
    expect(fight.pendingTriggers).toEqual([]);
    expect(fight.state.combatants['hero']!.position).toEqual({ x: -3, y: 0 });
    expect(ofType(events, 'move:ended').pop()!.payload).toEqual({ reason: 'arrived', at: { x: -3, y: 0 } });
  });

  it('step 7 — theater parity: wyldwood minus spatial loads; glide is a no-op success; terrain rides along unconsulted (CAP-M7, CA-M7)', () => {
    const pack = stripSpatial(generated('wyldwood'));
    const terrain: TerrainCell[] = [
      { at: { x: 0, y: 0 }, kind: 'lava' },
      { at: { x: 0, y: 0 }, kind: 'lava' },
    ];
    const { fight, events } = duelFight(pack, 'thorn-wolf', undefined, terrain);
    expect(fight.state.terrain).toEqual(terrain);
    fight.declare('glide', { to: { x: 9, y: 9 } });
    expect(ofType(events, 'declare:rejected')).toEqual([]);
    expect(events.filter((event) => event.type.startsWith('move:'))).toEqual([]);
    expect(ofType(events, 'action:resolved').pop()!.payload).toEqual({ actionId: 'glide', targetId: 'hero' });
    expect(fight.state.combatants['hero']!.position).toBeUndefined();
    expect(fight.state.combatants['hero']!.slots.remaining['move']).toBe(0);
  });
});

/** Axial hex distance (DD-M2) and the fixed hex neighbor order. */
function hexDistance(a: Position, b: Position): number {
  const dq = a.x - b.x;
  const dr = a.y - b.y;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
const HEX_NEIGHBORS: readonly Position[] = [
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
];

/** Answer every open offer by declining it (a paused move resumes once the queue empties). */
function declineAll(fight: Combat): void {
  while (fight.pendingTriggers.length > 0) fight.respond(fight.pendingTriggers[0]!.triggerId, 'decline');
}

/**
 * The automated 2-vs-2 loop: the active combatant glides next to its nearest
 * standing foe when out of reach, then strikes it. Returns the steps taken.
 */
function closeTheGap(fight: Combat, limit: number): number {
  const isOver = () => fight.state.phase === 'combat-over';
  let steps = 0;
  while (!isOver() && steps < limit) {
    steps += 1;
    if (fight.step().kind !== 'turn-started') continue;
    const self = fight.state.combatants[fight.state.active]!;
    const foes = Object.values(fight.state.combatants)
      .filter((other) => other.side !== self.side && other.hp.current > 0)
      .sort((x, y) => hexDistance(self.position!, x.position!) - hexDistance(self.position!, y.position!));
    const target = foes[0];
    if (target === undefined) continue;
    if (hexDistance(self.position!, target.position!) > 1) {
      const cells = HEX_NEIGHBORS.map((step) => ({
        x: target.position!.x + step.x,
        y: target.position!.y + step.y,
      }))
        .map((cell) => ({ cell, distance: hexDistance(self.position!, cell) }))
        .sort((x, y) => x.distance - y.distance);
      for (const { cell } of cells) {
        const answered = fight.declare('glide', { to: cell });
        declineAll(fight);
        if (!answered.some((event) => event.type === 'declare:rejected' && event.actor === self.id)) break;
      }
    }
    if (isOver()) break;
    fight.declare('strike', { targetId: target.id });
    declineAll(fight);
  }
  return steps;
}

function closingFight(): Fight {
  const rt = new Runtime(generated('wyldwood'));
  const events = recorded(rt);
  const race = Object.keys(rt.pack.content.races ?? {})[0]!;
  const hero = (id: string, initiativeBonus: number) => {
    const character = rt.createCharacter({ name: id, race, classes: [{ id: 'warden', level: 1 }] });
    const pair = profileFromCharacter(rt, character, id);
    return { id, profile: { ...pair.profile, initiativeBonus }, balances: pair.balances };
  };
  const wolf = (id: string, initiativeBonus: number) => ({
    id,
    profile: { ...spawnMonster(rt, 'thorn-wolf', id), initiativeBonus },
  });
  const fight = startCombat(rt, {
    allies: [hero('ash', 20), hero('rowan', 10)],
    enemies: [wolf('wolf-a', 15), wolf('wolf-b', 5)],
    positions: {
      ash: { x: 0, y: 0 },
      rowan: { x: 0, y: 1 },
      'wolf-a': { x: 4, y: 0 },
      'wolf-b': { x: 4, y: 1 },
    },
    rng: new Rng('close-the-gap'),
  });
  return { rt, fight, events };
}

describe('CAP-M6 — determinism and the retired stalemate', () => {
  it('step 8 — two runs of the same seed and script are byte-equal in events and state', () => {
    const run = () => {
      const { fight, events } = closingFight();
      closeTheGap(fight, 200);
      return { events: JSON.stringify(events), state: JSON.stringify(fight.serialize()) };
    };
    const [first, second] = [run(), run()];
    expect(second.events).toBe(first.events);
    expect(second.state).toBe(first.state);
  });

  it('step 9 — monsters close the gap: a 2-vs-2 fight started 4 cells apart ends in combat-over within 200 steps (DD16 retired)', () => {
    const { fight, events } = closingFight();
    expect(hexDistance({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(4);
    const steps = closeTheGap(fight, 200);
    expect(fight.state.phase).toBe('combat-over');
    expect(steps).toBeLessThanOrEqual(200);
    const movers = new Set(ofType(events, 'move:advanced').map((event) => event.actor));
    expect([...movers].some((id) => id?.startsWith('wolf'))).toBe(true);
    expect(ofType(events, 'damage:applied').length).toBeGreaterThan(0);
  });
});
