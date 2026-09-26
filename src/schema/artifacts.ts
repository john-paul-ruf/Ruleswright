/**
 * Per-artifact types mirroring pack.schema.json $defs 1:1 (schemaVersion 1, v1.1).
 * Normative source: src/schema/contracts/pack.schema.json (DB-owned, read-only).
 * Closed shapes: `additionalProperties: false` is enforced by the validator
 * (validate.ts), not by these types.
 */

export type DslString = string; // formula/effect mini-language source, minLength 1 ($defs/dslString)
export type KebabId = string; // ^[a-z][a-z0-9-]*$ ($defs/idPattern)

/** $defs/actionDef/properties/cost — generic slot/points economy (FR-4). */
export interface ActionCost {
  slots?: Record<string, number>;
  points?: PointsCost;
  /** Consumes a BOUND slot of this level; an empty slot cannot cast (FR-8). */
  vancian?: number;
}

export interface PointsCost {
  /** Pool id — resolves against the pack formulas map (pool capacity is a formula, FR-3/FR-8). */
  pool: string;
  amount: number;
}

export interface ActionTrigger {
  /** Event pattern; presence makes the action reactive (FR-4/FR-13). */
  on: string;
}

/** $defs/actionDef */
export interface ActionDef {
  cost: ActionCost;
  valid?: DslString;
  trigger?: ActionTrigger;
  effect: DslString;
  /** v1.1 — coarse categories for condition restricts matching (FR-7). */
  tags?: KebabId[];
}

/** $defs/content/properties/spells/additionalProperties/properties/magic */
export interface SpellMagic {
  /** 1–9. */
  level: number;
  /** Class ids this spell's list belongs to. */
  lists: string[];
}

/** $defs/content/properties/spells/additionalProperties/properties/targeting */
export interface SpellTargeting {
  /** v1 shapes only; cone/line deferred as engine geometry (FR-11). */
  shape: 'single' | 'burst';
  /** Required iff shape is "burst". */
  radius?: number;
}

/** $defs/content/properties/spells/additionalProperties — a spell is an action + metadata (FR-9). */
export interface SpellDef {
  name: string;
  magic: SpellMagic;
  cost: ActionCost;
  effect: DslString;
  targeting?: SpellTargeting;
  tags?: KebabId[];
}

/** Class features granted at level, referenced by id. */
export interface ClassFeature {
  level: number;
  ref: string;
}

/** $defs/content/properties/classes/additionalProperties */
export interface ClassDef {
  name: string;
  spellLists?: string[];
  /** Armor types in which this class may cast — pack data (FR-9). */
  armorCasting?: string[];
  features?: ClassFeature[];
  /**
   * v1.2 — action ids a character of this class may declare in combat (FR-16
   * parity with statblock actions). Unique; each must be a key of the pack's
   * `actions` map (E-REF-01). No level gating: every listed action is
   * available from class level 1.
   */
  actions?: KebabId[];
}

/** $defs/content/properties/races/additionalProperties */
export interface RaceDef {
  name: string;
  /** classId -> max level; classic level-cap curve (FR-6). */
  caps?: Record<string, number>;
  /** Spatial size class (FR-11); documented no-op for adjacency in v1, defaults medium. */
  size?: 'small' | 'medium' | 'large';
}

/** $defs/content/properties/skills/additionalProperties */
export interface SkillDef {
  name: string;
  /** Must name an ability in stats.abilities. */
  ability: string;
}

/** $defs/content/properties/feats/additionalProperties — passive or reactive. */
export interface FeatDef {
  name: string;
  passive?: DslString;
  trigger?: { on: string };
  effect?: DslString;
}

/** $defs/content/properties/conditions/additionalProperties */
export interface ConditionDef {
  name: string;
  duration: number;
  /** Pack-declared stacking policy (FR-7). */
  stacking: 'refresh' | 'stack' | 'ignore';
  /** Action tag patterns blocked while active — the condition's teeth (FR-7). */
  restricts?: string[];
}

/** $defs/content/properties/items/additionalProperties */
export interface ItemDef {
  name: string;
  kind?: string;
}

/** One row of a classic class attack table — defense keys are pack convention (FR-3). */
export interface ClassAttackRow {
  level: number;
  byDefense: Record<string, number>;
}

/** $defs/classProgression — per-class tables. Exactly one attack convention per class. */
export interface ClassProgression {
  hd: 'd6' | 'd8' | 'd10' | 'd12';
  attackTable?: ClassAttackRow[];
  attackBonus?: DslString;
  /** saveName -> per-level values; names must exist in stats.saves; length = max level. */
  saves: Record<string, number[]>;
  /** Vancian slots per class level, indexed by spell level (FR-8); levels need not be contiguous. */
  slots?: Record<string, number[]>;
}

/** $defs/statblock — monsters use the same character machinery (FR-16). */
export interface Statblock {
  name: string;
  /** FR-16 budget weight. */
  threat: number;
  level?: number;
  hd?: 'd6' | 'd8' | 'd10' | 'd12';
  abilityOverrides?: Record<string, number>;
  saveOverrides?: Record<string, number>;
  /** Reference to a progression attack table. */
  attackTable?: string;
  /** Action ids — same machinery as characters (FR-16). */
  actions: string[];
}

/** One entry of $defs/tableDef — the one table engine's data shape (FR-15). */
export interface TableEntry {
  /** Scalar, object, or (nested kind) a reference to another table. */
  value: unknown;
  /** weighted kind: integer >= 1. */
  weight?: number;
  /** ranged kind: min <= max. */
  min?: number;
  max?: number;
}

/** $defs/tableDef */
export interface TableDef {
  kind: 'weighted' | 'ranged' | 'nested';
  entries: TableEntry[];
}