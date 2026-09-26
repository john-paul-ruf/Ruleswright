/**
 * Stage 6 · bestiary (generation-pipeline.html: "statblocks, threats"):
 * contributes `bestiary` — statblocks built from the same character machinery
 * (FR-16): ability/save overrides, a referenced progression attack table, and
 * action ids declared in `actions`. The stage validates references against the
 * theme's sections so defects locate here, before stage 8.
 */
import type { Stage } from '../stage';
import type { Pack } from '../../schema/pack';
import { GenerationError, themeCard } from '../errors';

export const bestiaryStage: Stage = {
  name: 'bestiary',
  run(ctx) {
    const blocks = ctx.theme.bestiary;
    if (blocks === undefined) {
      throw new GenerationError([themeCard('E-SCHEMA-01', 'bestiary', 'bestiary', 'the theme declares no bestiary — stage 6 needs statblocks.')]);
    }
    for (const [id, block] of Object.entries(blocks)) {
      if (block.attackTable !== undefined && ctx.theme.progression?.[block.attackTable] === undefined) {
        throw new GenerationError([
          themeCard('E-REF-01', id, `bestiary.${id}.attackTable`, `statblock "${id}" references attack table "${block.attackTable}", which the theme's progression does not declare.`),
        ]);
      }
      for (const [index, actionId] of block.actions.entries()) {
        if (ctx.theme.actions?.[actionId] === undefined) {
          throw new GenerationError([
            themeCard('E-REF-01', id, `bestiary.${id}.actions[${index}]`, `statblock "${id}" uses action "${actionId}", which the theme's actions do not declare — monsters ride the same action machinery as characters (FR-16).`),
          ]);
        }
      }
    }
    ctx.pack['bestiary'] = structuredClone(blocks) as Pack['bestiary'];
    ctx.own = ctx.pack['bestiary'];
  },
};