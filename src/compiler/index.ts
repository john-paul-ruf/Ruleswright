/**
 * M04 compiler surface — FR-17/18/20: `generateCampaign`, machine-readable
 * knob declarations, stage pipeline, theme composition.
 */
export { generateCampaign, type GenerateCampaignRequest } from './generate';
export { listThemeKnobs, resolveKnobs, type KnobRejection } from './knobs';
export { runPipeline, defaultStages, STAGE_ORDER, type Stage } from './pipeline';
export type { GenerationContext } from './stage';
export { stageRng } from './rng-stream';
export type { ThemeTemplate, KnobDecl, ThemePatch } from './theme';
export { GenerationError } from './errors';
export { composeTheme, readPatch } from './compose';
export { loadTheme, DARK_FANTASY, ZOMBIE_URBAN, WYLDWOOD } from './theme-loader';
