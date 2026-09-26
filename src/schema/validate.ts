/**
 * The pack validator (FR-2) — pure, all-at-once, never partial, never throws.
 *
 * Implemented 1:1 against the DB-owned contract layer (schemaVersion 1, v1.1):
 *   src/schema/contracts/pack.schema.json  — structural rules (closed shapes, id grammar, integers, XOR attack convention, burst radius)
 *   specs/database.md                      — semantic rules (uniqueness, reference resolution, DSL, reserved ids, economy)
 *
 * Passes:
 *   1. collect   — tolerant sweep building every id namespace, so cross-references resolve regardless of section order.
 *   2. structural + per-artifact semantic — section by section, contract order.
 *   3. pack-level semantic — progression/class pairing, restricts tag integrity (v1.1).
 *
 * Every card carries artifactId + jsonPath + rule + message (+ hint). A broken pack
 * yields the complete card list; a valid one yields none (mocks/validation-errors.html).
 */
import { makeErrorCard, type ErrorCard } from './error-card';

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * Table-nesting bound at load (database.md: "Nesting depth is bounded at load
 * (documented limit; deeper → E-TBL-01)"). The limit value is not pinned by the
 * contract; 8 is a conservative bound — a chain longer than any sane loot tree is
 * pathological, and the DB owns the documented number.
 */
export const MAX_TABLE_DEPTH = 8;

const HD_DICE: readonly string[] = ['d6', 'd8', 'd10', 'd12'];
const MAX_SPELL_LEVEL = 9;
const MAX_ATTACK_TABLE_LEVEL = 10;
/** Reserved formula ids (PROGRAM-CONFIG Custom Rule 2, CA-6): `initiative` is optional (engine fallback: plain d20). */
const RESERVED_FORMULA_IDS: readonly string[] = ['hp', 'ac'];
const RESTRICTS_PREFIX = 'actions.tagged:';

/** What S03's checker receives per DSL string; S01 consumes only the returned ErrorCards (CA-2). */
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
 * CA-2 consumer-edge default (S03 seam): marks every DSL string as an E-FORM-01
 * deferred check until the real checker is wired. Fail-closed — it grants no
 * readiness; wiring S03's checker replaces it.
 */
export const deferredDslChecker: DslChecker = (request) => [
  makeErrorCard(
    'E-FORM-01',
    request.artifactId,
    request.jsonPath,
    'DSL check deferred: no dslChecker is wired (S03 seam) — the expression is recorded here for the typechecker stage.',
    request.expr,
  ),
];

interface Ctx {
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

/**
 * Validate a pack document. Collects every error; never throws, never returns a
 * partially-validated pack (FR-2). `dslChecker` is the S03 seam (CA-2) — omit it
 * and E-FORM-* checks are marked deferred.
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

// ---------------------------------------------------------------- emit + shared checks

function add(ctx: Ctx, card: ErrorCard): void {
  const key = `${card.rule}|${card.jsonPath}|${card.message}`;
  if (!ctx.emitted.has(key)) {
    ctx.emitted.add(key);
    ctx.errors.push(card);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function reqFields(
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

function forbidUnknown(
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

function checkStringField(
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

/** Registers an id in the global namespace; a second registration is E-DUP-01 (uniqueness is pack-wide, database.md). */
function registerId(ctx: Ctx, id: string, path: string): void {
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

/** DSL string field: presence is the caller's (required-field) duty; type + checker run here. */
function checkDslField(
  ctx: Ctx,
  value: unknown,
  kind: DslCheckRequest['kind'],
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

function runDslChecker(ctx: Ctx, request: DslCheckRequest): void {
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
  for (const card of cards) add(ctx, card);
}

/** Nearest candidate ids by edit distance — the error-design hint ("nearest ids", mocks/validation-errors.html). */
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

function nearestId(target: string, candidates: Iterable<string>): string | undefined {
  return nearestIds(target, candidates, 1)[0];
}

// ---------------------------------------------------------------- pass 1: id collection

function collectContext(doc: Record<string, unknown>, ctx: Ctx): void {
  const stats = doc['stats'];
  if (isPlainObject(stats)) {
    ctx.abilityIds = collectKebabList(stats['abilities']);
    ctx.saveIds = collectKebabList(stats['saves']);
  }
  const actions = doc['actions'];
  if (isPlainObject(actions)) {
    const actionIds = new Set<string>();
    for (const [id, def] of Object.entries(actions)) {
      if (ID_PATTERN.test(id)) actionIds.add(id);
      if (!isPlainObject(def)) {
        ctx.tagsTrusted = false;
      } else if (def['tags'] !== undefined) {
        collectTagsInto(ctx, def['tags']);
      }
    }
    ctx.actionIds = actionIds;
  }
  const formulas = doc['formulas'];
  if (isPlainObject(formulas)) {
    const formulaIds = new Set<string>();
    for (const id of Object.keys(formulas)) formulaIds.add(id);
    ctx.formulaIds = formulaIds;
  }
  const content = doc['content'];
  if (isPlainObject(content)) {
    const classes = content['classes'];
    if (isPlainObject(classes)) {
      const classIds = new Set<string>();
      for (const id of Object.keys(classes)) if (ID_PATTERN.test(id)) classIds.add(id);
      ctx.classIds = classIds;
    }
    const spells = content['spells'];
    if (isPlainObject(spells)) {
      for (const def of Object.values(spells)) {
        if (!isPlainObject(def)) {
          ctx.tagsTrusted = false;
        } else if (def['tags'] !== undefined) {
          collectTagsInto(ctx, def['tags']);
        }
      }
    }
  } else {
    ctx.tagsTrusted = false;
  }
  const economy = doc['economy'];
  if (economy !== undefined) {
    if (isPlainObject(economy) && isPlainObject(economy['turnSlots'])) {
      const names = new Set<string>();
      for (const name of Object.keys(economy['turnSlots'])) if (ID_PATTERN.test(name)) names.add(name);
      ctx.economySlotNames = names;
    }
  }
  const progression = doc['progression'];
  if (progression === undefined) {
    ctx.progressionIds = new Set(); // absent section = empty namespace: E-REF-03 fires per declared class
  } else if (isPlainObject(progression)) {
    const progressionIds = new Set<string>();
    for (const id of Object.keys(progression)) if (ID_PATTERN.test(id)) progressionIds.add(id);
    ctx.progressionIds = progressionIds;
  } else {
    ctx.progressionIds = null;
  }
  const tables = doc['tables'];
  if (isPlainObject(tables)) {
    ctx.tablesDoc = tables;
    const tableIds = new Set<string>();
    for (const id of Object.keys(tables)) if (ID_PATTERN.test(id)) tableIds.add(id);
    ctx.tableIds = tableIds;
  } else {
    ctx.tableIds = null;
  }
}

function collectKebabList(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;
  const set = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string' || !ID_PATTERN.test(entry)) return null;
    set.add(entry);
  }
  return set;
}

function collectTagsInto(ctx: Ctx, value: unknown): void {
  if (!Array.isArray(value)) {
    ctx.tagsTrusted = false;
    return;
  }
  for (const tag of value) {
    if (typeof tag !== 'string' || !ID_PATTERN.test(tag)) {
      ctx.tagsTrusted = false;
      return;
    }
    ctx.declaredTags.add(tag);
  }
}

// ---------------------------------------------------------------- pass 2: sections

function checkRootSections(ctx: Ctx, doc: Record<string, unknown>): void {
  const required = [
    'manifest',
    'stats',
    'actions',
    'formulas',
    'content',
    'progression',
    'bestiary',
    'tables',
  ];
  for (const section of required) {
    if (doc[section] === undefined) {
      add(ctx, makeErrorCard('E-SCHEMA-01', section, section, `required section "${section}" is missing.`));
    }
  }
  for (const key of Object.keys(doc)) {
    if (!required.includes(key) && key !== 'economy') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-02',
          key,
          key,
          `unknown top-level section "${key}" — the pack document is closed.`,
        ),
      );
    }
  }
}

function checkManifest(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(ctx, makeErrorCard('E-SCHEMA-01', 'manifest', 'manifest', 'manifest must be an object.'));
    return;
  }
  reqFields(ctx, value, ['id', 'schemaVersion', 'title'], 'manifest', 'manifest');
  forbidUnknown(
    ctx,
    value,
    ['id', 'schemaVersion', 'title', 'license', 'attribution', 'provenance'],
    'manifest',
    'manifest',
  );
  const id = value['id'];
  if (typeof id === 'string') {
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, 'manifest.id', `manifest id "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
    } else {
      registerId(ctx, id, 'manifest.id');
    }
  }
  const version = value['schemaVersion'];
  if (version !== undefined && (!isInteger(version) || version !== 1)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'manifest',
        'manifest.schemaVersion',
        `manifest.schemaVersion must be 1 for this contract layer (got ${JSON.stringify(version) ?? String(version)}).`,
      ),
    );
  }
  const title = value['title'];
  if (title !== undefined && (typeof title !== 'string' || title.length < 1)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'manifest',
        'manifest.title',
        'manifest.title must be a non-empty string.',
      ),
    );
  }
  checkStringField(ctx, value, 'license', 'manifest', 'manifest');
  checkStringField(ctx, value, 'attribution', 'manifest', 'manifest');
  const provenance = value['provenance'];
  if (provenance === undefined) return;
  if (!isPlainObject(provenance)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'manifest',
        'manifest.provenance',
        'manifest.provenance must be an object {theme, seed, knobs?}.',
      ),
    );
    return;
  }
  reqFields(ctx, provenance, ['theme', 'seed'], 'manifest', 'manifest.provenance');
  forbidUnknown(ctx, provenance, ['theme', 'seed', 'knobs'], 'manifest', 'manifest.provenance');
  if (provenance['theme'] !== undefined && typeof provenance['theme'] !== 'string') {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'manifest',
        'manifest.provenance.theme',
        'provenance.theme must be a string.',
      ),
    );
  }
  const seed = provenance['seed'];
  if (seed !== undefined && !isInteger(seed) && typeof seed !== 'string') {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'manifest',
        'manifest.provenance.seed',
        'provenance.seed must be an integer or a string.',
      ),
    );
  }
  if (provenance['knobs'] !== undefined && !isPlainObject(provenance['knobs'])) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'manifest',
        'manifest.provenance.knobs',
        'provenance.knobs must be an object (recorded knob values, FR-18).',
      ),
    );
  }
}

function checkStats(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', 'stats', 'stats', 'stats must be an object with abilities and saves.'),
    );
    return;
  }
  reqFields(ctx, value, ['abilities', 'saves'], 'stats', 'stats');
  forbidUnknown(ctx, value, ['abilities', 'saves'], 'stats', 'stats');
  checkIdList(ctx, value['abilities'], 'stats', 'stats.abilities');
  checkIdList(ctx, value['saves'], 'stats', 'stats.saves');
}

/** Structural check of a kebab-id array (stats.abilities / stats.saves). These are name-keyed vocabularies, not artifact ids — they never enter the global uniqueness namespace. Collection semantics happened in pass 1. */
function checkIdList(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
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

function checkCost(ctx: Ctx, value: unknown, artifactId: string, basePath: string): boolean {
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
        `${basePath}.vancian must be an integer in 1..${MAX_SPELL_LEVEL} — the level of the BOUND slot it consumes (FR-8).`,
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
          `costs an undeclared slot name "${name}" — the pack's economy section declares only [${[...ctx.economySlotNames].sort().join(', ')}] (the engine has no built-in slot vocabulary, FR-4).`,
          near === undefined ? undefined : `did you mean "${near}"?`,
        ),
      );
    }
  }
}

/** E-ECON-01: pool ids resolve against the formulas map — pool capacity is a pack formula (FR-3/FR-8). */
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
        `cost draws from pool "${pool}", but no formula declares it — a drain pool's capacity is a pack formula (FR-3/FR-8).`,
        near === undefined ? undefined : `did you mean "${near}"?`,
      ),
    );
  }
}

function checkTrigger(
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

function checkTagsField(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
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

function checkActions(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', 'actions', 'actions', 'actions must be an object keyed by action id.'),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `actions.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `action map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'action definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['cost', 'effect'], id, basePath);
    forbidUnknown(ctx, def, ['cost', 'valid', 'trigger', 'effect', 'tags'], id, basePath);
    if (def['id'] !== undefined && def['id'] !== id) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-02',
          id,
          `${basePath}.id`,
          `definition repeats id ${JSON.stringify(def['id'])} under map key "${id}" — the map key is the id (map-as-namespace).`,
        ),
      );
    }
    checkDslField(ctx, def['effect'], 'effect', id, `${basePath}.effect`);
    checkDslField(ctx, def['valid'], 'valid', id, `${basePath}.valid`);
    checkTagsField(ctx, def['tags'], id, `${basePath}.tags`);
    checkCost(ctx, def['cost'], id, `${basePath}.cost`);
    checkTrigger(ctx, def['trigger'], id, `${basePath}.trigger`, 1);
  }
}

function checkEconomy(ctx: Ctx, value: unknown): void {
  if (value === undefined) return; // optional (v1.1): absence = documented engine default at play time
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'economy',
        'economy',
        'economy must be an object with a turnSlots grant table.',
      ),
    );
    return;
  }
  reqFields(ctx, value, ['turnSlots'], 'economy', 'economy');
  forbidUnknown(ctx, value, ['turnSlots'], 'economy', 'economy');
  const turnSlots = value['turnSlots'];
  if (!isPlainObject(turnSlots) || Object.keys(turnSlots).length < 1) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'economy',
        'economy.turnSlots',
        'economy.turnSlots must be an object with at least one slot name -> integer >= 1.',
      ),
    );
    return;
  }
  for (const [name, count] of Object.entries(turnSlots)) {
    if (!ID_PATTERN.test(name)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          'economy',
          `economy.turnSlots.${name}`,
          `slot name "${name}" must match ^[a-z][a-z0-9-]*$.`,
        ),
      );
    }
    if (!isInteger(count) || count < 1) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          'economy',
          `economy.turnSlots.${name}`,
          `economy.turnSlots.${name} must be an integer >= 1 (slots granted per turn, FR-4).`,
        ),
      );
    }
  }
}

function checkFormulas(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', 'formulas', 'formulas', 'formulas must be an object keyed by formula id.'),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `formulas.${id}`;
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, 'formula definition must be an object {expr, params?}.'),
      );
      continue;
    }
    reqFields(ctx, def, ['expr'], id, basePath);
    forbidUnknown(ctx, def, ['expr', 'params'], id, basePath);
    checkDslField(ctx, def['expr'], 'formula', id, `${basePath}.expr`);
    const params = def['params'];
    if (params !== undefined) {
      if (!Array.isArray(params)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.params`,
            'params must be an array of parameter names.',
          ),
        );
      } else {
        const seen = new Set<string>();
        for (const [index, param] of params.entries()) {
          if (typeof param !== 'string') {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${basePath}.params[${index}]`,
                'params entries must be strings.',
              ),
            );
          } else if (seen.has(param)) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${basePath}.params[${index}]`,
                `params entries must be unique (uniqueItems) — "${param}" repeats.`,
              ),
            );
          }
          seen.add(param);
        }
      }
    }
  }
  // CA-6 — reserved formula ids: the engine resolves derived stats only through them.
  if (ctx.formulaIds !== null) {
    for (const reserved of RESERVED_FORMULA_IDS) {
      if (!ctx.formulaIds.has(reserved)) {
        add(
          ctx,
          makeErrorCard(
            'E-REF-01',
            reserved,
            'formulas',
            `reserved formula id "${reserved}" is not defined — every pack must define formulas.hp and formulas.ac (the engine resolves derived stats only through these ids).`,
            '"initiative" is optional (engine fallback: plain d20); "hp" and "ac" are not.',
          ),
        );
      }
    }
  }
}

function checkContent(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', 'content', 'content', 'content must be an object of artifact maps.'),
    );
    return;
  }
  forbidUnknown(
    ctx,
    value,
    ['classes', 'races', 'skills', 'feats', 'spells', 'conditions', 'items'],
    'content',
    'content',
  );
  checkClasses(ctx, value['classes']);
  checkRaces(ctx, value['races']);
  checkSkills(ctx, value['skills']);
  checkFeats(ctx, value['feats']);
  checkSpells(ctx, value['spells']);
  checkConditions(ctx, value['conditions']);
  checkItems(ctx, value['items']);
}

function checkClasses(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.classes',
        'content.classes',
        'content.classes must be an object keyed by class id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.classes.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `class map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'class definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'spellLists', 'armorCasting', 'features', 'actions'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    checkStringArray(ctx, def['spellLists'], id, `${basePath}.spellLists`);
    checkStringArray(ctx, def['armorCasting'], id, `${basePath}.armorCasting`);
    const features = def['features'];
    if (features !== undefined) {
      if (!Array.isArray(features)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.features`,
            'features must be an array of {level, ref}.',
          ),
        );
      } else {
        for (const [index, feature] of features.entries()) {
          const featurePath = `${basePath}.features[${index}]`;
          if (!isPlainObject(feature)) {
            add(
              ctx,
              makeErrorCard('E-SCHEMA-01', id, featurePath, 'feature must be an object {level, ref}.'),
            );
            continue;
          }
          reqFields(ctx, feature, ['level', 'ref'], id, featurePath);
          forbidUnknown(ctx, feature, ['level', 'ref'], id, featurePath);
          const level = feature['level'];
          if (level !== undefined && (!isInteger(level) || level < 1)) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${featurePath}.level`,
                'feature.level must be an integer >= 1.',
              ),
            );
          }
          if (feature['ref'] !== undefined && typeof feature['ref'] !== 'string') {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${featurePath}.ref`,
                'feature.ref must be a string (the feature artifact id).',
              ),
            );
          }
        }
      }
    }
    checkClassActions(ctx, def['actions'], id, `${basePath}.actions`);
  }
}

/** v1.2 — optional class action list: unique kebab ids, each resolving in the pack's actions map, like statblock actions (FR-16). */
function checkClassActions(ctx: Ctx, value: unknown, classId: string, basePath: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', classId, basePath, `${basePath} must be an array of unique action ids.`),
    );
    return;
  }
  const seen = new Set<string>();
  for (const [index, actionId] of value.entries()) {
    const entryPath = `${basePath}[${index}]`;
    if (typeof actionId !== 'string' || !ID_PATTERN.test(actionId)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', classId, entryPath, `${entryPath} must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    if (seen.has(actionId)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          classId,
          entryPath,
          `${basePath} entries must be unique (uniqueItems) — "${actionId}" repeats.`,
        ),
      );
      continue;
    }
    seen.add(actionId);
    if (ctx.actionIds !== null && !ctx.actionIds.has(actionId)) {
      const near = nearestId(actionId, ctx.actionIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-01',
          classId,
          entryPath,
          `class "${classId}" grants action "${actionId}", which is not declared in actions — characters ride the same action machinery as statblocks (FR-16).`,
          near === undefined
            ? `declared actions: ${[...ctx.actionIds].sort().join(', ') || '(none)'}`
            : `did you mean "${near}"?`,
        ),
      );
    }
  }
}

function checkStringArray(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
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

function checkRaces(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.races',
        'content.races',
        'content.races must be an object keyed by race id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.races.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `race map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'race definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'caps', 'size'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    const caps = def['caps'];
    if (caps !== undefined) {
      if (!isPlainObject(caps)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.caps`,
            'caps must be an object classId -> max level.',
          ),
        );
      } else {
        for (const [classId, maxLevel] of Object.entries(caps)) {
          if (!isInteger(maxLevel) || maxLevel < 1) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${basePath}.caps.${classId}`,
                `${basePath}.caps.${classId} must be an integer >= 1.`,
              ),
            );
          }
          if (ctx.classIds !== null && !ctx.classIds.has(classId)) {
            const near = nearestId(classId, ctx.classIds);
            add(
              ctx,
              makeErrorCard(
                'E-REF-02',
                id,
                `${basePath}.caps.${classId}`,
                `race "${id}" declares a level cap for class "${classId}", which is not in the class table.`,
                near === undefined
                  ? `known classes: ${[...ctx.classIds].sort().join(', ') || '(none)'}`
                  : `did you mean "${near}"?`,
              ),
            );
          }
        }
      }
    }
    const size = def['size'];
    if (size !== undefined && size !== 'small' && size !== 'medium' && size !== 'large') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.size`,
          'size must be one of "small" | "medium" | "large" (defaults medium; documented no-op for adjacency in v1).',
        ),
      );
    }
  }
}

function checkSkills(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.skills',
        'content.skills',
        'content.skills must be an object keyed by skill id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.skills.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `skill map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'skill definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name', 'ability'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'ability'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    const ability = def['ability'];
    if (ability !== undefined && typeof ability !== 'string') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.ability`,
          'ability must be a string naming an ability in stats.abilities.',
        ),
      );
    } else if (typeof ability === 'string' && ctx.abilityIds !== null && !ctx.abilityIds.has(ability)) {
      const near = nearestId(ability, ctx.abilityIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-01',
          id,
          `${basePath}.ability`,
          `skill "${id}" references ability "${ability}", which is not declared in stats.abilities.`,
          near === undefined
            ? `this pack's abilities: ${[...(ctx.abilityIds ?? [])].sort().join(', ') || '(none)'}`
            : `did you mean "${near}"?`,
        ),
      );
    }
  }
}

function checkFeats(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.feats',
        'content.feats',
        'content.feats must be an object keyed by feat id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.feats.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `feat map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'feat definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'passive', 'trigger', 'effect'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    checkDslField(ctx, def['passive'], 'passive', id, `${basePath}.passive`);
    checkDslField(ctx, def['effect'], 'effect', id, `${basePath}.effect`);
    checkTrigger(ctx, def['trigger'], id, `${basePath}.trigger`, 0);
  }
}

function checkSpells(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.spells',
        'content.spells',
        'content.spells must be an object keyed by spell id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.spells.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `spell map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'spell definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name', 'magic', 'cost', 'effect'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'magic', 'cost', 'effect', 'targeting', 'tags'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    checkTagsField(ctx, def['tags'], id, `${basePath}.tags`);
    checkDslField(ctx, def['effect'], 'effect', id, `${basePath}.effect`);
    const magic = def['magic'];
    if (magic !== undefined) {
      if (!isPlainObject(magic)) {
        add(
          ctx,
          makeErrorCard('E-SCHEMA-01', id, `${basePath}.magic`, 'magic must be an object {level, lists}.'),
        );
      } else {
        reqFields(ctx, magic, ['level', 'lists'], id, `${basePath}.magic`);
        forbidUnknown(ctx, magic, ['level', 'lists'], id, `${basePath}.magic`);
        const level = magic['level'];
        if (level !== undefined && (!isInteger(level) || level < 1 || level > MAX_SPELL_LEVEL)) {
          add(
            ctx,
            makeErrorCard(
              'E-SCHEMA-01',
              id,
              `${basePath}.magic.level`,
              `magic.level must be an integer in 1..${MAX_SPELL_LEVEL}.`,
            ),
          );
        }
        const lists = magic['lists'];
        if (lists !== undefined) {
          if (!Array.isArray(lists) || lists.length < 1) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${basePath}.magic.lists`,
                'magic.lists must be a non-empty array of class ids (minItems 1).',
              ),
            );
          } else {
            for (const [index, list] of lists.entries()) {
              if (typeof list !== 'string') {
                add(
                  ctx,
                  makeErrorCard(
                    'E-SCHEMA-01',
                    id,
                    `${basePath}.magic.lists[${index}]`,
                    'magic.lists entries must be class id strings.',
                  ),
                );
              } else if (ctx.classIds !== null && !ctx.classIds.has(list)) {
                const near = nearestId(list, ctx.classIds);
                add(
                  ctx,
                  makeErrorCard(
                    'E-REF-01',
                    id,
                    `${basePath}.magic.lists[${index}]`,
                    `spell "${id}" claims list membership in class "${list}", which is not declared in content.classes.`,
                    near === undefined
                      ? `known classes: ${[...ctx.classIds].sort().join(', ') || '(none)'}`
                      : `did you mean "${near}"?`,
                  ),
                );
              }
            }
          }
        }
      }
    }
    checkCost(ctx, def['cost'], id, `${basePath}.cost`);
    const targeting = def['targeting'];
    if (targeting !== undefined) {
      checkTargeting(ctx, targeting, id, `${basePath}.targeting`);
    }
  }
}

/** Structural conditional (v1): radius is required iff shape is "burst" — and meaningless (forbidden) otherwise. */
function checkTargeting(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', artifactId, basePath, 'targeting must be an object {shape, radius?}.'),
    );
    return;
  }
  reqFields(ctx, value, ['shape'], artifactId, basePath);
  forbidUnknown(ctx, value, ['shape', 'radius'], artifactId, basePath);
  const shape = value['shape'];
  if (shape !== undefined && shape !== 'single' && shape !== 'burst') {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        `${basePath}.shape`,
        'shape must be "single" or "burst" (v1 shapes only; cone/line deferred as engine geometry, FR-11).',
      ),
    );
  }
  const radius = value['radius'];
  if (radius !== undefined && (!isInteger(radius) || radius < 1)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', artifactId, `${basePath}.radius`, 'radius must be an integer >= 1.'),
    );
  }
  if (shape === 'burst' && radius === undefined) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        `${basePath}.radius`,
        'shape "burst" requires a radius (radius iff burst).',
      ),
    );
  }
  if (shape === 'single' && radius !== undefined) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-02',
        artifactId,
        `${basePath}.radius`,
        'radius is only valid for shape "burst" — a single-target effect has no area.',
      ),
    );
  }
}

function checkConditions(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.conditions',
        'content.conditions',
        'content.conditions must be an object keyed by condition id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.conditions.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `condition map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'condition definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name', 'duration', 'stacking'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'duration', 'stacking', 'restricts'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    const duration = def['duration'];
    if (duration !== undefined && (!isInteger(duration) || duration < 1)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, `${basePath}.duration`, 'duration must be an integer >= 1.'));
    }
    const stacking = def['stacking'];
    if (stacking !== undefined && stacking !== 'refresh' && stacking !== 'stack' && stacking !== 'ignore') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.stacking`,
          'stacking must be one of "refresh" | "stack" | "ignore" (pack-declared policy, FR-7).',
        ),
      );
    }
    const restricts = def['restricts'];
    if (restricts !== undefined && !Array.isArray(restricts)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.restricts`,
          'restricts must be an array of action tag patterns.',
        ),
      );
    }
  }
}

function checkItems(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.items',
        'content.items',
        'content.items must be an object keyed by item id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.items.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `item map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'item definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'kind'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    checkStringField(ctx, def, 'kind', id, basePath);
  }
}

function checkProgression(ctx: Ctx, value: unknown): void {
  if (value === undefined) return; // absence handled by root + E-REF-03
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'progression',
        'progression',
        'progression must be an object keyed by class id.',
      ),
    );
    return;
  }
  for (const [classId, prog] of Object.entries(value)) {
    const basePath = `progression.${classId}`;
    if (!ID_PATTERN.test(classId)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          classId,
          basePath,
          `progression map key "${classId}" must match ^[a-z][a-z0-9-]*$.`,
        ),
      );
      continue;
    }
    // progression is keyed BY class id — it is the class's own table, not a second artifact; pairing is E-REF-03's duty
    if (!isPlainObject(prog)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', classId, basePath, 'progression entry must be an object.'));
      continue;
    }
    reqFields(ctx, prog, ['hd', 'saves'], classId, basePath);
    forbidUnknown(ctx, prog, ['hd', 'attackTable', 'attackBonus', 'saves', 'slots'], classId, basePath);
    const hd = prog['hd'];
    if (hd !== undefined && !HD_DICE.includes(hd as string)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', classId, `${basePath}.hd`, `hd must be one of ${HD_DICE.join(' | ')}.`),
      );
    }
    // XOR rule (FR-3): exactly one attack convention per class.
    const hasTable = prog['attackTable'] !== undefined;
    const hasBonus = prog['attackBonus'] !== undefined;
    if (hasTable && hasBonus) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          classId,
          basePath,
          'progression declares both attackTable and attackBonus — exactly one attack convention per class (XOR rule, FR-3).',
        ),
      );
    } else if (!hasTable && !hasBonus) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          classId,
          basePath,
          'progression declares neither attackTable nor attackBonus — exactly one attack convention per class is required (XOR rule, FR-3).',
        ),
      );
    }
    if (hasTable) {
      checkAttackTable(ctx, prog['attackTable'], classId, `${basePath}.attackTable`);
    }
    if (hasBonus) {
      checkDslField(ctx, prog['attackBonus'], 'attackBonus', classId, `${basePath}.attackBonus`);
    }
    const saves = prog['saves'];
    if (isPlainObject(saves)) {
      if (Object.keys(saves).length < 1) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            classId,
            `${basePath}.saves`,
            'saves must declare at least one save progression (minProperties 1).',
          ),
        );
      }
      for (const [saveName, values] of Object.entries(saves)) {
        checkIntegerArray(
          ctx,
          values,
          classId,
          `${basePath}.saves.${saveName}`,
          `save progression "${saveName}"`,
        );
        if (ctx.saveIds !== null && !ctx.saveIds.has(saveName)) {
          const near = nearestId(saveName, ctx.saveIds);
          add(
            ctx,
            makeErrorCard(
              'E-REF-01',
              classId,
              `${basePath}.saves.${saveName}`,
              `progression save "${saveName}" is not declared in stats.saves — the pack declares which saves exist (FR-5).`,
              near === undefined
                ? `declared saves: ${[...(ctx.saveIds ?? [])].sort().join(', ') || '(none)'}`
                : `did you mean "${near}"?`,
            ),
          );
        }
      }
    }
    const slots = prog['slots'];
    if (slots !== undefined) {
      if (!isPlainObject(slots)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            classId,
            `${basePath}.slots`,
            'slots must be an object spellLevel -> per-class-level slot counts.',
          ),
        );
      } else {
        for (const [level, values] of Object.entries(slots)) {
          checkIntegerArray(
            ctx,
            values,
            classId,
            `${basePath}.slots.${level}`,
            `vancian slot table for spell level ${level}`,
            0,
          );
        }
      }
    }
  }
}

function checkAttackTable(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
  if (!Array.isArray(value) || value.length < 1) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        basePath,
        'attackTable must be a non-empty array of {level, byDefense} rows.',
      ),
    );
    return;
  }
  for (const [index, row] of value.entries()) {
    const rowPath = `${basePath}[${index}]`;
    if (!isPlainObject(row)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          rowPath,
          'attack table row must be an object {level, byDefense}.',
        ),
      );
      continue;
    }
    reqFields(ctx, row, ['level', 'byDefense'], artifactId, rowPath);
    forbidUnknown(ctx, row, ['level', 'byDefense'], artifactId, rowPath);
    const level = row['level'];
    if (level !== undefined && (!isInteger(level) || level < 1 || level > MAX_ATTACK_TABLE_LEVEL)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${rowPath}.level`,
          `attack table level must be an integer in 1..${MAX_ATTACK_TABLE_LEVEL}.`,
        ),
      );
    }
    const byDefense = row['byDefense'];
    if (byDefense !== undefined) {
      if (!isPlainObject(byDefense) || Object.keys(byDefense).length < 1) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            artifactId,
            `${rowPath}.byDefense`,
            'byDefense must be an object with at least one defenseValue -> toHit entry.',
          ),
        );
      } else {
        for (const [defense, toHit] of Object.entries(byDefense)) {
          if (!isInteger(toHit)) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                artifactId,
                `${rowPath}.byDefense.${defense}`,
                'byDefense values (to-hit) must be integers; defense keys are pack convention (FR-3).',
              ),
            );
          }
        }
      }
    }
  }
}

function checkIntegerArray(
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

function checkBestiary(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', 'bestiary', 'bestiary', 'bestiary must be an object keyed by monster id.'),
    );
    return;
  }
  for (const [id, block] of Object.entries(value)) {
    const basePath = `bestiary.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `bestiary map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(block)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'statblock must be an object.'));
      continue;
    }
    reqFields(ctx, block, ['name', 'threat', 'actions'], id, basePath);
    forbidUnknown(
      ctx,
      block,
      ['name', 'threat', 'level', 'hd', 'abilityOverrides', 'saveOverrides', 'attackTable', 'actions'],
      id,
      basePath,
    );
    checkStringField(ctx, block, 'name', id, basePath, 1);
    const threat = block['threat'];
    if (threat !== undefined && (typeof threat !== 'number' || Number.isNaN(threat) || threat <= 0)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.threat`,
          'threat must be a number > 0 (the FR-16 budget weight).',
        ),
      );
    }
    const level = block['level'];
    if (level !== undefined && (!isInteger(level) || level < 1)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, `${basePath}.level`, 'level must be an integer >= 1.'));
    }
    const hd = block['hd'];
    if (hd !== undefined && !HD_DICE.includes(hd as string)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, `${basePath}.hd`, `hd must be one of ${HD_DICE.join(' | ')}.`),
      );
    }
    checkOverrides(ctx, block['abilityOverrides'], id, `${basePath}.abilityOverrides`, 'abilityOverrides');
    checkOverrides(ctx, block['saveOverrides'], id, `${basePath}.saveOverrides`, 'saveOverrides');
    const attackTable = block['attackTable'];
    if (attackTable !== undefined) {
      if (typeof attackTable !== 'string') {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.attackTable`,
            'attackTable must be a string referencing a progression attack table.',
          ),
        );
      } else if (ctx.progressionIds !== null && !ctx.progressionIds.has(attackTable)) {
        const near = nearestId(attackTable, ctx.progressionIds);
        add(
          ctx,
          makeErrorCard(
            'E-REF-01',
            id,
            `${basePath}.attackTable`,
            `statblock "${id}" references attack table "${attackTable}", which is not a progression entry in this pack.`,
            near === undefined
              ? `known progressions: ${[...ctx.progressionIds].sort().join(', ') || '(none)'}`
              : `did you mean "${near}"?`,
          ),
        );
      }
    }
    const actions = block['actions'];
    if (actions !== undefined) {
      if (!Array.isArray(actions) || actions.length < 1) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.actions`,
            'actions must be a non-empty array of action ids (minItems 1).',
          ),
        );
      } else {
        for (const [index, actionId] of actions.entries()) {
          if (typeof actionId !== 'string') {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${basePath}.actions[${index}]`,
                'actions entries must be action id strings.',
              ),
            );
          } else if (ctx.actionIds !== null && !ctx.actionIds.has(actionId)) {
            const near = nearestId(actionId, ctx.actionIds);
            add(
              ctx,
              makeErrorCard(
                'E-REF-01',
                id,
                `${basePath}.actions[${index}]`,
                `statblock "${id}" uses action "${actionId}", which is not declared in actions — monsters ride the same action machinery as characters (FR-16).`,
                near === undefined
                  ? `declared actions: ${[...ctx.actionIds].sort().join(', ') || '(none)'}`
                  : `did you mean "${near}"?`,
              ),
            );
          }
        }
      }
    }
  }
}

function checkOverrides(ctx: Ctx, value: unknown, artifactId: string, basePath: string, label: string): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        basePath,
        `${label} must be an object of name -> integer override.`,
      ),
    );
    return;
  }
  for (const [name, score] of Object.entries(value)) {
    if (!isInteger(score)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}.${name}`,
          `${label}.${name} must be an integer.`,
        ),
      );
    }
  }
}

function checkTables(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(ctx, makeErrorCard('E-SCHEMA-01', 'tables', 'tables', 'tables must be an object keyed by table id.'));
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `tables.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `table map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'table definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['kind', 'entries'], id, basePath);
    forbidUnknown(ctx, def, ['kind', 'entries'], id, basePath);
    const kind = def['kind'];
    if (kind !== undefined && kind !== 'weighted' && kind !== 'ranged' && kind !== 'nested') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.kind`,
          'kind must be one of "weighted" | "ranged" | "nested".',
        ),
      );
    }
    const entries = def['entries'];
    if (entries !== undefined) {
      if (!Array.isArray(entries) || entries.length < 1) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.entries`,
            'entries must be a non-empty array (minItems 1).',
          ),
        );
      } else {
        for (const [index, entry] of entries.entries()) {
          checkTableEntry(
            ctx,
            entry,
            id,
            `${basePath}.entries[${index}]`,
            kind === 'weighted',
            kind === 'ranged',
          );
        }
      }
    }
    if (kind === 'nested' && Array.isArray(def['entries'])) {
      checkNestedDepth(ctx, def['entries'], id, basePath, new Set([id]));
    }
  }
}

/** Entry shape per database.md's kind contracts: weighted -> {weight >= 1, value}; ranged -> {min <= max, value}; nested -> value may reference tables. The schema leaves entries open; the semantic contract closes them (E-TBL-01), and unknown fields are closed-shape errors. */
function checkTableEntry(
  ctx: Ctx,
  entry: unknown,
  artifactId: string,
  basePath: string,
  requireWeight: boolean,
  requireRange: boolean,
): void {
  if (!isPlainObject(entry)) {
    add(ctx, makeErrorCard('E-SCHEMA-01', artifactId, basePath, 'table entry must be an object.'));
    return;
  }
  forbidUnknown(ctx, entry, ['weight', 'min', 'max', 'value'], artifactId, basePath);
  if (entry['value'] === undefined) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        `${basePath}.value`,
        'table entry requires a value (scalar, object, or nested table reference).',
      ),
    );
  }
  const weight = entry['weight'];
  if (requireWeight) {
    if (!isInteger(weight) || weight < 1) {
      add(
        ctx,
        makeErrorCard(
          'E-TBL-01',
          artifactId,
          `${basePath}.weight`,
          'weighted table entries require an integer weight >= 1.',
        ),
      );
    }
  } else if (weight !== undefined && (!isInteger(weight) || weight < 1)) {
    add(ctx, makeErrorCard('E-TBL-01', artifactId, `${basePath}.weight`, 'weight must be an integer >= 1.'));
  }
  const min = entry['min'];
  const max = entry['max'];
  if (requireRange) {
    if (!isInteger(min) || !isInteger(max)) {
      add(
        ctx,
        makeErrorCard('E-TBL-01', artifactId, basePath, 'ranged table entries require integer min and max.'),
      );
    } else if (min > max) {
      add(
        ctx,
        makeErrorCard(
          'E-TBL-01',
          artifactId,
          basePath,
          `ranged entry is malformed: min (${min}) > max (${max}).`,
        ),
      );
    }
  } else if ((min !== undefined || max !== undefined) && (!isInteger(min) || !isInteger(max))) {
    add(ctx, makeErrorCard('E-TBL-01', artifactId, basePath, 'range bounds min/max must be integers.'));
  } else if (isInteger(min) && isInteger(max) && min > max) {
    add(
      ctx,
      makeErrorCard(
        'E-TBL-01',
        artifactId,
        basePath,
        `ranged entry is malformed: min (${min}) > max (${max}).`,
      ),
    );
  }
}

/** E-TBL-01: nesting depth is bounded at load so a pathological pack fails validation instead of hanging load. */
/** E-TBL-01: nesting depth is bounded at load so a pathological pack fails validation instead of hanging load. */
function checkNestedDepth(
  ctx: Ctx,
  entries: unknown[],
  tableId: string,
  basePath: string,
  visiting: Set<string>,
): void {
  for (const [index, entry] of entries.entries()) {
    if (!isPlainObject(entry)) continue;
    const value = entry['value'];
    if (typeof value !== 'string' || !value.startsWith('tables.')) continue;
    const ref = value.slice('tables.'.length);
    if (!ID_PATTERN.test(ref)) continue; // scalar string value that merely looks like a path — not a reference
    const refPath = `${basePath}.entries[${index}].value`;
    if (ctx.tableIds !== null && !ctx.tableIds.has(ref)) {
      const near = nearestId(ref, ctx.tableIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-01',
          tableId,
          refPath,
          `nested table entry references table "${ref}", which does not exist in this pack.`,
          near === undefined
            ? `known tables: ${[...ctx.tableIds].sort().join(', ') || '(none)'}`
            : `did you mean "${near}"?`,
        ),
      );
      continue;
    }
    if (visiting.size >= MAX_TABLE_DEPTH) {
      add(
        ctx,
        makeErrorCard(
          'E-TBL-01',
          tableId,
          refPath,
          `table nesting exceeds the documented depth limit (${MAX_TABLE_DEPTH}) — bounded work at load (E-TBL-01).`,
        ),
      );
      return;
    }
    if (visiting.has(ref)) {
      add(
        ctx,
        makeErrorCard(
          'E-TBL-01',
          tableId,
          refPath,
          `table nesting cycle through "${ref}" — nesting depth is bounded (E-TBL-01).`,
        ),
      );
      return;
    }
    const nested = getNestedEntries(ctx, ref);
    if (nested !== undefined) {
      visiting.add(ref);
      checkNestedDepth(ctx, nested, tableId, `${basePath}.entries[${index}]`, visiting);
      visiting.delete(ref);
    }
  }
}
/** Re-reads a referenced table's entries for depth traversal; tolerant because the referenced table was already structurally checked in pass 2. Only nested-kind tables are followed — a weighted table's string value that merely looks like a path is a value, not a reference. */
function getNestedEntries(ctx: Ctx, tableId: string): unknown[] | undefined {
  const def = ctx.tablesDoc?.[tableId];
  if (!isPlainObject(def) || def['kind'] !== 'nested' || !Array.isArray(def['entries'])) return undefined;
  return def['entries'];
}

/** E-REF-03: progression is required for every id in content.classes; orphaned progression (no such class) is the same failure named from the other side. */
function checkProgressionPairing(ctx: Ctx): void {
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
function checkRestrictsTags(ctx: Ctx, content: unknown): void {
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
