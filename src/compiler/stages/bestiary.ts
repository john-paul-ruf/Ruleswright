/**
 * Stage 6 · bestiary (generation-pipeline.html: "statblocks, threats"):
 * contributes `bestiary` + `content.races` + `content.conditions` — statblocks
 * built from the same character machinery (FR-16): ability/save overrides, a
 * referenced progression attack table, action ids declared in `actions`, and
 * the race/condition content the floor ships. The stage validates references
 * against the theme's sections so defects locate here, before stage 8.
 */
import type { Stage } from '../stage';
import type { Pack } from '../../schema/pack';
import { GenerationError, themeCard } from '../errors';

export const bestiaryStage: Stage = {
  name: 'bestiary',
  run(ctx) {
    const blocks = ctx.theme.bestiary;
    const races = ctx.theme.content?.races;
    const conditions = ctx.theme.content?.conditions;
    if (blocks === undefined) {
      throw new GenerationError([
        themeCard(
          'E-SCHEMA-01',
          'bestiary',
          'bestiary',
          'the theme declares no bestiary — stage 6 needs statblocks.',
        ),
      ]);
    }
    for (const [id, block] of Object.entries(blocks)) {
      if (block.attackTable !== undefined && ctx.theme.progression?.[block.attackTable] === undefined) {
        throw new GenerationError([
          themeCard(
            'E-REF-01',
            id,
            `bestiary.${id}.attackTable`,
            `statblock "${id}" references attack table "${block.attackTable}", which the theme's progression does not declare.`,
          ),
        ]);
      }
      for (const [index, actionId] of block.actions.entries()) {
        if (ctx.theme.actions?.[actionId] === undefined) {
          throw new GenerationError([
            themeCard(
              'E-REF-01',
              id,
              `bestiary.${id}.actions[${index}]`,
              `statblock "${id}" uses action "${actionId}", which the theme's actions do not declare — monsters ride the same action machinery as characters (FR-16).`,
            ),
          ]);
        }
      }
    }
    const content = (ctx.pack['content'] ?? {}) as NonNullable<Pack['content']>;
    if (races !== undefined) {
      for (const [id, race] of Object.entries(races)) {
        for (const classId of Object.keys(race.caps ?? {})) {
          if (ctx.theme.content?.classes?.[classId] === undefined) {
            throw new GenerationError([
              themeCard(
                'E-REF-02',
                id,
                `content.races.${id}.caps.${classId}`,
                `race "${id}" declares a level cap for class "${classId}", which the theme does not declare.`,
              ),
            ]);
          }
        }
      }
      content['races'] = structuredClone(races) as NonNullable<Pack['content']>['races'];
    }
    if (conditions !== undefined)
      content['conditions'] = structuredClone(conditions) as NonNullable<Pack['content']>['conditions'];
    if (Object.keys(content).length > 0) ctx.pack['content'] = content;
    ctx.pack['bestiary'] = structuredClone(blocks) as Pack['bestiary'];
    ctx.own = { bestiary: ctx.pack['bestiary'], races: content['races'], conditions: content['conditions'] };
  },
};
