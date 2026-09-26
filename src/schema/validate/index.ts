/**
 * The pack validator (FR-2) — pure, all-at-once, never partial, never throws.
 *
 * Three passes over the pack document:
 *   1. collect      — tolerant sweep building every id namespace, so
 *                     cross-references resolve regardless of section order.
 *   2. structural + per-artifact semantic — section by section, contract order.
 *   3. pack-level semantic — progression/class pairing, restricts tag integrity.
 *
 * Every card carries artifactId + jsonPath + rule + message (+ hint). A broken
 * pack yields the complete card list; a valid one yields none.
 */
import { makeErrorCard, type ErrorCard } from '../error-card';
import { collectContext } from './collect';
import { deferredDslChecker, type DslChecker } from './dsl';
import type { Ctx } from './context';
import { add, isPlainObject } from './helpers';
import { checkActions } from './sections/actions';
import { checkBestiary } from './sections/bestiary';
import { checkContent } from './sections/content';
import { checkEconomy } from './sections/economy';
import { checkFormulas, checkManifest, checkRootSections, checkStats } from './sections/root';
import { checkProgression } from './sections/progression';
import { checkTables } from './sections/tables';
import { checkProgressionPairing, checkRestrictsTags } from './sections/cross';

export { deferredDslChecker, type DslCheckRequest, type DslChecker } from './dsl';
export { MAX_TABLE_DEPTH, nearestIds } from './helpers';

/**
 * Validate a pack document. Collects every error; never throws, never returns a
 * partially-validated pack. `dslChecker` is the DSL seam — omit it and
 * E-FORM-* checks are marked deferred.
 */
export function validatePack(json: unknown, dslChecker: DslChecker = deferredDslChecker): ErrorCard[] {
  const ctx: Ctx = {
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
  if (!isPlainObject(json)) {
    add(ctx, makeErrorCard('E-SCHEMA-01', '(pack)', '(root)', 'Pack document must be a JSON object.'));
    return ctx.errors;
  }
  collectContext(json, ctx);
  checkRootSections(ctx, json);
  checkManifest(ctx, json['manifest']);
  checkStats(ctx, json['stats']);
  checkActions(ctx, json['actions']);
  checkEconomy(ctx, json['economy']);
  checkFormulas(ctx, json['formulas']);
  checkContent(ctx, json['content']);
  checkProgression(ctx, json['progression']);
  checkBestiary(ctx, json['bestiary']);
  checkTables(ctx, json['tables']);
  checkProgressionPairing(ctx);
  checkRestrictsTags(ctx, json['content']);
  return ctx.errors;
}
