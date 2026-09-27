/**
 * One error shape everywhere (FR-2, PROGRAM-CONFIG Conventions): severity stripe,
 * located artifact, stated rule, a hint. Acceptance shapes: mocks/validation-errors.html.
 */

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorCard {
  severity: ErrorSeverity;
  /** Id of the offending artifact; the owning section name for section-level errors, "(pack)" for document-level ones. */
  artifactId: string;
  /** Dot path from the pack root; array entries use bracket indices ("content.classes.warden.features[0].level"). */
  jsonPath: string;
  /** Registered rule id (see RULE_IDS). */
  rule: string;
  message: string;
  /** What makes the failure fixable — nearest ids, known names, the documented default. */
  hint?: string;
}

const RULE_ID_TUPLE = [
  'E-SCHEMA-01',
  'E-SCHEMA-02',
  'E-DUP-01',
  'E-REF-01',
  'E-REF-02',
  'E-REF-03',
  'E-FORM-01',
  'E-FORM-02',
  'E-FORM-03',
  'E-ECON-01',
  'E-TBL-01',
  'E-OVR-01',
  'E-SNAP-01',
  'E-SNAP-02',
  'E-SPAT-01',
] as const;

/**
 * Rule-id registry — the DB's enumeration, verbatim (specs/database.md,
 * ErrorCard Rule Registry). FREEZE: additive-only. Adding ids is a compatible
 * minor event; renumbering or retiring a shipped id is a major schema event
 * (database.md Versioning discipline). W-* / I-* prefixes are reserved; v1
 * registers none.
 *
 * E-SNAP-01/-02 are registered here but enforced by runtime/snapshots.ts (S06).
 * E-SPAT-01 (v1.3, additive minor) is registered here and enforced by the
 * pack validator's spatial section plus the runtime's spatial gate (S03).
 */
export const RULE_IDS: readonly RuleId[] = Object.freeze(RULE_ID_TUPLE);

export type RuleId = (typeof RULE_ID_TUPLE)[number];

/** Every card v1 emits is an error; the severity field exists for additive warning and info growth. */
export function makeErrorCard(
  rule: RuleId,
  artifactId: string,
  jsonPath: string,
  message: string,
  hint?: string,
): ErrorCard {
  return { severity: 'error', artifactId, jsonPath, rule, message, ...(hint !== undefined ? { hint } : {}) };
}
