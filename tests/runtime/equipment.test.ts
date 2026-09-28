/**
 * CAP-E2/CA-EG2/CA-EG5 suite — the equipment verbs over the shared runtime
 * fixture: the pure `equippedUnits` rule (R-5), equip/unequip with every named
 * rejection (no state change), event payloads, grant stacking across slots,
 * the lazy `equipped` array (F-E5: absent until the first equip), and the
 * out-of-combat `useItem` (CAP-E4 character leg: the R-2 heal clamp, over-cap
 * `X→X`, one unit per use, the parse-once `itemEffects` index).
 */
import { describe, expect, it } from 'vitest';
import { Runtime } from '../../src/runtime/runtime';
import { RuntimeRuleError } from '../../src/runtime/errors';
import { createCharacter } from '../../src/runtime/character';
import { grantItem } from '../../src/runtime/inventory';
import { equipItem, equippedGrants, equippedUnits, unequipItem, useItem } from '../../src/runtime/equipment';
import type { Pack } from '../../src/schema/pack';
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

/** The fixture with a gear-aware hp formula plus in-test consumables exercising each apply path. */
function gearPack(): Pack {
  const pack = cloneRuntimePack();
  pack.formulas['hp'] = { expr: '10 + vigor + gear-hp' };
  pack.content.items!['blight-vial'] = { name: 'Blight Vial', kind: 'consumable', use: 'damage(3)' };
  pack.content.items!['sap-dust'] = {
    name: 'Sap Dust',
    kind: 'consumable',
    use: 'applyCondition(sapped, 5)',
  };
  pack.content.items!['charm-flask'] = {
    name: 'Charm Flask',
    kind: 'consumable',
    slots: ['ring'],
    use: 'heal(1)',
  };
  return pack;
}

function gearVale(): { runtime: Runtime; character: ReturnType<typeof createCharacter> } {
  const runtime = new Runtime(gearPack());
  const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: ['warden'] });
  return { runtime, character };
}

describe('parse-once item effects (F-E11)', () => {
  it('indexes exactly the items that declare use', () => {
    const { runtime } = vale();
    expect(Object.keys(runtime.index.itemEffects)).toEqual(['mend-draught']);
    expect(runtime.index.itemEffects['mend-draught']!.text).toBe('heal');
  });
});

describe('useItem — out-of-combat consumables (CAP-E4 character leg, CA-EG4/CA-EG5)', () => {
  it('heal(10) into a character missing 4 lands exactly at the cap; the last unit removes the entry', () => {
    const { runtime, state } = vale();
    grantItem(runtime, state, 'mend-draught');
    state.hp.current = 16; // cap 20 (10 + vigor)
    const events = useItem(runtime, state, 'mend-draught');
    expect(state.hp.current).toBe(20);
    expect(state.inventory).toEqual([]);
    expect(events.map((event) => event.type)).toEqual(['item:used', 'damage:applied']);
    expect(events[0]!.payload).toEqual({ itemId: 'mend-draught', remaining: 0 });
    expect(events[0]!.why).toEqual({ rule: 'content.items.mend-draught', rolls: [] });
    const heal = events[1]!;
    expect(heal.actor).toBe(state.id);
    expect(heal.target).toBe(state.id);
    expect(heal.payload.amount).toBe(-10);
    expect(heal.payload.hp).toBe('16→20');
    expect(heal.why).toEqual({ rule: 'content.items.mend-draught', rolls: ['d0[]-10=-10'] });
  });

  it('consumes exactly one unit per use; the stack survives above zero', () => {
    const { runtime, state } = vale();
    grantItem(runtime, state, 'mend-draught', 2);
    useItem(runtime, state, 'mend-draught');
    expect(state.inventory).toEqual([{ id: 'mend-draught', qty: 1 }]);
  });

  it('the heal cap equals derived().hp with grants equipped', () => {
    const { runtime, character } = gearVale();
    character.grant('ward-ring');
    character.equip('ward-ring', 'ring');
    character.grant('mend-draught');
    expect(character.derived().hp).toBe(22);
    character.state.hp.current = 15;
    character.useItem('mend-draught');
    expect(character.state.hp.current).toBe(character.derived().hp);
    expect(runtime.events.sinceRound(0).slice(-1)[0]!.payload.hp).toBe('15→22');
  });

  it('R-2 over-cap: a heal never lowers hp already above the cap — X→X, the unit still consumed', () => {
    const { runtime, character } = gearVale();
    character.grant('ward-ring');
    character.equip('ward-ring', 'ring');
    character.state.hp.current = character.derived().hp; // 22, the with-grants cap
    character.unequip('ring'); // unequip never clamps: 22 > the new cap 20
    expect(character.state.hp.current).toBe(22);
    expect(character.derived().hp).toBe(20);
    character.grant('mend-draught');
    const events = character.useItem('mend-draught');
    expect(character.state.hp.current).toBe(22);
    expect(character.state.inventory.some((entry) => entry.id === 'mend-draught')).toBe(false);
    expect(events.map((event) => event.type)).toEqual(['item:used', 'damage:applied']);
    expect(events[1]!.payload.hp).toBe('22→22');
    expect(events[1]!.payload.amount).toBe(-10);
    expect(runtime.events.sinceRound(0).filter((event) => event.type === 'damage:applied').length).toBe(1);
  });

  it('a positive-total damage effect subtracts honestly; a condition effect routes through applyCondition with the effect duration', () => {
    const { character } = gearVale();
    character.grant('blight-vial');
    character.useItem('blight-vial');
    expect(character.state.hp.current).toBe(17);
    character.grant('sap-dust');
    const events = character.useItem('sap-dust');
    expect(events.map((event) => event.type)).toEqual(['item:used', 'condition:applied']);
    expect(character.state.conditions).toEqual([{ conditionId: 'sapped', duration: 5 }]); // pack default 3
  });

  it('rejects every gate by name with no state change and no event', () => {
    const { runtime, character } = gearVale();
    const state = character.state;
    grantItem(runtime, state, 'ashwood-blade');
    grantItem(runtime, state, 'charm-flask');
    equipItem(runtime, state, 'charm-flask', 'ring');
    const before = JSON.stringify(state);
    const eventsBefore = runtime.events.sinceRound(0).length;
    expect(ruleOf(() => useItem(runtime, state, 'no-such-item'))).toBe('unknown-item');
    expect(ruleOf(() => useItem(runtime, state, 'ashwood-blade'))).toBe('not-consumable');
    expect(ruleOf(() => useItem(runtime, state, 'mend-draught'))).toBe('item-not-held');
    expect(ruleOf(() => useItem(runtime, state, 'charm-flask'))).toBe('item-equipped');
    expect(JSON.stringify(state)).toBe(before);
    expect(runtime.events.sinceRound(0).length).toBe(eventsBefore);
  });
});
