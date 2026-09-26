/**
 * Theme-template types (FR-17/FR-18/FR-20) — the DB owns this shape
 * (specs/database.md Seed Data: "DB owns their shape (knob declarations, stage
 * inputs, patch vocabulary…)"); this file declares it 1:1. A theme is pure
 * JSON: no code, no functions, no ambient values (CA-5).
 *
 * The template is a *partial pack*: every section a stage reads, keyed the
 * same way the pack sections are, so stages contribute by section and the
 * merge into the final document is structurally typed. Stage inputs reference
 * knob values with the `#knob/<id>` token (see knobs.ts).
 *
 * Knob declarations are an object keyed by knob id (theme-knobs.html's
 * knobs block + its winter-march /knobs merge patch — the mock's shape);
 * `listThemeKnobs` renders the machine-readable array (FR-18).
 */
import type { PackContent, PackEconomy, PackStats, FormulaDef } from '../schema/pack';
import type { ActionDef, ClassProgression, Statblock, TableDef } from '../schema/artifacts';

/** FR-18 — a knob declaration: id (the map key), type, allowed values or range, default, description. */
export interface KnobDecl {
  type: 'enum' | 'range';
  /** enum type: the allowed values. */
  values?: readonly string[];
  /** range type: inclusive bounds. */
  min?: number;
  max?: number;
  default: string | number;
  desc: string;
}

/** FR-20 — one composition patch: add / remove / merge at a pointer path. */
export interface ThemePatch {
  op: 'add' | 'remove' | 'merge';
  /** Pointer path from the composed theme root ('/'-joined segments, e.g. "/content/conditions/frostbitten"). */
  path: string;
  /** add/merge: the value; remove: omitted. */
  value?: unknown;
}

/** A theme's identity + knobs + optional composition (FR-20). */
export interface ThemeTemplate {
  id: string;
  title: string;
  /** FR-20 — base theme id + patches; absent = standalone theme (D1: samples stand alone). */
  base?: string;
  patches?: readonly ThemePatch[];
  /** Knob declarations keyed by knob id (FR-18; the mock's knobs block). */
  knobs?: Readonly<Record<string, KnobDecl>>;
  /** The theme's authoring notes: the documented example override (FR-19 anchor) lives here. */
  readme?: string;
  /** Stage inputs, section-keyed like the pack (stats/actions/economy?/formulas/content/progression/bestiary/tables). */
  stats: PackStats;
  economy?: PackEconomy;
  actions?: Record<string, ActionDef>;
  formulas?: Record<string, FormulaDef>;
  content?: PackContent;
  progression?: Record<string, ClassProgression>;
  bestiary?: Record<string, Statblock>;
  tables?: Record<string, TableDef>;
}
