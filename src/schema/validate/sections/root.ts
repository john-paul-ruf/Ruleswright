/**
 * The pack document's root and its first three sections: root shape, manifest,
 * stats, formulas. Root-level discipline lives here — required sections, the
 * closed top-level key set, manifest provenance, and the reserved formula ids
 * every pack must define.
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
