import { describe, expect, it } from 'vitest';
import { validateEncounterSetup, validateEncounterSessionOptions } from '../../src/schema/play-session';
import { Runtime, serializeCharacter } from '../../src/runtime';
import { cloneRuntimePack } from '../runtime/fixtures/pack';

function input() {
  const pack = cloneRuntimePack();
  const rt = new Runtime(pack);
  const hero = rt.createCharacter({ name: 'Hero', race: 'ashkin', classes: ['warden'] });
  const setup = { budget: 2, seed: '', maxPartySize: 1, maxEnemies: 1, layout: { kind: 'theater' as const } };
  return {
    pack,
    setup,
    options: {
      sessionId: 'test',
      seed: 42,
      members: [{ memberId: 'hero', character: serializeCharacter(rt, hero.state) }],
      setup,
    },
  };
}

describe('AR-02 portable setup and options validation', () => {
  it('accepts explicit empty seeds, canonical number/string inputs and valid members without mutation', () => {
    const { pack, options } = input();
    const before = JSON.stringify(options);
    expect(validateEncounterSessionOptions(pack, options)).toEqual([]);
    expect(validateEncounterSessionOptions(pack, { ...options, seed: '42' })).toEqual([]);
    expect(JSON.stringify(options)).toBe(before);
  });
  it.each([0, -1, NaN, Infinity, 1])('rejects unaffordable or invalid budget %s', (budget) => {
    const { pack, setup } = input();
    expect(
      validateEncounterSetup(pack, { ...setup, budget }).some((e) => e.jsonPath === 'setup.budget'),
    ).toBe(true);
  });
  it('rejects body/weight bounds before any call to the RNG', () => {
    const { pack, setup } = input();
    expect(
      validateEncounterSetup(pack, { ...setup, budget: 4 }).some((e) => e.jsonPath === 'setup.maxEnemies'),
    ).toBe(true);
    pack.bestiary['barrow-wight']!.threat = 42949673;
    expect(
      validateEncounterSetup(pack, { ...setup, budget: 42949673 }).some((e) => e.message.includes('2^32')),
    ).toBe(true);
    pack.bestiary['barrow-wight']!.threat = 0;
    expect(validateEncounterSetup(pack, setup).length).toBeGreaterThan(0);
  });
  it('rejects unknown fields, duplicate members, foreign pack and missing required balances/HP', () => {
    const { pack, options } = input();
    const variants = [
      { ...options, extra: true },
      { ...options, seed: Infinity },
      { ...options, members: [options.members[0], options.members[0]] },
    ];
    for (const v of variants) expect(validateEncounterSessionOptions(pack, v).length).toBeGreaterThan(0);
    for (const key of ['hp', 'slots', 'pools']) {
      const v = JSON.parse(JSON.stringify(options));
      delete v.members[0].character.state[key];
      expect(validateEncounterSessionOptions(pack, v).some((e) => e.jsonPath.endsWith(`.${key}`))).toBe(true);
    }
    const v = JSON.parse(JSON.stringify(options));
    v.members[0].character.pack.contentHash = '12345678';
    expect(validateEncounterSessionOptions(pack, v).some((e) => e.rule === 'E-SNAP-01')).toBe(true);
  });
  it('checks spatial model, capacity, duplicate cells, terrain vocabulary and blocking spawns', () => {
    const { pack, setup } = input();
    pack.spatial = {
      model: 'grid',
      reach: { default: 1 },
      shapes: ['single'],
      terrain: { wall: { blocks: true } },
    };
    const spatial = {
      ...setup,
      layout: {
        kind: 'spatial',
        model: 'grid',
        allies: [{ x: 0, y: 0 }],
        enemies: [{ x: 1, y: 0 }],
        terrain: [],
      },
    };
    expect(validateEncounterSetup(pack, spatial)).toEqual([]);
    for (const layout of [
      { ...spatial.layout, model: 'hex' },
      { ...spatial.layout, allies: [] },
      { ...spatial.layout, enemies: [{ x: 0, y: 0 }] },
      { ...spatial.layout, terrain: [{ at: { x: 0, y: 0 }, kind: 'wall' }] },
      { ...spatial.layout, terrain: [{ at: { x: 2, y: 0 }, kind: 'unknown' }] },
      { ...spatial.layout, enemies: [{ x: 1.5, y: 0 }] },
    ])
      expect(validateEncounterSetup(pack, { ...setup, layout }).length).toBeGreaterThan(0);
  });
});
