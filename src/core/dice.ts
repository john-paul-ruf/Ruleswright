/**
 * Dice recipes → structured RollResult (FR-1, CA-2). The recipe vocabulary is
 * exactly dice.html's recipes table: XdY with keep-high/keep-low, plus flat
 * integer and variable terms ("d20 + attackBonus", "4d6kh3", "2d20kh1",
 * "1d8 + might", "d100", "3d6kl2"). One recipe = one die cluster plus flat
 * terms; multi-die formulas compose recipes (S03's formula DSL, parse-once).
 * Verdicts belong to the caller — this module computes rolls, not hit logic.
 */
import type { RandomSource } from './rng';

/**
 * The FR-13 roll anatomy from dice.html: purpose, parts, total — events quote
 * it and replays re-render it without re-deriving anything. `values` are the
 * KEPT dice in roll order, so the shape carries one invariant everywhere:
 * `total === values.reduce(sum) + modifier`.
 */
export interface RollResult {
  purpose: string;
  sides: number;
  values: number[];
  modifier: number;
  total: number;
  /** Caller-computed (attack vs. defense); core never sets it. */
  verdict?: RollVerdict;
}

export interface RollVerdict {
  /** Pack defense name ("ac", a named save, a descending-AC table key…). */
  defense: string;
  value: number;
  result: string;
}

/** Parsed recipe — parse once at load, roll many times. */
export interface DiceRecipe {
  source: string;
  die: DiceTerm;
  /** Signed integer constants. */
  flat: number;
  /** Signed variable terms, resolved against the vars map at roll time. */
  vars: readonly VarTerm[];
}

export interface DiceTerm {
  count: number;
  sides: number;
  keep?: Keep;
}

export interface Keep {
  mode: 'kh' | 'kl';
  count: number;
}

export interface VarTerm {
  name: string;
  sign: 1 | -1;
}

export type RecipeParse = { ok: true; recipe: DiceRecipe } | { ok: false; reason: string };

const DICE_PATTERN = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/;
const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INT_PATTERN = /^\d+$/;

/** Pure load-time parse; failures carry the reason the validator surfaces (E-FORM-01 territory for S03's checker). */
export function parseRecipe(source: string): RecipeParse {
  const compact = source.replace(/\s+/g, '');
  if (compact.length === 0) {
    return { ok: false, reason: 'empty recipe' };
  }
  let die: DiceTerm | undefined;
  let flat = 0;
  const vars: VarTerm[] = [];
  let covered = '';
  for (const match of compact.matchAll(/([+-]?)([^+-]+)/g)) {
    covered += match[0] ?? '';
    const sign: 1 | -1 = match[1] === '-' ? -1 : 1;
    const body = match[2] ?? '';
    const dice = DICE_PATTERN.exec(body);
    if (dice !== null) {
      if (sign === -1) {
        return { ok: false, reason: `negative dice term "${body}" — subtract constants or variables, not dice` };
      }
      if (die !== undefined) {
        return { ok: false, reason: `two dice terms ("${die.count}d${die.sides}", "${body}") — one recipe rolls one die cluster; compose multi-dice in formulas` };
      }
      const count = dice[1] === undefined || dice[1] === '' ? 1 : Number(dice[1]);
      const sides = Number(dice[2]);
      if (count < 1) {
        return { ok: false, reason: `dice count must be >= 1 in "${body}"` };
      }
      if (sides < 1) {
        return { ok: false, reason: `die sides must be >= 1 in "${body}"` };
      }
      let keep: Keep | undefined;
      if (dice[3] !== undefined) {
        const keepCount = Number(dice[4]);
        if (keepCount < 1) {
          return { ok: false, reason: `keep count must be >= 1 in "${body}"` };
        }
        keep = { mode: dice[3] as Keep['mode'], count: keepCount };
      }
      die = { count, sides, keep };
      continue;
    }
    if (NAME_PATTERN.test(body)) {
      vars.push({ name: body, sign });
      continue;
    }
    if (INT_PATTERN.test(body)) {
      flat += sign * Number(body);
      continue;
    }
    return { ok: false, reason: `unrecognized term "${body}"` };
  }
  if (covered !== compact) {
    return { ok: false, reason: `malformed recipe "${source}"` };
  }
  if (die === undefined) {
    return { ok: false, reason: `no dice term in "${source}" — a recipe rolls dice ("d20 + 2")` };
  }
  return { ok: true, recipe: { source, die, flat, vars } };
}

/**
 * Roll a parsed recipe. Unknown variables throw — the pack validator (E-FORM-03)
 * rejects them at load; a roll-time hit means a caller skipped validation.
 */
export function rollRecipe(
  recipe: DiceRecipe,
  rng: RandomSource,
  vars: Readonly<Record<string, number>>,
  purpose: string,
): RollResult {
  let modifier = recipe.flat;
  for (const term of recipe.vars) {
    const value = vars[term.name];
    if (value === undefined) {
      throw new Error(`unknown variable "${term.name}" in recipe "${recipe.source}"`);
    }
    modifier += term.sign * value;
  }
  const raw: number[] = [];
  for (let i = 0; i < recipe.die.count; i++) {
    raw.push(rng.int(recipe.die.sides) + 1);
  }
  const values = recipe.die.keep ? keptValues(raw, recipe.die.keep) : raw;
  const total = values.reduce((sum, value) => sum + value, 0) + modifier;
  return { purpose, sides: recipe.die.sides, values, modifier, total };
}

/** Kept dice in roll order; stable ties favor earlier rolls. */
function keptValues(raw: number[], keep: Keep): number[] {
  const ranked = raw.map((value, index) => ({ value, index }));
  ranked.sort((x, y) => (keep.mode === 'kh' ? y.value - x.value : x.value - y.value) || x.index - y.index);
  const keptIndices = new Set(ranked.slice(0, Math.min(keep.count, ranked.length)).map((entry) => entry.index));
  return raw.filter((_, index) => keptIndices.has(index));
}