/**
 * M03 — inventory (CAP-01/CA-02): pack-declared items as {id, qty} stacks on
 * `CharacterState.inventory` (plain JSON, FR-14), granted/dropped/counted
 * through the same verb discipline as pools.ts — validate with named rules
 * (`ruleCard`), mutate in place, emit one provenanced event per mutation
 * (FR-13). Rejections leave no durable change; ids resolve in `content.items`
 * at mutation time (CA-01: restore is verbatim, it never cross-validates).
 *
 * Loot (CAP-02) rolls a pack table through THE one table engine (Custom Rule
 * 3 — `core/tables.ts`, never a second implementation) and maps the rolled
 * value into inventory under the CA-02 value convention:
 *   string resolving in content.items  ⇒ grant that id, qty 1
 *   plain object {id, qty: int >= 1}   ⇒ grant that stack
 *   anything else (prose, numbers, null, undeclared ids) ⇒ flavor — skipped,
 *     not an error by itself; a roll where nothing was grantable rejects with
 *     `loot-grants-nothing` (no state change).
 * A string here is an item id, NOT a condition id — applyTheme's vocabulary
 * does not apply (distinct concepts stay distinct).
 *
 * Determinism (FR-1): no ambient entropy — `opts.rng` wins, else a fresh Rng
 * seeded from `opts.seed ?? tableId`, so the same seed rolls the same grants.
 */
import { Rng, type RandomSource } from '../core/rng';
import { rollTable, type TableDef, type TableOutcome, type TableResolver } from '../core/tables';
import type { Runtime } from './runtime';
import type { CharacterState } from './character';
import { RuntimeRuleError, ruleCard } from './errors';
import type { RuntimeEvent } from './events';

/** The loot call's optional entropy steering: an injected source wins over the seed (FR-1). */
export interface LootOptions {
  readonly seed?: number | string;
  readonly rng?: RandomSource;
}

/**
 * Nested-table references resolve in BOTH spaces (CA-02): theme-space refs
 * are bare ids (stage-7's resolverOf), pack-space refs are `tables.`-prefixed
 * (the load validator's and fixtures' convention). One normalized resolver
 * serves both; a non-string ref resolves nothing.
 */
function lootTableResolver(runtime: Runtime): TableResolver {
  return (ref: unknown): TableDef | undefined => {
    if (typeof ref !== 'string') return undefined;
    return (
      runtime.pack.tables[ref] ??
      (ref.startsWith('tables.') ? runtime.pack.tables[ref.slice('tables.'.length)] : undefined)
    );
  };
}

/**
 * Whether a rolled value grants inventory under CA-02: a string id declared in
 * content.items, or a plain object {id, qty: integer >= 1} whose id resolves.
 * Everything else is flavor.
 */
function grantableValue(runtime: Runtime, value: unknown): { id: string; qty: number } | undefined {
  if (typeof value === 'string') {
    return runtime.pack.content.items?.[value] !== undefined ? { id: value, qty: 1 } : undefined;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const candidate = value as { id?: unknown; qty?: unknown };
    if (
      typeof candidate.id === 'string' &&
      Number.isInteger(candidate.qty) &&
      (candidate.qty as number) >= 1 &&
      runtime.pack.content.items?.[candidate.id] !== undefined
    ) {
      return { id: candidate.id, qty: candidate.qty as number };
    }
  }
  return undefined;
}

/** Add one stack's qty to the character's inventory, stacking by id. */
function addStack(character: CharacterState, id: string, qty: number): number {
  const existing = character.inventory.find((entry) => entry.id === id);
  if (existing !== undefined) {
    existing.qty += qty;
    return existing.qty;
  }
  character.inventory.push({ id, qty });
  return qty;
}

/** One held stack's position by id, or -1. */
function heldIndex(character: CharacterState, itemId: string): number {
  return character.inventory.findIndex((entry) => entry.id === itemId);
}

/**
 * CAP-01 — gain a pack-declared item (default qty 1); entries stack by id.
 * Rejections (`unknown-item`, `invalid-amount`) leave no durable change.
 * Emits `item:granted` provenanced by the item's own declaration.
 */
export function grantItem(
  runtime: Runtime,
  character: CharacterState,
  itemId: string,
  qty?: number,
): RuntimeEvent {
  const amount = qty ?? 1;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RuntimeRuleError([
      ruleCard('invalid-amount', itemId, 'qty', `item grant must be a positive integer qty, got ${amount}.`),
    ]);
  }
  if (runtime.pack.content.items?.[itemId] === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'unknown-item',
        itemId,
        `content.items.${itemId}`,
        `unknown item "${itemId}" — not declared in content.items.`,
        `known items: ${Object.keys(runtime.pack.content.items ?? {}).join(', ') || '(none)'}`,
      ),
    ]);
  }
  const total = addStack(character, itemId, amount);
  return runtime.events.emit({
    type: 'item:granted',
    actor: character.id,
    payload: { itemId, qty: amount, total },
    why: { rule: `content.items.${itemId}`, rolls: [] },
  });
}

/**
 * CAP-01 — give up held qty of a pack-declared item (default 1); the entry
 * leaves the inventory entirely at qty 0. Rejections (`unknown-item`,
 * `item-not-held`, `insufficient-qty`, `invalid-amount`) leave no durable
 * change. Emits `item:dropped` with the remaining stack.
 */
export function dropItem(
  runtime: Runtime,
  character: CharacterState,
  itemId: string,
  qty?: number,
): RuntimeEvent {
  const amount = qty ?? 1;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RuntimeRuleError([
      ruleCard('invalid-amount', itemId, 'qty', `item drop must be a positive integer qty, got ${amount}.`),
    ]);
  }
  if (runtime.pack.content.items?.[itemId] === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'unknown-item',
        itemId,
        `content.items.${itemId}`,
        `unknown item "${itemId}" — not declared in content.items.`,
        `known items: ${Object.keys(runtime.pack.content.items ?? {}).join(', ') || '(none)'}`,
      ),
    ]);
  }
  const index = heldIndex(character, itemId);
  if (index === -1) {
    throw new RuntimeRuleError([
      ruleCard(
        'item-not-held',
        itemId,
        'inventory',
        `"${character.id}" holds no "${itemId}" — nothing to drop.`,
      ),
    ]);
  }
  const held = character.inventory[index]!.qty;
  if (held < amount) {
    throw new RuntimeRuleError([
      ruleCard(
        'insufficient-qty',
        itemId,
        'inventory',
        `"${itemId}" is held x${held}; dropping ${amount} would overdraw — rejected, no state changed.`,
      ),
    ]);
  }
  const remaining = held - amount;
  if (remaining === 0) character.inventory.splice(index, 1);
  else character.inventory[index]!.qty = remaining;
  return runtime.events.emit({
    type: 'item:dropped',
    actor: character.id,
    payload: { itemId, qty: amount, remaining },
    why: { rule: `content.items.${itemId}`, rolls: [] },
  });
}

/** CAP-01 — how many of an item the character holds (0 for anything unknown or unheld). */
export function countItem(runtime: Runtime, character: CharacterState, itemId: string): number {
  if (runtime.pack.content.items?.[itemId] === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'unknown-item',
        itemId,
        `content.items.${itemId}`,
        `unknown item "${itemId}" — not declared in content.items.`,
        `known items: ${Object.keys(runtime.pack.content.items ?? {}).join(', ') || '(none)'}`,
      ),
    ]);
  }
  const held = character.inventory.find((entry) => entry.id === itemId);
  return held === undefined ? 0 : held.qty;
}

/**
 * CAP-02 — the raw roll through the one table engine (Custom Rule 3), with
 * grantLoot's normalized dual-space resolver. The result maps into inventory
 * through grantLoot; this is the inspection seam (roll without grants).
 */
export function rollLoot(runtime: Runtime, tableId: string, rng: RandomSource): TableOutcome {
  const table = runtime.pack.tables[tableId];
  if (table === undefined) {
    throw new RuntimeRuleError([
      ruleCard('unknown-table', tableId, 'tables', `unknown table "${tableId}" — not declared in tables.`),
    ]);
  }
  return rollTable(table, rng, { jsonPath: `tables.${tableId}`, resolve: lootTableResolver(runtime) });
}

/**
 * CAP-02 — roll a pack loot table through the one table engine into the
 * character's inventory (CA-02 mapping). Order: `loot:rolled` first (why:
 * `tables.<tableId>`), then one `item:granted` per granted stack in roll
 * order (why: `content.items.<id>`). Nothing grantable ⇒ `loot-grants-nothing`
 * (state unchanged); a failed roll outcome maps to a named runtime rejection
 * (`unresolvable-ref`, or `table-roll-failed` naming the core reason) with no
 * state change and no loot:rolled event.
 */
export function grantLoot(
  runtime: Runtime,
  character: CharacterState,
  tableId: string,
  opts?: LootOptions,
): readonly RuntimeEvent[] {
  const table = runtime.pack.tables[tableId];
  if (table === undefined) {
    throw new RuntimeRuleError([
      ruleCard('unknown-table', tableId, 'tables', `unknown table "${tableId}" — not declared in tables.`),
    ]);
  }
  const rng = opts?.rng ?? new Rng(opts?.seed ?? tableId);
  const outcome = rollTable(table, rng, {
    jsonPath: `tables.${tableId}`,
    resolve: lootTableResolver(runtime),
  });
  if (!outcome.ok) {
    const { reason, jsonPath, message } = outcome.failure;
    const rule = reason === 'unresolvable-ref' ? 'unresolvable-ref' : 'table-roll-failed';
    throw new RuntimeRuleError([ruleCard(rule, tableId, jsonPath, `loot roll failed: ${message}`)]);
  }
  const grants: { id: string; qty: number }[] = [];
  const grant = grantableValue(runtime, outcome.value);
  if (grant !== undefined) grants.push(grant);
  if (grants.length === 0) {
    throw new RuntimeRuleError([
      ruleCard(
        'loot-grants-nothing',
        tableId,
        `tables.${tableId}`,
        `loot table "${tableId}" rolled nothing grantable — flavor values are skipped (CA-02), state unchanged.`,
      ),
    ]);
  }
  const events: RuntimeEvent[] = [
    runtime.events.emit({
      type: 'loot:rolled',
      actor: character.id,
      payload: { tableId, value: outcome.value, grants: grants.map((grant) => ({ ...grant })) },
      why: { rule: `tables.${tableId}`, rolls: [] },
    }),
  ];
  for (const grant of grants) {
    events.push(grantStack(runtime, character, grant));
  }
  return events;
}

/** CAP-02 — apply one CA-02 grant to the inventory, stacking by id; emits `item:granted`. */
function grantStack(
  runtime: Runtime,
  character: CharacterState,
  grant: { id: string; qty: number },
): RuntimeEvent {
  const total = addStack(character, grant.id, grant.qty);
  return runtime.events.emit({
    type: 'item:granted',
    actor: character.id,
    payload: { itemId: grant.id, qty: grant.qty, total },
    why: { rule: `content.items.${grant.id}`, rolls: [] },
  });
}
