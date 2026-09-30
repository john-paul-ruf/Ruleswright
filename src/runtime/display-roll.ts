/**
 * The one roll-display rule (FR-13 `why.rolls`): a structured RollResult → the
 * mock's display string. A runtime leaf — it imports only `core/dice` types,
 * so combat and the equipment leaf both use it without an import cycle.
 */
import type { RollResult } from '../core/dice';

/** Structured roll → the mock's display string (`d20[14]+3=17 ≥ ac15`, `d6[4]+2=6`). */
export function displayRoll(roll: RollResult): string {
  const dicePart = `d${roll.sides}[${roll.values.join(',')}]`;
  const modifierPart =
    roll.modifier === 0 ? '' : roll.modifier > 0 ? `+${roll.modifier}` : `${roll.modifier}`;
  const base = `${dicePart}${modifierPart}=${roll.total}`;
  const verdict = roll.verdict;
  if (verdict === undefined) return base;
  const relation = verdict.result === 'miss' || verdict.result === 'fail' ? '<' : '≥';
  return `${base} ${relation} ${verdict.defense}${verdict.value}`;
}
