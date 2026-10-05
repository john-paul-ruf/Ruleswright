/**
 * CAP-C3…C6 / CA-C3 / CA-C4 — the class-features journey on generated content
 * (v1.10, DD-C1…C9): theme JSON → `generateCampaign` (stage 8 `validatePack`) →
 * `new Runtime` → `createCharacter` → `profileFromCharacter` → `startCombat` /
 * `step` / `declare` / `respond`.
 *
 * Public imports from `src/`, never `dist/`. No doubles: every foe is a real
 * statblock through `spawnMonster`, every fight runs on its own Runtime with a
 * named `Rng` seed. `grave-gaze` applies `hexbound` on both save branches, so
 * no leg depends on the roll.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import {
  Runtime,
  RuntimeRuleError,
  bestiaryIds,
  classFeatures,
  deserializeCombat,
  knownSpells,
  learnFeat,
  levelSet,
  profileFromCharacter,
  restoreCharacter,
  serializeCharacter,
  serializeCombat,
  spawnMonster,
  startCombat,
  type Character,
  type Combat,
  type CombatSnapshot,
  type RuntimeEvent,
} from '../../src/runtime';
import { Rng } from '../../src/core/rng';

const SEED = 42;

function runtimeFor(themeId: 'dark-fantasy' | 'zombie-urban'): Runtime {
  return new Runtime(generateCampaign({ theme: loadTheme(themeId), seed: SEED }));
}

function recorded(rt: Runtime): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  rt.events.on((event) => {
    events.push(event);
  });
  return events;
}

function ofType(events: readonly RuntimeEvent[], type: string): RuntimeEvent[] {
  return events.filter((event) => event.type === type);
}

function refusedRule(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeRuleError);
    return (error as RuntimeRuleError).errors.map((card) => card.rule).join(',');
  }
  throw new Error('expected a RuntimeRuleError');
}

function cryptWarden(rt: Runtime, level: number): Character {
  return rt.createCharacter({ name: 'cw', race: 'ashkin', classes: [{ id: 'crypt-warden', level }] });
}

/** The crypt-warden `cw` at (0,0) against a barrow-wight at (1,0); `first` acts first (+100), the other last (−100). */
function cwVsWight(rt: Runtime, cw: Character, first: 'cw' | 'wight'): Combat {
  const pair = profileFromCharacter(rt, cw, 'cw');
  const fight = startCombat(rt, {
    allies: [
      {
        id: 'cw',
        profile: { ...pair.profile, initiativeBonus: first === 'cw' ? 100 : -100 },
        balances: pair.balances,
      },
    ],
    enemies: [
      {
        id: 'wight',
        profile: {
          ...spawnMonster(rt, 'barrow-wight', 'wight'),
          initiativeBonus: first === 'wight' ? 100 : -100,
        },
      },
    ],
    positions: { cw: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
    rng: new Rng('class-features-journey'),
  });
  fight.step();
  return fight;
}

/** The wight gazes at `cw` on its own turn (ARCH-PRE F-C3: `step()` alone declares nothing). */
function gazed(rt: Runtime, cw: Character): Combat {
  const fight = cwVsWight(rt, cw, 'wight');
  expect(fight.state.active).toBe('wight');
  fight.declare('grave-gaze', { targetId: 'cw' });
  return fight;
}

describe('class features journey (CAP-C3…C6)', () => {
  it('leg 1 (CAP-C3, CA-C3) — a crypt-warden L3 is granted crypt-vigil: offered and taken in combat, never stored', () => {
    const rt = runtimeFor('dark-fantasy');
    const events = recorded(rt);
    const cw = cryptWarden(rt, 3);
    expect(profileFromCharacter(rt, cw, 'cw').profile.feats).toEqual(['crypt-vigil']);
    expect(cw.state.feats).toBeUndefined();

    const fight = gazed(rt, cw);
    expect(
      ofType(events, 'condition:applied').map((event) => [event.target, event.payload['conditionId']]),
    ).toEqual([['cw', 'hexbound']]);
    expect(
      ofType(events, 'trigger:fired').map((event) => [event.payload['triggerId'], event.payload['source']]),
    ).toEqual([['cw.crypt-vigil', 'feat']]);

    const answered = fight.respond('cw.crypt-vigil', 'take');
    const braced = ofType(answered, 'condition:applied');
    expect(braced.map((event) => [event.target, event.payload['conditionId'], event.why.rule])).toEqual([
      ['cw', 'braced', 'content.feats.crypt-vigil'],
    ]);
    expect(cw.state.feats).toBeUndefined();
  });

  it('leg 1 control — at crypt-warden L2 the same gaze opens no crypt-vigil offer', () => {
    const rt = runtimeFor('dark-fantasy');
    const events = recorded(rt);
    const cw = cryptWarden(rt, 2);
    expect('feats' in profileFromCharacter(rt, cw, 'cw').profile).toBe(false);

    const fight = gazed(rt, cw);
    expect(ofType(events, 'condition:applied').map((event) => event.payload['conditionId'])).toEqual([
      'hexbound',
    ]);
    expect(ofType(events, 'trigger:fired').filter((event) => event.payload['source'] === 'feat')).toEqual([]);
    expect(() => fight.respond('cw.crypt-vigil', 'take')).toThrow(/no pending trigger/);
  });
  it('leg 2 (CAP-C4, CA-C4) — barrow-rite is refused no-action at crypt-warden L1, then resolves at L2', () => {
    const rt1 = runtimeFor('dark-fantasy');
    const events1 = recorded(rt1);
    const low = cwVsWight(rt1, cryptWarden(rt1, 1), 'cw');
    expect(low.state.active).toBe('cw');
    const before = low.serialize();
    const seen = events1.length;
    const answer = low.declare('barrow-rite', { targetId: 'wight' });
    expect(answer).toHaveLength(1);
    expect(answer[0]).toMatchObject({
      type: 'declare:rejected',
      actor: 'cw',
      payload: { kind: 'no-action', resource: 'barrow-rite' },
      why: { rule: 'E-REF-01' },
    });
    expect(answer[0]!.payload['message']).toContain('does not have action');
    expect(events1.slice(seen)).toEqual(answer);
    expect(low.serialize()).toEqual(before);

    const rt2 = runtimeFor('dark-fantasy');
    const events2 = recorded(rt2);
    const high = cwVsWight(rt2, cryptWarden(rt2, 2), 'cw');
    high.declare('barrow-rite', { targetId: 'wight' });
    expect(ofType(events2, 'declare:rejected')).toEqual([]);
    expect(ofType(events2, 'action:resolved').map((event) => event.payload['actionId'])).toEqual([
      'barrow-rite',
    ]);
  });

  it('leg 3 (CAP-C5, CA-C4) — rot-read is unknown to a medic L2, known and cast for points at L3', () => {
    const medicFight = (level: number) => {
      const rt = runtimeFor('zombie-urban');
      const events = recorded(rt);
      const medic = rt.createCharacter({
        name: 'medic',
        race: 'mile-born',
        classes: [{ id: 'medic', level }],
      });
      const pair = profileFromCharacter(rt, medic, 'medic');
      const foe = bestiaryIds(rt)[0]!;
      const fight = startCombat(rt, {
        allies: [
          { id: 'medic', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances },
        ],
        enemies: [{ id: 'foe', profile: { ...spawnMonster(rt, foe, 'foe'), initiativeBonus: -100 } }],
        positions: { medic: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
        rng: new Rng('class-features-journey'),
      });
      fight.step();
      expect(fight.state.active).toBe('medic');
      return { rt, events, medic, profile: pair.profile, fight };
    };

    const low = medicFight(2);
    expect(low.profile.spells ?? []).not.toContain('rot-read');
    expect(knownSpells(low.rt, low.medic.state)).not.toContain('rot-read');
    const before = low.fight.serialize();
    const answer = low.fight.declare('rot-read', { targetId: 'foe' });
    expect(answer).toHaveLength(1);
    expect(answer[0]).toMatchObject({ type: 'declare:rejected', payload: { kind: 'no-action' } });
    expect(answer[0]!.payload['message']).toContain('does not know spell');
    expect(ofType(low.events, 'spell:cast')).toEqual([]);
    expect(low.fight.serialize()).toEqual(before);

    const high = medicFight(3);
    expect(high.profile.spells).toContain('rot-read');
    expect(knownSpells(high.rt, high.medic.state)).toContain('rot-read');
    const stamina = high.fight.state.combatants['medic']!.pools['stamina']!;
    high.fight.declare('rot-read', { targetId: 'foe' });
    expect(ofType(high.events, 'declare:rejected')).toEqual([]);
    expect(ofType(high.events, 'spell:cast').map((event) => event.payload)).toEqual([
      expect.objectContaining({ cost: 'points', pool: 'stamina' }),
    ]);
    expect(high.fight.state.combatants['medic']!.pools['stamina']).toBe(stamina - 2);
  });
  it('leg 4 (CAP-C3, CA-C3) — a granted feat is not learned: refused feat-known, no slot, held once, dropped by levelSet', () => {
    const rt = runtimeFor('dark-fantasy');
    const cw = cryptWarden(rt, 3);
    expect(refusedRule(() => learnFeat(rt, cw.state, 'crypt-vigil'))).toBe('feat-known');
    expect(cw.state.feats).toBeUndefined();

    expect(rt.pack.progression['crypt-warden']!.featSlots![2]).toBe(2);
    learnFeat(rt, cw.state, 'ironhide');
    learnFeat(rt, cw.state, 'second-gust');
    expect(cw.state.feats).toEqual(['ironhide', 'second-gust']);
    expect(refusedRule(() => learnFeat(rt, cw.state, 'woodwise'))).toBe('feat-slots-exceeded');
    expect(profileFromCharacter(rt, cw, 'cw').profile.feats).toEqual(['second-gust', 'crypt-vigil']);

    const early = cryptWarden(rt, 2);
    learnFeat(rt, early.state, 'crypt-vigil');
    levelSet(rt, early.state, [{ id: 'crypt-warden', level: 3 }]);
    expect(early.state.feats).toEqual(['crypt-vigil']);
    expect(profileFromCharacter(rt, early, 'cw').profile.feats).toEqual(['crypt-vigil']);

    const events = recorded(rt);
    const lowered = cryptWarden(rt, 3);
    const seen = events.length;
    levelSet(rt, lowered.state, [{ id: 'crypt-warden', level: 1 }]);
    expect(classFeatures(rt, lowered.state).filter((view) => view.active)).toEqual([]);
    expect(events.slice(seen).map((event) => event.type)).toEqual(['level:reached']);
    expect('feats' in profileFromCharacter(rt, lowered, 'cw').profile).toBe(false);
  });

  it('leg 5 (CAP-C3, CA-C3) — snapshots: the grant is not serialized, re-derived on restore, and an open offer survives', () => {
    const rt = runtimeFor('dark-fantasy');
    const cw = cryptWarden(rt, 3);
    const snap = JSON.parse(JSON.stringify(serializeCharacter(rt, cw.state))) as ReturnType<
      typeof serializeCharacter
    >;
    expect('feats' in snap.state).toBe(false);
    const rtB = runtimeFor('dark-fantasy');
    const restored = restoreCharacter(rtB, snap);
    expect(restored.state.feats).toBeUndefined();
    expect(profileFromCharacter(rtB, restored, 'cw').profile.feats).toEqual(['crypt-vigil']);

    const fight = gazed(rt, cw);
    expect(fight.pendingTriggers.map((offer) => offer.triggerId)).toEqual(['cw.crypt-vigil']);
    const frozen = JSON.parse(
      JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' })),
    ) as CombatSnapshot;
    const rtC = runtimeFor('dark-fantasy');
    const eventsC = recorded(rtC);
    const pair = profileFromCharacter(rtC, cryptWarden(rtC, 3), 'cw');
    const resumed = deserializeCombat(rtC, frozen, {
      allies: [{ id: 'cw', profile: { ...pair.profile, initiativeBonus: -100 }, balances: pair.balances }],
      enemies: [
        { id: 'wight', profile: { ...spawnMonster(rtC, 'barrow-wight', 'wight'), initiativeBonus: 100 } },
      ],
      positions: { cw: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
    });
    resumed.respond('cw.crypt-vigil', 'take');
    expect(
      ofType(eventsC, 'condition:applied').map((event) => [
        event.target,
        event.payload['conditionId'],
        event.why.rule,
      ]),
    ).toEqual([['cw', 'braced', 'content.feats.crypt-vigil']]);
  });
  it('leg 6 (CAP-C6) — the host lists the class features of a medic L3 from the runtime barrel, DD-C5 order', () => {
    const rt = runtimeFor('zombie-urban');
    const medic = rt.createCharacter({
      name: 'medic',
      race: 'mile-born',
      classes: [{ id: 'medic', level: 3 }],
    });
    expect(classFeatures(rt, medic.state)).toEqual([
      { classId: 'medic', level: 2, ref: 'field-surgery', kind: 'feat', active: true },
      { classId: 'medic', level: 3, ref: 'rot-read', kind: 'spell', active: true },
      { classId: 'medic', level: 4, ref: 'steady-pulse', kind: 'feat', active: false },
    ]);
  });
});
