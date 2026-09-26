/**
 * The bestiary section: statblocks with name/threat/level/hd, ability and save
 * overrides, a referenced progression attackTable, and required action ids
 * that must resolve in the pack’s actions map — monsters ride the same action
 * machinery as characters.
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
  checkStringField,
  registerId,
  nearestId,
} from '../helpers';

export function checkBestiary(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', 'bestiary', 'bestiary', 'bestiary must be an object keyed by monster id.'),
    );
    return;
  }
  for (const [id, block] of Object.entries(value)) {
    const basePath = `bestiary.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `bestiary map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(block)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'statblock must be an object.'));
      continue;
    }
    reqFields(ctx, block, ['name', 'threat', 'actions'], id, basePath);
    forbidUnknown(
      ctx,
      block,
      ['name', 'threat', 'level', 'hd', 'abilityOverrides', 'saveOverrides', 'attackTable', 'actions'],
      id,
      basePath,
    );
    checkStringField(ctx, block, 'name', id, basePath, 1);
    const threat = block['threat'];
    if (threat !== undefined && (typeof threat !== 'number' || Number.isNaN(threat) || threat <= 0)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.threat`,
          'threat must be a number > 0 (the FR-16 budget weight).',
        ),
      );
    }
    const level = block['level'];
    if (level !== undefined && (!isInteger(level) || level < 1)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, `${basePath}.level`, 'level must be an integer >= 1.'));
    }
    const hd = block['hd'];
    if (hd !== undefined && !HD_DICE.includes(hd as string)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, `${basePath}.hd`, `hd must be one of ${HD_DICE.join(' | ')}.`),
      );
    }
    checkOverrides(ctx, block['abilityOverrides'], id, `${basePath}.abilityOverrides`, 'abilityOverrides');
    checkOverrides(ctx, block['saveOverrides'], id, `${basePath}.saveOverrides`, 'saveOverrides');
    const attackTable = block['attackTable'];
    if (attackTable !== undefined) {
      if (typeof attackTable !== 'string') {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.attackTable`,
            'attackTable must be a string referencing a progression attack table.',
          ),
        );
      } else if (ctx.progressionIds !== null && !ctx.progressionIds.has(attackTable)) {
        const near = nearestId(attackTable, ctx.progressionIds);
        add(
          ctx,
          makeErrorCard(
            'E-REF-01',
            id,
            `${basePath}.attackTable`,
            `statblock "${id}" references attack table "${attackTable}", which is not a progression entry in this pack.`,
            near === undefined
              ? `known progressions: ${[...ctx.progressionIds].sort().join(', ') || '(none)'}`
              : `did you mean "${near}"?`,
          ),
        );
      }
    }
    const actions = block['actions'];
    if (actions !== undefined) {
      if (!Array.isArray(actions) || actions.length < 1) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.actions`,
            'actions must be a non-empty array of action ids (minItems 1).',
          ),
        );
      } else {
        for (const [index, actionId] of actions.entries()) {
          if (typeof actionId !== 'string') {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${basePath}.actions[${index}]`,
                'actions entries must be action id strings.',
              ),
            );
          } else if (ctx.actionIds !== null && !ctx.actionIds.has(actionId)) {
            const near = nearestId(actionId, ctx.actionIds);
            add(
              ctx,
              makeErrorCard(
                'E-REF-01',
                id,
                `${basePath}.actions[${index}]`,
                `statblock "${id}" uses action "${actionId}", which is not declared in actions — monsters ride the same action machinery as characters (FR-16).`,
                near === undefined
                  ? `declared actions: ${[...ctx.actionIds].sort().join(', ') || '(none)'}`
                  : `did you mean "${near}"?`,
              ),
            );
          }
        }
      }
    }
  }
}

function checkOverrides(ctx: Ctx, value: unknown, artifactId: string, basePath: string, label: string): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        basePath,
        `${label} must be an object of name -> integer override.`,
      ),
    );
    return;
  }
  for (const [name, score] of Object.entries(value)) {
    if (!isInteger(score)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}.${name}`,
          `${label}.${name} must be an integer.`,
        ),
      );
    }
  }
}
