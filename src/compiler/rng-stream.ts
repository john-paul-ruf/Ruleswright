/**
 * Per-stage deterministic RNG streams (FR-17 determinism discipline): each
 * stage's stream derives from `seed + ":" + stage name`, so stages are
 * independent — the same stage name across two runs consumes the identical
 * stream, and reordering stages cannot shift another stage's draws. All
 * arithmetic flows through S02's `Rng` (cyrb128 → sfc32, one injected source).
 *
 * A stream is handed to a stage once; the stage draws from it in a fixed order
 * (its own section's construction order), which is what makes regeneration
 * byte-identical (CA-5).
 */
import { Rng, type RandomSource } from '../core/rng';

/** Derive a stage's stream from the campaign seed + stage name. */
export function stageRng(seed: number | string, stageName: string): RandomSource {
  return new Rng(`${String(seed)}:${stageName}`);
}