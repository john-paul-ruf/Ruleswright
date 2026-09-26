/**
 * Checkpoint-3 suite — pools (FR-8) and vancian bindings (CA-4): the pack's
 * pool vocabulary, formula caps, spend-with-rejection, prepare→bind→cast end
 * to end, empty-slot cast rejection, and the host-emitted rest event.
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { RuntimeRuleError } from '../../src/runtime/errors';
import {
  poolVocabulary,
  knownSpells,
  spendPool,
  prepareSpell,
  castSpell,
  rest,
} from '../../src/runtime/pools';
import { cloneRuntimePack } from './fixtures/pack';

describe('pool vocabulary (CA-4 — from the pack, never hardcoded)', () => {
  it('derives pool ids from action/spell point costs', () => {
    const runtime = new Runtime(cloneRuntimePack());
    expect(poolVocabulary(runtime)).toEqual(['stamina']); // only hex-bolt costs points
  });

  it('initializes pools at formula caps and drains with provenance', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Vex', race: 'ashkin', classes: ['hexer'] });
    expect(character.state.pools.stamina).toBe(32); // formulas.stamina: 12 + vigor*2
    const event = spendPool(runtime, character.state, 'stamina', 3);
    expect(character.state.pools.stamina).toBe(29);
    expect(event.type).toBe('pool:drained');
    expect(event.why.rule).toBe('formulas.stamina');
    expect(event.payload.remaining).toBe(29);
  });

  it('rejects an overdraw with no durable change (named rule)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Vex', race: 'ashkin', classes: ['hexer'] });
    try {
      spendPool(runtime, character.state, 'stamina', 100);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRuleError);
      expect((error as RuntimeRuleError).errors[0]!.rule).toBe('insufficient-points');
    }
    expect(character.state.pools.stamina).toBe(32); // unchanged
  });

  it('rejects a pool outside the pack vocabulary', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = runtime.createCharacter({ name: 'Vex', race: 'ashkin', classes: ['hexer'] });
    expect(() => spendPool(runtime, character.state, 'mana', 1)).toThrow(
      /not part of this character's pack vocabulary/,
    );
  });
});

describe('vancian bindings (FR-8 end-to-end)', () => {
  it('prepare → bind → cast consumes the bound slot; empty slot cannot cast', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const hexer = runtime.createCharacter({
      name: 'Vex',
      race: 'ashkin',
      classes: [{ id: 'hexer', level: 2 }],
    });
    const state = hexer.state;
    expect(knownSpells(runtime, state)).toEqual(['hex-bolt', 'grave-light']); // both hexer-list, pack order

    expect(state.slots['1']).toEqual([null]); // hexer level-1 slots [0,1,2,2]
    prepareSpell(runtime, state, 'grave-light');
    expect(state.slots['1']).toEqual(['grave-light']);

    // An EMPTY slot cannot cast: after casting, the bound slot is empty again.
    castSpell(runtime, state, 'grave-light');
    expect(state.slots['1']).toEqual([null]);

    // Now nothing is bound — cast must be rejected with no durable change.
    try {
      castSpell(runtime, state, 'grave-light');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRuleError);
      expect((error as RuntimeRuleError).errors[0]!.rule).toBe('not-prepared');
    }
    expect(state.slots['1']).toEqual([null]);
  });

  it('gates known spells by pack restriction tables (FR-9): warden knows neither hexer spell', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const warden = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    expect(knownSpells(runtime, warden.state)).toEqual([]);
    expect(() => prepareSpell(runtime, warden.state, 'hex-bolt')).toThrow(/not known/);
  });

  it('cast consumes the slot bound to THAT spell — a mismatch is rejected', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const hexer = runtime.createCharacter({
      name: 'Vex',
      race: 'ashkin',
      classes: [{ id: 'hexer', level: 3 }],
    });
    const state = hexer.state;
    prepareSpell(runtime, state, 'grave-light', 0);
    expect(() => castSpell(runtime, state, 'hex-bolt', 0)).toThrow(/holds "grave-light", not "hex-bolt"/);
    expect(state.slots['1']).toEqual(['grave-light', null]); // unchanged
  });

  it('rest is the host-emitted event: slots clear and pools refill to caps (FR-8)', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const hexer = runtime.createCharacter({
      name: 'Vex',
      race: 'ashkin',
      classes: [{ id: 'hexer', level: 3 }],
    });
    const state = hexer.state;
    spendPool(runtime, state, 'stamina', 5);
    prepareSpell(runtime, state, 'grave-light');
    prepareSpell(runtime, state, 'hex-bolt', 1);
    expect(state.slots['1']).toEqual(['grave-light', 'hex-bolt']);

    const event = rest(runtime, state);
    expect(event.type).toBe('rest:completed');
    expect(event.why.rule).toBe('host.rest');
    expect(state.pools.stamina).toBe(32); // refilled to formula cap
    expect(state.slots['1']).toEqual([null, null]); // bindings cleared
    expect(event.payload.slotsCleared).toBe(2);
  });
});
