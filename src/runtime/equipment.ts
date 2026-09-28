/**
 * M03 — equipment (CAP-E2/CA-EG2): pack-declared items worn in pack-declared
 * `equipSlots`, held as `{slot, itemId}` entries on `CharacterState.equipped`
 * (plain JSON, FR-14). Same verb discipline as inventory.ts — validate with
 * named rules (`ruleCard`), mutate in place, emit one provenanced event per
 * mutation (FR-13). Rejections leave no durable change.
 *
 * `equipped` is ABSENT until the first equip (absent = `[]`, F-E5): the
 * factory never writes it, `equipItem` creates it lazily, and an emptied
 * array stays `[]`.
 *
 * `equippedUnits` is the ONE equipped-unit rule (R-5): the equip held check,
 * `dropItem`'s guard, `useItem`'s guard and combat settlement all call it.
 *
 * Runtime leaf (R-11): value imports are core, `./errors` and `./conditions`
 * only — character/pools/inventory import this module, never the reverse.
 */
import type { Runtime } from './runtime';
import type { CharacterState } from './character';
import { RuntimeRuleError, ruleCard } from './errors';
import type { RuntimeEvent } from './events';

/** One occupied slot: plain data; one item per slot; the slot is a pack `equipSlots` id. */
export interface EquippedEntry {
  readonly slot: string;
  itemId: string;
}

/**
 * CA-EG1/DD-EG1 — how many slots currently hold `itemId` (absent `equipped` = 0).
 * Pure: reads state only, no runtime, no mutation. The ONE equipped-unit rule:
 * `dropItem`'s guard, `equipItem`'s held check, `useItem`'s guard and S05's
 * `settleItemUses` all call it (R-5).
 */
export function equippedUnits(state: CharacterState, itemId: string): number {
  return (state.equipped ?? []).filter((entry) => entry.itemId === itemId).length;
}

/** CA-EG2 — sum of every equipped item's grants, by grant key (absent `equipped` = none). */
export function equippedGrants(runtime: Runtime, state: CharacterState): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const entry of state.equipped ?? []) {
    const grants = runtime.pack.content.items?.[entry.itemId]?.grants ?? {};
    for (const [key, value] of Object.entries(grants)) sums[key] = (sums[key] ?? 0) + value;
  }
  return sums;
}

function unknownItem(runtime: Runtime, itemId: string): RuntimeRuleError {
  return new RuntimeRuleError([
    ruleCard(
      'unknown-item',
      itemId,
      `content.items.${itemId}`,
      `unknown item "${itemId}" — not declared in content.items.`,
      `known items: ${Object.keys(runtime.pack.content.items ?? {}).join(', ') || '(none)'}`,
    ),
  ]);
}

/**
 * CAP-E2 — equip a held item into one of its declared slots. One item per slot.
 * Gates, in order: `unknown-item`, `not-equippable`, `unknown-slot`,
 * `slot-not-allowed`, `slot-occupied` (unequip first — fail-closed),
 * `item-not-held` (held qty must exceed the slots already holding the id).
 * Emits `item:equipped` provenanced by the item's declaration.
 */
export function equipItem(
  runtime: Runtime,
  state: CharacterState,
  itemId: string,
  slot: string,
): RuntimeEvent {
  const item = runtime.pack.content.items?.[itemId];
  if (item === undefined) throw unknownItem(runtime, itemId);
  if (item.slots === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'not-equippable',
        itemId,
        `content.items.${itemId}.slots`,
        `"${itemId}" declares no slots — it cannot be equipped.`,
      ),
    ]);
  }
  const packSlots = runtime.pack.equipSlots ?? [];
  if (!packSlots.includes(slot)) {
    throw new RuntimeRuleError([
      ruleCard(
        'unknown-slot',
        slot,
        'equipSlots',
        `unknown slot "${slot}" — not declared in equipSlots.`,
        `pack slots: ${packSlots.join(', ') || '(none)'}`,
      ),
    ]);
  }
  if (!item.slots.includes(slot)) {
    throw new RuntimeRuleError([
      ruleCard(
        'slot-not-allowed',
        itemId,
        `content.items.${itemId}.slots`,
        `"${itemId}" cannot be equipped in "${slot}" — its slots are ${item.slots.join(', ')}.`,
      ),
    ]);
  }
  const occupant = state.equipped?.find((entry) => entry.slot === slot);
  if (occupant !== undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'slot-occupied',
        slot,
        'equipped',
        `slot "${slot}" already holds "${occupant.itemId}" — unequip it first.`,
      ),
    ]);
  }
  const held = state.inventory.find((entry) => entry.id === itemId)?.qty ?? 0;
  const worn = equippedUnits(state, itemId);
  if (held <= worn) {
    throw new RuntimeRuleError([
      ruleCard(
        'item-not-held',
        itemId,
        'inventory',
        `"${state.id}" holds x${held} "${itemId}" with ${worn} already equipped — no free unit to equip.`,
      ),
    ]);
  }
  (state.equipped ??= []).push({ slot, itemId });
  return runtime.events.emit({
    type: 'item:equipped',
    actor: state.id,
    payload: { itemId, slot },
    why: { rule: `content.items.${itemId}`, rolls: [] },
  });
}

/**
 * CAP-E2 — free a slot. `not-equipped` when the slot is empty (no change).
 * The emptied array stays `[]`. Emits `item:unequipped`. Never clamps hp
 * (CA-EG2): hp above the new cap is a legal state.
 */
export function unequipItem(runtime: Runtime, state: CharacterState, slot: string): RuntimeEvent {
  const index = state.equipped?.findIndex((entry) => entry.slot === slot) ?? -1;
  if (index === -1) {
    throw new RuntimeRuleError([
      ruleCard('not-equipped', slot, 'equipped', `slot "${slot}" is empty — nothing to unequip.`),
    ]);
  }
  const [removed] = state.equipped!.splice(index, 1);
  return runtime.events.emit({
    type: 'item:unequipped',
    actor: state.id,
    payload: { itemId: removed!.itemId, slot },
    why: { rule: `content.items.${removed!.itemId}`, rolls: [] },
  });
}
