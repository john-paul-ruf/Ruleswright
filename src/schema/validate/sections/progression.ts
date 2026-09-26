/**
 * The progression section: per-class tables keyed BY class id (each entry is
 * the class’s own table, not a second artifact). Owns the XOR rule — exactly
 * one attack convention (attackTable or attackBonus) per class — plus hd dice,
 * save progressions, and vancian slot tables.
 */
import type { Ctx } from '../context';
import { makeErrorCard } from '../../error-card';
import {
  ID_PATTERN,
  HD_DICE,
  add,
  isPlainObject,
  isInteger,
  reqFields,
  forbidUnknown,
  checkDslField,
  nearestId,
  checkIntegerArray,
} from '../helpers';

/** Attack-table rows span levels 1..10 (documented bound). */
const MAX_ATTACK_TABLE_LEVEL = 10;

export function checkProgression(ctx: Ctx, value: unknown): void {
  if (value === undefined) return; // absence handled by root + E-REF-03
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'progression',
        'progression',
        'progression must be an object keyed by class id.',
      ),
    );
    return;
  }
  for (const [classId, prog] of Object.entries(value)) {
    const basePath = `progression.${classId}`;
    if (!ID_PATTERN.test(classId)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          classId,
          basePath,
          `progression map key "${classId}" must match ^[a-z][a-z0-9-]*$.`,
        ),
      );
      continue;
    }
    // progression is keyed BY class id — it is the class's own table, not a second artifact; pairing is E-REF-03's duty
    if (!isPlainObject(prog)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', classId, basePath, 'progression entry must be an object.'));
      continue;
    }
    reqFields(ctx, prog, ['hd', 'saves'], classId, basePath);
    forbidUnknown(ctx, prog, ['hd', 'attackTable', 'attackBonus', 'saves', 'slots'], classId, basePath);
    const hd = prog['hd'];
    if (hd !== undefined && !HD_DICE.includes(hd as string)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', classId, `${basePath}.hd`, `hd must be one of ${HD_DICE.join(' | ')}.`),
      );
    }
    // XOR rule (FR-3): exactly one attack convention per class.
    const hasTable = prog['attackTable'] !== undefined;
    const hasBonus = prog['attackBonus'] !== undefined;
    if (hasTable && hasBonus) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          classId,
          basePath,
          'progression declares both attackTable and attackBonus — exactly one attack convention per class (XOR rule, FR-3).',
        ),
      );
    } else if (!hasTable && !hasBonus) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          classId,
          basePath,
          'progression declares neither attackTable nor attackBonus — exactly one attack convention per class is required (XOR rule, FR-3).',
        ),
      );
    }
    if (hasTable) {
      checkAttackTable(ctx, prog['attackTable'], classId, `${basePath}.attackTable`);
    }
    if (hasBonus) {
      checkDslField(ctx, prog['attackBonus'], 'attackBonus', classId, `${basePath}.attackBonus`);
    }
    const saves = prog['saves'];
    if (isPlainObject(saves)) {
      if (Object.keys(saves).length < 1) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            classId,
            `${basePath}.saves`,
            'saves must declare at least one save progression (minProperties 1).',
          ),
        );
      }
      for (const [saveName, values] of Object.entries(saves)) {
        checkIntegerArray(
          ctx,
          values,
          classId,
          `${basePath}.saves.${saveName}`,
          `save progression "${saveName}"`,
        );
        if (ctx.saveIds !== null && !ctx.saveIds.has(saveName)) {
          const near = nearestId(saveName, ctx.saveIds);
          add(
            ctx,
            makeErrorCard(
              'E-REF-01',
              classId,
              `${basePath}.saves.${saveName}`,
              `progression save "${saveName}" is not declared in stats.saves — the pack declares which saves exist (FR-5).`,
              near === undefined
                ? `declared saves: ${[...(ctx.saveIds ?? [])].sort().join(', ') || '(none)'}`
                : `did you mean "${near}"?`,
            ),
          );
        }
      }
    }
    const slots = prog['slots'];
    if (slots !== undefined) {
      if (!isPlainObject(slots)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            classId,
            `${basePath}.slots`,
            'slots must be an object spellLevel -> per-class-level slot counts.',
          ),
        );
      } else {
        for (const [level, values] of Object.entries(slots)) {
          checkIntegerArray(
            ctx,
            values,
            classId,
            `${basePath}.slots.${level}`,
            `vancian slot table for spell level ${level}`,
            0,
          );
        }
      }
    }
  }
}

function checkAttackTable(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
  if (!Array.isArray(value) || value.length < 1) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        basePath,
        'attackTable must be a non-empty array of {level, byDefense} rows.',
      ),
    );
    return;
  }
  for (const [index, row] of value.entries()) {
    const rowPath = `${basePath}[${index}]`;
    if (!isPlainObject(row)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          rowPath,
          'attack table row must be an object {level, byDefense}.',
        ),
      );
      continue;
    }
    reqFields(ctx, row, ['level', 'byDefense'], artifactId, rowPath);
    forbidUnknown(ctx, row, ['level', 'byDefense'], artifactId, rowPath);
    const level = row['level'];
    if (level !== undefined && (!isInteger(level) || level < 1 || level > MAX_ATTACK_TABLE_LEVEL)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${rowPath}.level`,
          `attack table level must be an integer in 1..${MAX_ATTACK_TABLE_LEVEL}.`,
        ),
      );
    }
    const byDefense = row['byDefense'];
    if (byDefense !== undefined) {
      if (!isPlainObject(byDefense) || Object.keys(byDefense).length < 1) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            artifactId,
            `${rowPath}.byDefense`,
            'byDefense must be an object with at least one defenseValue -> toHit entry.',
          ),
        );
      } else {
        for (const [defense, toHit] of Object.entries(byDefense)) {
          if (!isInteger(toHit)) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                artifactId,
                `${rowPath}.byDefense.${defense}`,
                'byDefense values (to-hit) must be integers; defense keys are pack convention (FR-3).',
              ),
            );
          }
        }
      }
    }
  }
}
