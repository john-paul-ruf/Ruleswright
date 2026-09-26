/**
 * Internal core barrel — consumed by runtime + compiler through their declared
 * core imports; never re-exported at a surface root except the types the
 * runtime surfaces (architecture: module contracts).
 */
export { Rng, type RandomSource, type RngState } from './rng';
export {
  parseRecipe,
  rollRecipe,
  type DiceRecipe,
  type DiceTerm,
  type Keep,
  type RecipeParse,
  type RollResult,
  type RollVerdict,
  type VarTerm,
} from './dice';
export {
  MAX_TABLE_DEPTH,
  rollTable,
  type RollTableOptions,
  type TableDef,
  type TableEntry,
  type TableFailure,
  type TableFailureReason,
  type TableOutcome,
  type TableResolver,
} from './tables';