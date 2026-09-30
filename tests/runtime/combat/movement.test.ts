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
