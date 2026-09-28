/**
 * Checkpoint-2 suite — character creation (FR-5), the shared build validator's
 * named-rule rejections (FR-6), multi-class contribution, and the derived()
 * facade through reserved formulas (CA-6).
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { CharacterBuildError } from '../../src/runtime/progression';
import { cloneRuntimePack } from './fixtures/pack';
import type { RuntimeEvent } from '../../src/runtime/events';
import type { Pack } from '../../src/schema/pack';
import { equipmentView } from '../../src/runtime/equipment';

describe('createCharacter (FR-5)', () => {
  it('defaults abilities from the pack and initializes hp from the reserved formula', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    const state = character.state;
    expect(state.abilities).toEqual({
      might: 10,
      grace: 10,
      vigor: 10,
      reason: 10,
      insight: 10,
      presence: 10,
    });
    expect(state.hp.current).toBe(20); // formulas.hp: 10 + vigor
    expect(state.level).toBe(1);
    expect(state.xp).toBe(0);
    expect(state.classXp).toEqual({ warden: 0 });
    expect(state.saves).toEqual({ fortitude: 0, reflex: 0, will: 0, toughness: 1, luck: 0 }); // warden level-1 column
    expect(state.slots).toEqual({ '1': [null] }); // warden slots '1' [1,2,2,3] at level 1
  });

  it('emits character:created and keeps state plain-JSON (FR-13, FR-14)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const seen: RuntimeEvent[] = [];
    runtime.events.on((event) => seen.push(event));
    const character = runtime.createCharacter({
      name: 'Brynn',
      race: 'ashkin',
      classes: [{ id: 'warden', level: 4 }],
    });
    expect(seen.length).toBe(1);
    expect(seen[0]!.type).toBe('character:created');
    expect(seen[0]!.actor).toBe(character.state.id);
    expect(seen[0]!.why.rule).toBe('content.races.ashkin');
    expect(JSON.parse(JSON.stringify(character.state))).toEqual(character.state);
    expect(character.state.level).toBe(4);
    expect(character.state.saves.toughness).toBe(2); // warden level-4 column
    expect(character.state.slots).toEqual({ '1': [null, null, null] }); // [1,2,2,3] at level 4
  });
});

describe('multi-class (FR-6)', () => {
  it('combines saves best-of and slots additively across classes', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({
      name: 'Sela',
      race: 'ashkin',
      classes: [
        { id: 'warden', level: 3 },
        { id: 'hexer', level: 3 },
      ],
    });
    const state = character.state;
    expect(state.level).toBe(6); // total across classes
    expect(state.saves.will).toBe(1); // warden[2]=1, hexer[2]=1 — best-of
    expect(state.saves.luck).toBe(1); // warden[2]=1, hexer[2]=1
    expect(state.saves.toughness).toBe(2); // warden-only save
    expect(state.slots['1']).toEqual([null, null, null, null]); // warden 2 + hexer 2
    expect(state.slots['2']).toEqual([null]); // hexer level-3 slots
  });
});

describe('illegal builds are rejected with named rules (FR-5/FR-6)', () => {
  it('rejects unknown class, unknown race, duplicate class, and invalid level — all at once', () => {
    const runtime = new Runtime(cloneRuntimePack());
    try {
      runtime.createCharacter({
        name: 'X',
        race: 'no-such-race',
        classes: ['no-such-class', 'warden', 'warden'],
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CharacterBuildError);
      const rules = (error as CharacterBuildError).errors.map((card) => card.rule);
      expect(rules).toContain('unknown-race');
      expect(rules).toContain('unknown-class');
      expect(rules).toContain('duplicate-class');
      expect((error as CharacterBuildError).errors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('rejects a level the progression tables cannot read (missing-progression)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    expect(() =>
      runtime.createCharacter({ name: 'X', race: 'ashkin', classes: [{ id: 'warden', level: 5 }] }),
    ).toThrow(/cover 4 level/);
  });

  it('rejects a non-integer or below-one level (invalid-level)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    expect(() =>
      runtime.createCharacter({ name: 'X', race: 'ashkin', classes: [{ id: 'warden', level: 0 }] }),
    ).toThrow(/integer level >= 1/);
  });
});

describe('derived() — CA-6 reserved formulas only', () => {
  it('resolves hp, ac, and attackBonus through pack formulas, never hardcoded math', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const hexer = runtime.createCharacter({
      name: 'Vex',
      race: 'ashkin',
      classes: [{ id: 'hexer', level: 2 }],
    });
    const derived = hexer.derived();
    expect(derived.hp).toBe(20); // 10 + vigor(10)
    expect(derived.ac).toBe(20); // 10 + grace(10)
    expect(derived.attackBonus).toBe(2); // hexer attackBonus: 1 + level/2 at level 2
    expect(derived.saves).toEqual({ will: 1, luck: 0 });
  });
});

/** An in-test pack: the fixture clone with assigned formulas (the fixture's own strings stay untouched). */
function packWith(formulas: Record<string, string>, hexerAttackBonus?: string): Pack {
  const pack = cloneRuntimePack();
  for (const [id, expr] of Object.entries(formulas)) pack.formulas[id] = { expr };
  if (hexerAttackBonus !== undefined) pack.progression['hexer']!.attackBonus = hexerAttackBonus;
  return pack;
}

describe('CAP-E2 closing proof — grants compose into derived() in either AC direction (CA-EG2)', () => {
  it('ascending AC (10 + gear-ac): equipping {ac: 2} moves ac by +2; unequip restores byte-exactly', () => {
    const runtime = new Runtime(packWith({ ac: '10 + gear-ac' }));
    const brynn = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    const base = JSON.stringify(brynn.derived());
    expect(brynn.derived().ac).toBe(10);
    brynn.grant('chain-shirt');
    brynn.equip('chain-shirt', 'body');
    expect(brynn.derived().ac).toBe(12);
    brynn.unequip('body');
    expect(JSON.stringify(brynn.derived())).toBe(base);
  });

  it('descending AC (12 - floor(level / 3) - gear-ac): equipping {ac: 2} moves ac by -2; unequip restores', () => {
    const runtime = new Runtime(packWith({ ac: '12 - floor(level / 3) - gear-ac' }));
    const brynn = runtime.createCharacter({
      name: 'Brynn',
      race: 'ashkin',
      classes: [{ id: 'warden', level: 3 }],
    });
    const base = JSON.stringify(brynn.derived());
    expect(brynn.derived().ac).toBe(11);
    brynn.grant('chain-shirt');
    brynn.equip('chain-shirt', 'body');
    expect(brynn.derived().ac).toBe(9);
    brynn.unequip('body');
    expect(JSON.stringify(brynn.derived())).toBe(base);
  });

  it('{hp: 2} raises derived().hp by exactly 2 while hp.current is unchanged (equipping never heals)', () => {
    const runtime = new Runtime(packWith({ hp: '10 + vigor + gear-hp' }));
    const brynn = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    expect(brynn.derived().hp).toBe(20);
    expect(brynn.state.hp.current).toBe(20);
    brynn.grant('ward-ring');
    brynn.equip('ward-ring', 'ring');
    expect(brynn.derived().hp).toBe(22);
    expect(brynn.state.hp.current).toBe(20);
    brynn.unequip('ring');
    expect(brynn.derived().hp).toBe(20);
    expect(brynn.state.hp.current).toBe(20); // unequip never clamps either
  });

  it('{might: 1} ADDS to might inside attackBonus (floor(level / 2) + might): might 3 uses 4, not 1', () => {
    const runtime = new Runtime(packWith({}, 'floor(level / 2) + might'));
    const vex = runtime.createCharacter({
      name: 'Vex',
      race: 'ashkin',
      classes: [{ id: 'hexer', level: 2 }],
    });
    (vex.state.abilities as Record<string, number>)['might'] = 3;
    expect(vex.derived().attackBonus).toBe(4); // 1 + 3
    vex.grant('ashwood-blade');
    vex.equip('ashwood-blade', 'main-hand');
    expect(vex.derived().attackBonus).toBe(5); // 1 + (3 + 1)
    expect(vex.state.abilities['might']).toBe(3); // the base is never written
  });

  it('a save grant adds to derived().saves; the base saves in state are untouched', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const brynn = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    expect(brynn.derived().saves['luck']).toBe(0);
    brynn.grant('ward-ring');
    brynn.equip('ward-ring', 'ring');
    expect(brynn.derived().saves).toEqual({ fortitude: 0, reflex: 0, will: 0, toughness: 1, luck: 1 });
    expect(brynn.state.saves['luck']).toBe(0);
  });

  it('a key naming both an ability and a save adds to both', () => {
    const pack = packWith({});
    pack.stats.saves.push('vigor');
    pack.content.items!['stone-heart'] = {
      name: 'Stone Heart',
      kind: 'trinket',
      slots: ['ring'],
      grants: { vigor: 2 },
    };
    const runtime = new Runtime(pack);
    const brynn = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    brynn.grant('stone-heart');
    brynn.equip('stone-heart', 'ring');
    const view = equipmentView(runtime, brynn.state);
    expect(view.abilities['vigor']).toBe(12);
    expect(view.saves['vigor']).toBe(2);
    expect(brynn.derived().hp).toBe(22); // formulas.hp: 10 + vigor
  });

  it('nothing equipped: every fixture value equals its pre-equipment value, gear-* all 0', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const vex = runtime.createCharacter({
      name: 'Vex',
      race: 'ashkin',
      classes: [{ id: 'hexer', level: 2 }],
    });
    const absent = vex.derived();
    expect(absent).toEqual({ hp: 20, ac: 20, attackBonus: 2, saves: { will: 1, luck: 0 } });
    vex.state.equipped = [];
    expect(vex.derived()).toEqual(absent);
    expect(equipmentView(runtime, vex.state).gear).toEqual({
      'gear-hp': 0,
      'gear-ac': 0,
      'gear-initiative': 0,
      'gear-armor': 0,
    });
  });
});
