/**
 * CAP-E2/CA-EG2/CA-EG5 suite — the equipment verbs over the shared runtime
 * fixture: the pure `equippedUnits` rule (R-5), equip/unequip with every named
 * rejection (no state change), event payloads, grant stacking across slots,
 * and the lazy `equipped` array (F-E5: absent until the first equip).
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { RuntimeRuleError } from '../../src/runtime/errors';
import { createCharacter } from '../../src/runtime/character';
import { grantItem } from '../../src/runtime/inventory';
import { equipItem, equippedGrants, equippedUnits, unequipItem } from '../../src/runtime/equipment';
import type { CharacterState } from '../../src/runtime/runtime';
import type { ErrorCard } from '../../src/schema/error-card';
import { cloneRuntimePack } from './fixtures/pack';

function vale(): { runtime: Runtime; state: CharacterState } {
  const runtime = new Runtime(cloneRuntimePack());
  const state = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] }).state;
  return { runtime, state };
}

function ruleOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeRuleError);
    return ((error as RuntimeRuleError).errors as readonly ErrorCard[])[0]!.rule;
  }
  return expect.unreachable('expected a RuntimeRuleError');
}

describe('equippedUnits — the one equipped-unit rule (R-5)', () => {
  it('counts 0 fresh, 1 after one equip, 2 across two slots, 0 after both unequip — and never mutates', () => {
    const { runtime, state } = vale();
    expect('equipped' in state).toBe(false);
    expect(equippedUnits(state, 'ashwood-blade')).toBe(0);
    expect('equipped' in state).toBe(false); // a read never creates the array

    grantItem(runtime, state, 'ashwood-blade', 2);
    equipItem(runtime, state, 'ashwood-blade', 'main-hand');
    expect(equippedUnits(state, 'ashwood-blade')).toBe(1);
    equipItem(runtime, state, 'ashwood-blade', 'off-hand');
    const before = JSON.stringify(state);
    expect(equippedUnits(state, 'ashwood-blade')).toBe(2);
    expect(JSON.stringify(state)).toBe(before);

    unequipItem(runtime, state, 'main-hand');
    unequipItem(runtime, state, 'off-hand');
    expect(equippedUnits(state, 'ashwood-blade')).toBe(0);
  });
});

describe('equipItem / unequipItem (CAP-E2)', () => {
  it('equips lazily: a fresh character has no equipped key; the first equip creates it', () => {
    const { runtime, state } = vale();
    expect(state.equipped).toBeUndefined();
    grantItem(runtime, state, 'chain-shirt');
    const event = equipItem(runtime, state, 'chain-shirt', 'body');
    expect(state.equipped).toEqual([{ slot: 'body', itemId: 'chain-shirt' }]);
    expect(event.type).toBe('item:equipped');
    expect(event.actor).toBe(state.id);
    expect(event.payload).toEqual({ itemId: 'chain-shirt', slot: 'body' });
    expect(event.why).toEqual({ rule: 'content.items.chain-shirt', rolls: [] });
  });

  it('unequip frees the slot, emits item:unequipped, and leaves an emptied array as []', () => {
    const { runtime, state } = vale();
    grantItem(runtime, state, 'chain-shirt');
    equipItem(runtime, state, 'chain-shirt', 'body');
    const event = unequipItem(runtime, state, 'body');
    expect(state.equipped).toEqual([]);
    expect(event.type).toBe('item:unequipped');
    expect(event.payload).toEqual({ itemId: 'chain-shirt', slot: 'body' });
    expect(event.why).toEqual({ rule: 'content.items.chain-shirt', rolls: [] });
    expect(state.inventory).toEqual([{ id: 'chain-shirt', qty: 1 }]); // unequip never drops
  });

  it('rejects every gate by name, in order, with no state change and no event', () => {
    const { runtime, state } = vale();
    grantItem(runtime, state, 'chain-shirt');
    grantItem(runtime, state, 'rope');
    const eventsBefore = runtime.events.sinceRound(0).length;
    const before = JSON.stringify(state);

    expect(ruleOf(() => equipItem(runtime, state, 'no-such-item', 'body'))).toBe('unknown-item');
    expect(ruleOf(() => equipItem(runtime, state, 'rope', 'body'))).toBe('not-equippable');
    expect(ruleOf(() => equipItem(runtime, state, 'chain-shirt', 'head'))).toBe('unknown-slot');
    expect(ruleOf(() => equipItem(runtime, state, 'chain-shirt', 'ring'))).toBe('slot-not-allowed');
    expect(ruleOf(() => equipItem(runtime, state, 'ashwood-blade', 'main-hand'))).toBe('item-not-held');
    expect(ruleOf(() => unequipItem(runtime, state, 'body'))).toBe('not-equipped');
    expect(JSON.stringify(state)).toBe(before);
    expect('equipped' in state).toBe(false);
    expect(runtime.events.sinceRound(0).length).toBe(eventsBefore);
  });

  it('slot-occupied: one item per slot — the caller must unequip first (fail-closed)', () => {
    const { runtime, state } = vale();
    grantItem(runtime, state, 'ashwood-blade', 2);
    equipItem(runtime, state, 'ashwood-blade', 'main-hand');
    const before = JSON.stringify(state);
    expect(ruleOf(() => equipItem(runtime, state, 'ashwood-blade', 'main-hand'))).toBe('slot-occupied');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('item-not-held: one held unit cannot fill two slots', () => {
    const { runtime, state } = vale();
    grantItem(runtime, state, 'ashwood-blade', 1);
    equipItem(runtime, state, 'ashwood-blade', 'main-hand');
    const before = JSON.stringify(state);
    expect(ruleOf(() => equipItem(runtime, state, 'ashwood-blade', 'off-hand'))).toBe('item-not-held');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('grants stack across two slots (equippedGrants sums by key)', () => {
    const { runtime, state } = vale();
    expect(equippedGrants(runtime, state)).toEqual({});
    grantItem(runtime, state, 'ashwood-blade', 2);
    grantItem(runtime, state, 'chain-shirt');
    equipItem(runtime, state, 'ashwood-blade', 'main-hand');
    equipItem(runtime, state, 'ashwood-blade', 'off-hand');
    equipItem(runtime, state, 'chain-shirt', 'body');
    expect(equippedGrants(runtime, state)).toEqual({ might: 2, ac: 2, armor: 1 });
  });

  it('the facade delegates equip/unequip one-to-one', () => {
    const runtime = new Runtime(cloneRuntimePack());
    const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
    character.grant('chain-shirt');
    character.equip('chain-shirt', 'body');
    expect(character.state.equipped).toEqual([{ slot: 'body', itemId: 'chain-shirt' }]);
    character.unequip('body');
    expect(character.state.equipped).toEqual([]);
    expect(() => character.unequip('body')).toThrow(RuntimeRuleError);
  });
});
