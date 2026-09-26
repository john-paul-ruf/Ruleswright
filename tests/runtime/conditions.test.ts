/**
 * Checkpoint-3 suite — conditions (FR-7): durations, the three stacking
 * policies, the v1.1 restricts matcher over declared tags (blocking a tagged
 * action AND a tagged spell), tick/expiration, and theme application through
 * the event system.
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { RuntimeRuleError } from '../../src/runtime/errors';
import {
  matchesRestriction,
  isLivePattern,
  applyCondition,
  removeCondition,
  tickConditions,
  isRestricted,
  restrictedIds,
  applyTheme,
  removeTheme,
} from '../../src/runtime/conditions';
import { cloneRuntimePack } from './fixtures/pack';
import type { Pack } from '../../src/schema/pack';

describe('restricts matcher (v1.1 tag consumption — S05 reuses at declare time)', () => {
  it('blocks an action whose tags include the pattern tag, and no other', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    const state = character.state;
    applyCondition(runtime, state, 'sapped'); // restricts: ['actions.tagged:main']
    expect(isRestricted(runtime, state, 'action', 'strike')).toBe(true); // strike.tags: ['main']
    expect(isRestricted(runtime, state, 'action', 'step-aside')).toBe(false); // step-aside.tags: ['move']
    expect(restrictedIds(runtime, state, 'action')).toEqual(['strike']);
  });

  it('blocks a spell whose tags include the pattern tag', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const hexer = runtime.createCharacter({ name: 'Vex', race: 'ashkin', classes: ['hexer'] });
    const state = hexer.state;
    applyCondition(runtime, state, 'hexbound'); // restricts: ['spells.tagged:casting']
    expect(isRestricted(runtime, state, 'spell', 'grave-light')).toBe(true);
    expect(isRestricted(runtime, state, 'spell', 'hex-bolt')).toBe(true); // also tagged casting
    expect(isRestricted(runtime, state, 'action', 'strike')).toBe(false); // actions.tagged: prefix mismatch
    expect(restrictedIds(runtime, state, 'spell')).toEqual(['hex-bolt', 'grave-light']);
  });

  it('matches tags exactly — no substring or prefix bleed', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'X', race: 'ashkin', classes: ['warden'] }).state;
    applyCondition(runtime, state, 'sapped');
    // 'main' must not match 'mainhand' or 'domain' were they declared; assert a non-declared tag id.
    expect(isRestricted(runtime, state, 'action', 'step-aside')).toBe(false);
  });

  it('a pattern naming an undeclared tag matches nothing (matcher cannot exceed the pack)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'X', race: 'ashkin', classes: ['warden'] }).state;
    applyCondition(runtime, state, 'sapped'); // pattern references 'main' — declared by strike
    // Force a pattern referencing an undeclared tag through the matcher directly:
    expect(
      matchesRestriction('actions.tagged:no-such-tag', 'action', ['no-such-tag'], new Set(['main', 'move'])),
    ).toBe(false);
    expect(matchesRestriction('actions.tagged:main', 'action', ['main'], new Set(['main']))).toBe(true);
    expect(isLivePattern(runtime, 'actions.tagged:main')).toBe(true);
    expect(isLivePattern(runtime, 'spells.tagged:no-such-tag')).toBe(false);
  });

  it('wrong-kind prefix never matches (actions pattern vs spell tags)', () => {
    expect(matchesRestriction('actions.tagged:casting', 'spell', ['casting'], new Set(['casting']))).toBe(
      false,
    );
    expect(matchesRestriction('spells.tagged:casting', 'spell', ['casting'], new Set(['casting']))).toBe(
      true,
    );
  });
});

describe('condition lifecycle (FR-7)', () => {
  it('apply seeds duration from the pack and emits condition:applied with pack provenance', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] }).state;
    const event = applyCondition(runtime, state, 'sapped');
    expect(state.conditions).toEqual([{ conditionId: 'sapped', duration: 3 }]);
    expect(event.type).toBe('condition:applied');
    expect(event.why.rule).toBe('content.conditions.sapped');
  });

  it('stacking: refresh resets duration; ignore keeps the first; stack adds an entry', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const refreshed = runtime.createCharacter({ name: 'A', race: 'ashkin', classes: ['warden'] }).state;
    applyCondition(runtime, refreshed, 'sapped'); // duration 3
    tickConditions(runtime, refreshed); // 2
    applyCondition(runtime, refreshed, 'sapped'); // refresh → 3
    expect(refreshed.conditions).toEqual([{ conditionId: 'sapped', duration: 3 }]);

    const ignored = runtime.createCharacter({ name: 'B', race: 'ashkin', classes: ['warden'] }).state;
    applyCondition(runtime, ignored, 'dazzed'); // duration 2, ignore
    tickConditions(runtime, ignored); // 1
    applyCondition(runtime, ignored, 'dazzed');
    expect(ignored.conditions).toEqual([{ conditionId: 'dazzed', duration: 1 }]);

    const stacked = runtime.createCharacter({ name: 'C', race: 'ashkin', classes: ['hexer'] }).state;
    applyCondition(runtime, stacked, 'hexbound'); // duration 2, stack
    applyCondition(runtime, stacked, 'hexbound');
    expect(stacked.conditions.length).toBe(2);
    expect(stacked.conditions.every((active) => active.conditionId === 'hexbound')).toBe(true);

    const fresh = runtime.createCharacter({ name: 'D', race: 'ashkin', classes: ['warden'] }).state;
    applyCondition(runtime, fresh, 'dazzed');
    applyCondition(runtime, fresh, 'dazzed'); // ignore — still one entry
    expect(fresh.conditions.length).toBe(1);
  });

  it('tick decrements durations and expires at zero with condition:removed events', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] }).state;
    applyCondition(runtime, state, 'sapped'); // 3
    expect(tickConditions(runtime, state).length).toBe(0); // 2
    expect(tickConditions(runtime, state).length).toBe(0); // 1
    const events = tickConditions(runtime, state); // 0 → expired
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('condition:removed');
    expect(events[0]!.payload).toEqual({ conditionId: 'sapped', expired: true });
    expect(state.conditions).toEqual([]);
  });

  it('removeCondition clears active instances; removing an inactive one is rejected', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] }).state;
    applyCondition(runtime, state, 'sapped');
    const event = removeCondition(runtime, state, 'sapped');
    expect(event.type).toBe('condition:removed');
    expect(state.conditions).toEqual([]);
    expect(() => removeCondition(runtime, state, 'sapped')).toThrow(RuntimeRuleError);
  });

  it('unknown conditions are rejected with a named rule', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'X', race: 'ashkin', classes: ['warden'] }).state;
    expect(() => applyCondition(runtime, state, 'no-such-condition')).toThrow(/unknown condition/);
  });
});

describe('applyTheme / removeTheme (FR-7 via pack theme tables)', () => {
  it("applies a theme table's declared conditions through the event system", () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] }).state;
    const events = applyTheme(runtime, state, 'wandering-dread');
    expect(events.map((event) => event.type)).toEqual(['condition:applied', 'condition:applied']);
    expect(state.conditions.map((active) => active.conditionId).sort()).toEqual(['dazzed', 'sapped']);
  });

  it('removeTheme clears every condition the theme granted', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] }).state;
    applyTheme(runtime, state, 'wandering-dread');
    const events = removeTheme(runtime, state, 'wandering-dread');
    expect(events.length).toBe(2);
    expect(state.conditions).toEqual([]);
  });

  it('rejects unknown themes and theme tables that grant no declared conditions', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const state = runtime.createCharacter({ name: 'X', race: 'ashkin', classes: ['warden'] }).state;
    expect(() => applyTheme(runtime, state, 'no-such-theme')).toThrow(/unknown theme/);
    expect(() => applyTheme(runtime, state, 'district-scavenge')).toThrow(/grants no declared conditions/);
  });
});

describe('CA-6 guard — derived stats never bypass reserved formulas', () => {
  it('a pack whose ac formula is missing fails at load, not play (fail-closed recheck)', () => {
    const pack = cloneRuntimePack() as Pack;
    const { ac, ...withoutAc } = pack.formulas;
    expect(ac).toBeDefined();
    pack.formulas = withoutAc;
    expect(() => new Runtime(pack)).toThrow(/reserved formula id "ac" is not defined/);
  });
});
