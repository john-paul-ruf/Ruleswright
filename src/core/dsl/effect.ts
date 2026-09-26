/**
 * Effect DSL (FR-3): what actions do — `attack(ac, attackBonus)`,
 * `save(reason, 14, damage(3d6), damage(half))`, `applyCondition(prone, 2)`,
 * `target(burst-2, …)`, `sequence(…)`. One grammar, two vocabularies: the
 * checkpoint-1 parser is grammar-pure (any `name(…)` is a call node); this
 * module categorizes arguments by the registry's signatures and executes the
 * AST as a pure interpreter.
 *
 * Parse once at load (check time), evaluate many times in play (CA-2): S05's
 * combat calls `executeEffect` with an injected RandomSource and a host `apply`
 * interface — no parser access at play time. The executor requests mutations
 * through `apply` (damage, conditions, target resolution) and returns
 * structured per-target outcomes — the raw material of FR-13 events. Verdicts
 * are attached here: the executor is dice.ts's "caller".
 *
 * `half` is the reserved save-for-half marker (magic.html perTarget anatomy):
 * legal only as `damage(half)` inside a save's pass branch; it re-rolls the
 * fail branch's first damage expression and halves the total (rounded up —
 * mock: 3d6 → 10 → "half · 5 fire").
 */
import { parseRecipe, rollRecipe, type DiceRecipe, type RollResult } from '../dice';
import type { RandomSource } from '../rng';
import type { DslCheckRequest } from '../../schema/validate';
import type { ErrorCard } from '../../schema/error-card';
import { lookupFunction } from './registry';
import { dslCard } from './shared';
import { checkFormulaAst, evalFormula, parseFormula, valueOfFormula, type FormulaAst, type FormulaCheckContext, type FormulaContext, type FormulaNode, type FormulaValue } from './formula';

/** An effect node is the shared call-tree AST plus executor annotations. */
export interface EffectNode extends FormulaNode {
  /** Prebuilt `d20 + <saveName>` recipe — parsed at load, rolled at play (parse-once). */
  saveRecipe?: DiceRecipe;
  saveRecipeError?: string;
  /** Prebuilt `d20` recipe for attack statements. */
  attackRecipe?: DiceRecipe;
}

export type EffectAst = EffectNode;

/** Scalars an effect's formula arguments may reference at play time: level plus CA-6's engine-resolved derived stats. */
export const EFFECT_SCALARS: readonly string[] = ['level', 'hp', 'ac', 'initiative'];

/** Host-supplied target handle; identity only — combat state stays host-side. */
export interface EffectTargetRef {
  readonly id: string;
}

/** The mutation interface S05 wires: geometry, damage, conditions. The executor never mutates state itself. */
export interface EffectApply {
  /** Resolve a shape word ("adjacent", "burst-2", …) to the targets it covers — host geometry (FR-11). */
  resolveTargets(shape: string): readonly EffectTargetRef[];
  damage(target: EffectTargetRef, roll: RollResult, type?: string): void;
  condition(target: EffectTargetRef, conditionId: string, duration: number): void;
}

/** Play-time context: actor (opaque, host identity), scope targets, RNG, mutation callbacks, actor-state scalars. */
export interface EffectContext {
  readonly actor: unknown;
  readonly targets: readonly EffectTargetRef[];
  readonly rng: RandomSource;
  readonly apply: EffectApply;
  readonly vars: FormulaContext;
}

export interface AttackOutcome {
  readonly kind: 'attack';
  readonly targetId: string;
  /** d20 + bonus with verdict attached ({defense, value, result: 'hit' | 'miss'}). */
  readonly roll: RollResult;
  readonly hit: boolean;
}

export interface SaveTargetOutcome {
  readonly targetId: string;
  /** d20 + save with verdict attached ({defense: saveName, value: dc, result: 'fail' | 'pass'}). */
  readonly roll: RollResult;
  readonly branch: 'fail' | 'pass';
  /** Outcomes produced by the branch effect, scoped to this target. */
  readonly outcomes: readonly EffectResolution[];
}

export interface SaveOutcome {
  readonly kind: 'save';
  readonly saveName: string;
  readonly dc: number;
  readonly perTarget: readonly SaveTargetOutcome[];
}

export interface DamageOutcome {
  readonly kind: 'damage';
  readonly targetId: string;
  readonly roll: RollResult;
  readonly type?: string;
  /** True for damage(half): the total was halved (rounded up) from the fail branch's roll. */
  readonly halved: boolean;
}

export interface ConditionOutcome {
  readonly kind: 'condition';
  readonly targetId: string;
  readonly conditionId: string;
  readonly duration: number;
}

export interface TargetOutcome {
  readonly kind: 'target';
  readonly shape: string;
  /** How many targets the host resolved for the shape. */
  readonly count: number;
  readonly outcomes: readonly EffectResolution[];
}

export interface SequenceOutcome {
  readonly kind: 'sequence';
  readonly steps: readonly EffectResolution[];
}

export type EffectResolution = AttackOutcome | SaveOutcome | DamageOutcome | ConditionOutcome | TargetOutcome | SequenceOutcome;

// ---------------------------------------------------------------- parsing

/**
 * Parse an effect expression. The grammar is the checkpoint-1 parser (grammar-
 * pure call trees); the effect constraint is structural: the root must be a
 * statement — a call. Vocabulary and signature checks belong to the checker.
 */
export function parseEffect(src: string): { ok: true; value: EffectAst } | { ok: false; reason: string; start: number; length: number } {
  const parsed = parseFormula(src);
  if (!parsed.ok) return parsed;
  if (parsed.value.kind !== 'call') {
    return { ok: false, reason: 'effect must be a statement — a function call (attack(…), save(…), damage(…), …)', start: 0, length: src.length };
  }
  return { ok: true, value: annotateRecipes(parsed.value) };
}

/** Prebuild the load-time dice recipes play time will roll (parse-once, CA-2). */
function annotateRecipes(root: FormulaAst): EffectAst {
  const stack: FormulaAst[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === 'call') {
      const effectNode = node as EffectNode;
      const args = node.args ?? [];
      if (node.text === 'save' && args[0]?.kind === 'name') {
        const parsed = parseRecipe(`d20 + ${args[0].text ?? ''}`);
        if (parsed.ok) effectNode.saveRecipe = parsed.recipe;
        else effectNode.saveRecipeError = parsed.reason;
      }
      if (node.text === 'attack') {
        const parsed = parseRecipe('d20');
        if (parsed.ok) effectNode.attackRecipe = parsed.recipe;
      }
      for (const arg of args) stack.push(arg);
    } else if (node.kind === 'unary') {
      stack.push(node.operand!);
    } else if (node.kind === 'binary' || node.kind === 'comparator') {
      stack.push(node.left!, node.right!);
    }
  }
  return root as EffectAst;
}

// ---------------------------------------------------------------- execution

/**
 * Execute a parsed effect AST. Pure interpreter: all state mutation is
 * requested through `ctx.apply`; all randomness through `ctx.rng`; all actor
 * numbers through `ctx.vars`. Unknown functions throw — load-time checking
 * (E-FORM-02) rejects them; a play-time hit means a caller skipped validation.
 */
export function executeEffect(ast: EffectAst, ctx: EffectContext): readonly EffectResolution[] {
  return execStatement(ast, ctx, ctx.targets, undefined);
}

function execStatement(node: FormulaAst, ctx: EffectContext, scope: readonly EffectTargetRef[], halveFrom: HalveFrom | undefined): readonly EffectResolution[] {
  if (node.kind !== 'call') {
    throw new Error(`effect statement must be a function call, got "${node.kind}" — validate before execution (E-FORM-02)`);
  }
  const args = node.args ?? [];
  switch (node.text) {
    case 'attack':
      return execAttack(node, args, ctx, scope);
    case 'save':
      return execSave(node, args, ctx, scope);
    case 'damage':
      return execDamage(node, args, ctx, scope, halveFrom);
    case 'applyCondition':
      return execCondition(args, ctx, scope);
    case 'target':
      return execTarget(args, ctx, scope, halveFrom);
    case 'sequence':
      return execSequence(args, ctx, scope, halveFrom);
    default:
      throw new Error(`unknown effect function "${node.text}" — validate before execution (E-FORM-02)`);
  }
}

function execAttack(node: FormulaAst, args: readonly FormulaAst[], ctx: EffectContext, scope: readonly EffectTargetRef[]): readonly EffectResolution[] {
  const effectNode = node as EffectNode;
  if (effectNode.attackRecipe === undefined) {
    throw new Error('attack statement is missing its prebuilt d20 recipe — parse effects through parseEffect (E-FORM-01)');
  }
  const defense = valueOfFormula(evalFormula(args[0]!, ctx.vars, ctx.rng));
  const bonus = valueOfFormula(evalFormula(args[1]!, ctx.vars, ctx.rng));
  const defenseName = args[0]!.kind === 'name' ? args[0]!.text ?? 'defense' : 'defense';
  const outcomes: AttackOutcome[] = [];
  for (const target of scope) {
    const rolled = rollRecipe(effectNode.attackRecipe, ctx.rng, {}, 'attack');
    const roll: RollResult = { ...rolled, modifier: rolled.modifier + bonus, total: rolled.total + bonus };
    const hit = roll.total >= defense;
    const judged: RollResult = { ...roll, verdict: { defense: defenseName, value: defense, result: hit ? 'hit' : 'miss' } };
    outcomes.push({ kind: 'attack', targetId: target.id, roll: judged, hit });
  }
  return outcomes;
}

function execSave(node: FormulaAst, args: readonly FormulaAst[], ctx: EffectContext, scope: readonly EffectTargetRef[]): readonly EffectResolution[] {
  const effectNode = node as EffectNode;
  const saveName = args[0]?.kind === 'name' ? args[0].text ?? '' : '';
  if (effectNode.saveRecipe === undefined) {
    throw new Error(`save statement is missing its prebuilt d20 recipe${effectNode.saveRecipeError === undefined ? '' : ` (${effectNode.saveRecipeError})`} — parse effects through parseEffect (E-FORM-01)`);
  }
  const dc = valueOfFormula(evalFormula(args[1]!, ctx.vars, ctx.rng));
  const [failEffect, passEffect] = [args[2]!, args[3]!];
  const perTarget: SaveTargetOutcome[] = [];
  for (const target of scope) {
    const roll = rollRecipe(effectNode.saveRecipe, ctx.rng, ctx.vars, saveName);
    const passed = roll.total >= dc;
    const judged: RollResult = { ...roll, verdict: { defense: saveName, value: dc, result: passed ? 'pass' : 'fail' } };
    const branch = passed ? passEffect : failEffect;
    const branchScope: readonly EffectTargetRef[] = [target];
    const outcomes = execStatement(branch, ctx, branchScope, passed ? halveFromFail(failEffect) : undefined);
    perTarget.push({ targetId: target.id, roll: judged, branch: passed ? 'pass' : 'fail', outcomes });
  }
  return [{ kind: 'save', saveName, dc, perTarget }];
}

function execDamage(node: FormulaAst, args: readonly FormulaAst[], ctx: EffectContext, scope: readonly EffectTargetRef[], halveFrom: HalveFrom | undefined): readonly EffectResolution[] {
  const ownType = args[1]?.kind === 'name' ? args[1].text ?? undefined : undefined;
  const half = args[0]!.kind === 'name' && args[0]!.text === 'half';
  if (half && halveFrom === undefined) {
    throw new Error('damage(half) needs a save fail branch with a damage statement to halve — validate before execution (E-FORM-02)');
  }
  const outcomes: DamageOutcome[] = [];
  for (const target of scope) {
    const value = half ? evalFormula(halveFrom!.expr, ctx.vars, ctx.rng) : evalFormula(args[0]!, ctx.vars, ctx.rng);
    const rolled = toRoll(value, 'damage');
    const halvedTotal = Math.ceil(rolled.total / 2);
    const roll = half ? { ...rolled, modifier: rolled.modifier + (halvedTotal - rolled.total), total: halvedTotal } : rolled;
    const effectiveType = half ? halveFrom!.type ?? ownType : ownType;
    ctx.apply.damage(target, roll, effectiveType);
    outcomes.push({ kind: 'damage', targetId: target.id, roll, ...(effectiveType !== undefined ? { type: effectiveType } : {}), halved: half });
  }
  return outcomes;
}

function execCondition(args: readonly FormulaAst[], ctx: EffectContext, scope: readonly EffectTargetRef[]): readonly EffectResolution[] {
  const conditionId = args[0]?.kind === 'name' ? args[0].text ?? '' : '';
  const duration = valueOfFormula(evalFormula(args[1]!, ctx.vars, ctx.rng));
  const outcomes: ConditionOutcome[] = [];
  for (const target of scope) {
    ctx.apply.condition(target, conditionId, duration);
    outcomes.push({ kind: 'condition', targetId: target.id, conditionId, duration });
  }
  return outcomes;
}

function execTarget(args: readonly FormulaAst[], ctx: EffectContext, scope: readonly EffectTargetRef[], halveFrom: HalveFrom | undefined): readonly EffectResolution[] {
  const shape = args[0]?.kind === 'name' ? args[0].text ?? '' : '';
  const resolved = ctx.apply.resolveTargets(shape);
  const outcomes = execStatement(args[1]!, ctx, resolved, halveFrom);
  return [{ kind: 'target', shape, count: resolved.length, outcomes }];
}

function execSequence(args: readonly FormulaAst[], ctx: EffectContext, scope: readonly EffectTargetRef[], halveFrom: HalveFrom | undefined): readonly EffectResolution[] {
  const steps: EffectResolution[] = [];
  for (const arg of args) {
    for (const outcome of execStatement(arg, ctx, scope, halveFrom)) steps.push(outcome);
  }
  return [{ kind: 'sequence', steps }];
}

/** The fail branch's first damage expression + its declared type — what damage(half) re-rolls and halves (magic.html: "half · 5 fire"). */
type HalveFrom = { expr: FormulaAst; type?: string };

function halveFromFail(node: FormulaAst): HalveFrom | undefined {
  if (node.kind !== 'call') return undefined;
  if (node.text === 'damage') {
    const arg = node.args?.[0];
    if (arg === undefined || (arg.kind === 'name' && arg.text === 'half')) return undefined;
    const typeArg = node.args?.[1];
    return { expr: arg, type: typeArg !== undefined && typeArg.kind === 'name' ? typeArg.text ?? undefined : undefined };
  }
  for (const arg of node.args ?? []) {
    const found = halveFromFail(arg);
    if (found !== undefined) return found;
  }
  return undefined;
}

function toRoll(value: FormulaValue, purpose: string): RollResult {
  if (typeof value === 'object') return { ...value, purpose };
  return { purpose, sides: 0, values: [], modifier: value, total: value };
}

// ---------------------------------------------------------------- checking (S01 seam, E-FORM-01/02/03)

const ARG_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  attack: ['formula', 'formula'],
  save: ['save-name', 'formula', 'effect', 'effect'],
  damage: ['formula', 'type'],
  applyCondition: ['condition-id', 'formula'],
  target: ['shape', 'effect'],
  sequence: [],
};

/**
 * The S01 seam for `effect` fields: parse + semantic walk → ErrorCards. Every
 * call must exist in the closed registry (E-FORM-02) with legal arity and
 * argument categories; save names must resolve against ctx.saves (E-FORM-03,
 * did-you-mean); `half` is legal only as damage(half) in a save pass branch.
 */
export function checkEffect(request: DslCheckRequest): ErrorCard[] {
  const parsed = parseEffect(request.expr);
  if (!parsed.ok) {
    return [dslCard('E-FORM-01', request, `cannot parse effect at offset ${parsed.start}: ${parsed.reason}`)];
  }
  if (parsed.value.saveRecipeError !== undefined) {
    return [dslCard('E-FORM-01', request, `invalid save statement — ${parsed.value.saveRecipeError}`)];
  }
  const ctx: FormulaCheckContext = { abilities: request.abilities, saves: request.saves, scalars: EFFECT_SCALARS };
  const failure = checkEffectAst(parsed.value, ctx, false, true);
  if (failure === undefined) return [];
  return [dslCard(failure.rule, request, failure.message, failure.hint)];
}

type EffectFailure = { rule: 'E-FORM-01' | 'E-FORM-02' | 'E-FORM-03'; message: string; hint?: string };

function checkEffectAst(node: FormulaAst, ctx: FormulaCheckContext, insideSavePass: boolean, atEffectPosition: boolean): EffectFailure | undefined {
  if (node.kind !== 'call') {
    if (atEffectPosition) {
      return { rule: 'E-FORM-02', message: 'an effect position needs a statement — a function call (attack(…), save(…), damage(…), …).' };
    }
    return undefined; // scalar name leaf at a shape/type position — category checks happen at the call
  }
  const name = node.text ?? '';
  const spec = lookupFunction(name);
  if (spec === undefined) {
    return { rule: 'E-FORM-02', message: `unknown function "${name}" — the function registry is closed.` };
  }
  if (spec.kind !== 'effect') {
    return {
      rule: 'E-FORM-02',
      message:
        spec.kind === 'formula'
          ? `function "${name}" is a formula function, not an effect statement.`
          : `"${name}" cannot be used here — ${spec.kind} vocabulary only.`,
    };
  }
  const categories = ARG_CATEGORIES[name] ?? [];
  const [minArgs, maxArgs] = typeof spec.arity === 'number' ? [spec.arity, spec.arity] : spec.arity;
  const count = (node.args ?? []).length;
  if (count < minArgs || count > maxArgs) {
    return {
      rule: 'E-FORM-02',
      message: `function "${name}" takes ${minArgs === maxArgs ? minArgs : `${minArgs}-${maxArgs}`} argument(s), got ${count}.`,
    };
  }
  const args = node.args ?? [];
  for (const [index, arg] of args.entries()) {
    const category = name === 'sequence' ? 'effect' : categories[index];
    if (category === undefined) continue;
    if (category === 'effect') {
      const failure = checkEffectAst(arg, ctx, name === 'save' && index === 3, true);
      if (failure !== undefined) return failure;
      continue;
    }
    if (category === 'formula') {
      if (name === 'damage' && index === 0 && arg.kind === 'name' && arg.text === 'half') {
        if (!insideSavePass) {
          return { rule: 'E-FORM-02', message: "damage(half) is only legal inside a save statement's pass branch — the marker halves the fail branch's damage." };
        }
        continue;
      }
      const failure = checkFormulaAst(arg, ctx);
      if (failure !== undefined) return failure;
      continue;
    }
    // save-name | shape | condition-id | type: a bare name leaf, open vocabulary except save names.
    if (arg.kind !== 'name') {
      return { rule: 'E-FORM-02', message: `argument ${index + 1} of "${name}" must be a bare name.` };
    }
    if (category === 'save-name') {
      const saveName = arg.text ?? '';
      if (!ctx.saves.includes(saveName)) {
        const near = nearestSaveName(saveName, ctx.saves);
        return {
          rule: 'E-FORM-03',
          message: `unknown save "${saveName}" — not declared in stats.saves.`,
          hint: near === undefined ? undefined : `did you mean "${near}"?`,
        };
      }
    }
  }
  return undefined;
}

/** did-you-mean for save names (E-FORM-03) — nearest by edit distance, S01's nearestIds semantics. */
function nearestSaveName(target: string, saves: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of saves) {
    const distance = editDistance(target, candidate);
    if (distance < bestDistance || (distance === bestDistance && best !== undefined && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (previous[j] ?? i) + 1,
        (current[j - 1] ?? i) + 1,
        (previous[j - 1] ?? i - 1) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j] ?? i;
  }
  return previous[b.length] ?? a.length;
}