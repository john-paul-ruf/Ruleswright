/**
 * Cross-section checks that run after every section pass: progression/class
 * pairing (E-REF-03), the v1.1 restricts-tag integrity (E-REF-01) and the v1.5
 * movement DSL rules (move placement E-FORM-02, speed reference E-REF-01).
 */
import type { Ctx } from '../context';
import { makeErrorCard } from '../../error-card';
import { ID_PATTERN, RESTRICTS_PREFIX, add, isPlainObject, nearestId } from '../helpers';

export function checkProgressionPairing(ctx: Ctx): void {
  if (ctx.progressionIds === null) return; // progression container unreadable — the structural card is already emitted
  for (const classId of ctx.classIds ?? []) {
    if (!ctx.progressionIds.has(classId)) {
      const near = nearestId(classId, ctx.progressionIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-03',
          classId,
          `progression.${classId}`,
          `class "${classId}" is declared in content.classes but has no progression entry — progression is required for every declared class.`,
          near === undefined ? undefined : `did you mean "${near}"?`,
        ),
      );
    }
  }
  if (ctx.classIds === null) return; // classes container unreadable — the structural card is already emitted
  for (const classId of ctx.progressionIds) {
    if (!ctx.classIds.has(classId)) {
      const near = nearestId(classId, ctx.classIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-03',
          classId,
          `progression.${classId}`,
          `orphaned progression for "${classId}" — no class with this id is declared in content.classes.`,
          near === undefined ? undefined : `did you mean "${near}"?`,
        ),
      );
    }
  }
}

/** v1.1 tag integrity: a condition restricts pattern "actions.tagged:<tag>" must reference a tag declared on at least one action or spell (E-REF-01). */
export function checkRestrictsTags(ctx: Ctx, content: unknown): void {
  if (!ctx.tagsTrusted) return; // declared-tag set unreliable — integrity stays silent rather than false-positive
  if (!isPlainObject(content)) return;
  const conditions = content['conditions'];
  if (!isPlainObject(conditions)) return;
  for (const [id, def] of Object.entries(conditions)) {
    if (!isPlainObject(def) || def['restricts'] === undefined) continue;
    const restricts = def['restricts'];
    if (!Array.isArray(restricts)) continue; // type card already emitted in pass 2
    for (const [index, pattern] of restricts.entries()) {
      if (typeof pattern !== 'string' || !pattern.startsWith(RESTRICTS_PREFIX)) continue;
      const tag = pattern.slice(RESTRICTS_PREFIX.length);
      if (tag.length === 0 || !ID_PATTERN.test(tag)) continue; // non-tag patterns belong to the runtime matcher, not this integrity rule
      if (!ctx.declaredTags.has(tag)) {
        const near = nearestId(tag, ctx.declaredTags);
        add(
          ctx,
          makeErrorCard(
            'E-REF-01',
            id,
            `content.conditions.${id}.restricts[${index}]`,
            `condition "${id}" restricts pattern "${pattern}" names tag "${tag}", which no action or spell declares — a condition that can never bite is a broken reference, not a silent no-op (v1.1 tag integrity).`,
            near === undefined
              ? `declared tags: ${[...ctx.declaredTags].sort().join(', ') || '(none)'}`
              : `did you mean "${near}"?`,
          ),
        );
      }
    }
  }
}

/** A root `move(` statement — exact because core's checkEffect already makes move root-only. */
const MOVE_ROOT = /^\s*move\s*\(/;

/** Mirrors core effect.ts ARG_CATEGORIES and the formula registry's `ability-name` position (v1.7): positions whose argument is a name, not a formula. M01 imports no core value. */
const NON_FORMULA_ARGS: Readonly<Record<string, readonly number[]>> = {
  damage: [1], // type
  applyCondition: [0], // condition-id
  target: [0], // shape
  save: [0], // save-name
  ability: [0], // ability name (v1.7)
};

/** DSL tokens for the speed scan: names (core lexer grammar), numbers/dice, call punctuation, any other operator character. */
const DSL_TOKEN = /[A-Za-z_][A-Za-z0-9_-]*|\d+(?:d\d+)?|[(),]|[^\sA-Za-z0-9_(),]/g;

interface EffectField {
  readonly artifactId: string;
  readonly jsonPath: string;
  readonly expr: string;
  /** Why a root move is illegal here; undefined = a non-triggered action effect (legal). */
  readonly moveForbiddenAs?: string;
}

/** v1.5 (CA-M2): move placement + the speed reference rule — text-level, M01 imports no core value. */
export function checkMovementDsl(ctx: Ctx, doc: Record<string, unknown>): void {
  const formulas = doc['formulas'];
  // An unreadable formulas section already carries its structural card — the speed rule stays silent.
  const isSpeedUndeclared = isPlainObject(formulas) && formulas['speed'] === undefined;
  for (const field of effectFields(doc)) {
    if (field.moveForbiddenAs !== undefined && MOVE_ROOT.test(field.expr)) {
      add(
        ctx,
        makeErrorCard(
          'E-FORM-02',
          field.artifactId,
          field.jsonPath,
          `move(...) is legal only as the root statement of a non-triggered actions.<id>.effect — not in ${field.moveForbiddenAs}.`,
        ),
      );
    }
    if (isSpeedUndeclared && referencesSpeed(field.expr)) {
      add(
        ctx,
        makeErrorCard(
          'E-REF-01',
          field.artifactId,
          field.jsonPath,
          '"speed" is referenced at a formula position, but the pack declares no formulas.speed — speed is a reserved optional formula id (v1.5 movement budget).',
          'declare formulas.speed to give effects a speed to read.',
        ),
      );
    }
  }
}

/** Every effect-bearing field: action effects (triggered or not), spell and feat effects, item uses. */
function effectFields(doc: Record<string, unknown>): EffectField[] {
  const fields: EffectField[] = [];
  const actions = doc['actions'];
  if (isPlainObject(actions)) {
    for (const [id, def] of Object.entries(actions)) {
      if (!isPlainObject(def) || typeof def['effect'] !== 'string') continue;
      fields.push({
        artifactId: id,
        jsonPath: `actions.${id}.effect`,
        expr: def['effect'],
        ...(def['trigger'] !== undefined ? { moveForbiddenAs: 'a triggered action' } : {}),
      });
    }
  }
  const content = doc['content'];
  if (!isPlainObject(content)) return fields;
  const sections = [
    ['spells', 'effect', 'a spell effect'],
    ['feats', 'effect', 'a feat effect'],
    ['items', 'use', "an item's use"],
  ] as const;
  for (const [section, key, label] of sections) {
    const artifacts = content[section];
    if (!isPlainObject(artifacts)) continue;
    for (const [id, def] of Object.entries(artifacts)) {
      if (!isPlainObject(def) || typeof def[key] !== 'string') continue;
      fields.push({
        artifactId: id,
        jsonPath: `content.${section}.${id}.${key}`,
        expr: def[key],
        moveForbiddenAs: label,
      });
    }
  }
  return fields;
}

/**
 * Position-aware scan (DD-M19): does the name `speed` appear at a formula
 * position? A bare `speed` that is the whole argument at a NON_FORMULA_ARGS
 * position is a name (type, condition id, shape, save), not a reference.
 * Unbalanced input reports nothing — the DSL seam has already rejected it.
 */
function referencesSpeed(expr: string): boolean {
  const tokens = expr.match(DSL_TOKEN) ?? [];
  const stack: { callName: string; argIndex: number; argTokens: number; hasSpeed: boolean }[] = [];
  let isFound = false;
  const closeArg = (): void => {
    const frame = stack[stack.length - 1]!;
    const isNamePosition =
      frame.argTokens === 1 && (NON_FORMULA_ARGS[frame.callName] ?? []).includes(frame.argIndex);
    if (frame.hasSpeed && !isNamePosition) isFound = true;
  };
  for (const [index, token] of tokens.entries()) {
    const frame = stack[stack.length - 1];
    if (token === '(') {
      if (index > 0 && isCallName(tokens[index - 1]!)) continue; // opened with its call name
      if (frame !== undefined) frame.argTokens += 1;
      stack.push({ callName: '', argIndex: 0, argTokens: 0, hasSpeed: false }); // grouping parentheses
      continue;
    }
    if (token === ',' || token === ')') {
      if (frame === undefined) return false;
      closeArg();
      if (token === ',') {
        frame.argIndex += 1;
        frame.argTokens = 0;
        frame.hasSpeed = false;
      } else {
        stack.pop();
      }
      continue;
    }
    if (frame !== undefined) frame.argTokens += 1;
    if (tokens[index + 1] === '(') {
      stack.push({ callName: token, argIndex: 0, argTokens: 0, hasSpeed: false });
    } else if (token === 'speed') {
      if (frame === undefined) isFound = true;
      else frame.hasSpeed = true;
    }
  }
  return stack.length === 0 && isFound;
}

function isCallName(token: string): boolean {
  return /^[A-Za-z_]/.test(token);
}
