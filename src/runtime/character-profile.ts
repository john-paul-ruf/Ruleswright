/**
 * Character → combatant (FR-16 parity, pack v1.2): a created character fights
 * through the same `CombatantProfile` the bestiary produces, so a host puts
 * its character on a side without doing any rules math. Every number comes
 * from the character's state, its `derived()` facade (the pack's reserved
 * formulas, CA-6), or pack data; actions are the class-granted
 * `content.classes.<id>.actions` lists (v1.2).
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
import { RuntimeRuleError, ruleCard } from './errors';

/** A character ready for `startCombat`: spread it into an ally/enemy entry (`{ id, ...pair }`). */
export interface CharacterCombatant {
  readonly profile: CombatantProfile;
  readonly balances: EconomyBalances;
}

/**
 * Build a combatant from a character (UI B-1 / CA-08).
 *
 * - `hp` is the character's current hp; `ac` and `attackBonus` come from
 *   `character.derived()`; `initiativeBonus` evaluates the pack's reserved
 *   `initiative` formula (0 when undeclared) over abilities ∪ saves ∪ level,
 *   exactly as statblock profiles do.
 * - Table convention (only when no class yields an `attackBonus`): the
 *   table-convention class with the highest class level wins (ties → first in
 *   `state.classes`). A single-class character carries that progression's rows
 *   as-is; a multiclass character carries that class's row at its class level,
 *   re-keyed to the character's total level (v1 default).
 * - `actions` is the union of the character's class action lists in class
 *   order, first occurrence wins. None at all → `RuntimeRuleError`
 *   (`no-combat-actions`).
 * - `balances` carries the character's pool points and, per spell level, the
 *   count of bound (memorized) slots.
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
  const base: Record<string, number> = { ...state.abilities, ...state.saves, level: state.level };
  const attackTable = derived.attackBonus === undefined ? characterAttackTable(runtime, state) : undefined;
  const boundSlots: Record<string, number> = {};
  for (const [level, bindings] of Object.entries(state.slots)) {
    boundSlots[level] = bindings.filter((binding) => binding !== null).length;
  }

  return {
    profile: {
      id: id ?? state.id,
      abilities: { ...state.abilities },
      saves: { ...state.saves },
      level: state.level,
      hp: state.hp.current,
      ac: derived.ac,
      initiativeBonus:
        pack.formulas['initiative'] !== undefined ? evalPackFormula(pack, 'initiative', base) : 0,
      actions,
      ...(derived.attackBonus !== undefined ? { attackBonus: derived.attackBonus } : {}),
      ...(attackTable !== undefined ? { attackTable } : {}),
    },
    balances: { pools: { ...state.pools }, boundSlots },
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
