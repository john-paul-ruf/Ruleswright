/**
 * Resolution (FR-3): everything combat-related runs through pack formulas and
 * the effect DSL. The engine's one resolution primitive is
 * `d20 + attackBonus ≥ defenseTarget` — but both sides are pack data, and the
 * engine never knows which defense convention a pack uses: a descending-AC
 * class's `byDefense` map is just keys, looked up by the defender's evaluated
 * defense value; an ascending class compares against the same number. The
 * `why` anatomy (FR-13) is assembled here: rule path + structured RollResults.
 *
 * Parse once at load, evaluate many in play (CA-2): effect strings are parsed
 * once when the combat engine binds a pack, formulas likewise — this module
 * never touches a parser at play time. Zero parser access during combat.
 *
 * Wiring shape (S03's executor contract, honored exactly): one
 * `executeEffect` call per target with a per-target `vars` map — the actor's
 * abilities/saves plus level and the engine-derived hp/ac/initiative
 * (EFFECT_SCALARS) on the actor, plus the DEFENDER's save and defense values
 * under their pack names so save recipes and attack defense formulas read
 * defender data. `attack()` reports and never mutates; the host `apply` turns
 * the executor's mutation requests into combat state + events. Because one
 * action's damage clause may roll several times (one per target), damage
 * callbacks carry the whole roll history; the combat layer gates them on the
 * attack verdict recorded for that target.
 */
import type { Pack } from '../../schema/pack';
import type { ActionDef, Statblock } from '../../schema/artifacts';
import type { DslCheckRequest } from '../../schema/validate';
import { packDslChecker } from '../../core/dsl/checker';
import { parseFormula, evalFormula } from '../../core/dsl/formula';
import {
  parseEffect,
  executeEffect,
  EFFECT_SCALARS,
  type EffectAst,
  type EffectContext,
  type EffectResolution,
  type EffectApply,
  type EffectTargetRef,
} from '../../core/dsl/effect';
import type { RollResult } from '../../core/dice';
import type { RandomSource } from '../../core/rng';

/** The per-target execution context the effect executor receives. */
export interface ResolutionVars {
  /** The attacking/acting combatant's numbers. */
  readonly actor: Readonly<Record<string, number>>;
  /** The defender's numbers, layered under the same pack names (saves, `ac`, …). */
  readonly defender: Readonly<Record<string, number>>;
}

/**
 * What the resolution layer tells the combat state about a mutation request.
 * `rolls` is the ordered roll history of the statement that produced the
 * mutation — the raw material of `why.rolls`.
 */
export interface MutationRequest {
  readonly targetId: string;
  readonly kind: 'damage' | 'condition';
  /** Damage amount (kind `damage`); the executor's honest total, positive or negative. */
  readonly amount?: number;
  readonly damageType?: string;
  readonly conditionId?: string;
  readonly duration?: number;
  /** Every structured roll in order, most recent last. */
  readonly rolls: readonly RollResult[];
}

/** A host-side sink for the executor's mutation requests. */
export type MutationSink = (request: MutationRequest) => void;

/**
 * A combatant as resolution sees it: pack-name-numbered abilities/saves, the
 * engine's derived stats, its action list, and the optional attack
 * progression table (pack data, engine-blind to its convention).
 */
export interface CombatantProfile {
  readonly id: string;
  /** Abilities + named saves + any pack-declared extras, by name. */
  readonly abilities: Readonly<Record<string, number>>;
  readonly saves: Readonly<Record<string, number>>;
  readonly level: number;
  readonly hp: number;
  readonly ac: number;
  readonly initiativeBonus: number;
  /** Ids of the actions this combatant may declare (characters and statblocks alike). */
  readonly actions: readonly string[];
  /** The combatant's attack progression table (pack data; descending/ascending convention is the pack's business). */
  readonly attackTable?: readonly { level: number; byDefense: Record<string, number> }[];
  /** Ascending attack bonus for classes that declare the bonus convention instead of a table. */
  readonly attackBonus?: number;
}

/** Which side a combatant fights for — also the encounter sides. */
export type Side = 'allies' | 'enemies';

/** One combatant in a bound combat: profile + a resolvable target reference. */
export interface BoundCombatant {
  readonly id: string;
  readonly side: Side;
  readonly profile: CombatantProfile;
}

/** A bound action ready to execute: the def plus its parse-once AST. */
export interface BoundAction {
  readonly id: string;
  readonly def: ActionDef;
  readonly ast: EffectAst;
}

/** Effect DSL strings are parsed once when combat binds the pack (CA-2). */
export function parsePackEffects(pack: Pack): Map<string, EffectAst> {
  const asts = new Map<string, EffectAst>();
  for (const [id, def] of Object.entries(pack.actions)) {
    const parsed = parseEffect(def.effect);
    if (!parsed.ok) {
      throw new Error(`pack action "${id}" failed to parse at play time — a validated pack never reaches here: ${parsed.reason}`);
    }
    asts.set(id, parsed.value);
  }
  for (const [id, spell] of Object.entries(pack.content.spells ?? {})) {
    const parsed = parseEffect(spell.effect);
    if (!parsed.ok) {
      throw new Error(`pack spell "${id}" failed to parse at play time — a validated pack never reaches here: ${parsed.reason}`);
    }
    asts.set(id, parsed.value);
  }
  for (const [id, feat] of Object.entries(pack.content.feats ?? {})) {
    if (feat.effect === undefined) continue;
    const parsed = parseEffect(feat.effect);
    if (!parsed.ok) {
      throw new Error(`pack feat "${id}" failed to parse at play time — a validated pack never reaches here: ${parsed.reason}`);
    }
    asts.set(id, parsed.value);
  }
  return asts;
}

/** Load-check every effect/formula/valid DSL string in a pack through the real checker (S01+S03 seams; empty = valid). */
export function checkPackDsl(pack: Pack): ReturnType<typeof packDslChecker> {
  const cards: ReturnType<typeof packDslChecker> = [];
  const abilities = pack.stats.abilities;
  const saves = pack.stats.saves;
  const request = (expr: string, kind: DslCheckRequest['kind'], artifactId: string, jsonPath: string) => ({
    expr,
    kind,
    artifactId,
    jsonPath,
    abilities,
    saves,
  });
  for (const [id, def] of Object.entries(pack.actions)) {
    cards.push(...packDslChecker(request(def.effect, 'effect', id, `actions.${id}.effect`)));
    if (def.valid !== undefined) cards.push(...packDslChecker(request(def.valid, 'valid', id, `actions.${id}.valid`)));
  }
  for (const [id, spell] of Object.entries(pack.content.spells ?? {})) {
    cards.push(...packDslChecker(request(spell.effect, 'effect', id, `content.spells.${id}.effect`)));
  }
  for (const [id, feat] of Object.entries(pack.content.feats ?? {})) {
    if (feat.effect !== undefined) cards.push(...packDslChecker(request(feat.effect, 'effect', id, `content.feats.${id}.effect`)));
    if (feat.passive !== undefined) cards.push(...packDslChecker(request(feat.passive, 'passive', id, `content.feats.${id}.passive`)));
  }
  for (const [id, formula] of Object.entries(pack.formulas)) {
    cards.push(...packDslChecker(request(formula.expr, 'formula', id, `formulas.${id}.expr`)));
  }
  for (const [classId, progression] of Object.entries(pack.progression)) {
    if (progression.attackBonus !== undefined) {
      cards.push(...packDslChecker(request(progression.attackBonus, 'attackBonus', classId, `progression.${classId}.attackBonus`)));
    }
  }
  return cards;
}

/**
 * Build a combatant profile from a statblock — the same machinery characters
 * use (FR-16): pack abilities with statblock overrides, save overrides, the
 * statblock's progression tables (referenced by id), and the pack's reserved
 * `hp`/`ac` formulas evaluated at the statblock's level.
 */
export function profileFromStatblock(pack: Pack, block: Statblock, id: string): CombatantProfile {
  const level = block.level ?? 1;
  const abilities: Record<string, number> = {};
  for (const ability of pack.stats.abilities) {
    abilities[ability] = block.abilityOverrides?.[ability] ?? 0;
  }
  const saves: Record<string, number> = {};
  for (const save of pack.stats.saves) {
    saves[save] = block.saveOverrides?.[save] ?? 0;
  }
  // Abilities and saves share one namespace in the pack's formulas (FR-3):
  // an override wins over the default 0 regardless of which list declared it.
  const base: Record<string, number> = {};
  for (const [name, value] of Object.entries(block.abilityOverrides ?? {})) base[name] = value;
  for (const [name, value] of Object.entries(block.saveOverrides ?? {})) base[name] = value;
  for (const ability of pack.stats.abilities) if (base[ability] === undefined) base[ability] = 0;
  for (const save of pack.stats.saves) if (base[save] === undefined) base[save] = 0;
  base['level'] = level;
  const progression = block.attackTable === undefined ? undefined : pack.progression[block.attackTable];
  return {
    id,
    abilities,
    saves,
    level,
    hp: evalPackFormula(pack, 'hp', base),
    ac: evalPackFormula(pack, 'ac', base),
    initiativeBonus: pack.formulas['initiative'] !== undefined ? evalPackFormula(pack, 'initiative', base) : 0,
    actions: [...block.actions],
    attackTable: progressionTableById(progression?.attackTable),
    attackBonus: attackBonusFromFormula(progression, base),
  };
}

/** The referenced progression's attack-table rows, or undefined (bonus convention / no rows). */
function progressionTableById(rows: readonly { level: number; byDefense: Record<string, number> }[] | undefined) {
  if (rows === undefined) return undefined;
  return rows.map((row) => ({ level: row.level, byDefense: { ...row.byDefense } }));
}

/** The referenced progression's declared attackBonus evaluated at the combatant's level (ascending convention). */
function attackBonusFromFormula(
  progression: { attackBonus?: string } | undefined,
  vars: Readonly<Record<string, number>>,
): number | undefined {
  if (progression === undefined || progression.attackBonus === undefined) return undefined;
  return evalDslFormula(progression.attackBonus, vars);
}

/** Evaluate a pack formula by id; reserved ids (hp/ac/initiative, CA-6) resolve only through these. */
export function evalPackFormula(pack: Pack, id: string, vars: Readonly<Record<string, number>>): number {
  const def = pack.formulas[id];
  if (def === undefined) {
    throw new Error(`formula "${id}" is not declared in the pack — derived stats resolve only through pack formulas (CA-6).`);
  }
  return evalDslFormula(def.expr, vars);
}

/** Evaluate a raw formula-DSL string against the zero-RNG stream (see the zeroRng note). */
function evalDslFormula(expr: string, vars: Readonly<Record<string, number>>): number {
  const parsed = parseFormula(expr);
  if (!parsed.ok) throw new Error(`formula does not parse — a validated pack never reaches here: ${parsed.reason}`);
  const value = evalFormula(parsed.value, vars, zeroRng);
  return typeof value === 'object' ? value.total : value;
}

const zeroRng: RandomSource = { int: () => 0 };

/**
 * The defense value a defender presents: the engine derives `ac` through the
 * pack formula (CA-6) and never interprets the convention — the ATTACKER's
 * table lookup consumes it (FR-3).
 */
export function defenseValue(defender: CombatantProfile): number {
  return defender.ac;
}

/** Roll d20 + attacker bonus against the defense target. Both sides are pack data (FR-3). */
export function attackRoll(attackBonus: number, defenseTarget: number, defenseName: string, rng: RandomSource): { roll: RollResult; hit: boolean } {
  const raw = rng.int(20) + 1;
  const total = raw + attackBonus;
  const roll: RollResult = {
    purpose: 'attack',
    sides: 20,
    values: [raw],
    modifier: attackBonus,
    total,
    verdict: { defense: defenseName, value: defenseTarget, result: total >= defenseTarget ? 'hit' : 'miss' },
  };
  return { roll, hit: total >= defenseTarget };
}

/**
 * The attacker's attack bonus against a defense value. Descending tables are
 * pack data: `byDefense[defenseValue]` IS the bonus — the engine adds no
 * interpretation, no sign flips, no convention knowledge (FR-3). Ascending
 * classes skip the table and use their declared attack bonus.
 */
export function attackBonusAgainst(attacker: CombatantProfile, defenseValue: number): number {
  const row = attacker.attackTable?.find((candidate) => candidate.level === attacker.level);
  const toHit = row?.byDefense[String(defenseValue)];
  if (toHit !== undefined) return toHit;
  if (attacker.attackBonus === undefined) {
    throw new Error(`combatant "${attacker.id}" has no attack progression covering defense ${defenseValue} — the pack's table must declare the row (FR-3).`);
  }
  return attacker.attackBonus;
}

/**
 * Execute a bound action's effect for one target. The executor runs once per
 * target with per-target vars: actor numbers plus the defender's saves and
 * defense under their pack names. Mutations flow to `sink` in executor order;
 * every mutation carries the statement's full roll history for `why.rolls`.
 */
export function executeAgainst(
  action: BoundAction,
  actor: BoundCombatant,
  target: BoundCombatant,
  rng: RandomSource,
  sink: MutationSink,
): readonly EffectResolution[] {
  const rolls: RollResult[] = [];
  const vars: Record<string, number> = {
    ...actor.profile.abilities,
    ...actor.profile.saves,
    level: actor.profile.level,
    hp: actor.profile.hp,
    ac: actor.profile.ac,
    initiative: actor.profile.initiativeBonus,
  };
  for (const [saveName, value] of Object.entries(target.profile.saves)) {
    vars[saveName] = value;
  }
  vars['ac'] = target.profile.ac;
  const apply: EffectApply = {
    resolveTargets: (shape: string) => {
      // Shapes resolve to the target the combat layer bound for this action;
      // combat declares one primary target per execution.
      void shape;
      return [{ id: target.id }];
    },
    damage: (ref: EffectTargetRef, roll: RollResult, type?: string) => {
      rolls.push(roll);
      sink({ targetId: ref.id, kind: 'damage', amount: roll.total, damageType: type, rolls: [...rolls] });
    },
    condition: (ref: EffectTargetRef, conditionId: string, duration: number) => {
      sink({ targetId: ref.id, kind: 'condition', conditionId, duration, rolls: [...rolls] });
    },
  };
  const ctx: EffectContext = { actor: actor.id, targets: [{ id: target.id }], rng, apply, vars };
  const outcomes = executeEffect(action.ast, ctx);
  for (const outcome of flatten(outcomes)) {
    if (outcome.kind === 'attack' && outcome.targetId === target.id) {
      rolls.push(outcome.roll);
    }
  }
  return outcomes;
}

function flatten(outcomes: readonly EffectResolution[]): readonly EffectResolution[] {
  const flat: EffectResolution[] = [];
  for (const outcome of outcomes) {
    flat.push(outcome);
    if (outcome.kind === 'save') {
      for (const perTarget of outcome.perTarget) flat.push(...flatten(perTarget.outcomes));
    } else if (outcome.kind === 'target') {
      flat.push(...flatten(outcome.outcomes));
    } else if (outcome.kind === 'sequence') {
      flat.push(...flatten(outcome.steps));
    }
  }
  return flat;
}

/** The scalars the effect executor may reference (CA-6 + level), re-exported for combat wiring. */
export const RESOLUTION_SCALARS = EFFECT_SCALARS;