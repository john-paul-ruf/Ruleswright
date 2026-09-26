/**
 * FR-18 — theme knobs: declared by the theme (id/type/range-or-values/default/
 * desc), validated against the caller's values, defaults filled from the
 * declaration, and every final value recorded in the pack's provenance
 * (`manifest.provenance.knobs` exactly — no other keys, FR-18/CA-5).
 *
 * Stage inputs reference knob values with the token `#knob/<id>`, resolved
 * here before stages run: a stage reads resolved theme data, never the raw
 * declaration. Unknown knob values and out-of-range/out-of-vocabulary values
 * are typed rejections (GenerationError), named like the build validators.
 */
import type { ErrorCard } from '../schema/error-card';
import type { KnobDecl, ThemeTemplate } from './theme';
import { GenerationError, themeCard } from './errors';

/** A knob value the theme's declaration does not know. */
export interface KnobRejection {
  rule: 'unknown-knob' | 'bad-knob-value';
  knob: string;
  message: string;
  hint?: string;
}

/** A declaration joined with its map key — the machine-readable form (FR-18). */
export type KnobDeclWithId = KnobDecl & { id: string };

/** Machine-readable knob declarations (FR-18) — the host renders a form from this alone. */
export function listThemeKnobs(theme: ThemeTemplate): readonly KnobDeclWithId[] {
  return Object.entries(theme.knobs ?? {}).map(([id, decl]) => ({ id, ...decl }));
}

/**
 * Validate caller knob values against the theme's declarations, fill defaults,
 * and return the resolved map (the provenance record's `knobs` value, verbatim).
 */
export function resolveKnobs(
  theme: ThemeTemplate,
  caller?: Readonly<Record<string, unknown>>,
): Record<string, string | number> {
  const declared = listThemeKnobs(theme);
  const rejections: ErrorCard[] = [];
  const resolved: Record<string, string | number> = {};
  const callerKeys = Object.keys(caller ?? {});

  for (const decl of declared) {
    const given = caller?.[decl.id];
    if (given === undefined) {
      resolved[decl.id] = decl.default;
      continue;
    }
    const failure = validateValue(decl, given);
    if (failure !== undefined) {
      rejections.push(knobCard(failure));
      continue;
    }
    resolved[decl.id] = given as string | number;
  }
  for (const key of callerKeys) {
    if (!declared.some((decl) => decl.id === key)) {
      const near = nearestDecl(
        key,
        declared.map((decl) => decl.id),
      );
      rejections.push(
        knobCard({
          rule: 'unknown-knob',
          knob: key,
          message: `unknown knob "${key}" — the theme declares: [${declared.map((decl) => decl.id).join(', ') || '(none)'}].`,
          hint: near === undefined ? undefined : `did you mean "${near}"?`,
        }),
      );
    }
  }
  if (rejections.length > 0) throw new GenerationError(rejections);
  return resolved;
}

function validateValue(decl: KnobDeclWithId, value: unknown): KnobRejection | undefined {
  if (decl.type === 'enum') {
    if (typeof value !== 'string' || !decl.values?.includes(value)) {
      return {
        rule: 'bad-knob-value',
        knob: decl.id,
        message: `knob "${decl.id}" takes one of [${(decl.values ?? []).join(', ')}], got ${JSON.stringify(value) ?? String(value)}.`,
      };
    }
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return {
      rule: 'bad-knob-value',
      knob: decl.id,
      message: `knob "${decl.id}" is a range knob and needs an integer, got ${JSON.stringify(value) ?? String(value)}.`,
    };
  }
  if (decl.min !== undefined && value < decl.min) {
    return {
      rule: 'bad-knob-value',
      knob: decl.id,
      message: `knob "${decl.id}" must be >= ${decl.min}, got ${value}.`,
    };
  }
  if (decl.max !== undefined && value > decl.max) {
    return {
      rule: 'bad-knob-value',
      knob: decl.id,
      message: `knob "${decl.id}" must be <= ${decl.max}, got ${value}.`,
    };
  }
  return undefined;
}

function knobCard(rejection: KnobRejection): ErrorCard {
  return themeCard(
    'E-SCHEMA-01',
    rejection.knob,
    `knobs.${rejection.knob}`,
    rejection.message,
    rejection.hint,
  );
}

function nearestDecl(target: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = editDistance(target, candidate);
    if (distance < bestDistance || (distance === bestDistance && best !== undefined && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (previous[j] ?? i) + 1,
        (current[j - 1] ?? i) + 1,
        (previous[j - 1] ?? i - 1) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous[j] = current[j]!;
    }
  }
  return previous[b.length] ?? a.length;
}
