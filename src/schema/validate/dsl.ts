/**
 * The DSL seam (CA-2): the contract between the pack validator and the engine's
 * DSL checker. The validator owns nothing about the mini-language itself — it
 * hands every DSL string to a `DslChecker` and relays the returned ErrorCards.
 */
import { makeErrorCard, type ErrorCard } from '../error-card';

/** What the DSL checker receives per DSL string; the validator consumes only the returned ErrorCards (CA-2). */
export interface DslCheckRequest {
  expr: string;
  /** Which field the string came from, so the checker can apply formula vs effect grammar. */
  kind: 'formula' | 'valid' | 'effect' | 'passive' | 'attackBonus';
  artifactId: string;
  jsonPath: string;
  abilities: readonly string[];
  saves: readonly string[];
}

export type DslChecker = (request: DslCheckRequest) => ErrorCard[];

/**
 * Marks every DSL string as an E-FORM-01 deferred check until a real checker is
 * wired. Fail-closed — it grants no readiness; wiring the engine's real checker
 * replaces it (`@ruleswright/core` exports `dslChecker` for exactly that).
 */
export const deferredDslChecker: DslChecker = (request) => [
  makeErrorCard(
    'E-FORM-01',
    request.artifactId,
    request.jsonPath,
    'DSL check deferred: no dslChecker is wired — the expression is recorded here for the typechecker stage.',
    request.expr,
  ),
];

/** Relay: one checker call, exceptions contained as an E-FORM-01 card — a throwing checker must never crash validation. */
export function runDslChecker(
  ctx: { errors: import('../error-card').ErrorCard[]; dslChecker: DslChecker },
  request: DslCheckRequest,
): void {
  let cards: ErrorCard[];
  try {
    cards = ctx.dslChecker(request);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    cards = [
      makeErrorCard(
        'E-FORM-01',
        request.artifactId,
        request.jsonPath,
        `dsl checker failed: ${detail}`,
        request.expr,
      ),
    ];
  }
  for (const card of cards) {
    ctx.errors.push(card);
  }
}
