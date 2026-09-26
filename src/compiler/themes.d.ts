/**
 * Ambient module declarations for the theme JSON data files (database.md Seed
 * Data: themes are "JSON, not code"). S01's repo tsconfig does not enable
 * `resolveJsonModule` — that file is outside this lease — so the two theme
 * imports are declared here. The declared shape is `unknown`; the loader casts
 * to ThemeTemplate (the caller-side cast, mirroring how JSON.parse surfaces).
 */
declare module '*/dark-fantasy.json' {
  const darkFantasyThemeJson: Record<string, unknown>;
  export default darkFantasyThemeJson;
}

declare module '*/zombie-urban.json' {
  const zombieUrbanThemeJson: Record<string, unknown>;
  export default zombieUrbanThemeJson;
}