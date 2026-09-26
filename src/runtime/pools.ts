/**
 * M03 — resource pools and vancian bindings (FR-8, CA-4 consumer). Pool ids
 * and slot levels come from the pack, never hardcoded: a drain pool exists
 * because some action/spell cost names it (`points.pool` — E-ECON-01 already
 * guarantees the id resolves to a formula), and its capacity is that formula's
 * value. Vancian slots are per-class progression tables; casting consumes a
 * BOUND slot of the matching level — an empty slot cannot cast (FR-8).
 *
 * Rest is a host-emitted event (FR-8): the host calls `rest()`, the engine
 * emits `rest:completed` and applies the documented v1 default policy — pools
 * refill to formula caps, bound slots clear. A richer pack-declared policy is
 * a schema event (v1.1 declares no refill fields).
 *
 * All state is plain JSON inside the character snapshot (FR-14). This module
 * imports only core + types — the character/progression modules depend on it.
 */
import { evalFormula, valueOfFormula } from '../core/dsl/formula';
import { Rng } from '../core/rng';
import type { Runtime } from './runtime';
import type { CharacterState } from './character';
import { RuntimeRuleError, ruleCard } from './errors';
import type { RuntimeEvent } from './events';

/** Evaluate a pool-capacity formula against the character's scalars (CA-4: the pack formula is the only math). */
function evalPoolFormula(
  runtime: Runtime,
  pool: string,
  abilities: Readonly<Record<string, number>>,
  level: number,
): number {
  const ast = runtime.index.formulaAsts[pool];
  if (ast === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'unknown-pool',
        pool,
        `pools.${pool}`,
        `pool "${pool}" has no capacity formula — a drain pool's capacity is a pack formula (FR-3/FR-8).`,
      ),
    ]);
  }
  return valueOfFormula(evalFormula(ast, { ...abilities, level }, new Rng(0)));
}

/**
 * CA-4 — the pack's drain-pool vocabulary: every pool id named by an
 * action/spell cost, in pack declaration order. Empty when the pack declares
 * no point costs.
 */
export function poolVocabulary(runtime: Runtime): readonly string[] {
  const pools = new Set<string>();
  for (const action of Object.values(runtime.pack.actions)) {
    if (action.cost.points !== undefined) pools.add(action.cost.points.pool);
  }
  for (const spell of Object.values(runtime.pack.content.spells ?? {})) {
    if (spell.cost.points !== undefined) pools.add(spell.cost.points.pool);
  }
  return [...pools];
}

/** Initial pool state: every pack-declared pool at its formula cap (abilities + level scalars). */
export function initPools(
  runtime: Runtime,
  abilities: Readonly<Record<string, number>>,
  level: number,
): Record<string, number> {
  const pools: Record<string, number> = {};
  for (const pool of poolVocabulary(runtime)) {
    pools[pool] = evalPoolFormula(runtime, pool, abilities, level);
  }
  return pools;
}

/**
 * CA-4 — spend points from a pack-declared pool. Insufficient points are
 * rejected with no durable change (named rule); the spend emits
 * `pool:drained` with the pool formula as provenance (FR-13).
 */
export function spendPool(
  runtime: Runtime,
  character: CharacterState,
  pool: string,
  amount: number,
): RuntimeEvent {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RuntimeRuleError([
      ruleCard('invalid-spend', pool, 'amount', `pool spend must be a positive integer, got ${amount}.`),
    ]);
  }
  const current = character.pools[pool];
  if (current === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'unknown-pool',
        pool,
        'pools',
        `pool "${pool}" is not part of this character's pack vocabulary.`,
        `pack pools: ${poolVocabulary(runtime).join(', ') || '(none)'}`,
      ),
    ]);
  }
  if (current < amount) {
    throw new RuntimeRuleError([
      ruleCard(
        'insufficient-points',
        pool,
        `pools.${pool}`,
        `pool "${pool}" has ${current} point(s); spending ${amount} would overdraw — rejected, no state changed.`,
      ),
    ]);
  }
  character.pools[pool] = current - amount;
  return runtime.events.emit({
    type: 'pool:drained',
    actor: character.id,
    payload: { pool, amount, remaining: character.pools[pool] },
    why: { rule: `formulas.${pool}`, rolls: [] },
  });
}

/**
 * FR-9 — memorization binds a KNOWN spell (FR-9 gating: the spell's
 * `magic.lists` must intersect one of the character's classes' spellLists)
 * into an empty slot of the matching level. Emits `spell:prepared`.
 */
export function prepareSpell(
  runtime: Runtime,
  character: CharacterState,
  spellId: string,
  slotIndex?: number,
): RuntimeEvent {
  const spell = runtime.pack.content.spells?.[spellId];
  if (spell === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'unknown-spell',
        spellId,
        'spells',
        `unknown spell "${spellId}" — not declared in content.spells.`,
      ),
    ]);
  }
  if (!knownSpells(runtime, character).includes(spellId)) {
    throw new RuntimeRuleError([
      ruleCard(
        'spell-not-known',
        spellId,
        'spells',
        `spell "${spellId}" is not known — its lists (${spell.magic.lists.join(', ')}) match none of the character's classes (FR-9).`,
      ),
    ]);
  }
  const slotLevel = String(spell.magic.level);
  const slots = character.slots[slotLevel];
  if (slots === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'no-slot',
        spellId,
        `slots.${slotLevel}`,
        `no level-${slotLevel} slots — the character's classes grant none at their levels (FR-8).`,
      ),
    ]);
  }
  const index = slotIndex ?? slots.findIndex((bound) => bound === null);
  if (index === -1 || index >= slots.length) {
    throw new RuntimeRuleError([
      ruleCard(
        'no-empty-slot',
        spellId,
        `slots.${slotLevel}`,
        `no empty level-${slotLevel} slot to prepare "${spellId}" into (FR-8).`,
      ),
    ]);
  }
  if (slots[index] !== null) {
    throw new RuntimeRuleError([
      ruleCard(
        'slot-bound',
        spellId,
        `slots.${slotLevel}[${index}]`,
        `level-${slotLevel} slot ${index} already holds "${slots[index]}" — clear or rest first (FR-8).`,
      ),
    ]);
  }
  slots[index] = spellId;
  return runtime.events.emit({
    type: 'spell:prepared',
    actor: character.id,
    payload: { spellId, slotLevel, slotIndex: index },
    why: { rule: `content.spells.${spellId}`, rolls: [] },
  });
}

/**
 * FR-8 — casting consumes a BOUND slot of the spell's level: the slot must be
 * bound to this spell. An empty slot cannot cast; a slot bound to another
 * spell cannot cast this one. Rejections leave no durable change; success
 * empties the slot and emits `spell:cast`.
 */
export function castSpell(
  runtime: Runtime,
  character: CharacterState,
  spellId: string,
  slotIndex?: number,
): RuntimeEvent {
  const spell = runtime.pack.content.spells?.[spellId];
  if (spell === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'unknown-spell',
        spellId,
        'spells',
        `unknown spell "${spellId}" — not declared in content.spells.`,
      ),
    ]);
  }
  const slotLevel = String(spell.magic.level);
  const slots = character.slots[slotLevel];
  if (slots === undefined) {
    throw new RuntimeRuleError([
      ruleCard(
        'no-slot',
        spellId,
        `slots.${slotLevel}`,
        `no level-${slotLevel} slots — an empty slot cannot cast (FR-8).`,
      ),
    ]);
  }
  const index = slotIndex ?? slots.findIndex((bound) => bound === spellId);
  if (index === -1 || index >= slots.length) {
    throw new RuntimeRuleError([
      ruleCard(
        'not-prepared',
        spellId,
        `slots.${slotLevel}`,
        `"${spellId}" is not bound in any level-${slotLevel} slot — an empty slot cannot cast (FR-8).`,
      ),
    ]);
  }
  if (slots[index] !== spellId) {
    throw new RuntimeRuleError([
      ruleCard(
        'slot-mismatch',
        spellId,
        `slots.${slotLevel}[${index}]`,
        `level-${slotLevel} slot ${index} holds "${slots[index]}", not "${spellId}" — casting consumes a bound slot of the matching level (FR-8).`,
      ),
    ]);
  }
  slots[index] = null;
  return runtime.events.emit({
    type: 'spell:cast',
    actor: character.id,
    payload: { spellId, slotLevel, slotIndex: index },
    why: { rule: `content.spells.${spellId}`, rolls: [] },
  });
}

/**
 * FR-9 — known spells: a spell is known when its `magic.lists` intersect one
 * of the character's classes' `spellLists` (the pack's v1 restriction
 * gating). Derived from pack + classes — never stored, so it cannot drift
 * from the snapshot's class list.
 */
export function knownSpells(runtime: Runtime, character: CharacterState): readonly string[] {
  const lists = new Set<string>();
  for (const entry of character.classes) {
    for (const list of runtime.pack.content.classes?.[entry.id]?.spellLists ?? []) lists.add(list);
  }
  return Object.entries(runtime.pack.content.spells ?? {})
    .filter(([, spell]) => spell.magic.lists.some((list) => lists.has(list)))
    .map(([id]) => id);
}

/**
 * FR-8 — the host's rest event: emits `rest:completed`, then applies the
 * documented v1 default policy — every pool refills to its formula cap and
 * every bound slot clears. Returns the emitted event.
 */
export function rest(runtime: Runtime, character: CharacterState): RuntimeEvent {
  const refilled: Record<string, number> = {};
  for (const pool of Object.keys(character.pools)) {
    const cap = evalPoolFormula(runtime, pool, character.abilities, character.level);
    refilled[pool] = cap;
    character.pools[pool] = cap;
  }
  let cleared = 0;
  for (const slots of Object.values(character.slots)) {
    for (let i = 0; i < slots.length; i += 1) {
      if (slots[i] !== null) {
        slots[i] = null;
        cleared += 1;
      }
    }
  }
  return runtime.events.emit({
    type: 'rest:completed',
    actor: character.id,
    payload: { poolsRefilled: refilled, slotsCleared: cleared },
    why: { rule: 'host.rest', rolls: [] },
  });
}
