/**
 * Character → combatant (FR-16 parity, pack v1.2): a created character fights
 * through the same `CombatantProfile` the bestiary produces, so a host puts
 * its character on a side without doing any rules math. Every number comes
 * from the character's state, its `derived()` facade (the pack's reserved
 * formulas, CA-6), or pack data; actions are the class-granted
 * `content.classes.<id>.actions` lists (v1.2).
 *
 * The inverse direction is `settleItemUses` (CA-EG5): the fight never touches
 * character state, so the host settles a finished fight's item spend back into
 * the inventory explicitly.
 *
 * v1 limits (documented, not silent): active conditions are not carried into
 * the fight — `StartCombatRequest` has no conditions field — and a multiclass
 * character on the table convention uses one class's row (see
 * `profileFromCharacter`).
 */
import type { ClassAttackRow } from '../schema/artifacts';
import type { Runtime } from './runtime';
import type { Character, CharacterState } from './character';
import { evalPackFormula, type CombatantProfile } from './combat/resolve';
import type { EconomyBalances } from './combat/action-economy';
import type { Combat } from './combat/combat';
import { equipmentView, equippedUnits } from './equipment';
import { dropItem } from './inventory';
import type { RuntimeEvent } from './events';
import type { ErrorCard } from '../schema/error-card';
import { RuntimeRuleError, ruleCard } from './errors';

/** A character ready for `startCombat`: spread it into an ally/enemy entry (`{ id, ...pair }`). */
export interface CharacterCombatant {
  readonly profile: CombatantProfile;
  readonly balances: EconomyBalances;
}

/**
 * Build a combatant from a character (UI B-1 / CA-08).
 *
 * - Equipment (CA-EG2): `abilities`/`saves` are the equipment view's (grants
 *   added); `initiativeBonus` evaluates the pack's reserved `initiative`
 *   formula (0 when undeclared) over view abilities ∪ view saves ∪ level ∪
 *   `gear-*`, as statblock profiles do over their own numbers.
 * - `hp` is the character's current hp (it may exceed `maxHp` after an
 *   unequip); `maxHp`, `ac` and `attackBonus` come from `character.derived()`.
 * - Table convention (only when no class yields an `attackBonus`): the
 *   table-convention class with the highest class level wins (ties → first in
 *   `state.classes`). A single-class character carries that progression's rows
 *   as-is; a multiclass character carries that class's row at its class level,
 *   re-keyed to the character's total level (v1 default).
 * - `actions` is the union of the character's class action lists in class
 *   order, first occurrence wins. None at all → `RuntimeRuleError`
 *   (`no-combat-actions`).
 * - `balances` carries the character's pool points, per spell level the count
 *   of bound (memorized) slots, and (CA-EG5) the held qty of every consumable
 *   (an item with a parse-once `use` effect) — the fight's item charges.
 * - Active conditions are NOT carried (v1: `StartCombatRequest` has no field).
 */
export function profileFromCharacter(
  runtime: Runtime,
  character: Character,
  id?: string,
): CharacterCombatant {
  const state = character.state;
  const pack = runtime.pack;
  const actions: string[] = [];
  for (const entry of state.classes) {
    for (const actionId of pack.content.classes?.[entry.id]?.actions ?? []) {
      if (!actions.includes(actionId)) actions.push(actionId);
    }
  }
  if (actions.length === 0) {
    const classId = state.classes[0]?.id ?? '(none)';
    throw new RuntimeRuleError([
      ruleCard(
        'no-combat-actions',
        classId,
        'content.classes',
        `character "${state.id}" has no combat actions — none of its classes (${state.classes.map((entry) => entry.id).join(', ')}) declares any.`,
        'declare actions on the class (pack v1.2)',
      ),
    ]);
  }

  const derived = character.derived();
  const view = equipmentView(runtime, state);
  const base: Record<string, number> = { ...view.abilities, ...view.saves, level: state.level, ...view.gear };
  const attackTable = derived.attackBonus === undefined ? characterAttackTable(runtime, state) : undefined;
  const boundSlots: Record<string, number> = {};
  for (const [level, bindings] of Object.entries(state.slots)) {
    boundSlots[level] = bindings.filter((binding) => binding !== null).length;
  }
  const items: Record<string, number> = {};
  for (const entry of state.inventory) {
    if (runtime.index.itemEffects[entry.id] !== undefined) items[entry.id] = entry.qty;
  }

  return {
    profile: {
      id: id ?? state.id,
      abilities: view.abilities,
      saves: view.saves,
      level: state.level,
      hp: state.hp.current,
      maxHp: derived.hp,
      ac: derived.ac,
      initiativeBonus:
        pack.formulas['initiative'] !== undefined ? evalPackFormula(pack, 'initiative', base) : 0,
      actions,
      ...(derived.attackBonus !== undefined ? { attackBonus: derived.attackBonus } : {}),
      ...(attackTable !== undefined ? { attackTable } : {}),
    },
    balances: { pools: { ...state.pools }, boundSlots, items },
  };
}

/** The table-convention attack rows for a character (see `profileFromCharacter`). */
function characterAttackTable(runtime: Runtime, state: CharacterState): ClassAttackRow[] | undefined {
  let chosenLevel = 0;
  let chosenRows: readonly ClassAttackRow[] | undefined;
  for (const entry of state.classes) {
    const rows = runtime.pack.progression[entry.id]?.attackTable;
    if (rows === undefined) continue;
    if (chosenRows === undefined || entry.level > chosenLevel) {
      chosenLevel = entry.level;
      chosenRows = rows;
    }
  }
  if (chosenRows === undefined) return undefined;
  if (state.classes.length === 1) {
    return chosenRows.map((row) => ({ level: row.level, byDefense: { ...row.byDefense } }));
  }
  const row = chosenRows.find((candidate) => candidate.level === chosenLevel);
  return row === undefined ? undefined : [{ level: state.level, byDefense: { ...row.byDefense } }];
}

/**
 * CA-EG5 — write a finished fight's item spend back to the character (inverse
 * of profileFromCharacter). The combatant (`combatantId`, default the
 * character's id) must be in `fight`, and the fight must be `combat-over`
 * (`combat-not-over` otherwise). Every used item is validated before anything
 * changes, all cards at once: still held (`item-not-held`), held qty ≥ used
 * (`insufficient-qty`), and the drop would strand no equipped unit
 * (`item-equipped`, the one `equippedUnits` rule `dropItem` uses, R-5). Then,
 * per item in id order, the used units leave the inventory through `dropItem`
 * (`item:dropped`) and `item:settled` `{combatantId, itemId, qty}` follows.
 * Finally the combatant's `itemsUsed` is cleared, so a second call settles
 * nothing and returns `[]`.
 *
 * v1 limits (documented):
 * - a fight abandoned before `combat-over` does not settle; the host may `drop`
 *   the units itself;
 * - idempotence is per live fight object, not across snapshots (R-4): the
 *   "already settled" marker is only the cleared `itemsUsed` on this `Combat`.
 *   A snapshot taken before settling still carries the spend, and restoring it
 *   and settling again drops the same units twice. Settle each fight once.
 */
export function settleItemUses(
  runtime: Runtime,
  character: Character,
  fight: Combat,
  combatantId?: string,
): readonly RuntimeEvent[] {
  const state = character.state;
  const id = combatantId ?? state.id;
  if (fight.state.phase !== 'combat-over') {
    throw new RuntimeRuleError([
      ruleCard(
        'combat-not-over',
        id,
        'phase',
        `the fight is in phase "${fight.state.phase}" — item use settles only once the fight is combat-over.`,
      ),
    ]);
  }
  const combatant = fight.state.combatants[id];
  if (combatant === undefined) {
    throw new RuntimeRuleError([
      ruleCard('unknown-target', id, 'combatants', `combatant "${id}" is not in this fight.`),
    ]);
  }
  const spent = Object.entries(combatant.itemsUsed)
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const cards: ErrorCard[] = [];
  for (const [itemId, qty] of spent) {
    const held = state.inventory.find((entry) => entry.id === itemId)?.qty ?? 0;
    const worn = equippedUnits(state, itemId);
    if (held === 0) {
      cards.push(
        ruleCard(
          'item-not-held',
          itemId,
          'inventory',
          `"${state.id}" holds no "${itemId}" — ${qty} used in the fight.`,
        ),
      );
    } else if (held < qty) {
      cards.push(
        ruleCard(
          'insufficient-qty',
          itemId,
          'inventory',
          `"${itemId}" is held x${held}, but ${qty} were used in the fight.`,
        ),
      );
    } else if (held - qty < worn) {
      cards.push(
        ruleCard(
          'item-equipped',
          itemId,
          'equipped',
          `"${itemId}" is held x${held} with ${worn} equipped; settling ${qty} would strand an equipped unit — unequip first.`,
        ),
      );
    }
  }
  if (cards.length > 0) throw new RuntimeRuleError(cards);

  const events: RuntimeEvent[] = [];
  for (const [itemId, qty] of spent) {
    events.push(dropItem(runtime, state, itemId, qty));
    events.push(
      runtime.events.emit({
        type: 'item:settled',
        actor: state.id,
        payload: { combatantId: id, itemId, qty },
        why: { rule: `content.items.${itemId}`, rolls: [] },
      }),
    );
  }
  combatant.itemsUsed = {};
  return events;
}
