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

describe('createCharacter (FR-5)', () => {
  it('defaults abilities from the pack and initializes hp from the reserved formula', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    const state = character.state;
    expect(state.abilities).toEqual({ might: 10, grace: 10, vigor: 10, reason: 10, insight: 10, presence: 10 });
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
    const character = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: [{ id: 'warden', level: 4 }] });
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
      runtime.createCharacter({ name: 'X', race: 'no-such-race', classes: ['no-such-class', 'warden', 'warden'] });
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
    expect(() => runtime.createCharacter({ name: 'X', race: 'ashkin', classes: [{ id: 'warden', level: 5 }] })).toThrow(/cover 4 level/);
  });

  it('rejects a non-integer or below-one level (invalid-level)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    expect(() => runtime.createCharacter({ name: 'X', race: 'ashkin', classes: [{ id: 'warden', level: 0 }] })).toThrow(/integer level >= 1/);
  });
});

describe('derived() — CA-6 reserved formulas only', () => {
  it('resolves hp, ac, and attackBonus through pack formulas, never hardcoded math', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const hexer = runtime.createCharacter({ name: 'Vex', race: 'ashkin', classes: [{ id: 'hexer', level: 2 }] });
    const derived = hexer.derived();
    expect(derived.hp).toBe(20); // 10 + vigor(10)
    expect(derived.ac).toBe(20); // 10 + grace(10)
    expect(derived.attackBonus).toBe(2); // hexer attackBonus: 1 + level/2 at level 2
    expect(derived.saves).toEqual({ will: 1, luck: 0 });
  });
});