/**
 * generateCampaign — the FR-17 one-call entry: `generateCampaign({ theme,
 * seed, knobs? })` → a complete, valid, byte-identical pack. Fully offline;
 * validated by the runtime's own validator before it leaves (CA-1).
 *
 * The mock pins the API shape (quickstart.html/api-map.html); the illustrative
 * `await` does not bind — v1 generation is synchronous (pure data expansion).
 */
import type { Pack } from '../schema/pack';
import type { DslChecker } from '../schema/validate';
import { packDslChecker } from '../core/dsl/checker';
import type { ThemeTemplate } from './theme';
import { runPipeline, defaultStages } from './pipeline';

export interface GenerateCampaignRequest {
  readonly theme: ThemeTemplate;
  readonly seed: number | string;
  /** Caller knob values — validated against the theme's declarations, recorded in provenance (FR-18). */
  readonly knobs?: Readonly<Record<string, string | number>>;
}

export function generateCampaign(request: GenerateCampaignRequest, dslChecker: DslChecker = packDslChecker): Pack {
  return runPipeline(request.theme, request.seed, defaultStages(), request.knobs, dslChecker);
}