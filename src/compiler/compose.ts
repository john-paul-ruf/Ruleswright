/**
 * FR-20 — theme composition: a theme may declare a base theme plus patches
 * (`add` / `remove` / `merge` at pointer paths); merge semantics are
 * documented and deterministic. This is the same merge model as the GM
 * override layer (FR-19) one level up — one merge model, learned once
 * (theme-knobs.html's winter-march anatomy).
 *
 * `add` sets the path's value (path must not already exist — a blind overwrite
 * is `merge`'s job); `remove` deletes the path's key; `merge` deep-merges
 * object values and replaces scalars/arrays, creating missing object
 * containers on the way (S01's applyDotted semantics). Patches apply in array
 * order. Unknown base ids are typed rejections. The shipped sample themes
 * stand alone (D1) — composition is exercised by tests regardless.
 */
import type { ErrorCard, RuleId } from '../schema/error-card';
import { GenerationError, themeCard } from './errors';
import type { ThemePatch, ThemeTemplate } from './theme';

/** A patch whose path does not resolve as the op requires. */
function patchCard(rule: RuleId, index: number, jsonPath: string, message: string, hint?: string): ErrorCard {
  return themeCard(rule, '(theme)', `patches[${index}].${jsonPath}`, message, hint);
}

/** Compose a derived theme from its base + patches. Both templates are caller-supplied; the base is read-only. */
export function composeTheme(derived: ThemeTemplate, base: ThemeTemplate): ThemeTemplate {
  if (derived.base !== undefined && derived.base !== base.id) {
    throw new GenerationError([
      themeCard('E-OVR-01', '(theme)', 'base', `theme "${derived.id}" declares base "${derived.base}", which does not match the supplied base template "${base.id}".`),
    ]);
  }
  const composed = structuredClone(base) as unknown as Record<string, unknown>;
  composed['id'] = derived.id;
  composed['title'] = derived.title;
  composed['base'] = base.id;
  if (derived.knobs !== undefined) composed['knobs'] = structuredClone(derived.knobs);

  const patches = derived.patches ?? [];
  for (const [index, patch] of patches.entries()) {
    applyPatch(composed, patch, index);
  }
  return composed as unknown as ThemeTemplate;
}

/** One patch, applied to a plain root in place — the shared merge model (FR-19's vocabulary, one level up). */
export function readPatch(root: Record<string, unknown>, patch: ThemePatch, index: number): void {
  applyPatch(root, patch, index);
}

function applyPatch(root: Record<string, unknown>, patch: ThemePatch, index: number): void {
  const segments = pointerSegments(patch.path, index);
  const parent = resolveParent(root, segments, index);
  const leaf = segments[segments.length - 1]!;
  switch (patch.op) {
    case 'add': {
      if (parent[leaf] !== undefined) {
        throw new GenerationError([patchCard('E-OVR-01', index, 'path', `add path "${patch.path}" already exists — "merge" is the overwriting op.`)]);
      }
      parent[leaf] = structuredClone(patch.value);
      return;
    }
    case 'remove': {
      if (parent[leaf] === undefined) {
        throw new GenerationError([patchCard('E-OVR-01', index, 'path', `remove path "${patch.path}" does not exist in the composed theme.`)]);
      }
      delete parent[leaf];
      return;
    }
    case 'merge': {
      if (patch.value === undefined) {
        throw new GenerationError([patchCard('E-SCHEMA-01', index, 'value', `merge patch "${patch.path}" needs a value.`)]);
      }
      parent[leaf] = mergeValue(parent[leaf], patch.value);
      return;
    }
  }
}

/** '/'-joined pointer segments ("/content/conditions/frostbitten" → [content, conditions, frostbitten]). */
function pointerSegments(path: string, index: number): readonly string[] {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    throw new GenerationError([patchCard('E-OVR-01', index, 'path', `patch path "${path}" is empty — point it at a theme field.`)]);
  }
  return segments;
}

/** Walk to the leaf's parent, creating missing object containers (override-merge semantics, FR-19). */
function resolveParent(root: Record<string, unknown>, segments: readonly string[], index: number): Record<string, unknown> {
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]!;
    const next = cursor[segment];
    if (next === undefined) {
      cursor[segment] = {};
      cursor = cursor[segment] as Record<string, unknown>;
      continue;
    }
    if (next === null || typeof next !== 'object' || Array.isArray(next)) {
      throw new GenerationError([patchCard('E-OVR-01', index, 'path', `patch path "${segments.join('/')}" descends through "${segment}", which is not an object.`)]);
    }
    cursor = next as Record<string, unknown>;
  }
  return cursor;
}

function mergeValue(existing: unknown, value: unknown): unknown {
  if (isMergeable(existing) && isMergeable(value)) {
    const out: Record<string, unknown> = { ...existing };
    for (const [key, patchEntry] of Object.entries(value)) {
      out[key] = mergeValue(out[key], patchEntry);
    }
    return out;
  }
  return structuredClone(value);
}

function isMergeable(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}