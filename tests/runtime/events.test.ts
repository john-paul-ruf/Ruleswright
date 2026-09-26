/**
 * CA-3 checkpoint-1 suite — the event envelope + stream, the runtime load
 * path, and the shared-file window's named non-combat events. Envelope shape
 * assertions pin the combat-loop.html anatomy S05's rows must conform to.
 */
import { describe, expect, it } from 'vitest';
import { Runtime, PackLoadError } from '../../src/runtime/runtime';
import { BROKEN_PACK, cloneRuntimePack } from './fixtures/pack';
import type { Pack } from '../../src/schema/pack';
import type { RuntimeEvent } from '../../src/runtime/events';

describe('Runtime.load (FR-2, CA-6)', () => {
  it('loads a valid pack and indexes/compiles it', () => {
    const runtime = new Runtime(cloneRuntimePack());
    expect(runtime.pack.manifest.id).toBe('test-vale');
    expect(runtime.index.actionEffects['strike']).toBeDefined();
    expect(runtime.index.spellEffects['grave-light']).toBeDefined();
    expect(runtime.index.formulaAsts['hp']).toBeDefined();
    expect(runtime.index.formulaAsts['ac']).toBeDefined();
    expect(runtime.index.classes['warden']).toBeDefined();
  });

  it('rejects a broken pack with an aggregate of ErrorCards (never partial load)', () => {
    let caught: unknown;
    try {
      new Runtime(BROKEN_PACK);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PackLoadError);
    const load = caught as PackLoadError;
    expect(load.errors.length).toBeGreaterThanOrEqual(2);
    const rules = load.errors.map((card) => card.rule);
    expect(rules).toContain('E-REF-01'); // missing ac formula
    expect(rules.some((rule) => rule.startsWith('E-FORM'))).toBe(true); // effect checked by the real S03 checker
  });

  it('enforces the reserved hp/ac formulas at runtime too (CA-6 fail-closed recheck)', () => {
    const pack = cloneRuntimePack() as Pack;
    const { ac, ...withoutAc } = pack.formulas;
    expect(ac).toBeDefined();
    pack.formulas = withoutAc;
    // A hand-assembled Pack object bypassing the schema still fails at load.
    try {
      new Runtime(pack);
      expect.unreachable('load must reject a pack without formulas.ac');
    } catch (error) {
      expect(error).toBeInstanceOf(PackLoadError);
      expect((error as PackLoadError).errors.map((card) => card.rule)).toContain('E-REF-01');
    }
  });
});

describe('EventStream (CA-3 envelope + emitter)', () => {
  it('emits the exact combat-loop.html envelope', () => {
    const runtime = new Runtime(cloneRuntimePack());
    runtime.events.setClock({ round: 1, turn: 3 });
    const event = runtime.events.emit({
      type: 'damage:applied',
      actor: 'barrow-wight',
      target: 'brynn',
      payload: { amount: 6, hp: '10→4' },
      why: { rule: 'bestiary.barrow-wight.claw', rolls: ['d20[14]+3=17 ≥ ac15', 'd6[4]+2=6'] },
    });
    expect(Object.keys(event).sort()).toEqual(['actor', 'at', 'payload', 'target', 'type', 'why']);
    expect(event.at).toEqual({ round: 1, turn: 3 });
    expect(event.why).toEqual({ rule: 'bestiary.barrow-wight.claw', rolls: ['d20[14]+3=17 ≥ ac15', 'd6[4]+2=6'] });
  });

  it('delivers to a subscriber and stops after off', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const seen: RuntimeEvent[] = [];
    const sink = (event: RuntimeEvent): void => {
      seen.push(event);
    };
    runtime.events.on(sink);
    runtime.events.emit({ type: 'character:created', payload: {}, why: { rule: 'test', rolls: [] } });
    runtime.events.off(sink);
    runtime.events.emit({ type: 'character:created', payload: {}, why: { rule: 'test', rolls: [] } });
    expect(seen.length).toBe(1);
  });

  it('sinceRound returns the replay window', () => {
    const runtime = new Runtime(cloneRuntimePack());
    runtime.events.setClock({ round: 1, turn: 0 });
    runtime.events.emit({ type: 'character:created', payload: {}, why: { rule: 'a', rolls: [] } });
    runtime.events.setClock({ round: 2, turn: 0 });
    runtime.events.emit({ type: 'xp:awarded', payload: {}, why: { rule: 'b', rolls: [] } });
    const window = runtime.events.sinceRound(2);
    expect(window.length).toBe(1);
    expect(window[0]!.type).toBe('xp:awarded');
  });

  it('emitting with zero subscribers runs fine and still records (FR-13)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    expect(() => {
      runtime.events.emit({ type: 'condition:applied', payload: {}, why: { rule: 'r', rolls: [] } });
    }).not.toThrow();
    expect(runtime.events.sinceRound(0).length).toBe(1);
  });
});

describe('createCharacter (FR-5, shared-file window event)', () => {
  it('creates plain-JSON state with pack-defaulted abilities and reserved-formula hp', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    const state = character.state;
    expect(state.id).toBe('char-1');
    expect(state.abilities).toEqual({ might: 10, grace: 10, vigor: 10, reason: 10, insight: 10, presence: 10 });
    expect(state.hp.current).toBe(20); // formulas.hp: 10 + vigor
    expect(state.level).toBe(1);
    expect(state.conditions).toEqual([]);
    // Plain-JSON guarantee: round-trips through JSON without loss (FR-14).
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('emits character:created with provenance naming the pack artifact (FR-13)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const seen: RuntimeEvent[] = [];
    runtime.events.on((event) => {
      seen.push(event);
    });
    runtime.createCharacter({ name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    expect(seen.length).toBe(1);
    expect(seen[0]!.type).toBe('character:created');
    expect(seen[0]!.actor).toBe('char-1');
    expect(seen[0]!.why.rule).toBe('content.races.hillfolk');
  });
});