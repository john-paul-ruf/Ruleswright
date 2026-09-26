/**
 * The S01 seam wired (CA-2): one DslChecker dispatching by field kind — effect
 * fields speak the effect grammar, every other DSL kind (formula, valid,
 * passive, attackBonus) speaks the formula grammar. Pass this to S01's
 * `validatePack(json, dslChecker)`; it replaces the deferred E-FORM-01 default.
 */
import type { DslChecker } from '../../schema/validate';
import { checkEffect } from './effect';
import { checkFormula } from './formula';

export const packDslChecker: DslChecker = (request) =>
  request.kind === 'effect' ? checkEffect(request) : checkFormula(request);
