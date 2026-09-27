/**
 * The pack document type — mirrors the top level of pack.schema.json
 * (8 required + 2 optional sections, schemaVersion 1: economy v1.1, spatial v1.3).
 */
import type {
  ActionDef,
  ClassDef,
  ClassProgression,
  ConditionDef,
  DslString,
  FeatDef,
  ItemDef,
  KebabId,
  RaceDef,
  SkillDef,
  SpellDef,
  Statblock,
  TableDef,
} from './artifacts';
import type { ErrorCard } from './error-card';

/** $defs/manifest/properties/provenance — provenance is exactly {theme, seed, knobs} (FR-18). */
export interface PackProvenance {
  theme: string;
  seed: number | string;
  knobs?: Record<string, unknown>;
}

/** $defs/manifest */
export interface PackManifest {
  id: KebabId;
  /** `const 1` for this contract; the engine's supported range is checked at load (FR-23). */
  schemaVersion: number;
  title: string;
  /** Carried and surfaced, never enforced (FR-2, Q7). */
  license?: string;
  attribution?: string;
  provenance?: PackProvenance;
}

/** $defs/stats — name-keyed abilities and named saves (FR-5). */
export interface PackStats {
  abilities: KebabId[];
  saves: KebabId[];
}

/**
 * $defs/economy (v1.1) — the turn-economy declaration (FR-4): slot name -> slots
 * granted per turn. Optional; when absent the engine's documented per-cost default
 * applies at play time (1 of each slot name seen in action costs).
 */
export interface PackEconomy {
  turnSlots: Record<KebabId, number>;
}

/** $defs/spatial (v1.3) — optional spatial model (FR-11): grid reach + documented shape set. */
export interface SpatialReach {
  /** Melee reach in grid steps (1 = adjacency). */
  default: number;
  /** Per-id reach overrides — direct siblings of `default` (spatial.html verbatim). */
  [overrideKey: string]: number;
}

export interface SpatialDef {
  model: 'grid';
  reach: SpatialReach;
  shapes?: readonly ('single' | 'burst')[];
}

/** formulas map entry — pure data; the function registry is closed (NFR-Security). */
export interface FormulaDef {
  params?: string[];
  expr: DslString;
}

/** $defs/content — seven maps keyed by id. */
export interface PackContent {
  classes?: Record<string, ClassDef>;
  races?: Record<string, RaceDef>;
  skills?: Record<string, SkillDef>;
  feats?: Record<string, FeatDef>;
  spells?: Record<string, SpellDef>;
  conditions?: Record<string, ConditionDef>;
  items?: Record<string, ItemDef>;
}

/** The pack document — the complete JSON rules + content the runtime consumes. */
export interface Pack {
  manifest: PackManifest;
  stats: PackStats;
  actions: Record<string, ActionDef>;
  economy?: PackEconomy;
  spatial?: SpatialDef;
  formulas: Record<string, FormulaDef>;
  content: PackContent;
  progression: Record<string, ClassProgression>;
  bestiary: Record<string, Statblock>;
  tables: Record<string, TableDef>;
}

/** FR-2 — all ErrorCards or nothing: a failed pack is never partially loaded. */
export type ValidationResult = { ok: true; pack: Pack } | { ok: false; errors: ErrorCard[] };
