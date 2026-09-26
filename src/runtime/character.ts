/**
 * M03 — plain-JSON character state (FR-5/FR-14), its factory, and the thin
 * `Character` facade (api-map: `char.derived()`). Every state field is
 * serializable data: no class instances, no closures, no hidden state. The
 * facade holds no state of its own — it pairs the live state with its runtime.
 *
 * Derived stats resolve exclusively through the pack's reserved formula ids
 * (`hp`/`ac`, CA-6) — never hardcoded math. Build validation and the
 * progression paths live in progression.ts (both entry points run the same
 * validator); pools/slots vocabulary in pools.ts, conditions in conditions.ts.
 */
import { evalFormula, valueOfFormula } from '../core/dsl/formula';
import { Rng } from '../core/rng';
import type { CharacterCreateRequest, Runtime } from './runtime';
import {
  spendPool as spendPoolFn,
  prepareSpell as prepareSpellFn,
  castSpell as castSpellFn,
  rest as restFn,
} from './pools';
import {
  applyCondition as applyConditionFn,
  removeCondition as removeConditionFn,
  tickConditions,
  applyTheme as applyThemeFn,
  removeTheme as removeThemeFn,
} from './conditions';
import type { RuntimeEvent } from './events';
import { validateBuild, buildCharacter, CharacterBuildError } from './progression';

/** FR-7 — one active condition on a character: plain data, duration in rounds. */
export interface ActiveCondition {
  readonly conditionId: string;
  /** Rounds remaining; the pack's duration is the initial value; tick/refresh mutate it in place. */
  duration: number;
}

/** One concurrent class with its own level (FR-6 multi-class). */
export interface ClassEntry {
  id: string;
  level: number;
}

/** Plain-JSON character state (FR-5/FR-14) — the serializer's subject (S06 pairs with this). */
export interface CharacterState {
  readonly id: string;
  readonly name: string;
  readonly race: string;
  /** Total level across classes. */
  level: number;
  xp: number;
  classes: ClassEntry[];
  /** Per-class XP accumulation — the FR-14 "classes + XP split" snapshot field. */
  classXp: Record<string, number>;
  /** Ability name → value, defaulted from the pack (FR-5). */
  readonly abilities: Readonly<Record<string, number>>;
  /** Save name → value — best across classes at their levels (FR-6). */
  saves: Record<string, number>;
  /** Pack-declared pool ids → current points (FR-8; vocabulary from pools.ts). */
  pools: Record<string, number>;
  /** Slot level ("1") → bound slot refs — null = empty, string = bound spell id (FR-8). */
  slots: Record<string, (string | null)[]>;
  conditions: ActiveCondition[];
  spells: string[];
  /** HP bookkeeping: the reserved formula's value is the cap; `current` starts at it. */
  hp: { current: number; temp: number };
}

/** api-map `char.derived()` — hp · ac · attackBonus · saveTargets (FR-3), all through pack formulas. */
export interface DerivedStats {
  /** The reserved `hp` formula's value — the cap (state.hp.current may be lower). */
  readonly hp: number;
  /** The reserved `ac` formula's value (CA-6). */
  readonly ac: number;
  /** Best attack bonus across classes that declare an `attackBonus` formula; table-convention classes contribute none (combat consults their attackTable). */
  readonly attackBonus?: number;
  /** The save targets — best per save across classes (FR-6). */
  readonly saves: Readonly<Record<string, number>>;
}

/** The thin character facade: derived() plus the mutation surfaces added at checkpoint 3. */
export class Character {
  constructor(
    readonly runtime: Runtime,
    readonly state: CharacterState,
  ) {}

  /** CA-4 — spend points from a pack-declared pool (pools.ts). */
  spend(pool: string, amount: number): void {
    spendPoolFn(this.runtime, this.state, pool, amount);
  }

  /** FR-9 — memorize a known spell into an empty slot (pools.ts). */
  prepare(spellId: string, slotIndex?: number): void {
    prepareSpellFn(this.runtime, this.state, spellId, slotIndex);
  }

  /** FR-8 — cast consumes a bound slot of the matching level (pools.ts). */
  cast(spellId: string, slotIndex?: number): void {
    castSpellFn(this.runtime, this.state, spellId, slotIndex);
  }

  /** FR-7 — apply a pack-declared condition (conditions.ts). */
  applyCondition(conditionId: string): void {
    applyConditionFn(this.runtime, this.state, conditionId);
  }

  /** FR-7 — remove an active condition (conditions.ts). */
  removeCondition(conditionId: string): void {
    removeConditionFn(this.runtime, this.state, conditionId);
  }

  /** FR-7 — thematic condition application via a pack theme table (conditions.ts). */
  applyTheme(themeId: string): void {
    applyThemeFn(this.runtime, this.state, themeId);
  }

  /** FR-7 — remove a theme's conditions (conditions.ts). */
  removeTheme(themeId: string): void {
    removeThemeFn(this.runtime, this.state, themeId);
  }

  /** FR-8 — the host's rest event (pools.ts). */
  rest(): void {
    restFn(this.runtime, this.state);
  }

  /** FR-7 — one round tick of condition durations (conditions.ts). */
  tick(): readonly RuntimeEvent[] {
    return tickConditions(this.runtime, this.state);
  }

  /** FR-3 — derived stats strictly through the pack's reserved formulas (CA-6). */
  derived(rng: Rng = new Rng(0)): DerivedStats {
    const abilities = this.state.abilities;
    const hp = reserveValue(this.runtime, 'hp', abilities, this.state.level, rng);
    const ac = reserveValue(this.runtime, 'ac', abilities, this.state.level, rng);
    let attackBonus: number | undefined;
    for (const entry of this.state.classes) {
      const ast = this.runtime.index.attackBonusAsts[entry.id];
      if (ast === undefined) continue;
      const value = valueOfFormula(evalFormula(ast, { ...abilities, level: entry.level }, rng));
      if (attackBonus === undefined || value > attackBonus) attackBonus = value;
    }
    return { hp, ac, saves: { ...this.state.saves }, ...(attackBonus !== undefined ? { attackBonus } : {}) };
  }
}

/**
 * FR-5 — build a character from the pack: abilities default to 10 per
 * `stats.abilities`, progression fills saves/slots, hp initializes from the
 * reserved formula (CA-6), and creation emits `character:created` (CA-3 named
 * non-combat event). Illegal builds are rejected with named rules (FR-6) by
 * the shared build validator — both creation paths run it.
 */
export function createCharacter(runtime: Runtime, request: CharacterCreateRequest): Character {
  const entries = request.classes.map((entry) =>
    typeof entry === 'string' ? { id: entry, level: request.level ?? 1 } : { ...entry },
  );
  const errors = validateBuild(runtime, request.race, entries);
  if (errors.length > 0) throw new CharacterBuildError(errors);

  const state = buildCharacter(runtime, { name: request.name, race: request.race, classes: entries });
  runtime.nextCharacterId += 1;
  runtime.events.emit({
    type: 'character:created',
    actor: state.id,
    payload: {
      id: state.id,
      name: state.name,
      race: state.race,
      classes: state.classes.map((entry) => ({ ...entry })),
    },
    why: { rule: `content.races.${state.race}`, rolls: [] },
  });
  return new Character(runtime, state);
}

/**
 * Evaluate ANY declared pack formula by id against the character's scalars
 * (abilities + level) — the shared engine for the reserved ids (CA-6) and
 * pool capacities (CA-4). Formula presence is a load-time guarantee.
 */
export function formulaValue(
  runtime: Runtime,
  formulaId: string,
  abilities: Readonly<Record<string, number>>,
  level: number,
  rng: Rng,
): number {
  const ast = runtime.index.formulaAsts[formulaId];
  if (ast === undefined) {
    throw new Error(
      `formula "${formulaId}" missing at play time — Runtime load should have rejected the pack (E-REF-01)`,
    );
  }
  return valueOfFormula(evalFormula(ast, { ...abilities, level }, rng));
}

/**
 * CA-6 — the only door to a derived stat: resolve the pack's reserved formula
 * id against the character's scalars (abilities + level). The load-time
 * recheck in Runtime guarantees the id exists.
 */
export function reserveValue(
  runtime: Runtime,
  reservedId: 'hp' | 'ac',
  abilities: Readonly<Record<string, number>>,
  level: number,
  rng: Rng,
): number {
  return formulaValue(runtime, reservedId, abilities, level, rng);
}
