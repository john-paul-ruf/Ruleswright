/**
 * M03 — the lifecycle facade (api-map.html): `new Runtime(pack)` validates at
 * load (FR-2: all ErrorCards or nothing — a failed pack is never partially
 * loaded), indexes artifacts by id, and compiles the pack's DSL once into
 * cached ASTs (parse-once/check-time; zero parser access at play time, CA-2).
 *
 * Derived stats resolve exclusively through the pack's reserved formula ids
 * `hp`/`ac` (CA-6, PROGRAM-CONFIG Custom Rule 2). The validator (S01) already
 * enforces their presence (E-REF-01); the runtime re-checks at load so a
 * hand-assembled Pack object cannot bypass the schema (fail-closed discipline).
 *
 * Character-side state is plain serializable JSON (FR-5/FR-14): plain objects
 * only, no class instances, no hidden state. Progression paths live in
 * progression.ts, pools/slots in pools.ts, conditions in conditions.ts.
 */
import type { Pack } from '../schema/pack';
import type { ClassDef, ConditionDef, SpellDef } from '../schema/artifacts';
import { validatePack } from '../schema/validate';
import { packDslChecker } from '../core/dsl/checker';
import { parseEffect, type EffectAst } from '../core/dsl/effect';
import { parseFormula, type FormulaAst } from '../core/dsl/formula';
import type { ErrorCard } from '../schema/error-card';
import type { Rng } from '../core/rng';
import { EventStream } from './events';
import { createCharacter, type ActiveCondition, type CharacterState } from './character';

/** The load-time artifact index: everything a character-side lookup needs, keyed by id. */
export interface PackIndex {
  readonly classes: Readonly<Record<string, ClassDef>>;
  readonly conditions: Readonly<Record<string, ConditionDef>>;
  readonly spells: Readonly<Record<string, SpellDef>>;
  /** Parse-once effect ASTs for actions and spells (zero parser access at play time, CA-2). */
  readonly actionEffects: Readonly<Record<string, EffectAst>>;
  readonly spellEffects: Readonly<Record<string, EffectAst>>;
  /** Parse-once formula ASTs — the whole `formulas` map, reserved ids included. */
  readonly formulaAsts: Readonly<Record<string, FormulaAst>>;
}

/** Aggregate load failure (FR-2): `errors` is the complete ErrorCard[] from the validator. */
export class PackLoadError extends Error {
  readonly errors: readonly ErrorCard[];

  constructor(errors: readonly ErrorCard[]) {
    super(`pack load failed with ${errors.length} error card(s) — first: ${errors[0]?.rule} ${errors[0]?.message}`);
    this.name = 'PackLoadError';
    this.errors = errors;
  }
}

/** FR-5 — character creation request: direct level-set; the XP path lives in progression.ts. */
export interface CharacterCreateRequest {
  readonly name: string;
  readonly race: string;
  readonly classes: readonly string[];
  readonly level?: number;
  readonly rng?: Rng;
}

/**
 * Load, validate, index, compile. Throws `PackLoadError` (FR-2 aggregate) on
 * any validation failure — never partially loaded.
 */
export class Runtime {
  readonly pack: Pack;
  readonly events: EventStream;
  readonly index: PackIndex;
  /** Monotonic per-runtime character serial — stable ids without ambient entropy. */
  nextCharacterId = 1;

  constructor(pack: unknown) {
    const errors = validatePack(pack, packDslChecker);
    if (errors.length > 0) throw new PackLoadError(errors);
    const loaded = pack as Pack;

    // CA-6 fail-closed recheck: derived stats resolve only through the reserved
    // formulas. S01's validator enforces presence for JSON input; any pack that
    // slips past the schema still fails closed here.
    for (const reserved of ['hp', 'ac'] as const) {
      if (!(reserved in loaded.formulas)) {
        throw new PackLoadError([
          {
            severity: 'error',
            artifactId: reserved,
            jsonPath: 'formulas',
            rule: 'E-REF-01',
            message: `reserved formula id "${reserved}" is not defined — every pack must define formulas.hp and formulas.ac (the engine resolves derived stats only through these ids).`,
            hint: '"initiative" is optional (engine fallback: plain d20); "hp" and "ac" are not.',
          },
        ]);
      }
    }

    this.pack = loaded;
    this.events = new EventStream();
    this.index = {
      classes: loaded.content.classes ?? {},
      conditions: loaded.content.conditions ?? {},
      spells: loaded.content.spells ?? {},
      actionEffects: compileEffects(loaded.actions, (action) => action.effect),
      spellEffects: compileEffects(loaded.content.spells ?? {}, (spell) => spell.effect),
      formulaAsts: compileFormulas(loaded.formulas),
    };
  }

  /**
   * FR-5 — create a character from the pack: abilities default from
   * `stats.abilities`, illegal builds rejected with named rules (FR-6).
   * Emits `character:created` (CA-3 named non-combat event, shared-file window).
   */
  createCharacter(request: CharacterCreateRequest): CharacterState {
    return createCharacter(this, request);
  }
}

export type { ActiveCondition, CharacterState };

/** Parse-once effect compilation (CA-2) — a validator pass should never fail here. */
function compileEffects<T extends { readonly effect: string }>(defs: Readonly<Record<string, T>>, effectOf: (def: T) => string): Record<string, EffectAst> {
  const compiled: Record<string, EffectAst> = {};
  for (const [id, def] of Object.entries(defs)) {
    const parsed = parseEffect(effectOf(def));
    if (!parsed.ok) {
      throw new Error(`effect parse failed for "${id}" at load — ${parsed.reason} (the validator's dslChecker should have caught this)`);
    }
    compiled[id] = parsed.value;
  }
  return compiled;
}

function compileFormulas(formulas: Readonly<Record<string, { expr: string }>>): Record<string, FormulaAst> {
  const compiled: Record<string, FormulaAst> = {};
  for (const [id, def] of Object.entries(formulas)) {
    const parsed = parseFormula(def.expr);
    if (!parsed.ok) {
      throw new Error(`formula parse failed for "${id}" at load — ${parsed.reason} (the validator's dslChecker should have caught this)`);
    }
    compiled[id] = parsed.value;
  }
  return compiled;
}