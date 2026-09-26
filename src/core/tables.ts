/**
 * THE one table engine (FR-15, Custom Rule 3): weighted / ranged / nested,
 * seeded through the injected RNG, depth-bounded. The compiler has no second
 * implementation — runtime and compiler both roll through this module.
 *
 * Data shape mirrors $defs/tableDef in src/schema/contracts/pack.schema.json
 * (core is a schema sibling: structurally identical types, no internal import).
 *
 * Selection: weighted — uniform over total weight (all-integer arithmetic).
 * ranged — one d100 (`rng.int(100) + 1`; dice.html: percentile is the table
 * roll), ranges inclusive, first match wins, declared gaps fail loudly.
 * nested — entries are table references, selected uniformly (optional weight,
 * default 1); the roll recurses into the referenced table, the root counts as depth 1; each reference +1,
 * bounded at MAX_TABLE_DEPTH = 8 tables entered (database.md: bounded at load; deeper → E-TBL-01).
 *
 * Data failures are returned typed, never thrown — the validator (S01) maps
 * them to ErrorCards at load:
 *   'malformed-entries' → E-TBL-01 (weight < 1 or non-integer, missing or
 *     inverted ranges, empty entries)
 *   'range-gap'         → E-TBL-01 (d100 roll falls in no declared range)
 *   'depth-exceeded'    → E-TBL-01 (nesting deeper than MAX_TABLE_DEPTH)
 *   'unresolvable-ref'  → E-REF-01 (nested table reference does not resolve)
 *
 * jsonPath convention: the caller's root path (e.g. "tables.district-loot"),
 * then `.entries[i]` per entry; a `->` marks a hop across a table reference,
 * after which the referenced table's own entries continue. Deterministic and
 * locatable; S01 can re-derive exact pack paths from its resolver context.
 */
import type { RandomSource } from './rng';

/** Documented nesting limit — 8 tables entered; the 9th fails (E-TBL-01). */
export const MAX_TABLE_DEPTH = 8;

export interface TableEntry {
  /** Scalar, object, or (nested kind) a reference to another table. */
  value: unknown;
  /** weighted kind: integer >= 1; nested kind: optional, default 1. */
  weight?: number;
  /** ranged kind: integer, min <= max. */
  min?: number;
  /** ranged kind: integer, min <= max. */
  max?: number;
}

export interface TableDef {
  kind: 'weighted' | 'ranged' | 'nested';
  entries: TableEntry[];
}

export type TableFailureReason = 'malformed-entries' | 'range-gap' | 'depth-exceeded' | 'unresolvable-ref';

export interface TableFailure {
  reason: TableFailureReason;
  jsonPath: string;
  message: string;
}

export type TableOutcome = { ok: true; value: unknown } | { ok: false; failure: TableFailure };

/** Resolves a nested entry's table reference; undefined = unresolvable (E-REF-01 territory). */
export type TableResolver = (ref: unknown) => TableDef | undefined;

export interface RollTableOptions {
  /** Required for nested tables; unused by weighted/ranged. */
  resolve?: TableResolver;
  /** Root JSON path for failure locating (e.g. "tables.district-loot"). */
  jsonPath?: string;
}

export function rollTable(def: TableDef, rng: RandomSource, options: RollTableOptions = {}): TableOutcome {
  return rollAt(def, rng, 1, options.jsonPath ?? '(table)', options.resolve);
}

function rollAt(def: TableDef, rng: RandomSource, depth: number, path: string, resolve?: TableResolver): TableOutcome {
  if (def.entries.length === 0) {
    return fail('malformed-entries', path, 'table has no entries');
  }
  if (def.kind === 'weighted') return rollWeighted(def, rng, path);
  if (def.kind === 'ranged') return rollRanged(def, rng, path);
  return rollNested(def, rng, depth, path, resolve);
}

function rollWeighted(def: TableDef, rng: RandomSource, path: string): TableOutcome {
  const weights: number[] = [];
  let total = 0;
  for (const [index, entry] of def.entries.entries()) {
    if (!Number.isInteger(entry.weight) || (entry.weight ?? 0) < 1) {
      return fail('malformed-entries', `${path}.entries[${index}]`, `weighted entries need an integer weight >= 1, got ${entry.weight}`);
    }
    const weight = entry.weight as number;
    weights.push(weight);
    total += weight;
  }
  const selected = selectIndex(weights, total, rng);
  const entry = def.entries[selected];
  if (!entry) return fail('malformed-entries', path, 'weighted selection left the entry range');
  return { ok: true, value: entry.value };
}

function rollRanged(def: TableDef, rng: RandomSource, path: string): TableOutcome {
  for (const [index, entry] of def.entries.entries()) {
    const { min, max } = entry;
    if (!Number.isInteger(min) || !Number.isInteger(max) || (min as number) > (max as number)) {
      return fail('malformed-entries', `${path}.entries[${index}]`, `ranged entries need integers min <= max, got ${min}..${max}`);
    }
  }
  const face = rng.int(100) + 1;
  for (const entry of def.entries) {
    if ((entry.min as number) <= face && face <= (entry.max as number)) {
      return { ok: true, value: entry.value };
    }
  }
  return fail('range-gap', path, `d100 roll ${face} falls in no declared range`);
}

function rollNested(def: TableDef, rng: RandomSource, depth: number, path: string, resolve?: TableResolver): TableOutcome {
  const weights: number[] = [];
  let total = 0;
  for (const [index, entry] of def.entries.entries()) {
    if (entry.weight !== undefined && (!Number.isInteger(entry.weight) || entry.weight < 1)) {
      return fail('malformed-entries', `${path}.entries[${index}]`, `nested entry weights need an integer >= 1, got ${entry.weight}`);
    }
    const weight = entry.weight ?? 1;
    weights.push(weight);
    total += weight;
  }
  const selected = selectIndex(weights, total, rng);
  const entry = def.entries[selected];
  if (!entry) return fail('malformed-entries', path, 'nested selection left the entry range');
  const childPath = `${path}->entries[${selected}]`;
  if (depth + 1 > MAX_TABLE_DEPTH) {
    return fail('depth-exceeded', childPath, `nesting exceeds MAX_TABLE_DEPTH (${MAX_TABLE_DEPTH})`);
  }
  if (!resolve) {
    return fail('unresolvable-ref', `${path}.entries[${selected}]`, 'nested table roll requires a resolver');
  }
  const referenced = resolve(entry.value);
  if (!referenced) {
    return fail('unresolvable-ref', `${path}.entries[${selected}]`, `nested table reference did not resolve`);
  }
  return rollAt(referenced, rng, depth + 1, childPath, resolve);
}

/** Walk a cumulative weight table; draw is uniform over total (integers only). */
function selectIndex(weights: number[], total: number, rng: RandomSource): number {
  let draw = rng.int(total);
  for (const [index, weight] of weights.entries()) {
    draw -= weight;
    if (draw < 0) return index;
  }
  return weights.length - 1; // unreachable: weights are integers >= 1 summing to total
}

function fail(reason: TableFailureReason, jsonPath: string, message: string): TableOutcome {
  return { ok: false, failure: { reason, jsonPath, message } };
}