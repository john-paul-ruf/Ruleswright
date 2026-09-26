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
 * `{theme, seed, knobs}` — FR-18/CA-5, no other keys), resolves knob tokens in
 * the theme's stage inputs (`#knob/<id>` → the resolved value — knob values
 * feed generation, FR-18), seeds the formulas map (CA-6 identity is
 * pack-level), then runs the stages.
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

/** Stage inputs the stages read, section-keyed like the pack. */
const STAGE_INPUT_SECTIONS: readonly string[] = ['stats', 'economy', 'actions', 'formulas', 'content', 'progression', 'bestiary', 'tables'];

/**
 * Resolve `#knob/<id>` tokens across the theme's stage inputs against the
 * resolved knob map. Every occurrence inside a string value is substituted
 * (whole-value tokens and tokens spliced into expressions alike). A token
 * naming an undeclared knob is a located rejection — the theme's data defect,
 * caught before stages run.
 */
function resolveKnobTokens(theme: ThemeTemplate, knobs: Readonly<Record<string, string | number>>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const section of STAGE_INPUT_SECTIONS) {
    const value = (theme as unknown as Record<string, unknown>)[section];
    resolved[section] = value === undefined ? undefined : substituteTokens(value, knobs, section, theme.id);
  }
  return resolved;
}

const KNOB_TOKEN = /#knob\/([a-z][a-z0-9-]*)/g;

function substituteTokens(value: unknown, knobs: Readonly<Record<string, string | number>>, path: string, themeId: string): unknown {
  if (typeof value === 'string') {
    return value.replace(KNOB_TOKEN, (token: string, id: string) => {
      const knob = knobs[id];
      if (knob === undefined) {
        throw new GenerationError([
          { severity: 'error', artifactId: '(theme)', jsonPath: path, rule: 'E-SCHEMA-01', message: `knob token "${token}" names knob "${id}", which the theme "${themeId}" does not declare.` },
        ]);
      }
      return String(knob);
    });
  }
  if (Array.isArray(value)) return value.map((entry, index) => substituteTokens(entry, knobs, `${path}[${index}]`, themeId));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = substituteTokens(entry, knobs, `${path}.${key}`, themeId);
    return out;
  }
  return value;
}

/**
 * Run stages 1–7 over the theme (with knobs resolved + per-stage streams),
 * then stage 8: the same `schema.validatePack` external packs face. Any error
 * card anywhere — stage or validator — aggregates into one GenerationError;
 * a failed campaign never returns a partial pack (FR-2).
 */
export function runPipeline(theme: ThemeTemplate, seed: number | string, stages: readonly Stage[] = defaultStages(), dslChecker: DslChecker = packDslChecker): Pack {
  const knobs = resolveKnobs(theme);
  const inputs = resolveKnobTokens(theme, knobs);
  const themeView: ThemeTemplate = { ...theme, ...(inputs as unknown as ThemeTemplate) };
  const provenance: PackProvenance = { theme: theme.id, seed, knobs };
  const manifest = { id: theme.id, schemaVersion: 1, title: theme.title, provenance };
  const pack: Record<string, unknown> = { manifest };
  // Reserved formulas are pack-level identity (CA-6): seed the map from the
  // token-resolved view before the stages run so every stage sees hp/ac.
  if (themeView.formulas !== undefined) {
    const formulas: Record<string, unknown> = {};
    for (const [id, def] of Object.entries(themeView.formulas)) formulas[id] = structuredClone(def);
    pack['formulas'] = formulas;
  }

  for (const stage of stages) {
    const ctx: GenerationContext = {
      theme: themeView,
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