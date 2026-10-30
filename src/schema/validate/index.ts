/**
 * The pack validator (FR-2) — pure, all-at-once, never partial, never throws.
 *
 * Three passes over the pack document:
 *   1. collect      — tolerant sweep building every id namespace, so
 *                     cross-references resolve regardless of section order.
 *   2. structural + per-artifact semantic — section by section, contract order.
 *   3. pack-level semantic — progression/class pairing, class-feature refs
 *                     (v1.10), restricts tag integrity, movement DSL placement
 *                     + the speed reference (v1.5).
 *
 * Every card carries artifactId + jsonPath + rule + message (+ hint). A broken
 * pack yields the complete card list; a valid one yields none.
 */
import { makeErrorCard, type ErrorCard } from '../error-card';
import { collectContext } from './collect';
import { deferredDslChecker, type DslChecker } from './dsl';
import type { Ctx } from './context';
import { add, isPlainObject } from './helpers';
import { JsonMemo, jsonMemoKey } from '../json-memo';
import { checkActions } from './sections/actions';
import { checkBestiary } from './sections/bestiary';
import { checkContent } from './sections/content';
import { checkEconomy } from './sections/economy';
import {
  checkEquipSlots,
  checkFormulas,
  checkManifest,
  checkRootSections,
  checkSpatial,
  checkStats,
} from './sections/root';
import { checkProgression } from './sections/progression';
import { checkTables } from './sections/tables';
import {
  checkClassFeatures,
  checkMovementDsl,
  checkProgressionPairing,
  checkRestrictsTags,
} from './sections/cross';

export { deferredDslChecker, type DslCheckRequest, type DslChecker } from './dsl';
export { MAX_TABLE_DEPTH, nearestIds } from './helpers';

/**
 * Validate a pack document. Collects every error; never throws, never returns a
 * partially-validated pack. `dslChecker` is the DSL seam — omit it and
 * E-FORM-* checks are marked deferred.
 */
const validationMemo = new WeakMap<DslChecker, JsonMemo<ErrorCard[]>>();

export function validatePack(json: unknown, dslChecker: DslChecker = deferredDslChecker): ErrorCard[] {
  const key = jsonMemoKey(json);
  if (key === undefined) return validatePackUncached(json, dslChecker);
  let memo = validationMemo.get(dslChecker);
  if (memo === undefined) validationMemo.set(dslChecker, (memo = new JsonMemo<ErrorCard[]>(8)));
  const hit = memo.get(key);
  if (hit !== undefined) return hit.map((card) => ({ ...card }));
  const errors = validatePackUncached(json, dslChecker);
  memo.set(
    key,
    errors.map((card) => ({ ...card })),
  );
  return errors;
}

function validatePackUncached(json: unknown, dslChecker: DslChecker): ErrorCard[] {
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
    equipSlotNames: null,
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
  checkSpatial(ctx, json['spatial']);
  checkEquipSlots(ctx, json['equipSlots']);
  checkFormulas(ctx, json['formulas']);
  checkContent(ctx, json['content']);
  checkProgression(ctx, json['progression']);
  checkBestiary(ctx, json['bestiary']);
  checkTables(ctx, json['tables']);
  checkProgressionPairing(ctx);
  checkClassFeatures(ctx, json);
  checkRestrictsTags(ctx, json['content']);
  checkMovementDsl(ctx, json);
  return ctx.errors;
}
