/**
 * The content section: classes (incl. the v1.2 optional class action list), races,
 * skills, feats, spells (incl. the burst-radius conditional), conditions, items.
 * Every artifact id registers in the global uniqueness namespace; reference
 * checks resolve against the pass-1 namespaces.
 */
import type { Ctx } from '../context';
import { makeErrorCard } from '../../error-card';
import {
  ID_PATTERN,
  MAX_SPELL_LEVEL,
  add,
  isPlainObject,
  isInteger,
  reqFields,
  forbidUnknown,
  checkStringField,
  registerId,
  checkDslField,
  nearestId,
  checkTagsField,
  checkTrigger,
  checkCost,
} from '../helpers';

export function checkContent(ctx: Ctx, value: unknown): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', 'content', 'content', 'content must be an object of artifact maps.'),
    );
    return;
  }
  forbidUnknown(
    ctx,
    value,
    ['classes', 'races', 'skills', 'feats', 'spells', 'conditions', 'items'],
    'content',
    'content',
  );
  checkClasses(ctx, value['classes']);
  checkRaces(ctx, value['races']);
  checkSkills(ctx, value['skills']);
  checkFeats(ctx, value['feats']);
  checkSpells(ctx, value['spells']);
  checkConditions(ctx, value['conditions']);
  checkItems(ctx, value['items']);
}

function checkClasses(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.classes',
        'content.classes',
        'content.classes must be an object keyed by class id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.classes.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `class map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'class definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'spellLists', 'armorCasting', 'features', 'actions'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    checkStringArray(ctx, def['spellLists'], id, `${basePath}.spellLists`);
    checkStringArray(ctx, def['armorCasting'], id, `${basePath}.armorCasting`);
    const features = def['features'];
    if (features !== undefined) {
      if (!Array.isArray(features)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.features`,
            'features must be an array of {level, ref}.',
          ),
        );
      } else {
        for (const [index, feature] of features.entries()) {
          const featurePath = `${basePath}.features[${index}]`;
          if (!isPlainObject(feature)) {
            add(
              ctx,
              makeErrorCard('E-SCHEMA-01', id, featurePath, 'feature must be an object {level, ref}.'),
            );
            continue;
          }
          reqFields(ctx, feature, ['level', 'ref'], id, featurePath);
          forbidUnknown(ctx, feature, ['level', 'ref'], id, featurePath);
          const level = feature['level'];
          if (level !== undefined && (!isInteger(level) || level < 1)) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${featurePath}.level`,
                'feature.level must be an integer >= 1.',
              ),
            );
          }
          if (feature['ref'] !== undefined && typeof feature['ref'] !== 'string') {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${featurePath}.ref`,
                'feature.ref must be a string (the feature artifact id).',
              ),
            );
          }
        }
      }
    }
    checkClassActions(ctx, def['actions'], id, `${basePath}.actions`);
  }
}

/** v1.2 — optional class action list: unique kebab ids, each resolving in the pack's actions map, like statblock actions (FR-16). */
function checkClassActions(ctx: Ctx, value: unknown, classId: string, basePath: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', classId, basePath, `${basePath} must be an array of unique action ids.`),
    );
    return;
  }
  const seen = new Set<string>();
  for (const [index, actionId] of value.entries()) {
    const entryPath = `${basePath}[${index}]`;
    if (typeof actionId !== 'string' || !ID_PATTERN.test(actionId)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', classId, entryPath, `${entryPath} must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    if (seen.has(actionId)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          classId,
          entryPath,
          `${basePath} entries must be unique (uniqueItems) — "${actionId}" repeats.`,
        ),
      );
      continue;
    }
    seen.add(actionId);
    if (ctx.actionIds !== null && !ctx.actionIds.has(actionId)) {
      const near = nearestId(actionId, ctx.actionIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-01',
          classId,
          entryPath,
          `class "${classId}" grants action "${actionId}", which is not declared in actions — characters ride the same action machinery as statblocks (FR-16).`,
          near === undefined
            ? `declared actions: ${[...ctx.actionIds].sort().join(', ') || '(none)'}`
            : `did you mean "${near}"?`,
        ),
      );
    }
  }
}

function checkStringArray(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    add(ctx, makeErrorCard('E-SCHEMA-01', artifactId, basePath, `${basePath} must be an array of strings.`));
    return;
  }
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          artifactId,
          `${basePath}[${index}]`,
          `${basePath}[${index}] must be a string.`,
        ),
      );
    }
  }
}

function checkRaces(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.races',
        'content.races',
        'content.races must be an object keyed by race id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.races.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `race map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'race definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'caps', 'size'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    const caps = def['caps'];
    if (caps !== undefined) {
      if (!isPlainObject(caps)) {
        add(
          ctx,
          makeErrorCard(
            'E-SCHEMA-01',
            id,
            `${basePath}.caps`,
            'caps must be an object classId -> max level.',
          ),
        );
      } else {
        for (const [classId, maxLevel] of Object.entries(caps)) {
          if (!isInteger(maxLevel) || maxLevel < 1) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${basePath}.caps.${classId}`,
                `${basePath}.caps.${classId} must be an integer >= 1.`,
              ),
            );
          }
          if (ctx.classIds !== null && !ctx.classIds.has(classId)) {
            const near = nearestId(classId, ctx.classIds);
            add(
              ctx,
              makeErrorCard(
                'E-REF-02',
                id,
                `${basePath}.caps.${classId}`,
                `race "${id}" declares a level cap for class "${classId}", which is not in the class table.`,
                near === undefined
                  ? `known classes: ${[...ctx.classIds].sort().join(', ') || '(none)'}`
                  : `did you mean "${near}"?`,
              ),
            );
          }
        }
      }
    }
    const size = def['size'];
    if (size !== undefined && size !== 'small' && size !== 'medium' && size !== 'large') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.size`,
          'size must be one of "small" | "medium" | "large" (defaults medium; documented no-op for adjacency in v1).',
        ),
      );
    }
  }
}

function checkSkills(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.skills',
        'content.skills',
        'content.skills must be an object keyed by skill id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.skills.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `skill map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'skill definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name', 'ability'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'ability'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    const ability = def['ability'];
    if (ability !== undefined && typeof ability !== 'string') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.ability`,
          'ability must be a string naming an ability in stats.abilities.',
        ),
      );
    } else if (typeof ability === 'string' && ctx.abilityIds !== null && !ctx.abilityIds.has(ability)) {
      const near = nearestId(ability, ctx.abilityIds);
      add(
        ctx,
        makeErrorCard(
          'E-REF-01',
          id,
          `${basePath}.ability`,
          `skill "${id}" references ability "${ability}", which is not declared in stats.abilities.`,
          near === undefined
            ? `this pack's abilities: ${[...(ctx.abilityIds ?? [])].sort().join(', ') || '(none)'}`
            : `did you mean "${near}"?`,
        ),
      );
    }
  }
}

function checkFeats(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.feats',
        'content.feats',
        'content.feats must be an object keyed by feat id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.feats.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `feat map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'feat definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'passive', 'trigger', 'effect'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    checkDslField(ctx, def['passive'], 'passive', id, `${basePath}.passive`);
    checkDslField(ctx, def['effect'], 'effect', id, `${basePath}.effect`);
    checkTrigger(ctx, def['trigger'], id, `${basePath}.trigger`, 0);
  }
}

function checkSpells(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.spells',
        'content.spells',
        'content.spells must be an object keyed by spell id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.spells.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `spell map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'spell definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name', 'magic', 'cost', 'effect'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'magic', 'cost', 'effect', 'targeting', 'tags'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    checkTagsField(ctx, def['tags'], id, `${basePath}.tags`);
    checkDslField(ctx, def['effect'], 'effect', id, `${basePath}.effect`);
    const magic = def['magic'];
    if (magic !== undefined) {
      if (!isPlainObject(magic)) {
        add(
          ctx,
          makeErrorCard('E-SCHEMA-01', id, `${basePath}.magic`, 'magic must be an object {level, lists}.'),
        );
      } else {
        reqFields(ctx, magic, ['level', 'lists'], id, `${basePath}.magic`);
        forbidUnknown(ctx, magic, ['level', 'lists'], id, `${basePath}.magic`);
        const level = magic['level'];
        if (level !== undefined && (!isInteger(level) || level < 1 || level > MAX_SPELL_LEVEL)) {
          add(
            ctx,
            makeErrorCard(
              'E-SCHEMA-01',
              id,
              `${basePath}.magic.level`,
              `magic.level must be an integer in 1..${MAX_SPELL_LEVEL}.`,
            ),
          );
        }
        const lists = magic['lists'];
        if (lists !== undefined) {
          if (!Array.isArray(lists) || lists.length < 1) {
            add(
              ctx,
              makeErrorCard(
                'E-SCHEMA-01',
                id,
                `${basePath}.magic.lists`,
                'magic.lists must be a non-empty array of class ids (minItems 1).',
              ),
            );
          } else {
            for (const [index, list] of lists.entries()) {
              if (typeof list !== 'string') {
                add(
                  ctx,
                  makeErrorCard(
                    'E-SCHEMA-01',
                    id,
                    `${basePath}.magic.lists[${index}]`,
                    'magic.lists entries must be class id strings.',
                  ),
                );
              } else if (ctx.classIds !== null && !ctx.classIds.has(list)) {
                const near = nearestId(list, ctx.classIds);
                add(
                  ctx,
                  makeErrorCard(
                    'E-REF-01',
                    id,
                    `${basePath}.magic.lists[${index}]`,
                    `spell "${id}" claims list membership in class "${list}", which is not declared in content.classes.`,
                    near === undefined
                      ? `known classes: ${[...ctx.classIds].sort().join(', ') || '(none)'}`
                      : `did you mean "${near}"?`,
                  ),
                );
              }
            }
          }
        }
      }
    }
    checkCost(ctx, def['cost'], id, `${basePath}.cost`);
    const targeting = def['targeting'];
    if (targeting !== undefined) {
      checkTargeting(ctx, targeting, id, `${basePath}.targeting`);
    }
  }
}

/** Structural conditional (v1): radius is required iff shape is "burst" — and meaningless (forbidden) otherwise. */
function checkTargeting(ctx: Ctx, value: unknown, artifactId: string, basePath: string): void {
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', artifactId, basePath, 'targeting must be an object {shape, radius?}.'),
    );
    return;
  }
  reqFields(ctx, value, ['shape'], artifactId, basePath);
  forbidUnknown(ctx, value, ['shape', 'radius'], artifactId, basePath);
  const shape = value['shape'];
  if (shape !== undefined && shape !== 'single' && shape !== 'burst') {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        `${basePath}.shape`,
        'shape must be "single" or "burst" (v1 shapes only; cone/line deferred as engine geometry, FR-11).',
      ),
    );
  }
  const radius = value['radius'];
  if (radius !== undefined && (!isInteger(radius) || radius < 1)) {
    add(
      ctx,
      makeErrorCard('E-SCHEMA-01', artifactId, `${basePath}.radius`, 'radius must be an integer >= 1.'),
    );
  }
  if (shape === 'burst' && radius === undefined) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        artifactId,
        `${basePath}.radius`,
        'shape "burst" requires a radius (radius iff burst).',
      ),
    );
  }
  if (shape === 'single' && radius !== undefined) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-02',
        artifactId,
        `${basePath}.radius`,
        'radius is only valid for shape "burst" — a single-target effect has no area.',
      ),
    );
  }
}

function checkConditions(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.conditions',
        'content.conditions',
        'content.conditions must be an object keyed by condition id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.conditions.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `condition map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'condition definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name', 'duration', 'stacking'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'duration', 'stacking', 'restricts'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    const duration = def['duration'];
    if (duration !== undefined && (!isInteger(duration) || duration < 1)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, `${basePath}.duration`, 'duration must be an integer >= 1.'));
    }
    const stacking = def['stacking'];
    if (stacking !== undefined && stacking !== 'refresh' && stacking !== 'stack' && stacking !== 'ignore') {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.stacking`,
          'stacking must be one of "refresh" | "stack" | "ignore" (pack-declared policy, FR-7).',
        ),
      );
    }
    const restricts = def['restricts'];
    if (restricts !== undefined && !Array.isArray(restricts)) {
      add(
        ctx,
        makeErrorCard(
          'E-SCHEMA-01',
          id,
          `${basePath}.restricts`,
          'restricts must be an array of action tag patterns.',
        ),
      );
    }
  }
}

function checkItems(ctx: Ctx, value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    add(
      ctx,
      makeErrorCard(
        'E-SCHEMA-01',
        'content.items',
        'content.items',
        'content.items must be an object keyed by item id.',
      ),
    );
    return;
  }
  for (const [id, def] of Object.entries(value)) {
    const basePath = `content.items.${id}`;
    if (!ID_PATTERN.test(id)) {
      add(
        ctx,
        makeErrorCard('E-SCHEMA-01', id, basePath, `item map key "${id}" must match ^[a-z][a-z0-9-]*$.`),
      );
      continue;
    }
    registerId(ctx, id, basePath);
    if (!isPlainObject(def)) {
      add(ctx, makeErrorCard('E-SCHEMA-01', id, basePath, 'item definition must be an object.'));
      continue;
    }
    reqFields(ctx, def, ['name'], id, basePath);
    forbidUnknown(ctx, def, ['name', 'kind'], id, basePath);
    checkStringField(ctx, def, 'name', id, basePath, 1);
    checkStringField(ctx, def, 'kind', id, basePath);
  }
}
