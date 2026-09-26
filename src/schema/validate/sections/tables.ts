/**
 * The tables section: weighted / ranged / nested table definitions, per-kind
 * entry shapes, and the E-TBL-01 load-time nesting bound (depth + cycles) with
 * nested references resolving against pass 1’s table namespace.
 */
import type { Ctx } from '../context';
import { makeErrorCard } from '../../error-card';
import {
  ID_PATTERN,
  MAX_TABLE_DEPTH,
  add,
  isPlainObject,
  isInteger,
  reqFields,
  forbidUnknown,
  registerId,
  nearestId,
} from '../helpers';

export function checkTables(ctx: Ctx, value: unknown): void {
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
