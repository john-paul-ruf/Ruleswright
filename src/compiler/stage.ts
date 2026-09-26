/**
 * The stable Stage interface (generation-pipeline.html: "named stages, stable
 * interface"). A stage has a unique name and a run(ctx) that contributes its
 * pack section through ctx.own. Stages read the resolved theme + knobs and
 * draw randomness ONLY from ctx.stream (per-stage, seed-salted — CA-5).
 */
import type { Pack } from '../schema/pack';
import type { RandomSource } from '../core/rng';
import type { ThemeTemplate } from './theme';

/** What one stage receives. `pack` is the document under construction; `own` is the stage's section. */
export interface GenerationContext {
  readonly theme: ThemeTemplate;
  /** Resolved knob values (defaults filled) — never the raw declarations. */
  readonly knobs: Readonly<Record<string, string | number>>;
  readonly seed: number | string;
  /** This stage's own deterministic stream (seed + ":" + stage name). */
  readonly stream: RandomSource;
  /** The document under construction (earlier stages' sections are visible). */
  readonly pack: Partial<Pack> & Record<string, unknown>;
  /** The section this stage contributes — set by run(). */
  own: unknown;
}

export interface Stage {
  readonly name: string;
  run(ctx: GenerationContext): void;
}
