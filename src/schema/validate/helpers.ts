/**
 * Shared checking primitives for the validator's section modules: the emit
 * buffer, JSON-shape guards, field checks, cross-reference resolution with
 * did-you-mean hints, and the checks more than one section needs (costs,
 * triggers, tag arrays). Section modules own their own artifact-specific
 * rules; anything two sections share lives here.
 */
import { makeErrorCard, type ErrorCard } from '../error-card';
import type { Ctx } from './context';
import { runDslChecker } from './dsl';

/** Kebab-id grammar every map key, id field, and tag must match. */
export const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export const HD_DICE: readonly string[] = ['d6', 'd8', 'd10', 'd12'];
export const MAX_SPELL_LEVEL = 9;

// ---------------------------------------------------------------- emit + shape guards

export function add(ctx: Ctx, card: ErrorCard): void {
  const key = `${card.rule}|${card.jsonPath}|${card.message}`;
  if (!ctx.emitted.has(key)) {
    ctx.emitted.add(key);
    ctx.errors.push(card);
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function reqFields(
  ctx: Ctx,
  holder: Record<string, unknown>,
  fields: readonly string[],
  artifactId: string,
  basePath: string,
): void {
  for (const field of fields) {
    if (holder[field] === undefined) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}.${field}`,
          `required field "${field}" is missing.`,
        ),
      );
    }
  }
}

export function forbidUnknown(
  ctx: Ctx,
  holder: Record<string, unknown>,
  allowed: readonly string[],
  artifactId: string,
  basePath: string,
): void {
  for (const key of Object.keys(holder)) {
    if (!allowed.includes(key)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-02',
          artifactId,
          `${basePath}.${key}`,
          `unknown field "${key}" — the contract is closed (additionalProperties: false).`,
        ),
      );
    }
  }
}

export function checkStringField(
  ctx: Ctx,
  holder: Record<string, unknown>,
  field: string,
  artifactId: string,
  basePath: string,
  minLength = 0,
): void {
  const value = holder[field];
  if (value === undefined) return;
  if (typeof value !== 'string' || value.length < minLength) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        `${basePath}.${field}`,
        minLength > 0
          ? `${field} must be a string of at least ${minLength} character(s).`
          : `${field} must be a string.`,
      ),
    );
  }
}

/** Registers an id in the global namespace; a second registration is E-DUP-01 — ids are unique across the whole pack, and overrides address them by id. */
export function registerId(ctx: Ctx, id: string, path: string): void {
  const first = ctx.knownIds.get(id);
  if (first !== undefined) {
    add(
      ctx,
      makeErrorCard(
        'E-DUP-01',
        id,
        path,
        `Duplicate id "${id}" — also defined at ${first}. Ids must be unique across the whole pack; overrides address them by id.`,
      ),
    );
  } else {
    ctx.knownIds.set(id, path);
  }
}

// ---------------------------------------------------------------- did-you-mean hints

/**
 * Nearest candidate ids by edit distance — the did-you-mean hint design every
 * E-REF card builds on: the validator never just says "unknown", it names the
 * closest declared ids so a typo is fixable from the card alone.
 */
export function nearestIds(target: string, candidates: Iterable<string>, limit = 3): string[] {
  return [...candidates]
    .map((id) => ({ id, distance: editDistance(target, id) }))
    .sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : 1))
    .slice(0, limit)
    .map((entry) => entry.id);
}

function editDistance(a: string, b: string): number {
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] ?? j,
        current[j - 1] ?? i,
        (previous[j - 1] ?? i - 1) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j] ?? i;
  }
  return previous[b.length] ?? a.length;
}

export function nearestId(target: string, candidates: Iterable<string>): string | undefined {
  return nearestIds(target, candidates, 1)[0];
}

// ---------------------------------------------------------------- DSL string fields

/** DSL string field: presence is the caller's (required-field) duty; type + checker run here. */
export function checkDslField(
  ctx: Ctx,
  value: unknown,
  kind: 'formula' | 'valid' | 'effect' | 'passive' | 'attackBonus',
  artifactId: string,
  jsonPath: string,
): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || value.length < 1) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        jsonPath,
        'must be a non-empty DSL string (formula/effect mini-language).',
      ),
    );
    return;
  }
  runDslChecker(ctx, {
    expr: value,
    kind,
    artifactId,
    jsonPath,
    abilities: [...(ctx.abilityIds ?? [])],
    saves: [...(ctx.saveIds ?? [])],
  });
}

// ---------------------------------------------------------------- multi-section field shapes

/** Structural check of a kebab-id array (stats.abilities / stats.saves). These are name-keyed vocabularies, not artifact ids — they never enter the global uniqueness namespace. */
export function checkIdList(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
  if (!Array.isArray(value) || value.length < 1) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        basePath,
        `${basePath} must be a non-empty array of kebab ids (minItems 1).`,
      ),
    );
    return;
  }
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !ID_PATTERN.test(entry)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}[${index}]`,
          `${basePath}[${index}] must match ^[a-z][a-z0-9-]*$.`,
        ),
      );
      continue;
    }
    if (seen.has(entry)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}[${index}]`,
          `${basePath} entries must be unique (uniqueItems) — "${entry}" repeats.`,
        ),
      );
    }
    seen.add(entry);
  }
}

export function checkStringArray(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    add(ctx, makeErrorCard('E-SCHEMA-01', artifactId, basePath, `${basePath} must be an array of strings.`));
    return;
  }
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}[${index}]`,
          `${basePath}[${index}] must be a string.`,
        ),
      );
    }
  }
}

export function checkTagsField(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
  if (!Array.isArray(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', artifactId, basePath, `${basePath} must be an array of kebab tag ids.`),
    );
    return;
  }
  const seen = new Set<string>();
  for (const [index, tag] of value.entries()) {
    if (typeof tag !== 'string' || !ID_PATTERN.test(tag)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}[${index}]`,
          `${basePath}[${index}] must match ^[a-z][a-z0-9-]*$.`,
        ),
      );
      continue;
    }
    if (seen.has(tag)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}[${index}]`,
          `${basePath} entries must be unique (uniqueItems) — "${tag}" repeats.`,
        ),
      );
    }
    seen.add(tag);
  }
}

export function checkTrigger(
  ctx: Ctx,
  value: unknown,
  artifactId: string,
  basePath: string,
  onMinLength: number,
): void {
  if (value === undefined) return; // optional field
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', artifactId, basePath, `${basePath} must be an object {on: eventPattern}.`),
    );
    return;
  }
  reqFields(ctx, value, ['on'], artifactId, basePath);
  forbidUnknown(ctx, value, ['on'], artifactId, basePath);
  const on = value['on'];
  if (on !== undefined && (typeof on !== 'string' || on.length < onMinLength)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        `${basePath}.on`,
        `${basePath}.on must be a string of at least ${onMinLength} character(s).`,
      ),
    );
  }
}

export function checkIntegerArray(
  ctx: Ctx,
  value: unknown,
  artifactId: string,
  basePath: string,
  label: string,
  minimum = Number.NEGATIVE_INFINITY,
): void {
  if (!Array.isArray(value) || value.length < 1) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        basePath,
        `${label} must be a non-empty array of integers (minItems 1).`,
      ),
    );
    return;
  }
  for (const [index, entry] of value.entries()) {
    if (!isInteger(entry) || entry < minimum) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}[${index}]`,
          `${label} entries must be integers${minimum === Number.NEGATIVE_INFINITY ? '' : ` >= ${minimum}`}.`,
        ),
      );
    }
  }
}

// ---------------------------------------------------------------- cost blocks (actions + spells)

export function checkCost(ctx: Ctx, value: unknown, artifactId: string, basePath: string): boolean {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        basePath,
        `${basePath} must be an object declaring at least one cost (slots | points | vancian).`,
      ),
    );
    return false;
  }
  forbidUnknown(ctx, value, ['slots', 'points', 'vancian'], artifactId, basePath);
  const declared = (['slots', 'points', 'vancian'] as const).filter((field) => value[field] !== undefined);
  if (declared.length === 0) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        basePath,
        `${basePath} must declare at least one of slots, points, vancian (minProperties 1).`,
      ),
    );
    return false;
  }
  let ok = true;
  const slots = value['slots'];
  if (slots !== undefined) {
    if (!isPlainObject(slots) || Object.keys(slots).length < 1) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}.slots`,
          `${basePath}.slots must be an object with at least one slot name -> integer >= 1.`,
        ),
      );
      ok = false;
    } else {
      for (const [name, amount] of Object.entries(slots)) {
        if (!isInteger(amount) || amount < 1) {
          add(
            ctx,
            makeErrorCard(
              'E-SCHEMA-01',
              artifactId,
              `${basePath}.slots.${name}`,
              `${basePath}.slots.${name} must be an integer >= 1.`,
            ),
          );
          ok = false;
        }
      }
      resolveSlotNames(ctx, Object.keys(slots), artifactId, `${basePath}.slots`);
    }
  }
  const points = value['points'];
  if (points !== undefined) {
    if (!isPlainObject(points)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}.points`,
          `${basePath}.points must be an object {pool, amount}.`,
        ),
      );
      ok = false;
    } else {
      reqFields(ctx, points, ['pool', 'amount'], artifactId, `${basePath}.points`);
      forbidUnknown(ctx, points, ['pool', 'amount'], artifactId, `${basePath}.points`);
      const pool = points['pool'];
      if (pool !== undefined && (typeof pool !== 'string' || pool.length < 1)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            artifactId,
            `${basePath}.points.pool`,
            `${basePath}.points.pool must be a non-empty pool id.`,
          ),
        );
        ok = false;
      } else if (typeof pool === 'string') {
        resolvePool(ctx, pool, artifactId, `${basePath}.points.pool`);
      }
      const amount = points['amount'];
      if (amount !== undefined && (!isInteger(amount) || amount < 1)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            artifactId,
            `${basePath}.points.amount`,
            `${basePath}.points.amount must be an integer >= 1.`,
          ),
        );
        ok = false;
      }
    }
  }
  const vancian = value['vancian'];
  if (vancian !== undefined && (!isInteger(vancian) || vancian < 1 || vancian > MAX_SPELL_LEVEL)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        `${basePath}.vancian`,
        `${basePath}.vancian must be an integer in 1..${MAX_SPELL_LEVEL} — the level of the BOUND slot it consumes.`,
      ),
    );
    ok = false;
  }
  return ok;
}

/** E-ECON-01 (v1.1): when the optional economy section is present, cost slot keys must resolve to economy.turnSlots keys. Absent → pack-free at validation; the engine's documented per-cost default applies at play time. */
function resolveSlotNames(ctx: Ctx, names: readonly string[], artifactId: string, basePath: string): void {
  if (ctx.economySlotNames === null) return; // economy absent (or unreadable — already flagged) → engine default at play time
  for (const name of names) {
    if (!ctx.economySlotNames.has(name)) {
      const near = nearestId(name, ctx.economySlotNames);
      add(
        ctx,
        makeErrorCard(
          'E-ECON-01',
          artifactId,
          `${basePath}.${name}`,
          `costs an undeclared slot name "${name}" — the pack's economy section declares only [${[...ctx.economySlotNames].sort().join(', ')}] (the engine has no built-in slot vocabulary).`,
          near === undefined ? undefined : `did you mean "${near}"?`,
        ),
      );
    }
  }
}

/** E-ECON-01: pool ids resolve against the formulas map — a drain pool's capacity is a pack formula. */
function resolvePool(ctx: Ctx, pool: string, artifactId: string, jsonPath: string): void {
  if (ctx.formulaIds === null) return; // formulas section unreadable — already flagged structurally
  if (!ctx.formulaIds.has(pool)) {
    const near = nearestId(pool, ctx.formulaIds);
    add(
      ctx,
      makeErrorCard(
        'E-ECON-01',
        artifactId,
        jsonPath,
        `cost draws from pool "${pool}", but no formula declares it — a drain pool's capacity is a pack formula.`,
        near === undefined ? undefined : `did you mean "${near}"?`,
      ),
    );
  }
}

// ---------------------------------------------------------------- constants

/** E-ECON pool/tag pattern prefix (v1.1 restricts integrity). */
export const RESTRICTS_PREFIX = 'actions.tagged:';

/** Table-nesting bound at load: deeper chains are pathological and fail validation (E-TBL-01) instead of hanging load. The engine)s table roller enforces the same bound. */
export const MAX_TABLE_DEPTH = 8;
