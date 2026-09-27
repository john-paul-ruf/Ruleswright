/**
 * The pack document's root and its first sections: root shape, manifest,
 * stats, formulas, and the optional spatial model (v1.3). Root-level
 * discipline lives here — required sections, the closed top-level key set,
 * manifest provenance, and the reserved formula ids every pack must define.
 */
import { makeErrorCard } from '../../error-card';
import type { Ctx } from '../context';
import {
  ID_PATTERN,
  add,
  checkDslField,
  checkIdList,
  checkStringField,
  forbidUnknown,
  isInteger,
  isPlainObject,
  registerId,
  reqFields,
} from '../helpers';

/** Reserved formula ids: `initiative` is optional (engine fallback: plain d20); `hp` and `ac` are not. */
const RESERVED_FORMULA_IDS: readonly string[] = ['hp', 'ac'];

export function checkRootSections(ctx: Ctx, doc: Record<string, unknown>): void {
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
    if (!required.includes(key) && key !== 'economy' && key !== 'spatial') {
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

export function checkManifest(ctx: Ctx, value: unknown): void {
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
        'provenance.knobs must be an object (recorded knob values).',
      ),
    );
  }
}

export function checkStats(ctx: Ctx, value: unknown): void {
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

export function checkFormulas(ctx: Ctx, value: unknown): void {
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
  // Reserved formula ids: the engine resolves derived stats only through them.
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

/** The v1 shape vocabulary (FR-11) — cone/line are deferred engine geometry, never faked in data. */
const V1_SHAPES: readonly string[] = ['single', 'burst'];

/**
 * The optional spatial section (v1.3, FR-11): the grid model's reach table and
 * documented shape set. Structural violations (missing/mistyped fields) are
 * E-SCHEMA-01; declared-but-unshippable geometry (a model other than 'grid',
 * shape values outside the v1 set) is semantic — E-SPAT-01 (Design Decision 6).
 * Reach overrides are free-form sibling keys of `default` (spatial.html
 * verbatim); absent section = theater of mind, nothing else changes.
 */
export function checkSpatial(ctx: Ctx, value: unknown): void {
  if (value === undefined) return; // optional (v1.3): absence = theater of mind
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'spatial',
        'spatial',
        'spatial must be an object {model, reach, shapes?}.',
      ),
    );
    return;
  }
  reqFields(ctx, value, ['model', 'reach'], 'spatial', 'spatial');
  forbidUnknown(ctx, value, ['model', 'reach', 'shapes'], 'spatial', 'spatial');
  const model = value['model'];
  if (model !== undefined && (typeof model !== 'string' || model !== 'grid')) {
    add(
      ctx,
      makeErrorCard(
        'E-SPAT-01',
        'spatial',
        'spatial.model',
        `pack declares a spatial model the engine does not ship ("${String(model)}") — v1 ships exactly {grid} (square grid, Chebyshev distance); other models are future additive revisions, never silent aliases.`,
      ),
    );
  }
  const reach = value['reach'];
  if (isPlainObject(reach)) {
    reqFields(ctx, reach, ['default'], 'spatial', 'spatial.reach');
    for (const [key, steps] of Object.entries(reach)) {
      if (!isInteger(steps) || steps < 1) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            'spatial',
            `spatial.reach.${key}`,
            key === 'default'
              ? 'spatial.reach.default must be an integer >= 1 (melee reach in grid steps; 1 = adjacency).'
              : `spatial.reach.${key} must be an integer >= 1 (per-id reach override).`,
          ),
        );
      }
    }
  }
  const shapes = value['shapes'];
  if (shapes === undefined) return;
  if (!Array.isArray(shapes)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'spatial',
        'spatial.shapes',
        'spatial.shapes must be an array of shape names (single | burst).',
      ),
    );
    return;
  }
  const seen = new Set<string>();
  for (const [index, shape] of shapes.entries()) {
    if (typeof shape !== 'string' || !V1_SHAPES.includes(shape)) {
      add(
        ctx,
        makeErrorCard(
          'E-SPAT-01',
          'spatial',
          `spatial.shapes[${index}]`,
          `pack declares a shape the engine does not have ("${String(shape)}") — the v1 shape vocabulary is {${V1_SHAPES.join(', ')}}; cone/line are deferred engine geometry, never faked in data (FR-11).`,
        ),
      );
      continue;
    }
    if (seen.has(shape)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          'spatial',
          `spatial.shapes[${index}]`,
          `spatial.shapes entries must be unique (uniqueItems) — "${shape}" repeats.`,
        ),
      );
    }
    seen.add(shape);
  }
}
