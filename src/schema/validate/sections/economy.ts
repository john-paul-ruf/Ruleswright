/**
 * The optional economy section (v1.1): the turnSlots grant table. When present,
 * action/spell cost slot keys must resolve to these names (checked in helpers'
 * cost resolution); when absent, slot names are pack-free at validation and the
 * engine's documented per-cost default applies at play time.
 */
import { makeErrorCard } from '../../error-card';
import type { Ctx } from '../context';
import { ID_PATTERN, add, forbidUnknown, isInteger, isPlainObject, reqFields } from '../helpers';

export function checkEconomy(ctx: Ctx, value: unknown): void {
  if (value === undefined) return; // optional (v1.1): absence = documented engine default at play time
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'economy',
        'economy',
        'economy must be an object with a turnSlots grant table.',
      ),
    );
    return;
  }
  reqFields(ctx, value, ['turnSlots'], 'economy', 'economy');
  forbidUnknown(ctx, value, ['turnSlots'], 'economy', 'economy');
  const turnSlots = value['turnSlots'];
  if (!isPlainObject(turnSlots) || Object.keys(turnSlots).length < 1) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'economy',
        'economy.turnSlots',
        'economy.turnSlots must be an object with at least one slot name -> integer >= 1.',
      ),
    );
    return;
  }
  for (const [name, count] of Object.entries(turnSlots)) {
    if (!ID_PATTERN.test(name)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          'economy',
          `economy.turnSlots.${name}`,
          `slot name "${name}" must match ^[a-z][a-z0-9-]*$.`,
        ),
      );
    }
    if (!isInteger(count) || count < 1) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          'economy',
          `economy.turnSlots.${name}`,
          `economy.turnSlots.${name} must be an integer >= 1 (slots granted per turn).`,
        ),
      );
    }
  }
}
