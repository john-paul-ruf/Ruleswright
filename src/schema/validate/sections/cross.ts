/**
 * Cross-section checks that run after every section pass: progression/class
 * pairing (E-REF-03) and the v1.1 restricts-tag integrity (E-REF-01).
 */
import type { Ctx } from '../context';
import { makeErrorCard } from '../../error-card';
import { ID_PATTERN, RESTRICTS_PREFIX, add, isPlainObject, nearestId } from '../helpers';

export function checkProgressionPairing(ctx: Ctx): void {
  if (ctx.progressionIds === null) return; // progression container unreadable — the structural card is already emitted
  for (const classId of ctx.classIds ?? []) {
    if (!ctx.progressionIds.has(classId)) {
      const near = nearestId(classId, ctx.progressionIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-03',
          classId,
          `progression.${classId}`,
          `class "${classId}" is declared in content.classes but has no progression entry — progression is required for every declared class.`,
          near === undefined ? undefined : `did you mean "${near}"?`,
        ),
      );
    }
  }
  if (ctx.classIds === null) return; // classes container unreadable — the structural card is already emitted
  for (const classId of ctx.progressionIds) {
    if (!ctx.classIds.has(classId)) {
      const near = nearestId(classId, ctx.classIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-03',
          classId,
          `progression.${classId}`,
          `orphaned progression for "${classId}" — no class with this id is declared in content.classes.`,
          near === undefined ? undefined : `did you mean "${near}"?`,
        ),
      );
    }
  }
}

/** v1.1 tag integrity: a condition restricts pattern "actions.tagged:<tag>" must reference a tag declared on at least one action or spell (E-REF-01). */
export function checkRestrictsTags(ctx: Ctx, content: unknown): void {
  if (!ctx.tagsTrusted) return; // declared-tag set unreliable — integrity stays silent rather than false-positive
  if (!isPlainObject(content)) return;
  const conditions = content['conditions'];
  if (!isPlainObject(conditions)) return;
  for (const [id, def] of Object.entries(conditions)) {
    if (!isPlainObject(def) || def['restricts'] === undefined) continue;
    const restricts = def['restricts'];
    if (!Array.isArray(restricts)) continue; // type card already emitted in pass 2
    for (const [index, pattern] of restricts.entries()) {
      if (typeof pattern !== 'string' || !pattern.startsWith(RESTRICTS_PREFIX)) continue;
      const tag = pattern.slice(RESTRICTS_PREFIX.length);
      if (tag.length === 0 || !ID_PATTERN.test(tag)) continue; // non-tag patterns belong to the runtime matcher, not this integrity rule
      if (!ctx.declaredTags.has(tag)) {
        const near = nearestId(tag, ctx.declaredTags);
        add(
          ctx,
          makeErrorCard(
            'E-REF-01',
            id,
            `content.conditions.${id}.restricts[${index}]`,
            `condition "${id}" restricts pattern "${pattern}" names tag "${tag}", which no action or spell declares — a condition that can never bite is a broken reference, not a silent no-op (v1.1 tag integrity).`,
            near === undefined
              ? `declared tags: ${[...ctx.declaredTags].sort().join(', ') || '(none)'}`
              : `did you mean "${near}"?`,
          ),
        );
      }
    }
  }
}
