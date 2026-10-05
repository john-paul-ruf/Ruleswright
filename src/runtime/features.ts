/**
 * M03 — class features (FR-6, contract v1.10, DD-C1…C9). A leaf: type imports only.
 * A feature `{level, ref}` at `progression.<classId>.features` grants a feat or unlocks an
 * action or spell while the character's level in that class is >= level. Derived, never stored.
 */
import type { Pack } from '../schema/pack';
import type { Runtime } from './runtime';
import type { ClassEntry } from './character';

export interface ClassFeatureView {
  readonly classId: string;
  readonly level: number;
  readonly ref: string;
  readonly kind: 'feat' | 'action' | 'spell';
  readonly active: boolean;
}

/** CA-C2 — the map that declares `ref` decides its kind: feats, then actions, then spells. */
function featureKind(pack: Pack, ref: string): ClassFeatureView['kind'] | undefined {
  if (pack.content.feats?.[ref] !== undefined) return 'feat';
  if (pack.actions[ref] !== undefined) return 'action';
  if (pack.content.spells?.[ref] !== undefined) return 'spell';
  return undefined;
}

/**
 * DD-C7 — a character's class features, active or not, in DD-C5 order (class order, then
 * feature order). A ref no map declares is skipped: a loaded pack has none (CA-C2).
 */
export function classFeatures(
  runtime: Runtime,
  character: { readonly classes: readonly ClassEntry[] },
): readonly ClassFeatureView[] {
  const views: ClassFeatureView[] = [];
  for (const entry of character.classes) {
    for (const feature of runtime.pack.progression[entry.id]?.features ?? []) {
      const kind = featureKind(runtime.pack, feature.ref);
      if (kind === undefined) continue;
      views.push({
        classId: entry.id,
        level: feature.level,
        ref: feature.ref,
        kind,
        active: entry.level >= feature.level,
      });
    }
  }
  return views;
}

/** The active refs of one kind, DD-C5 order, first occurrence wins. */
function activeRefs(
  runtime: Runtime,
  classes: readonly ClassEntry[],
  kind: ClassFeatureView['kind'],
): readonly string[] {
  const refs: string[] = [];
  for (const view of classFeatures(runtime, { classes })) {
    if (view.active && view.kind === kind && !refs.includes(view.ref)) refs.push(view.ref);
  }
  return refs;
}

/** DD-C2 — feats the character's classes grant now. Never stored, never slotted. */
export function grantedFeats(runtime: Runtime, classes: readonly ClassEntry[]): readonly string[] {
  return activeRefs(runtime, classes, 'feat');
}

/** DD-C8 — actions the character's classes unlock now (declarable in combat). */
export function unlockedActions(runtime: Runtime, classes: readonly ClassEntry[]): readonly string[] {
  return activeRefs(runtime, classes, 'action');
}

/** DD-C8 — spells the character's classes unlock now (known). */
export function unlockedSpells(runtime: Runtime, classes: readonly ClassEntry[]): readonly string[] {
  return activeRefs(runtime, classes, 'spell');
}
