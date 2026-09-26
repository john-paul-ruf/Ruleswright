/**
 * Override application (FR-19) — merged at load: after base-pack load validation
 * and before final validation of the merged document (database.md merge discipline),
 * so an override can never smuggle in a structurally invalid pack. The caller
 * revalidates the merged pack; applyOverrides itself never validates.
 *
 * Patch keys are dotted paths into the target artifact (override.schema.json,
 * e.g. target "barrow-wight", patch "actions.claw.onHit"); values are replacement
 * scalars/objects, deep-merged per key in array order.
 */
import type { ErrorCard } from './error-card';
import { makeErrorCard } from './error-card';
import type { Pack } from './pack';
import { nearestIds } from './validate';

/** The override document shape (override.schema.json, schemaVersion 1). */
export interface OverrideDocument {
  overrides: ReadonlyArray<{ target: string; patch: Record<string, unknown> }>;
}

/**
 * Apply an override document to a pack, in array order. Returns the merged pack
 * plus E-OVR-01 cards for unknown targets (nearest-id hint per the error design);
 * unknown targets are skipped, never silently misapplied.
 */
export function applyOverrides(pack: Pack, doc: OverrideDocument): { pack: Pack; errors: ErrorCard[] } {
  const errors: ErrorCard[] = [];
  const merged = structuredClone(pack) as unknown as Record<string, unknown>;
  const sectionByArtifact = buildArtifactIndex(pack);

  for (const [index, entry] of doc.overrides.entries()) {
    const section = sectionByArtifact.get(entry.target);
    if (section === undefined) {
      errors.push(
        makeErrorCard(
          'E-OVR-01',
          entry.target,
          `overrides[${index}].target`,
          `override targets "${entry.target}", which is not an artifact id in this pack.`,
          nearestHint(entry.target, sectionByArtifact),
        ),
      );
      continue;
    }
    for (const [key, value] of Object.entries(entry.patch)) {
      const path = key.startsWith(`${section}.`) ? key : `${section}.${entry.target}.${key}`;
      applyDotted(merged, path, value);
    }
  }
  return { pack: merged as unknown as Pack, errors };
}

/**
 * The artifact-id → section index. Artifact ids are unique pack-wide (E-DUP-01),
 * so the first section holding an id is authoritative. The manifest id is its own
 * artifact; name-keyed vocabularies (stats.abilities/saves) are not artifacts.
 */
function buildArtifactIndex(pack: Pack): Map<string, string> {
  const index = new Map<string, string>();
  const put = (section: string, ids: readonly string[] | undefined): void => {
    for (const id of ids ?? []) if (!index.has(id)) index.set(id, section);
  };
  index.set(pack.manifest.id, 'manifest');
  put('actions', Object.keys(pack.actions));
  put('formulas', Object.keys(pack.formulas));
  put('content.classes', Object.keys(pack.content.classes ?? {}));
  put('content.races', Object.keys(pack.content.races ?? {}));
  put('content.skills', Object.keys(pack.content.skills ?? {}));
  put('content.feats', Object.keys(pack.content.feats ?? {}));
  put('content.spells', Object.keys(pack.content.spells ?? {}));
  put('content.conditions', Object.keys(pack.content.conditions ?? {}));
  put('content.items', Object.keys(pack.content.items ?? {}));
  put('bestiary', Object.keys(pack.bestiary));
  put('tables', Object.keys(pack.tables));
  return index;
}

/** Nearest artifact ids by edit distance — the E-OVR-01 hint design ("nearest ids", mocks/validation-errors.html). */
function nearestHint(target: string, index: Map<string, string>): string {
  const ids = [...index.keys()].filter((id) => id !== target);
  const near = nearestIds(target, ids, 3);
  return near.length > 0
    ? `nearest ids: ${near.map((id) => `"${id}"`).join(', ')}`
    : 'no other artifacts exist in this pack';
}

/**
 * Deep-merge `value` into `root` at a dotted path, creating plain-object steps as
 * needed. A non-object step on the way makes the path unresolvable and the write
 * is skipped — the merged document's revalidation reports the structural truth
 * (FR-2 holds for merged packs: an invalid result yields cards, never a throw).
 */
function applyDotted(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    const next = cursor[part];
    if (next === undefined || next === null || typeof next !== 'object' || Array.isArray(next)) {
      cursor[part] = {};
      cursor = cursor[part] as Record<string, unknown>;
    } else {
      cursor = next as Record<string, unknown>;
    }
  }
  const leaf = parts[parts.length - 1]!;
  const existing = cursor[leaf];
  cursor[leaf] = isMergeable(existing) && isMergeable(value) ? deepMerge(existing, value) : value;
}

function isMergeable(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    out[key] =
      isMergeable(out[key]) && isMergeable(value)
        ? deepMerge(out[key] as Record<string, unknown>, value)
        : value;
  }
  return out;
}
