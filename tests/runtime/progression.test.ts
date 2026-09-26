/**
 * Checkpoint-2 suite — progression (FR-6): the XP path, pack thresholds with
 * race caps, XP split policy, and identical validation between the direct
 * level-set path and the earned path (byte-identical progression state).
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { CharacterBuildError, levelForXp, xpSplit } from '../../src/runtime/progression';
import { cloneRuntimePack } from './fixtures/pack';
import type { RuntimeEvent } from '../../src/runtime/events';

describe('awardXp — the host awards, the engine reports (FR-6, FR-13)', () => {
  it('accumulates XP, emits xp:awarded with host.grant provenance, and derives levels from pack thresholds', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    const seen: RuntimeEvent[] = [];
    runtime.events.on((event) => seen.push(event));

    const events = runtime.awardXp(character, 1000);

    expect(character.state.xp).toBe(1000);
    expect(character.state.classXp.warden).toBe(1000);
    expect(character.state.classes[0]!.level).toBe(2); // fallback curve: 1000/level
    expect(events.length).toBe(2);
    expect(events[0]!.type).toBe('xp:awarded');
    expect(events[0]!.why.rule).toBe('host.grant');
    expect(events[1]!.type).toBe('level:reached');
    expect(events[1]!.payload).toEqual({ classId: 'warden', level: 2 });
    expect(seen.length).toBe(2); // subscriber received the same events
    expect(character.state.saves.reflex).toBe(1); // warden level-2 column
  });

  it('caps class level at the race cap (demihuman caps are pack data)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Old', race: 'hillfolk', classes: [{ id: 'hexer', level: 2 }] });
    runtime.awardXp(character, 2000);
    expect(character.state.classes[0]!.level).toBe(2); // capped at hillfolk.hexer cap (2)
    expect(character.state.xp).toBe(2000); // XP accumulates even when capped
    expect(character.state.classXp.hexer).toBe(2000);
  });
  it('rejects non-positive or non-integer awards', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'X', race: 'ashkin', classes: ['warden'] });
    expect(() => runtime.awardXp(character, 0)).toThrow(CharacterBuildError);
    expect(() => runtime.awardXp(character, -5)).toThrow(CharacterBuildError);
    expect(() => runtime.awardXp(character, 1.5)).toThrow(CharacterBuildError);
  });
});

describe('levelSet — direct path validates identically to the XP path (FR-6)', () => {
  it('a level-4 direct set and a level-4 earned set produce identical progression state', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const direct = runtime.createCharacter({ name: 'Direct', race: 'ashkin', classes: [{ id: 'warden', level: 4 }] });
    const earned = runtime.createCharacter({ name: 'Earned', race: 'ashkin', classes: [{ id: 'warden', level: 1 }] });
    runtime.awardXp(earned, 3000); // fallback curve: level 4

    const a = direct.state;
    const b = earned.state;
    expect(a.level).toBe(b.level);
    expect(a.saves).toEqual(b.saves);
    expect(a.slots).toEqual(b.slots);
    expect(a.level).toBe(4);
  });

  it('emits level:reached only for classes whose level changed', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: [{ id: 'warden', level: 1 }, { id: 'hexer', level: 2 }] });
    const events = runtime.levelSet(character, [
      { id: 'warden', level: 2 },
      { id: 'hexer', level: 2 },
    ]);
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('level:reached');
    expect(events[0]!.payload).toEqual({ classId: 'warden', level: 2 });
  });

  it('runs the same build validator — illegal level-set rejected with named rules', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    try {
      runtime.levelSet(character, [{ id: 'warden', level: 99 }]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CharacterBuildError);
      expect((error as CharacterBuildError).errors.map((card) => card.rule)).toContain('missing-progression');
    }
    // Rejection leaves state unchanged.
    expect(character.state.classes[0]!.level).toBe(1);
  });
});

describe('pack-declared XP curve (tables.xp)', () => {
  it('reads thresholds from a ranged table when the pack declares one', () => {
    const runtime = new Runtime(cloneRuntimePack());
    runtime.pack.tables['xp'] = {
      kind: 'ranged',
      entries: [
        { min: 0, max: 4999, value: 1 },
        { min: 5000, max: 11999, value: 2 },
        { min: 12000, max: 999999999, value: 3 },
      ],
    };
    expect(levelForXp(runtime, 4999)).toBe(1);
    expect(levelForXp(runtime, 5000)).toBe(2);
    const character = runtime.createCharacter({ name: 'X', race: 'ashkin', classes: ['warden'] });
    runtime.awardXp(character, 6000);
    expect(character.state.classes[0]!.level).toBe(2);
  });
});

describe('XP split policy', () => {
  it('splits even shares with remainder to the first class (documented v1 default)', () => {
    expect(xpSplit(1000, 2)).toEqual([500, 500]);
    expect(xpSplit(100, 3)).toEqual([34, 33, 33]);
    expect(xpSplit(1, 2)).toEqual([1, 0]);
  });

  it('multi-class award splits XP and derives levels per class', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({
      name: 'Sela',
      race: 'ashkin',
      classes: [
        { id: 'warden', level: 1 },
        { id: 'hexer', level: 1 },
      ],
    });
    runtime.awardXp(character, 2001); // warden 1001 → level 2; hexer 1000 → level 2
    expect(character.state.classXp.warden).toBe(1001);
    expect(character.state.classXp.hexer).toBe(1000);
    expect(character.state.classes.map((entry) => entry.level)).toEqual([2, 2]);
  });
});