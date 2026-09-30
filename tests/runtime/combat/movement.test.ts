/**
 * grid-movement S03 — the movement column on the real path (CAP-M2/M3/M7):
 * `new Runtime(validated fixture pack)` → `spawnMonster` / `profileFromCharacter`
 * (profiles carry `speed` when `formulas.speed` is declared) →
 * `startCombat({positions, terrain})` → `step()` → `declare('stride', {to})` →
 * movement gate → `spend` → `executeAgainst` → `move` statement → `apply.move`
 * → the walk (`move:advanced` / `move:ended`), then serialize → JSON → restore
 * with positions and terrain re-stated. No mocked boundary: every fight runs
 * the production combat loop on the hex fixture pack.
 */
import { describe, expect, it } from 'vitest';
import { emberMarchesHexPack, emberMarchesPack } from '../fixtures/packs';
import { profileFromStatblock } from '../../../src/runtime/combat/resolve';
import { Runtime } from '../../../src/runtime/runtime';
import { createCharacter } from '../../../src/runtime/character';
import { spawnMonster } from '../../../src/runtime/bestiary';
import { profileFromCharacter } from '../../../src/runtime/character-profile';
import { grantItem } from '../../../src/runtime/inventory';
import { useItem } from '../../../src/runtime/equipment';
import { startCombat, type Combat, type CombatantState } from '../../../src/runtime/combat/combat';
import type { CombatantProfile } from '../../../src/runtime/combat/resolve';
import type { Position, TerrainCell } from '../../../src/runtime/combat/spatial';
import { serializeCombat, deserializeCombat } from '../../../src/runtime/snapshots';
import type { RuntimeEvent } from '../../../src/runtime/events';
import type { Pack } from '../../../src/schema/pack';
import { Rng } from '../../../src/core/rng';

interface Sides {
  readonly allies: { id: string; profile: CombatantProfile }[];
  readonly enemies: { id: string; profile: CombatantProfile }[];
}

/** The hero (warden, level 1, speed 4) always acts first; the wight (level 2, speed 5) second. */
function sides(runtime: Runtime): Sides {
  const hero = createCharacter(runtime, { name: 'Brynn', race: 'ashling', classes: ['warden'] });
  const heroProfile = {
    ...profileFromCharacter(runtime, hero, 'hero').profile,
    initiativeBonus: 100,
    hp: 40,
  };
  const wight = { ...spawnMonster(runtime, 'barrow-wight', 'wight'), initiativeBonus: -100, hp: 40 };
  return { allies: [{ id: 'hero', profile: heroProfile }], enemies: [{ id: 'wight', profile: wight }] };
}

function hexFight(
  positions: Readonly<Record<string, Position>>,
  terrain: readonly TerrainCell[] = [],
  pack: Pack = emberMarchesHexPack(),
): { runtime: Runtime; fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(pack);
  const events: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    events.push(event);
  });
  const fight = startCombat(runtime, { ...sides(runtime), positions, terrain, rng: new Rng('movement') });
  fight.step(); // the hero's turn begins
  return { runtime, fight, events };
}

const APART = { hero: { x: 0, y: 0 }, wight: { x: 6, y: 0 } } as const;

function combatant(fight: Combat, id: string): CombatantState {
  return fight.state.combatants[id]!;
}

describe('the move column (CAP-M2, CA-M2/CA-M3)', () => {
  it('a hero and a monster move: position changes, events ordered, the move slot is spent', () => {
    const { fight, events } = hexFight(APART);
    expect(combatant(fight, 'hero').speed).toBe(4);
    expect(combatant(fight, 'wight').speed).toBe(5);

    const heroEvents = fight.declare('stride', { to: { x: 3, y: 0 } });
    expect(combatant(fight, 'hero').position).toEqual({ x: 3, y: 0 });
    expect(combatant(fight, 'hero').slots.remaining['move']).toBe(0);
    const heroMove = events.filter(
      (event) => event.type.startsWith('move:') || event.type === 'action:resolved',
    );
    expect(heroMove.map((event) => event.type)).toEqual(['move:advanced', 'move:ended', 'action:resolved']);
    expect(heroMove[0]!.payload).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 3, y: 0 },
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      cost: 3,
      remaining: 1,
    });
    expect(heroMove[1]!.payload).toEqual({ reason: 'arrived', at: { x: 3, y: 0 } });
    for (const event of heroMove) {
      expect(event.actor).toBe('hero');
      expect(event.why.rule).toBe('actions.stride');
    }
    expect(heroEvents.some((event) => event.type === 'move:advanced')).toBe(true);

    fight.step(); // hero's turn ends
    fight.step(); // wight's turn begins
    expect(fight.state.active).toBe('wight');
    fight.declare('stride', { to: { x: 4, y: 0 } });
    expect(combatant(fight, 'wight').position).toEqual({ x: 4, y: 0 });
    expect(combatant(fight, 'wight').slots.remaining['move']).toBe(0);
    expect(events.filter((event) => event.type === 'move:ended').pop()!.payload).toEqual({
      reason: 'arrived',
      at: { x: 4, y: 0 },
    });
  });

  it('a difficult (bramble) cell costs 2 to enter', () => {
    const { fight, events } = hexFight(APART, [{ at: { x: 1, y: 0 }, kind: 'bramble' }]);
    fight.declare('stride', { to: { x: 1, y: 0 } });
    expect(events.find((event) => event.type === 'move:advanced')!.payload).toMatchObject({
      cost: 2,
      remaining: 2,
    });
  });

  it('each rejection is one declare:rejected (E-SPAT-01) and changes nothing — state, rng words, ledger', () => {
    const ring: TerrainCell[] = [
      { x: 1, y: 0 },
      { x: 1, y: -1 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
    ].map((offset) => ({ at: { x: 3 + offset.x, y: -3 + offset.y }, kind: 'standing-stone' }));
    const cases: readonly [string, Position | undefined, string][] = [
      ['no-destination', undefined, 'stride'],
      ['blocked', { x: 3, y: -2 }, '3,-2'],
      ['occupied', { x: 6, y: 0 }, '6,0'],
      ['occupied', { x: 0, y: 0 }, '0,0'], // F-P10a: the mover's own cell
      ['unreachable', { x: 3, y: -3 }, '3,-3'],
      ['out-of-range', { x: -5, y: 0 }, '-5,0'],
    ];
    for (const [kind, to, resource] of cases) {
      const { fight } = hexFight(APART, ring);
      const before = fight.serialize();
      const events = fight.declare('stride', to === undefined ? {} : { to });
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('declare:rejected');
      expect(events[0]!.why.rule).toBe('E-SPAT-01');
      expect(events[0]!.payload['kind']).toBe(kind);
      expect(events[0]!.payload['resource']).toBe(resource);
      expect(fight.serialize()).toEqual(before);
      expect(fight.state.rng).toEqual(before.rng);
      expect(combatant(fight, 'hero').slots.remaining).toEqual(before.combatants['hero']!.slots.remaining);
      expect(combatant(fight, 'hero').slots.remaining['move']).toBe(1);
    }
    const { fight } = hexFight(APART);
    const outOfRange = fight.declare('stride', { to: { x: -5, y: 0 } });
    expect(outOfRange[0]!.payload['message']).toBe(
      'the cheapest legal path to (-5,0) costs 5, but the movement budget is 4.',
    );
  });

  it('rooted (restricts actions.tagged:move) rejects stride as restricted — no new code', () => {
    const { fight } = hexFight(APART);
    combatant(fight, 'hero').conditions.push({ conditionId: 'rooted', duration: 1 });
    const before = fight.serialize();
    const events = fight.declare('stride', { to: { x: 1, y: 0 } });
    expect(events[0]!.payload['kind']).toBe('restricted');
    expect(events[0]!.payload['resource']).toBe('move');
    expect(fight.serialize()).toEqual(before);
  });

  it('the engine-derived speed shadows an ability named speed', () => {
    const base = emberMarchesHexPack();
    const pack: Pack = {
      ...base,
      stats: { ...base.stats, abilities: [...base.stats.abilities, 'speed'] },
      formulas: { ...base.formulas, speed: { expr: '2' } },
      bestiary: {
        ...base.bestiary,
        'barrow-wight': {
          ...base.bestiary['barrow-wight']!,
          abilityOverrides: { ...base.bestiary['barrow-wight']!.abilityOverrides, speed: 9 },
        },
      },
    };
    const runtime = new Runtime(pack);
    const wight = { ...spawnMonster(runtime, 'barrow-wight', 'wight'), initiativeBonus: 100 };
    expect(wight.abilities['speed']).toBe(9);
    expect(wight.speed).toBe(2);
    const foe = { ...spawnMonster(runtime, 'grave-shambles', 'foe'), initiativeBonus: -100 };
    const fight = startCombat(runtime, {
      allies: [{ id: 'wight', profile: wight }],
      enemies: [{ id: 'foe', profile: foe }],
      positions: { wight: { x: 0, y: 0 }, foe: { x: 8, y: 0 } },
    });
    fight.step();
    const events = fight.declare('stride', { to: { x: 3, y: 0 } });
    expect(events[0]!.payload['kind']).toBe('out-of-range');
    expect(events[0]!.payload['message']).toContain('the movement budget is 2');
  });

  it('a profile built from a pack without formulas.speed carries no speed key', () => {
    const pack = emberMarchesPack();
    const withActions: Pack = {
      ...pack,
      content: {
        ...pack.content,
        classes: { ...pack.content.classes, warden: { name: 'Warden', spellLists: [], actions: ['strike'] } },
      },
    };
    const runtime = new Runtime(withActions);
    expect('speed' in spawnMonster(runtime, 'barrow-wight')).toBe(false);
    const hero = createCharacter(runtime, { name: 'Brynn', race: 'ashling', classes: ['warden'] });
    expect('speed' in profileFromCharacter(runtime, hero).profile).toBe(false);
    const fight = startCombat(runtime, {
      allies: [{ id: 'hero', profile: profileFromCharacter(runtime, hero, 'hero').profile }],
      enemies: [{ id: 'wight', profile: spawnMonster(runtime, 'barrow-wight', 'wight') }],
    });
    expect('speed' in combatant(fight, 'hero')).toBe(false);
  });

  it('startCombat refuses bad terrain — every card in one E-SPAT-01 aggregate, nothing built, no dice rolled', () => {
    const runtime = new Runtime(emberMarchesHexPack());
    const seen: RuntimeEvent[] = [];
    runtime.events.on((event) => {
      seen.push(event);
    });
    const rng = new Rng('refusal');
    const words = rng.getState();
    let refusal: unknown;
    try {
      startCombat(runtime, {
        ...sides(runtime),
        positions: APART,
        terrain: [
          { at: { x: 2, y: 0 }, kind: 'lava' },
          { at: { x: 3, y: 0 }, kind: 'bramble' },
          { at: { x: 3, y: 0 }, kind: 'bramble' },
          { at: { x: 6, y: 0 }, kind: 'standing-stone' },
        ],
        rng,
      });
    } catch (error) {
      refusal = error;
    }
    expect((refusal as Error).name).toBe('RuntimeRuleError');
    const cards = (refusal as { errors: readonly { rule: string; jsonPath: string; artifactId: string }[] })
      .errors;
    expect(cards.map((card) => [card.rule, card.jsonPath, card.artifactId])).toEqual([
      ['E-SPAT-01', 'terrain[0].kind', 'lava'],
      ['E-SPAT-01', 'terrain[2].at', 'bramble'],
      ['E-SPAT-01', 'positions.wight', 'wight'],
    ]);
    expect(seen.filter((event) => event.type === 'combat:start')).toEqual([]);
    expect(rng.getState()).toEqual(words);
  });

  it('F-P5: useItem out of combat binds speed — heal(speed) heals by the profile speed, clamped', () => {
    const runtime = new Runtime(emberMarchesHexPack());
    const hero = createCharacter(runtime, { name: 'Brynn', race: 'ashling', classes: ['warden'] });
    const speed = profileFromCharacter(runtime, hero).profile.speed!;
    expect(speed).toBe(4);
    const cap = hero.derived().hp;
    grantItem(runtime, hero.state, 'stride-tonic', 2);
    hero.state.hp.current = cap - 10;
    const events = useItem(runtime, hero.state, 'stride-tonic');
    expect(events.map((event) => event.type)).toEqual(['item:used', 'damage:applied']);
    expect(hero.state.hp.current).toBe(cap - 10 + speed);
    hero.state.hp.current = cap - 1;
    useItem(runtime, hero.state, 'stride-tonic');
    expect(hero.state.hp.current).toBe(cap);
  });
});

describe('theater of mind (CAP-M7, CA-M7)', () => {
  it('a pack without spatial loads its move content; stride is a no-op success with no move:* events; terrain is never consulted', () => {
    const hex = emberMarchesHexPack();
    const theater = { ...hex } as Partial<Pick<Pack, 'spatial'>> & Pack;
    delete theater.spatial;
    const runtime = new Runtime(theater);
    const seen: RuntimeEvent[] = [];
    runtime.events.on((event) => {
      seen.push(event);
    });
    const fight = startCombat(runtime, {
      ...sides(runtime),
      terrain: [
        { at: { x: 0, y: 0 }, kind: 'lava' },
        { at: { x: 0, y: 0 }, kind: 'lava' },
      ],
    });
    expect(fight.state.terrain).toHaveLength(2);
    fight.step();
    const events = fight.declare('stride', { to: { x: 9, y: 9 } });
    expect(events.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(seen.filter((event) => event.type.startsWith('move:'))).toEqual([]);
    expect(seen.filter((event) => event.type === 'action:resolved').pop()!.payload).toEqual({
      actionId: 'stride',
      targetId: 'hero',
    });
    expect(combatant(fight, 'hero').position).toBeUndefined();
    expect(combatant(fight, 'hero').slots.remaining['move']).toBe(0);
  });
});

describe('the first narrow journey leg (CAP-M2/CAP-M3): move → serialize → JSON → restore', () => {
  it('the moved position and the re-stated terrain hold across a restart, and the next declare in reach succeeds', () => {
    const terrain: TerrainCell[] = [
      { at: { x: 1, y: -1 }, kind: 'bramble' },
      { at: { x: 2, y: 1 }, kind: 'standing-stone' },
    ];
    const { fight } = hexFight({ hero: { x: 0, y: 0 }, wight: { x: 4, y: 0 } }, terrain);
    fight.declare('stride', { to: { x: 3, y: 0 } });
    expect(combatant(fight, 'hero').position).toEqual({ x: 3, y: 0 });

    const snap = JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) as ReturnType<
      typeof serializeCombat
    >;
    const positions: Record<string, Position> = {};
    for (const frozen of snap.combatants) positions[frozen.id] = frozen.position!;
    expect(positions['hero']).toEqual({ x: 3, y: 0 });

    const fresh = new Runtime(emberMarchesHexPack());
    const seen: RuntimeEvent[] = [];
    fresh.events.on((event) => {
      seen.push(event);
    });
    const restored = deserializeCombat(fresh, snap, { ...sides(fresh), positions, terrain });
    expect(restored.state.combatants['hero']!.position).toEqual({ x: 3, y: 0 });
    expect(restored.state.terrain).toEqual(terrain);
    expect(restored.state.combatants['hero']!.speed).toBe(4);

    restored.step(); // the hero's turn re-begins after the restore boundary
    const declared = restored.declare('strike', { targetId: 'wight' });
    expect(declared.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(seen.some((event) => event.type === 'attack:rolled' && event.target === 'wight')).toBe(true);
  });
});

/**
 * CAP-M4 provoke (ck3): the hero (speed 4) leaves the wight's reach on its
 * first step toward (-3,0). The wight's `barrow-wight` attack row hits the
 * hero's ac 10 on any face (byDefense[10] = 9), so reaction verdicts need no
 * dice script.
 */
interface ProvokeSetup {
  readonly heroHp?: number;
  readonly wightActions?: readonly string[];
  /** Extra opponents (barrow-wight statblocks), by id → position. */
  readonly extraEnemies?: Readonly<Record<string, Position>>;
  /** Extra allies (barrow-wight statblocks), by id → position. */
  readonly extraAllies?: Readonly<Record<string, Position>>;
  readonly pack?: Pack;
}

const DESTINATION = { x: -3, y: 0 } as const;

function provokeFight(setup: ProvokeSetup = {}): { runtime: Runtime; fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(setup.pack ?? emberMarchesHexPack());
  const events: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    events.push(event);
  });
  const base = sides(runtime);
  const hero = { ...base.allies[0]!, profile: { ...base.allies[0]!.profile, hp: setup.heroHp ?? 40 } };
  const statblock = (id: string, initiativeBonus: number, actions?: readonly string[]) => {
    const profile = profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, id);
    return { id, profile: { ...profile, initiativeBonus, hp: 40, actions: actions ?? profile.actions } };
  };
  const fight = startCombat(runtime, {
    allies: [hero, ...Object.keys(setup.extraAllies ?? {}).map((id) => statblock(id, -50))],
    enemies: [
      statblock('wight', -100, setup.wightActions),
      ...Object.keys(setup.extraEnemies ?? {}).map((id) => statblock(id, -100)),
    ],
    positions: { hero: { x: 0, y: 0 }, wight: { x: 1, y: 0 }, ...setup.extraEnemies, ...setup.extraAllies },
    rng: new Rng('provoke'),
  });
  fight.step();
  return { runtime, fight, events };
}

function ofType(events: readonly RuntimeEvent[], type: string): RuntimeEvent[] {
  return events.filter((event) => event.type === type);
}

describe('provoke: leaving reach pauses the move (CAP-M4, CA-M4)', () => {
  it('a leaving-reach offer pauses the move at P; a take attacks the mover there; the move then resumes to its destination', () => {
    const { fight, events } = provokeFight();
    fight.declare('stride', { to: DESTINATION });
    expect(
      ofType(events, 'move:leaving-reach').map((event) => [event.actor, event.target, event.payload]),
    ).toEqual([['hero', 'wight', { at: { x: 0, y: 0 }, next: { x: -1, y: 0 } }]]);
    expect(fight.pendingTriggers).toEqual([
      {
        triggerId: 'wight.opportunist',
        actorId: 'wight',
        actionId: 'opportunist',
        matchingEvent: 'move:leaving-reach',
      },
    ]);
    expect(combatant(fight, 'hero').pendingMove).toEqual({
      actionId: 'stride',
      to: DESTINATION,
      remaining: 4,
    });
    expect(combatant(fight, 'hero').position).toEqual({ x: 0, y: 0 });
    expect(ofType(events, 'move:advanced')).toEqual([]); // the walked segment is empty
    expect(ofType(events, 'action:resolved')).toHaveLength(1);
    expect(fight.state.phase).toBe('resolved');

    const hpBefore = combatant(fight, 'hero').hp.current;
    const answered = fight.respond('wight.opportunist', 'take', 'hero');
    const attack = ofType(events, 'attack:rolled').pop()!;
    expect([attack.actor, attack.target]).toEqual(['wight', 'hero']);
    expect(combatant(fight, 'hero').hp.current).toBeLessThan(hpBefore);
    expect(answered.slice(-2).map((event) => event.type)).toEqual(['move:advanced', 'move:ended']);
    expect(ofType(events, 'move:advanced')[0]!.payload).toEqual({
      from: { x: 0, y: 0 },
      to: DESTINATION,
      path: [
        { x: -1, y: 0 },
        { x: -2, y: 0 },
        { x: -3, y: 0 },
      ],
      cost: 3,
      remaining: 1,
    });
    expect(ofType(events, 'move:ended')[0]!.payload).toEqual({ reason: 'arrived', at: DESTINATION });
    expect(combatant(fight, 'hero').position).toEqual(DESTINATION);
    expect(combatant(fight, 'hero').pendingMove).toBeUndefined();
    // F-P1 closing assertion (take): the queue is empty and the offer fired exactly once.
    expect(fight.pendingTriggers).toEqual([]);
    expect(
      ofType(events, 'trigger:fired').filter((event) => event.payload['on'] === 'move:leaving-reach'),
    ).toHaveLength(1);
    expect(ofType(events, 'move:leaving-reach')).toHaveLength(1);
  });

  it('a decline resumes the move; exactly one trigger:fired and one trigger:declined (F-P1, decline)', () => {
    const { fight, events } = provokeFight();
    fight.declare('stride', { to: DESTINATION });
    const answered = fight.respond('wight.opportunist', 'decline');
    expect(answered.map((event) => event.type)).toEqual(['trigger:declined', 'move:advanced', 'move:ended']);
    expect(combatant(fight, 'hero').position).toEqual(DESTINATION);
    expect(fight.pendingTriggers).toEqual([]);
    expect(ofType(events, 'trigger:fired')).toHaveLength(1);
    expect(ofType(events, 'trigger:declined')).toHaveLength(1);
    expect(ofType(events, 'trigger:declined')[0]!.payload['on']).toBe('move:leaving-reach');
  });

  it('F-P1 regression on a non-move fight: a taken parry is not offered again', () => {
    const pack = emberMarchesPack();
    const runtime = new Runtime(pack);
    const events: RuntimeEvent[] = [];
    runtime.events.on((event) => {
      events.push(event);
    });
    const block = (id: string, actions: readonly string[], initiativeBonus: number) => ({
      id,
      profile: {
        ...profileFromStatblock(pack, pack.bestiary['barrow-wight']!, id),
        actions,
        initiativeBonus,
        hp: 60,
      },
    });
    const fight = startCombat(runtime, {
      allies: [block('brynn', ['strike'], 100)],
      enemies: [block('wight', ['wight-claw', 'parry'], -100)],
      rng: new Rng('parry'),
    });
    fight.step();
    fight.declare('strike');
    expect(fight.pendingTriggers.map((offer) => offer.triggerId)).toEqual(['wight.parry']);
    fight.respond('wight.parry', 'take');
    expect(fight.pendingTriggers.map((offer) => offer.triggerId)).not.toContain('wight.parry');
    expect(fight.pendingTriggers).toEqual([]);
    expect(ofType(events, 'trigger:fired')).toHaveLength(1);
  });

  it('F-P10b: a threatener whose reaction slot is spent is still offered and still pauses; a take is refused (E-ECON-01) with no change, then the move resumes', () => {
    const { fight, events } = provokeFight();
    combatant(fight, 'wight').slots.remaining['reaction'] = 0;
    fight.declare('stride', { to: DESTINATION });
    expect(fight.pendingTriggers.map((offer) => offer.triggerId)).toEqual(['wight.opportunist']);
    expect(combatant(fight, 'hero').pendingMove).toBeDefined();

    const wightBefore = JSON.parse(JSON.stringify(combatant(fight, 'wight'))) as CombatantState;
    const heroHp = combatant(fight, 'hero').hp.current;
    const rng = { ...fight.state.rng };
    const answered = fight.respond('wight.opportunist', 'take', 'hero');
    expect(answered[0]!.type).toBe('declare:rejected');
    expect(answered[0]!.actor).toBe('wight');
    expect(answered[0]!.payload['kind']).toBe('slot-exhausted');
    expect(answered[0]!.payload['resource']).toBe('reaction');
    expect(answered[0]!.why.rule).toBe('E-ECON-01');
    expect(ofType(events, 'declare:rejected')).toHaveLength(1);
    expect(combatant(fight, 'wight')).toEqual(wightBefore);
    expect(combatant(fight, 'hero').hp.current).toBe(heroHp);
    expect(fight.state.rng).toEqual(rng);
    expect(ofType(events, 'trigger:declined')).toEqual([]);
    expect(answered.slice(1).map((event) => event.type)).toEqual(['move:advanced', 'move:ended']);
    expect(combatant(fight, 'hero').position).toEqual(DESTINATION);
    expect(fight.pendingTriggers).toEqual([]);
  });

  it('F-P10b decline variant: one trigger:declined, then the move resumes', () => {
    const { fight, events } = provokeFight();
    combatant(fight, 'wight').slots.remaining['reaction'] = 0;
    fight.declare('stride', { to: DESTINATION });
    const answered = fight.respond('wight.opportunist', 'decline');
    expect(answered.map((event) => event.type)).toEqual(['trigger:declined', 'move:advanced', 'move:ended']);
    expect(ofType(events, 'trigger:declined')).toHaveLength(1);
    expect(ofType(events, 'declare:rejected')).toEqual([]);
  });

  it('two threateners raise two offers; the move resumes only after both are answered', () => {
    const { fight, events } = provokeFight({ extraEnemies: { 'wight-b': { x: 0, y: 1 } } });
    fight.declare('stride', { to: DESTINATION });
    const threateners = fight.state.order.filter((id) => id.startsWith('wight')); // initiative order
    expect(ofType(events, 'move:leaving-reach').map((event) => event.target)).toEqual(threateners);
    expect(fight.pendingTriggers.map((offer) => offer.triggerId)).toEqual(
      threateners.map((id) => `${id}.opportunist`),
    );
    const first = fight.respond('wight.opportunist', 'decline');
    expect(first.map((event) => event.type)).toEqual(['trigger:declined']);
    expect(combatant(fight, 'hero').pendingMove).toBeDefined();
    const second = fight.respond('wight-b.opportunist', 'take', 'hero');
    expect(second.slice(-2).map((event) => event.type)).toEqual(['move:advanced', 'move:ended']);
    expect(combatant(fight, 'hero').position).toEqual(DESTINATION);
    expect(fight.pendingTriggers).toEqual([]);
    expect(ofType(events, 'trigger:fired')).toHaveLength(2);
  });

  it('a reaction that downs the mover ends the move: downed', () => {
    const { fight, events } = provokeFight({ heroHp: 1 });
    fight.declare('stride', { to: DESTINATION });
    fight.respond('wight.opportunist', 'take', 'hero');
    expect(combatant(fight, 'hero').hp.current).toBeLessThanOrEqual(0);
    expect(ofType(events, 'move:ended').map((event) => event.payload)).toEqual([
      { reason: 'downed', at: { x: 0, y: 0 } },
    ]);
    expect(ofType(events, 'move:advanced')).toEqual([]);
    expect(combatant(fight, 'hero').pendingMove).toBeUndefined();
  });

  it('a reaction that applies rooted ends the move: restricted', () => {
    const { fight, events } = provokeFight({ wightActions: ['wight-claw', 'root-grasp'] });
    fight.declare('stride', { to: DESTINATION });
    fight.respond('wight.root-grasp', 'take', 'hero');
    expect(combatant(fight, 'hero').conditions.map((active) => active.conditionId)).toContain('rooted');
    expect(ofType(events, 'move:ended').map((event) => event.payload)).toEqual([
      { reason: 'restricted', at: { x: 0, y: 0 } },
    ]);
    expect(combatant(fight, 'hero').position).toEqual({ x: 0, y: 0 });
  });

  it('an ally stepping into the vacated destination blocks the re-plan: blocked (direct state setup)', () => {
    const { fight, events } = provokeFight({ extraAllies: { mate: { x: -5, y: 5 } } });
    fight.declare('stride', { to: DESTINATION });
    // Direct state setup: while the move is paused the ally now stands on the destination.
    const mate = combatant(fight, 'mate');
    fight.state = {
      ...fight.state,
      combatants: { ...fight.state.combatants, mate: { ...mate, position: DESTINATION } },
    };
    fight.respond('wight.opportunist', 'decline');
    expect(ofType(events, 'move:ended').map((event) => event.payload)).toEqual([
      { reason: 'blocked', at: { x: 0, y: 0 } },
    ]);
    expect(combatant(fight, 'hero').position).toEqual({ x: 0, y: 0 });
    expect(combatant(fight, 'hero').pendingMove).toBeUndefined();
  });

  it('step() while paused forfeits the move, then ends the turn', () => {
    const { fight, events } = provokeFight();
    fight.declare('stride', { to: DESTINATION });
    const before = events.length;
    expect(fight.step()).toEqual({ kind: 'turn-ended', combatantId: 'hero' });
    expect(events.slice(before).map((event) => [event.type, event.payload])).toEqual([
      ['move:ended', { reason: 'forfeited', at: { x: 0, y: 0 } }],
      ['turn:ended', { turn: 0, round: 1 }],
    ]);
    expect(combatant(fight, 'hero').pendingMove).toBeUndefined();
  });

  it('a fight with no matching reaction never pauses: only move:leaving-reach is new', () => {
    const { fight, events } = provokeFight({ wightActions: ['wight-claw'] });
    fight.declare('stride', { to: DESTINATION });
    expect(
      events
        .filter((event) => event.type.startsWith('move:') || event.type.startsWith('trigger:'))
        .map((event) => event.type),
    ).toEqual(['move:leaving-reach', 'move:advanced', 'move:ended']);
    expect(combatant(fight, 'hero').position).toEqual(DESTINATION);
    expect(fight.pendingTriggers).toEqual([]);
  });
});
