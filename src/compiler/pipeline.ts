/**
 * The named-stage pipeline (Extension Commitment 3, generation-pipeline.html):
 * generation is a chain of named stages behind a stable interface — registered,
 * ordered, replaceable. A future narrative stage slots in without touching
 * existing stages; that is the v2 seam built into v1.
 *
 * The default registry is the seven code stages (stats → skills → feats →
 * classes → magic → bestiary → tables); stage 8 is the runtime's own
 * `schema.validatePack` with S03's real checker wired (CA-1 dogfood proof) and
 * is deliberately NOT a replaceable Stage here — it is the pipeline's gate.
 *
 * The pipeline shell builds the manifest first (identity + provenance exactly
 * `{theme, seed, knobs}` — FR-18/CA-5, no other keys), then runs the stages.
 */
import type { Pack, PackProvenance } from '../schema/pack';
import type { ErrorCard } from '../schema/error-card';
import { validatePack, type DslChecker } from '../schema/validate';
import { packDslChecker } from '../core/dsl/checker';
import type { ThemeTemplate } from './theme';
import type { GenerationContext, Stage } from './stage';
import { GenerationError } from './errors';
import { resolveKnobs } from './knobs';
import { stageRng } from './rng-stream';
import { statsStage } from './stages/stats';
import { skillsStage } from './stages/skills';
import { featsStage } from './stages/feats';
import { classesStage } from './stages/classes';
import { magicStage } from './stages/magic';
import { bestiaryStage } from './stages/bestiary';
import { tablesStage } from './stages/tables';

export type { GenerationContext, Stage };
export const STAGE_ORDER: readonly string[] = ['stats', 'skills', 'feats', 'classes', 'magic', 'bestiary', 'tables'];

/** The default registry, in pipeline order. */
export function defaultStages(): readonly Stage[] {
  return [statsStage, skillsStage, featsStage, classesStage, magicStage, bestiaryStage, tablesStage];
}

/**
 * Run stages 1–7 over the theme (with knobs resolved + per-stage streams),
 * then stage 8: the same `schema.validatePack` external packs face. Any error
 * card anywhere — stage or validator — aggregates into one GenerationError;
 * a failed campaign never returns a partial pack (FR-2).
 */
export function runPipeline(theme: ThemeTemplate, seed: number | string, stages: readonly Stage[] = defaultStages(), dslChecker: DslChecker = packDslChecker): Pack {
  const knobs = resolveKnobs(theme);
  const provenance: PackProvenance = { theme: theme.id, seed, knobs };
  const manifest = { id: theme.id, schemaVersion: 1, title: theme.title, provenance };
  const pack: Record<string, unknown> = { manifest };

  for (const stage of stages) {
    const ctx: GenerationContext = {
      theme,
      knobs,
      seed,
      stream: stageRng(seed, stage.name),
      pack: pack as never,
      own: undefined,
    };
    stage.run(ctx);
  }
  const errors: ErrorCard[] = validatePack(pack, dslChecker);
  if (errors.length > 0) {
    throw new GenerationError(errors);
  }
  return pack as unknown as Pack;
}