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

describe('pool capacities over the equipment view (CA-EG2)', () => {
  it('rest refills to the with-grants cap; nothing equipped keeps the base cap byte-identical', () => {
    const pack = cloneRuntimePack();
    pack.formulas['stamina'] = { expr: '12 + might' };
    const runtime = new Runtime(pack);
    const vex = runtime.createCharacter({ name: 'Vex', race: 'ashkin', classes: ['hexer'] });
    expect(vex.state.pools.stamina).toBe(22);
    rest(runtime, vex.state);
    expect(vex.state.pools.stamina).toBe(22);
    vex.grant('ashwood-blade');
    vex.equip('ashwood-blade', 'main-hand');
    const event = rest(runtime, vex.state);
    expect(vex.state.pools.stamina).toBe(23);
    expect(event.payload.poolsRefilled).toEqual({ stamina: 23 });
    vex.unequip('main-hand');
    rest(runtime, vex.state);
    expect(vex.state.pools.stamina).toBe(22);
  });
});

describe('CAP-E3 — armorCasting gates the slot cast (CA-EG3)', () => {
  function hexerIn(pack = cloneRuntimePack()) {
    const runtime = new Runtime(pack);
    const hexer = runtime.createCharacter({
      name: 'Vex',
      race: 'ashkin',
      classes: [{ id: 'hexer', level: 2 }],
    });
    hexer.grant('chain-shirt'); // kind mail, grants.armor — the armor marker
    prepareSpell(runtime, hexer.state, 'grave-light');
    return { runtime, hexer };
  }

  it('a class lacking the kind is rejected armor-not-castable, the slot still bound, no event', () => {
    const { runtime, hexer } = hexerIn();
    hexer.equip('chain-shirt', 'body');
    const before = JSON.stringify(hexer.state);
    const eventsBefore = runtime.events.sinceRound(0).length;
    try {
      castSpell(runtime, hexer.state, 'grave-light');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRuleError);
      expect((error as RuntimeRuleError).errors[0]!.rule).toBe('armor-not-castable');
    }
    expect(hexer.state.slots['1']).toEqual(['grave-light']);
    expect(JSON.stringify(hexer.state)).toBe(before);
    expect(runtime.events.sinceRound(0).length).toBe(eventsBefore);
  });

  it('the same character casts after unequipping the armor', () => {
    const { runtime, hexer } = hexerIn();
    hexer.equip('chain-shirt', 'body');
    expect(() => hexer.cast('grave-light')).toThrow(/armorCasting/);
    hexer.unequip('body');
    const event = castSpell(runtime, hexer.state, 'grave-light');
    expect(event.type).toBe('spell:cast');
    expect(hexer.state.slots['1']).toEqual([null]);
  });

  it('a class listing the kind casts while the armor is equipped', () => {
    const pack = cloneRuntimePack();
    pack.content.classes!['hexer']!.armorCasting = ['mail'];
    const { runtime, hexer } = hexerIn(pack);
    hexer.equip('chain-shirt', 'body');
    expect(castSpell(runtime, hexer.state, 'grave-light').type).toBe('spell:cast');
  });

  it("non-armor gear never blocks, and any one of the character's classes listing the kind suffices", () => {
    const { runtime, hexer } = hexerIn();
    hexer.grant('ashwood-blade');
    hexer.equip('ashwood-blade', 'main-hand');
    expect(castSpell(runtime, hexer.state, 'grave-light').type).toBe('spell:cast');

    const multi = new Runtime(cloneRuntimePack());
    const sela = multi.createCharacter({
      name: 'Sela',
      race: 'ashkin',
      classes: [
        { id: 'warden', level: 1 },
        { id: 'hexer', level: 2 },
      ],
    });
    sela.grant('chain-shirt');
    sela.equip('chain-shirt', 'body'); // warden lists mail
    prepareSpell(multi, sela.state, 'grave-light');
    expect(castSpell(multi, sela.state, 'grave-light').type).toBe('spell:cast');
  });
});

describe('v1.10 — a class feature unlocks a vancian spell (CAP-C5, CA-C4)', () => {
  /** The fixture warden (spellLists [warden], slots 1: [1, 2, 2, 3]) unlocks hexer-list grave-light ({vancian: 1}) at 2. */
  function unlockPack() {
    const pack = cloneRuntimePack();
    expect(pack.content.spells!['grave-light']).toMatchObject({
      magic: { level: 1, lists: ['hexer'] },
      cost: { vancian: 1 },
    });
    pack.progression['warden']!.features!.push({ level: 2, ref: 'grave-light' });
    return new Runtime(pack);
  }

  it('warden L1: not known, and prepareSpell refuses spell-not-known with nothing changed', () => {
    const runtime = unlockPack();
    const warden = runtime.createCharacter({ name: 'Brynn', race: 'ashkin', classes: ['warden'] });
    expect(knownSpells(runtime, warden.state)).toEqual([]);
    const before = JSON.stringify(warden.state);
    try {
      prepareSpell(runtime, warden.state, 'grave-light');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRuleError);
      expect((error as RuntimeRuleError).errors[0]!.rule).toBe('spell-not-known');
    }
    expect(JSON.stringify(warden.state)).toBe(before);
  });

  it('warden L2: known (pack order), and prepareSpell binds it and emits spell:prepared', () => {
    const runtime = unlockPack();
    const warden = runtime.createCharacter({
      name: 'Brynn',
      race: 'ashkin',
      classes: [{ id: 'warden', level: 2 }],
    });
    expect(knownSpells(runtime, warden.state)).toEqual(['grave-light']);
    const event = prepareSpell(runtime, warden.state, 'grave-light');
    expect(event).toMatchObject({
      type: 'spell:prepared',
      payload: { spellId: 'grave-light', slotLevel: '1', slotIndex: 0 },
      why: { rule: 'content.spells.grave-light' },
    });
    expect(warden.state.slots['1']).toEqual(['grave-light', null]);
  });
});
