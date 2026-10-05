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
  profileFromCharacter,
  spawnMonster,
  startCombat,
  type Character,
  type Combat,
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
});
