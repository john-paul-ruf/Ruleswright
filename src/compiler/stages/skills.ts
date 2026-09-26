/**
 * Stage 2 · skills (generation-pipeline.html: "theme-flavored skill list"):
 * contributes `content.skills` from the theme. Skills are theme data (name +
 * governing ability); the stage validates shape and locates defects.
 */
import type { Stage } from '../stage';
import type { Pack } from '../../schema/pack';
import { GenerationError, themeCard } from '../errors';

export const skillsStage: Stage = {
  name: 'skills',
  run(ctx) {
    const skills = ctx.theme.content?.skills;
    if (skills === undefined) {
      throw new GenerationError([themeCard('E-SCHEMA-01', 'content.skills', 'content.skills', 'the theme declares no skills — stage 2 needs a skill list.')]);
    }
    for (const [id, def] of Object.entries(skills)) {
      if (def.ability !== undefined && !ctx.theme.stats.abilities.includes(def.ability)) {
        throw new GenerationError([
          themeCard('E-REF-01', id, `content.skills.${id}.ability`, `skill "${id}" references ability "${def.ability}", which the theme's stats do not declare.`),
        ]);
      }
    }
    const content = (ctx.pack['content'] ?? {}) as NonNullable<Pack['content']>;
    content['skills'] = structuredClone(skills) as NonNullable<Pack['content']>['skills'];
    ctx.pack['content'] = content;
    ctx.own = content['skills'];
  },
};