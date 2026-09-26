/**
 * Stage 1 · stats (generation-pipeline.html): contributes the pack's `stats`
 * section verbatim from the theme — abilities and named saves are pack
 * vocabulary (FR-5), name-keyed, and the stage adds nothing. A theme omitting
 * the section fails located here.
 */
import type { Stage } from '../stage';
import type { PackStats } from '../../schema/pack';
import { GenerationError } from '../errors';

export const statsStage: Stage = {
  name: 'stats',
  run(ctx) {
    if (ctx.theme.stats === undefined) {
      throw new GenerationError([{ severity: 'error', artifactId: 'stats', jsonPath: 'stats', rule: 'E-SCHEMA-01', message: 'the theme declares no stats section — stage 1 needs abilities and saves.' }]);
    }
    const stats = structuredClone(ctx.theme.stats) as PackStats;
    ctx.own = stats;
    ctx.pack['stats'] = stats;
  },
};