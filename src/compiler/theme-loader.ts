/**
 * Theme loading (FR-17): the sample themes are data files under
 * `src/compiler/themes/` (database.md Seed Data — "JSON, not code"), imported
 * statically and typed as ThemeTemplate. Import of a .json module requires the
 * TS `resolveJsonModule` compiler option; the ambient declaration file in this
 * directory (themes.d.ts) provides the module types without widening the
 * repo's tsconfig (which is outside this lease).
 */
import type { ThemeTemplate } from './theme';
import darkFantasyThemeJson from './themes/dark-fantasy.json';
import zombieUrbanThemeJson from './themes/zombie-urban.json';

/** The vancian showcase (FR-21): ~3 classes, ~40 spells L1–3, full race matrix, five named saves. */
export const DARK_FANTASY = darkFantasyThemeJson as unknown as ThemeTemplate;

/** The drain-pool & table showcase (FR-21): survivor classes, stamina/adrenaline pools, skills- and table-heavy. */
export const ZOMBIE_URBAN = zombieUrbanThemeJson as unknown as ThemeTemplate;

/** Resolve a theme by name against the built-in registry (FR-17's `theme` field). */
export function loadTheme(name: string): ThemeTemplate {
  switch (name) {
    case 'dark-fantasy':
      return DARK_FANTASY;
    case 'zombie-urban':
      return ZOMBIE_URBAN;
    default:
      throw new Error(`unknown built-in theme "${name}" — themes are data files under src/compiler/themes (FR-17).`);
  }
}