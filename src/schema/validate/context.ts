/**
 * The validator's shared context: one `Ctx` threaded through every pass,
 * carrying the error buffer, the pass-1 id namespaces, and the wired DSL
 * checker (CA-2). Nothing here validates on its own — this is the plumbing
 * every section module shares.
 */
import type { ErrorCard } from '../error-card';
import type { DslChecker } from './dsl';

export interface Ctx {
  errors: ErrorCard[];
  emitted: Set<string>;
  knownIds: Map<string, string>;
  /** null = the holding container is unreadable (dependent reference checks are skipped to avoid cascades). */
  abilityIds: Set<string> | null;
  saveIds: Set<string> | null;
  actionIds: Set<string> | null;
  formulaIds: Set<string> | null;
  classIds: Set<string> | null;
  tableIds: Set<string> | null;
  progressionIds: Set<string> | null;
  declaredTags: Set<string>;
  /** False when any actions/spells container or tags array was unreadable — restricts integrity then stays silent rather than false-positive. */
  tagsTrusted: boolean;
  tablesDoc: Record<string, unknown>;
  /** Set only when the optional economy section is present and readable (v1.1: cost slot keys must resolve to these). */
  economySlotNames: Set<string> | null;
  dslChecker: DslChecker;
}

export function newCtx(dslChecker: DslChecker): Ctx {
  return {
    errors: [],
    emitted: new Set(),
    knownIds: new Map(),
    abilityIds: new Set(),
    saveIds: new Set(),
    actionIds: new Set(),
    formulaIds: new Set(),
    classIds: new Set(),
    tableIds: new Set(),
    progressionIds: new Set(),
    declaredTags: new Set(),
    tagsTrusted: true,
    tablesDoc: {},
    economySlotNames: null,
    dslChecker,
  };
}
