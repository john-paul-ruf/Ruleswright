/**
 * Pass 1 — the tolerant id-collection sweep. Builds every id namespace and the
 * declared-tag set so cross-references resolve regardless of section order;
 * unreadable containers are recorded as null and dependent checks skip
 * (cascade avoidance), never false-positive.
 */
import type { Ctx } from './context';
import { ID_PATTERN, isPlainObject } from './helpers';

export function collectContext(doc: Record<string, unknown>, ctx: Ctx): void {
  const stats = doc['stats'];
  if (isPlainObject(stats)) {
    ctx.abilityIds = collectKebabList(stats['abilities']);
    ctx.saveIds = collectKebabList(stats['saves']);
  }
  const actions = doc['actions'];
  if (isPlainObject(actions)) {
    const actionIds = new Set<string>();
    for (const [id, def] of Object.entries(actions)) {
      if (ID_PATTERN.test(id)) actionIds.add(id);
      if (!isPlainObject(def)) {
        ctx.tagsTrusted = false;
      } else if (def['tags'] !== undefined) {
        collectTagsInto(ctx, def['tags']);
      }
    }
    ctx.actionIds = actionIds;
  }
  const formulas = doc['formulas'];
  if (isPlainObject(formulas)) {
    const formulaIds = new Set<string>();
    for (const id of Object.keys(formulas)) formulaIds.add(id);
    ctx.formulaIds = formulaIds;
  }
  const content = doc['content'];
  if (isPlainObject(content)) {
    const classes = content['classes'];
    if (isPlainObject(classes)) {
      const classIds = new Set<string>();
      for (const id of Object.keys(classes)) if (ID_PATTERN.test(id)) classIds.add(id);
      ctx.classIds = classIds;
    }
    const spells = content['spells'];
    if (isPlainObject(spells)) {
      for (const def of Object.values(spells)) {
        if (!isPlainObject(def)) {
          ctx.tagsTrusted = false;
        } else if (def['tags'] !== undefined) {
          collectTagsInto(ctx, def['tags']);
        }
      }
    }
  } else {
    ctx.tagsTrusted = false;
  }
  const economy = doc['economy'];
  if (economy !== undefined) {
    if (isPlainObject(economy) && isPlainObject(economy['turnSlots'])) {
      const names = new Set<string>();
      for (const name of Object.keys(economy['turnSlots'])) if (ID_PATTERN.test(name)) names.add(name);
      ctx.economySlotNames = names;
    }
  }
  const progression = doc['progression'];
  if (progression === undefined) {
    ctx.progressionIds = new Set(); // absent section = empty namespace: E-REF-03 fires per declared class
  } else if (isPlainObject(progression)) {
    const progressionIds = new Set<string>();
    for (const id of Object.keys(progression)) if (ID_PATTERN.test(id)) progressionIds.add(id);
    ctx.progressionIds = progressionIds;
  } else {
    ctx.progressionIds = null;
  }
  const tables = doc['tables'];
  if (isPlainObject(tables)) {
    ctx.tablesDoc = tables;
    const tableIds = new Set<string>();
    for (const id of Object.keys(tables)) if (ID_PATTERN.test(id)) tableIds.add(id);
    ctx.tableIds = tableIds;
  } else {
    ctx.tableIds = null;
  }
}

function collectKebabList(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;
  const set = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string' || !ID_PATTERN.test(entry)) return null;
    set.add(entry);
  }
  return set;
}

function collectTagsInto(ctx: Ctx, value: unknown): void {
  if (!Array.isArray(value)) {
    ctx.tagsTrusted = false;
    return;
  }
  for (const tag of value) {
    if (typeof tag !== 'string' || !ID_PATTERN.test(tag)) {
      ctx.tagsTrusted = false;
      return;
    }
    ctx.declaredTags.add(tag);
  }
}
