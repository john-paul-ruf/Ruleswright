/**
 * M03 — the one illegal-operation rejection shape (PROGRAM-CONFIG Conventions):
 * an aggregate carrying the complete ErrorCard list, every violated rule named
 * (FR-5). Load failures are `PackLoadError` (FR-2); every other rejected
 * runtime operation throws this.
 */
import type { ErrorCard } from '../schema/error-card';

export class RuntimeRuleError extends Error {
  readonly errors: readonly ErrorCard[];

  constructor(errors: readonly ErrorCard[]) {
    super(`runtime operation rejected with ${errors.length} error card(s) — first: ${errors[0]?.rule} ${errors[0]?.message}`);
    this.name = 'RuntimeRuleError';
    this.errors = errors;
  }
}

/** One rejection card, for single-rule sites. */
export function ruleCard(rule: string, artifactId: string, jsonPath: string, message: string, hint?: string): ErrorCard {
  return { severity: 'error', artifactId, jsonPath, rule, message, ...(hint !== undefined ? { hint } : {}) };
}