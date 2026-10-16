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

describe('CA-02 aggregate shape rejection', () => {
  it('rejects malformed counters, nested fields and unsupported versions before changing the source session', async () => {
    const { playFixture } = await import('../runtime/play/fixtures');
    const { createEncounterSession, restoreEncounterSession } = await import('../../src/runtime');
    const { pack, options } = playFixture();
    const session = createEncounterSession(pack, options);
    const before = session.serialize();
    const cases: [string, string, unknown][] = [
      ['snapshotVersion', 'snapshotVersion', 2],
      ['revision', 'revision', Number.MAX_SAFE_INTEGER + 1],
      ['rng.play.a', 'rng.play.a', 2 ** 32],
      ['encounter.combat.rng.d', 'encounter.combat.rng.d', -1],
      ['encounter.control', 'encounter.control.turn', 99],
      ['members[0].character.state.hp', 'members.0.character.state.hp', undefined],
      ['encounter.selection.seedUsed', 'encounter.selection.seedUsed', 42],
      ['encounter.extra', 'encounter.extra', true],
    ];
    for (const [path, field, value] of cases) {
      const bad = JSON.parse(JSON.stringify(before)) as Record<string, unknown>;
      const keys = field.split('.');
      let parent = bad;
      for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
      if (value === undefined) delete parent[keys[keys.length - 1]!];
      else parent[keys[keys.length - 1]!] = value;
      try {
        restoreEncounterSession(pack, bad);
        throw new Error('accepted malformed snapshot');
      } catch (error) {
        expect(error).toHaveProperty('errors');
        expect((error as { errors: { jsonPath: string }[] }).errors.some((e) => e.jsonPath === path)).toBe(
          true,
        );
      }
      expect(session.serialize()).toEqual(before);
    }
  });
});

describe('CA-02 semantic restore predicates', () => {
  const cases: [string, string, unknown][] = [
    ['encounter.memberBindings', 'encounter.memberBindings.0.memberId', 'other'],
    ['encounter.memberBindings', 'encounter.memberBindings.0.combatantId', 'm:other'],
    ['encounter.start.allies', 'encounter.start.allies.0.profile.hp', 123],
    ['encounter.start.allies', 'encounter.start.allies.0.balances.pools.stamina', 999],
    ['encounter.start.allies', 'encounter.start.allies.0.balances.boundSlots.1', 2],
    ['encounter.start.enemies', 'encounter.start.enemies.0.profile.hp', 999],
    ['encounter.selection', 'encounter.selection.seedUsed', 'replacement'],
    ['encounter.selection', 'encounter.selection.threat', 999],
    ['encounter.selection.groups', 'encounter.selection.groups.0.id', 'missing'],
    ['encounter.enemyInstances', 'encounter.enemyInstances.0.monsterId', 'missing'],
    ['encounter.encounterId', 'encounter.combat.pairsWith', 'wrong'],
    ['encounter.combat.order', 'encounter.combat.order', ['m:hero-1', 'm:hero-1']],
    ['encounter.combat.combatants[0].maxHp', 'encounter.combat.combatants.0.maxHp', 999],
    [
      'encounter.combat.combatants[0].conditions',
      'encounter.combat.combatants.0.conditions',
      [{ id: 'unknown', remaining: 2 }],
    ],
    ['encounter.combat.combatants[0].slotsUsed', 'encounter.combat.combatants.0.slotsUsed.main', 99],
    [
      'encounter.combat.combatants[0].itemsUsed',
      'encounter.combat.combatants.0.itemsUsed',
      { 'mend-draught': 3 },
    ],
    ['encounter.combat.combatants[0].itemsUsed', 'encounter.combat.combatants.0.itemsUsed', { rope: 1 }],
    [
      'encounter.combat.combatants[0].poolsSpent',
      'encounter.combat.combatants.0.poolsSpent',
      { stamina: 999 },
    ],
    ['encounter.combat.combatants[0].poolsSpent', 'encounter.combat.combatants.0.poolsSpent', { unknown: 1 }],
    [
      'encounter.combat.combatants[0].slotsCast.1',
      'encounter.combat.combatants.0.slotsCast',
      { '1': [0, 0] },
    ],
    ['encounter.combat.combatants[0].slotsCast.1', 'encounter.combat.combatants.0.slotsCast', { '1': [7] }],
    ['encounter.combat.phase', 'encounter.combat.phase', 'combat-over'],
    ['phase', 'result', 'victory'],
    ['encounter.control', 'encounter.control.turnStarted', true],
    ['encounter.positions', 'encounter.positions', { 'm:hero-1': { x: 1, y: 2 } }],
    ['journal[0].subjects', 'journal.0.subjects.0.name', 'Wrong name'],
    ['journal[0].subjects', 'journal.0.subjects', []],
    ['journal[0]', 'journal.0.sequence', 2],
    ['journal[0]', 'journal.0.revision', 2],
    ['sequence', 'sequence', 0],
    ['settlements', 'encounterIndex', 1],
  ];
  it.each(cases)('refuses corruption at %s (%s)', async (expected, field, value) => {
    const { settlementFixture } = await import('../runtime/play/fixtures');
    const { createEncounterSession, restoreEncounterSession } = await import('../../src/runtime');
    const { pack, options } = settlementFixture();
    const session = createEncounterSession(pack, options);
    const before = session.serialize(),
      bad = JSON.parse(JSON.stringify(before)) as Record<string, unknown>;
    const keys = field.split('.');
    let parent = bad;
    for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
    parent[keys[keys.length - 1]!] = value;
    try {
      restoreEncounterSession(pack, bad);
      throw new Error('accepted corrupt snapshot');
    } catch (error) {
      expect(error).toHaveProperty('errors');
      const errors = (error as { errors: { jsonPath: string }[] }).errors;
      // Pairing is rejected before a changed encounter index reaches receipt validation.
      expect(
        errors.some(
          (e) =>
            e.jsonPath === expected || (field === 'encounterIndex' && e.jsonPath === 'encounter.encounterId'),
        ),
        JSON.stringify(errors),
      ).toBe(true);
    }
    expect(session.serialize()).toEqual(before);
  });
  it('preserves empty seeds after settled reopen/next and refuses changed receipts or entry party', async () => {
    const { playFixture, finish, send } = await import('../runtime/play/fixtures');
    const { createEncounterSession, restoreEncounterSession } = await import('../../src/runtime');
    const { pack, options } = playFixture();
    const session = createEncounterSession(pack, options);
    finish(session);
    send(session, { type: 'finalize' });
    const settled = session.serialize();
    for (const [key, value] of [
      ['sourceHash', '00000000'],
      ['beforeMembersHash', '00000000'],
      ['afterMembersHash', '00000000'],
      ['revision', settled.revision - 1],
      ['result', 'abandoned'],
    ] as const) {
      const bad = JSON.parse(JSON.stringify(settled));
      bad.settlements[0][key] = value;
      expect(() => restoreEncounterSession(pack, bad)).toThrow();
    }
    const restored = restoreEncounterSession(pack, JSON.parse(JSON.stringify(settled)));
    expect(send(restored, { type: 'next', setup: options.setup })).toEqual(
      send(session, { type: 'next', setup: options.setup }),
    );
    const second = session.serialize();
    expect(second.encounter.setup.seed).toBe('');
    expect(second.encounter.selection.seedUsed).toBe('');
    const reopened = restoreEncounterSession(pack, JSON.parse(JSON.stringify(second)));
    expect(send(reopened, { type: 'advance' })).toEqual(send(session, { type: 'advance' }));
    expect(reopened.serialize()).toEqual(session.serialize());
    const bad = JSON.parse(JSON.stringify(second));
    bad.members[0].character.state.hp.current++;
    expect(() => restoreEncounterSession(pack, bad)).toThrow();
  });
});

it('rejects duplicate original character identities and foreign nested pack identity', async () => {
  const { playFixture } = await import('../runtime/play/fixtures');
  const { createEncounterSession, restoreEncounterSession } = await import('../../src/runtime');
  const { pack, options } = playFixture(undefined, 2);
  const saved = createEncounterSession(pack, options).serialize();
  const duplicate = JSON.parse(JSON.stringify(saved));
  duplicate.encounter.memberBindings[1].characterId = duplicate.encounter.memberBindings[0].characterId;
  expect(() => restoreEncounterSession(pack, duplicate)).toThrow(/unique/);
  const foreign = JSON.parse(JSON.stringify(saved));
  foreign.encounter.entryMembers[1].character.pack.contentHash = '00000000';
  expect(() => restoreEncounterSession(pack, foreign)).toThrow(/different effective pack/);
});

it('rejects cyclic/non-JSON journal payloads and changed offer provenance before reconstruction', async () => {
  const { settlementFixture, send } = await import('../runtime/play/fixtures');
  const { createEncounterSession, restoreEncounterSession } = await import('../../src/runtime');
  const { pack, options } = settlementFixture();
  const session = createEncounterSession(pack, options);
  send(session, { type: 'advance' });
  send(session, { type: 'use', actor: { kind: 'member', memberId: 'hero-1' }, itemId: 'mend-draught' });
  const original = session.serialize();
  expect(original.encounter.combat.offers).toHaveLength(1);
  const bad = JSON.parse(JSON.stringify(original));
  bad.encounter.combat.offers[0].on = 'wrong:event';
  expect(() => restoreEncounterSession(pack, bad)).toThrow(/provenance/);
  const cyclic = JSON.parse(JSON.stringify(original));
  cyclic.journal[0].event.payload.cycle = cyclic;
  expect(() => restoreEncounterSession(pack, cyclic)).toThrow(/play-session field/);
  const nonJson = JSON.parse(JSON.stringify(original));
  nonJson.journal[0].event.payload.date = new Date();
  expect(() => restoreEncounterSession(pack, nonJson)).toThrow(/play-session field/);
  expect(session.serialize()).toEqual(original);
});
