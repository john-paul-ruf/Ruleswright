/**
 * The actions section: every declared action's id grammar, required/forbidden
 * fields, DSL strings, tags, cost, and trigger. Action ids register in the
 * global uniqueness namespace; their `tags` arrays feed pass 1's declared-tag
 * set (consumed by the v1.1 restricts-integrity check).
 */
import { makeErrorCard } from '../../error-card';
import type { Ctx } from '../context';
import {
  ID_PATTERN,
  add,
  checkCost,
  checkDslField,
  checkTagsField,
  checkTrigger,
  forbidUnknown,
  isPlainObject,
  registerId,
  reqFields,
} from '../helpers';

export function checkActions(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', 'actions', 'actions', 'actions must be an object keyed by action id.'),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `actions.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `action map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'action definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['cost', 'effect'], id, basePath);
    forbidUnknown(ctx, def, ['cost', 'valid', 'trigger', 'effect', 'tags'], id, basePath);
    if (def['id'] !== undefined && def['id'] !== id) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-02',
          id,
          `${basePath}.id`,
          `definition repeats id ${JSON.stringify(def['id'])} under map key "${id}" — the map key is the id (map-as-namespace).`,
        ),
      );
    }
    checkDslField(ctx, def['effect'], 'effect', id, `${basePath}.effect`);
    checkDslField(ctx, def['valid'], 'valid', id, `${basePath}.valid`);
    checkTagsField(ctx, def['tags'], id, `${basePath}.tags`);
    checkCost(ctx, def['cost'], id, `${basePath}.cost`);
    checkTrigger(ctx, def['trigger'], id, `${basePath}.trigger`, 1);
  }
}
