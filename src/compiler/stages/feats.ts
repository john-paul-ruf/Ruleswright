/**
 * Stage 3 · feats (generation-pipeline.html: "incl. one reactive (FR-12)"):
 * contributes `content.feats` from the theme. At least one reactive feat
 * (trigger.on present) is the theme's coverage-floor duty (FR-21) — a theme
 * shipping none is rejected here, located.
 */
import type { Stage } from '../stage';
import type { Pack } from '../../schema/pack';
import { GenerationError, themeCard } from '../errors';

export const featsStage: Stage = {
  name: 'feats',
  run(ctx) {
    const feats = ctx.theme.content?.feats;
    if (feats === undefined) {
      throw new GenerationError([themeCard('E-SCHEMA-01', 'content.feats', 'content.feats', 'the theme declares no feats — stage 3 needs a feat list.')]);
    }
    const reactive = Object.values(feats).filter((def) => def.trigger?.on !== undefined);
    if (reactive.length === 0) {
      throw new GenerationError([
        themeCard('E-SCHEMA-01', 'content.feats', 'content.feats', 'the theme declares no reactive feat — the coverage floor ships ≥ 1 reactive feat (FR-12 proof 2, FR-21).'),
      ]);
    }
    const content = (ctx.pack['content'] ?? {}) as NonNullable<Pack['content']>;
    content['feats'] = structuredClone(feats) as NonNullable<Pack['content']>['feats'];
    ctx.pack['content'] = content;
    ctx.own = content['feats'];
  },
};