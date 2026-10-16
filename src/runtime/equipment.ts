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
 * Out-of-combat consumables (CAP-E4/CA-EG5): `useItem` consumes one unit and
 * runs the item's parse-once `use` effect against the character itself. A
 * heal (a negative-amount damage request, CA-EG4) follows the R-2 rule:
 * `after = current >= cap ? current : min(cap, current + heal)` with cap = the
 * with-grants `hp` formula — never above the cap, never lowering hp already
 * above it (legal after an unequip).
 *
 * Runtime leaf (R-11): value imports are core, `./errors`, `./conditions` and
 * the `./display-roll` leaf only — character/pools/inventory import this
 * module, never the reverse.
 */
import { executeEffect, type EffectApply } from '../core/dsl/effect';
import { EQUIPMENT_SCALARS, evalFormula, valueOfFormula } from '../core/dsl/formula';
import { Rng, type RandomSource } from '../core/rng';
import type { Runtime } from './runtime';
import type { CharacterState } from './character';
import { RuntimeRuleError, ruleCard } from './errors';
import type { RuntimeEvent } from './events';
import { applyCondition } from './conditions';
import { displayRoll } from './display-roll';

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

/**
 * CA-EG2 — the character's effective scalars: ability/save grants ADDED to the base stat;
 * reserved grants exposed as gear-hp/gear-ac/gear-initiative/gear-armor (0 when none).
 */
export interface EquipmentView {
  readonly abilities: Record<string, number>;
  readonly saves: Record<string, number>;
  /** Exactly the `EQUIPMENT_SCALARS` keys. */
  readonly gear: Record<string, number>;
}

/**
 * CA-EG2 — the one composition site. A key naming both an ability and a save
 * adds to both; a save the character's classes grant no base for starts at 0.
 * Nothing equipped ⇒ the base stats verbatim and every `gear-*` 0.
 */
export function equipmentView(runtime: Runtime, state: CharacterState): EquipmentView {
  const abilities: Record<string, number> = { ...state.abilities };
  const saves: Record<string, number> = { ...state.saves };
  const gear: Record<string, number> = {};
  for (const scalar of EQUIPMENT_SCALARS) gear[scalar] = 0;
  for (const [key, value] of Object.entries(equippedGrants(runtime, state))) {
    const scalar = `gear-${key}`;
    if (scalar in gear) gear[scalar] = gear[scalar]! + value;
    if (runtime.pack.stats.abilities.includes(key)) abilities[key] = (abilities[key] ?? 0) + value;
    if (runtime.pack.stats.saves.includes(key)) saves[key] = (saves[key] ?? 0) + value;
  }
  return { abilities, saves, gear };
}

/** CA-EG2 — the formula scope for the character's reserved stats: `{...view.abilities, level, ...view.gear}`. */
export function equipmentScope(view: EquipmentView, level: number): Record<string, number> {
  return { ...view.abilities, level, ...view.gear };
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

/** The use call's optional entropy steering: an injected source wins over the seed (FR-1, the grantLoot precedent). */
export interface UseItemOptions {
  readonly seed?: number | string;
  readonly rng?: RandomSource;
}

/**
 * CAP-E4/CA-EG5 — use one unit of a consumable out of combat. Gates, in order:
 * `unknown-item`, `not-consumable`, `item-not-held`, `insufficient-qty`,
 * `item-equipped` (the `dropItem` rule, R-5) — no state change on rejection.
 * Then one unit leaves the inventory (the entry at 0), `item:used` is emitted,
 * and the effect executes against the character; its own events follow
 * (`damage:applied` per damage/heal request, `condition:applied` per condition).
 */
export function useItem(
  runtime: Runtime,
  state: CharacterState,
  itemId: string,
  opts?: UseItemOptions,
): readonly RuntimeEvent[] {
  if (runtime.pack.content.items?.[itemId] === undefined) throw unknownItem(runtime, itemId);
  const effect = runtime.index.itemEffects[itemId];
  if (effect === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'not-consumable',
        itemId,
        `content.items.${itemId}.use`,
        `"${itemId}" declares no use effect — it cannot be used.`,
      ),
    ]);
  }
  const index = state.inventory.findIndex((entry) => entry.id === itemId);
  if (index === -1) {
    throw new RuntimeRuleError([
      ruleCard('item-not-held', itemId, 'inventory', `"${state.id}" holds no "${itemId}" — nothing to use.`),
    ]);
  }
  const held = state.inventory[index]!.qty;
  if (held < 1) {
    throw new RuntimeRuleError([
      ruleCard(
        'insufficient-qty',
        itemId,
        'inventory',
        `"${itemId}" is held x${held}; using 1 would overdraw — rejected, no state changed.`,
      ),
    ]);
  }
  const worn = equippedUnits(state, itemId);
  if (held - 1 < worn) {
    throw new RuntimeRuleError([
      ruleCard(
        'item-equipped',
        itemId,
        'equipped',
        `"${itemId}" is held x${held} with ${worn} equipped; using 1 would strand an equipped unit — unequip first.`,
      ),
    ]);
  }

  const view = equipmentView(runtime, state);
  const scope = equipmentScope(view, state.level);
  const cap = scopedFormula(runtime, 'hp', scope);
  const vars: Record<string, number> = {
    ...view.abilities,
    ...view.saves,
    level: state.level,
    hp: state.hp.current,
    ac: scopedFormula(runtime, 'ac', scope),
    initiative:
      runtime.index.formulaAsts['initiative'] === undefined ? 0 : scopedFormula(runtime, 'initiative', scope),
    speed: runtime.index.formulaAsts['speed'] === undefined ? 0 : scopedFormula(runtime, 'speed', scope),
  };
  for (const [name, value] of Object.entries(view.abilities)) vars[`ability:${name}`] = value;
  const rule = `content.items.${itemId}`;

  if (held === 1) state.inventory.splice(index, 1);
  else state.inventory[index]!.qty = held - 1;
  const events: RuntimeEvent[] = [
    runtime.events.emit({
      type: 'item:used',
      actor: state.id,
      payload: { itemId, remaining: held - 1 },
      why: { rule, rolls: [] },
    }),
  ];

  const self = { id: state.id };
  const apply: EffectApply = {
    resolveTargets: () => [self],
    damage: (_target, roll, type) => {
      const before = state.hp.current;
      const after =
        roll.total < 0
          ? before >= cap
            ? before
            : Math.min(cap, before - roll.total)
          : Math.max(0, before - roll.total);
      state.hp.current = after;
      events.push(
        runtime.events.emit({
          type: 'damage:applied',
          actor: state.id,
          target: state.id,
          payload: { amount: roll.total, type, hp: `${before}→${after}` },
          why: { rule, rolls: [displayRoll(roll)] },
        }),
      );
    },
    condition: (_target, conditionId, duration) => {
      events.push(applyCondition(runtime, state, conditionId, duration));
    },
  };
  executeEffect(effect, {
    actor: state.id,
    targets: [self],
    rng: opts?.rng ?? new Rng(opts?.seed ?? itemId),
    apply,
    vars,
  });
  return events;
}

/** A pack formula over the character's equipment scope with the zero RNG — the scope and RNG `derived()` uses (CA-EG2). */
function scopedFormula(runtime: Runtime, formulaId: string, scope: Readonly<Record<string, number>>): number {
  const ast = runtime.index.formulaAsts[formulaId];
  if (ast === undefined) {
    throw new Error(
      `formula "${formulaId}" missing at play time — Runtime load should have rejected the pack (E-REF-01)`,
    );
  }
  return valueOfFormula(evalFormula(ast, scope, new Rng(0)));
}
