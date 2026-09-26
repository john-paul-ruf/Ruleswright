/**
 * The compiler's one failure shape (PROGRAM-CONFIG: one ErrorCard shape
 * everywhere). `GenerationError` aggregates the ErrorCards a failed generation
 * produced — theme-shape rejections from the stages, knob rejections, and any
 * cards stage 8 (schema.validatePack, CA-1) returns. Throwing mirrors the
 * runtime's PackLoadError discipline: a failed campaign is never partially
 * returned (FR-2).
 */
import { makeErrorCard, type ErrorCard, type RuleId } from '../schema/error-card';

export class GenerationError extends Error {
  readonly errors: readonly ErrorCard[];

  constructor(errors: readonly ErrorCard[]) {
    super(
      `campaign generation failed with ${errors.length} error card(s) — first: ${errors[0]?.rule} ${errors[0]?.message}`,
    );
    this.name = 'GenerationError';
    this.errors = errors;
  }
}

/** A card located inside the theme template (theme-relative jsonPath, artifact = the theme). */
export function themeCard(
  rule: RuleId,
  artifactId: string,
  jsonPath: string,
  message: string,
  hint?: string,
): ErrorCard {
  return makeErrorCard(rule, artifactId, jsonPath, message, hint);
}

/** Reject a theme defect immediately with one located card. */
export function rejectTheme(jsonPath: string, message: string, hint?: string): never {
  throw new GenerationError([themeCard('E-SCHEMA-01', '(theme)', jsonPath, message, hint)]);
}
