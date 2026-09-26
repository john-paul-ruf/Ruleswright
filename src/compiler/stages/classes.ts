/**
 * Stage 4 · classes (generation-pipeline.html: "progression tables, 1–10"):
 * contributes `content.classes` + `progression` from the theme. Progression is
 * required for every declared class (E-REF-03's duty) — the stage rejects a
 * theme whose class has no table, here, located. Both attack conventions
 * (descending `attackTable` / ascending `attackBonus`) are pack data; the
 * stage never interprets them.
 */
import type { Stage } from '../stage';
import type { Pack } from '../../schema/pack';
import { GenerationError, themeCard } from '../errors';

export const classesStage: Stage = {
  name: 'classes',
  run(ctx) {
    const classes = ctx.theme.content?.classes;
    const progression = ctx.theme.progression;
    if (classes === undefined) {
      throw new GenerationError([
        themeCard(
          'E-SCHEMA-01',
          'content.classes',
          'content.classes',
          'the theme declares no classes — stage 4 needs a class table.',
        ),
      ]);
    }
    if (progression === undefined) {
      throw new GenerationError([
        themeCard(
          'E-REF-03',
          'progression',
          'progression',
          'the theme declares classes but no progression tables.',
        ),
      ]);
    }
    for (const classId of Object.keys(classes)) {
      if (progression[classId] === undefined) {
        throw new GenerationError([
          themeCard(
            'E-REF-03',
            classId,
            `progression.${classId}`,
            `class "${classId}" is declared but has no progression entry — progression is required for every declared class.`,
          ),
        ]);
      }
    }
    const content = (ctx.pack['content'] ?? {}) as NonNullable<Pack['content']>;
    content['classes'] = structuredClone(classes) as NonNullable<Pack['content']>['classes'];
    ctx.pack['content'] = content;
    ctx.pack['progression'] = structuredClone(progression) as Pack['progression'];
    ctx.own = { classes: content['classes'], progression: ctx.pack['progression'] };
  },
};
