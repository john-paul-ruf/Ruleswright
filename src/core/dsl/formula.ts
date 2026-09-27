/**
 * Formula DSL (FR-3): derived-stat expressions like `8 + vigor`, `1d8 + might`,
 * `level * 2`, `4d6kh3`, `min(floor(level / 2) + might, 6)`, plus comparators
 * for validity expressions (`level >= 3`, `hasTarget(adjacent)`). Parse once at
 * load → AST; evaluate many times in play with an injected RandomSource — no
 * parsing during combat (CA-2). No dynamic code execution, no ambient
 * randomness; arithmetic is plain IEEE-754 over caller-supplied plain JSON
 * context.
 *
 * Dice terms delegate to S02's recipes: one dice lexeme = one recipe = one die
 * cluster; multi-dice compose with `+`/`-` (values concatenate in evaluation
 * order, modifiers sum, and the RollResult total invariant survives). A
 * comparator judges a roll by its total.
 */
import type { RandomSource } from '../rng';
import { parseRecipe, rollRecipe, type DiceRecipe, type RollResult } from '../dice';
import type { DslCheckRequest } from '../../schema/validate';
import type { ErrorCard } from '../../schema/error-card';
import { lookupFunction } from './registry';
import {
  dslCard,
  nearestName,
  tokenize,
  MAX_EXPR_LENGTH,
  MAX_PARSE_DEPTH,
  type DslParse,
  type Pos,
  type Token,
} from './shared';

/** Scalar result of formula evaluation — a number, or a roll when the formula contains dice. */
export type FormulaValue = number | RollResult;

/** Eval context: actor stats, level, params, and any extra named scalars the host binds. */
export type FormulaContext = Readonly<Record<string, number>>;

/** Parse-once AST node. `pos` spans the node's source characters. */
export interface FormulaNode extends Pos {
  readonly kind: 'number' | 'name' | 'dice' | 'unary' | 'binary' | 'call' | 'comparator';
  readonly text?: string;
  readonly value?: number;
  readonly op?: string;
  readonly args?: readonly FormulaNode[];
  readonly left?: FormulaNode;
  readonly right?: FormulaNode;
  readonly operand?: FormulaNode;
  /** Dice terms carry their S02 parse; failures are recorded for the checker. */
  readonly recipe?: DiceRecipe;
  readonly recipeError?: string;
}

export type FormulaAst = FormulaNode;

/** The one name-resolution vocabulary for checking: abilities, saves, host-bound scalars. */
export interface FormulaCheckContext {
  readonly abilities: readonly string[];
  readonly saves: readonly string[];
  /** Extra bound scalars (pack formula params, host vars). */
  readonly scalars?: readonly string[];
  /** Which call vocabulary the expression allows: formula (default) or validity (`valid` fields). */
  readonly allow?: 'formula' | 'validity';
}

/** Names every formula may reference without declaring: the actor's level (FR-3/FR-5). */
export const BUILTIN_SCALARS: readonly string[] = ['level'];

export type FormulaParse = DslParse<FormulaAst>;

const OP_PRECEDENCE: Readonly<Record<string, number>> = { '*': 3, '/': 3, '+': 2, '-': 2 };
const COMPARATORS = ['≥', '>', '<', '≤', '='];

// ---------------------------------------------------------------- parser

/** Parse a formula expression into an AST (bounded depth; failures carry a source span). */
export function parseFormula(src: string): FormulaParse {
  if (src.length > MAX_EXPR_LENGTH) {
    return {
      ok: false,
      reason: `expression exceeds the documented length limit (${MAX_EXPR_LENGTH} chars)`,
      start: MAX_EXPR_LENGTH,
      length: src.length - MAX_EXPR_LENGTH,
    };
  }
  const tokens = tokenize(src);
  if (!tokens.ok) return { ok: false, reason: tokens.reason, start: tokens.start, length: tokens.length };
  const parser = new FormulaParser(src, tokens.value);
  const ast = parser.parseExpression(0);
  if (!parser.ok()) return { ok: false, ...parser.failureSpan() };
  const end = parser.expectEnd();
  if (!end.ok) return { ok: false, reason: end.reason, start: end.start, length: end.length };
  return { ok: true, value: ast };
}

class FormulaParser {
  private index = 0;
  private depth = 0;
  private failure: { reason: string; start: number; length: number } | undefined;

  constructor(
    private readonly src: string,
    private readonly tokens: readonly Token[],
  ) {}

  ok(): boolean {
    return this.failure === undefined;
  }

  failureSpan(): { reason: string; start: number; length: number } {
    return this.failure ?? { reason: 'unparseable expression', start: 0, length: 0 };
  }

  /** Precedence climbing: `* /` bind tighter than `+ -`; comparators sit on top, non-associative. */
  parseExpression(minPrecedence: number): FormulaAst {
    let left = this.parseAtom();
    while (this.ok() && this.peek()?.kind === 'op') {
      const token = this.peek()!;
      const comparator = COMPARATORS.includes(token.text);
      const precedence = comparator ? 1 : OP_PRECEDENCE[token.text];
      if (precedence === undefined || precedence < minPrecedence) break;
      this.advance();
      const right = this.parseExpression(precedence + 1);
      left = comparator
        ? { kind: 'comparator', op: token.text, left, right, pos: this.span(left, right) }
        : { kind: 'binary', op: token.text, left, right, pos: this.span(left, right) };
    }
    return left;
  }

  parseAtom(): FormulaAst {
    const token = this.peek();
    if (token === undefined) {
      return this.failAt('expression ends unexpectedly', this.src.length, 1);
    }
    if (token.kind === 'op' && (token.text === '+' || token.text === '-')) {
      this.advance();
      const operand = this.parseAtom();
      return this.ok()
        ? { kind: 'unary', op: token.text, operand, pos: this.spanPos(token.pos, operand.pos) }
        : operand;
    }
    if (token.kind === 'number') {
      this.advance();
      return { kind: 'number', value: Number(token.text), text: token.text, pos: token.pos };
    }
    if (token.kind === 'dice') {
      this.advance();
      return this.diceNode(token);
    }
    if (token.kind === 'name') {
      this.advance();
      const next = this.peek();
      if (next !== undefined && next.kind === 'lparen') {
        return this.parseCall(token);
      }
      return { kind: 'name', text: token.text, pos: token.pos };
    }
    if (token.kind === 'lparen') {
      this.advance();
      this.depth += 1;
      if (this.depth > MAX_PARSE_DEPTH) {
        return this.failAt(
          `expression nests deeper than the documented limit (${MAX_PARSE_DEPTH})`,
          token.pos.start,
          token.pos.length,
        );
      }
      const inner = this.parseExpression(0);
      if (!this.ok()) return inner;
      const closing = this.expect('rparen');
      if (!closing.ok) return this.failAt(closing.reason, closing.start, closing.length);
      this.depth -= 1;
      return inner;
    }
    return this.failAt(`unexpected "${token.text}"`, token.pos.start, token.pos.length);
  }

  private parseCall(callee: Token): FormulaAst {
    this.advance(); // consume (
    // The parser is grammar-pure: any name(…) is a call node. Registry membership
    // (E-FORM-02) is the checker's semantic duty — database.md separates the rules.
    const args: FormulaAst[] = [];
    if (this.peek()?.kind !== 'rparen') {
      do {
        const arg = this.parseExpression(0);
        if (!this.ok()) return arg;
        args.push(arg);
      } while (this.acceptComma());
    }
    const closing = this.expect('rparen');
    if (!closing.ok) return this.failAt(closing.reason, closing.start, closing.length);
    return {
      kind: 'call',
      text: callee.text,
      args,
      pos: {
        start: callee.pos.start,
        length: closing.token.pos.start + closing.token.pos.length - callee.pos.start,
      },
    };
  }

  private diceNode(token: Token): FormulaAst {
    const parsed = parseRecipe(token.text);
    if (!parsed.ok) {
      return { kind: 'dice', text: token.text, recipeError: parsed.reason, pos: token.pos };
    }
    return { kind: 'dice', text: token.text, recipe: parsed.recipe, pos: token.pos };
  }

  private acceptComma(): boolean {
    if (this.peek()?.kind !== 'comma') return false;
    this.advance();
    return true;
  }

  private expect(
    kind: Token['kind'],
  ): { ok: true; token: Token } | { ok: false; reason: string; start: number; length: number } {
    const token = this.peek();
    if (token === undefined) {
      return {
        ok: false,
        reason: `"${kind}" expected but the expression ends`,
        start: this.src.length,
        length: 1,
      };
    }
    if (token.kind !== kind) {
      return {
        ok: false,
        reason: `"${kind}" expected, found "${token.text}"`,
        start: token.pos.start,
        length: token.pos.length,
      };
    }
    this.advance();
    return { ok: true, token };
  }

  expectEnd(): { ok: true } | { ok: false; reason: string; start: number; length: number } {
    const token = this.peek();
    if (token === undefined) return { ok: true };
    return {
      ok: false,
      reason: `unexpected trailing "${token.text}"`,
      start: token.pos.start,
      length: token.pos.length,
    };
  }

  private failAt(reason: string, start: number, length: number): FormulaAst {
    if (this.failure === undefined) this.failure = { reason, start, length };
    return { kind: 'number', value: 0, pos: { start, length } };
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private advance(): void {
    if (this.index < this.tokens.length) this.index += 1;
  }

  private span(left: Pos, right: Pos) {
    return { start: left.pos.start, length: right.pos.start + right.pos.length - left.pos.start };
  }

  private spanPos(left: { start: number; length: number }, right: { start: number; length: number }) {
    return { start: left.start, length: right.start + right.length - left.start };
  }
}

// ---------------------------------------------------------------- evaluation

/**
 * Evaluate a parsed AST against a caller-supplied context and RNG. Dice terms
 * roll through S02's `rollRecipe`; everything else is pure arithmetic over the
 * context map. Unknown names throw — load-time checking (E-FORM-03) rejects
 * them; a play-time hit means a caller skipped validation.
 */
export function evalFormula(ast: FormulaAst, ctx: FormulaContext, rng: RandomSource): FormulaValue {
  switch (ast.kind) {
    case 'number':
      return ast.value ?? 0;
    case 'name': {
      const value = ctx[ast.text ?? ''];
      if (value === undefined)
        throw new Error(`unknown name "${ast.text}" — validate the formula before evaluation (E-FORM-03)`);
      return value;
    }
    case 'dice':
      return rollRecipe(ast.recipe!, rng, ctx, 'formula');
    case 'unary':
      return ast.op === '-'
        ? -valueOfFormula(evalFormula(ast.operand!, ctx, rng))
        : valueOfFormula(evalFormula(ast.operand!, ctx, rng));
    case 'binary':
      return arithmetic(ast, ctx, rng);
    case 'comparator': {
      const left = valueOfFormula(evalFormula(ast.left!, ctx, rng));
      const right = valueOfFormula(evalFormula(ast.right!, ctx, rng));
      return compare(ast.op!, left, right) ? 1 : 0;
    }
    case 'call':
      return evalCall(ast, ctx, rng);
  }
}

/** `+`/`-` compose dice clusters with scalars and each other; `*` `/` are scalar-only. */
function arithmetic(ast: FormulaAst, ctx: FormulaContext, rng: RandomSource): FormulaValue {
  const left = evalFormula(ast.left!, ctx, rng);
  const right = evalFormula(ast.right!, ctx, rng);
  if (ast.op === '*' || ast.op === '/') {
    if (isRoll(left) || isRoll(right)) {
      throw new Error(
        'multiplication and division are defined over scalar operands only — roll first, then scale',
      );
    }
    const a = valueOfFormula(left);
    const b = valueOfFormula(right);
    if (ast.op === '/' && b === 0) throw new Error('division by zero in formula evaluation');
    return ast.op === '*' ? a * b : a / b;
  }
  const sign: 1 | -1 = ast.op === '-' ? -1 : 1;
  if (isRoll(left) && isRoll(right)) return mergeRolls(left, right, sign);
  if (isRoll(left)) return foldRoll(left, sign * valueOfFormula(right));
  if (isRoll(right))
    return sign === 1
      ? foldRoll(right, valueOfFormula(left))
      : foldRoll(negateRoll(right), valueOfFormula(left));
  const a = valueOfFormula(left);
  const b = valueOfFormula(right);
  return ast.op === '+' ? a + b : a - b;
}

/** Two dice clusters compose into one roll result: values concatenate, modifiers and totals add. */
function mergeRolls(left: RollResult, right: RollResult, sign: 1 | -1): RollResult {
  const modifier = left.modifier + sign * right.modifier;
  const values =
    sign === 1 ? [...left.values, ...right.values] : [...left.values, ...right.values.map((value) => -value)];
  return { purpose: left.purpose, sides: left.sides, values, modifier, total: sum(values) + modifier };
}

function foldRoll(roll: RollResult, delta: number): RollResult {
  return { ...roll, modifier: roll.modifier + delta, total: roll.total + delta };
}

/** Scalar-minus-dice negates the dice side: values and modifier flip, total follows. */
function negateRoll(roll: RollResult): RollResult {
  return {
    ...roll,
    values: roll.values.map((value) => -value),
    modifier: -roll.modifier,
    total: -roll.total,
  };
}

function evalCall(ast: FormulaAst, ctx: FormulaContext, rng: RandomSource): FormulaValue {
  const scalars = (ast.args ?? []).map((arg) => valueOfFormula(evalFormula(arg, ctx, rng)));
  switch (ast.text) {
    case 'min':
      return Math.min(scalars[0]!, scalars[1]!);
    case 'max':
      return Math.max(scalars[0]!, scalars[1]!);
    case 'floor':
      return Math.floor(scalars[0]!);
    case 'ceil':
      return Math.ceil(scalars[0]!);
    default:
      throw new Error(
        `function "${ast.text}" is not a formula function — validate before evaluation (E-FORM-02)`,
      );
  }
}

function compare(op: string, left: number, right: number): boolean {
  switch (op) {
    case '≥':
      return left >= right;
    case '≤':
      return left <= right;
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '=':
      return left === right;
    default:
      return false;
  }
}

export function valueOfFormula(value: FormulaValue): number {
  return isRoll(value) ? value.total : value;
}

/**
 * Evaluate a validity AST (CA-G5). Comparators and scalar calls delegate to
 * evalFormula; `hasTarget(shape)` resolves through the injected geometry
 * callback — the engine's shape vocabulary lives in the caller (M03), not
 * here (core stays runtime-ignorant). Unknown call names throw (E-FORM-02's
 * check-time guarantee: a validated pack never reaches one at play time).
 */
export function evalValidity(
  ast: FormulaAst,
  ctx: FormulaContext,
  hasTarget: (shape: string) => boolean,
): boolean {
  switch (ast.kind) {
    case 'call':
      if (ast.text === 'hasTarget') {
        const arg = (ast.args ?? [])[0];
        if (arg === undefined || arg.kind !== 'name') {
          throw new Error('hasTarget takes a bare shape name — validate before evaluation (E-FORM-02)');
        }
        return hasTarget(arg.text ?? '');
      }
      return valueOfFormula(evalFormula(ast, ctx, zeroRng)) !== 0;
    case 'comparator':
      return valueOfFormula(evalFormula(ast, ctx, zeroRng)) !== 0;
    default:
      throw new Error(
        `a validity expression evaluates to a comparator or call, got "${ast.kind}" — validate before evaluation (E-FORM-01)`,
      );
  }
}

function isRoll(value: FormulaValue): value is RollResult {
  return typeof value === 'object';
}

/** Validity expressions never roll dice — evaluations ride the zero-RNG stream. */
const zeroRng: RandomSource = { int: () => 0 };

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// ---------------------------------------------------------------- checking (S01 seam, E-FORM-01/02/03)

/** Semantic failure found while walking an AST; the caller turns it into an ErrorCard. */
export interface SemanticFailure {
  readonly rule: 'E-FORM-01' | 'E-FORM-02' | 'E-FORM-03';
  readonly message: string;
  readonly hint?: string;
}

/** Walk the AST; names must resolve, dice terms must be legal recipes, calls must match the context's vocabulary. */
export function checkFormulaAst(
  ast: FormulaAst,
  ctx: FormulaCheckContext,
  insideValidity = false,
): SemanticFailure | undefined {
  switch (ast.kind) {
    case 'dice':
      if (ast.recipeError !== undefined) {
        return { rule: 'E-FORM-01', message: `invalid dice term "${ast.text}" — ${ast.recipeError}` };
      }
      return undefined;
    case 'name': {
      if (insideValidity) return undefined; // shape/predicate vocabulary inside hasTarget(...) is open (mocks pin `adjacent`)
      const name = ast.text ?? '';
      if (isFormulaName(name, ctx)) return undefined;
      const near = nearestName(name, nameCandidates(ctx));
      return {
        rule: 'E-FORM-03',
        message: `unknown name "${name}" in formula — not an ability, save, or declared scalar.`,
        hint: near === undefined ? undefined : `did you mean "${near}"?`,
      };
    }
    case 'call': {
      const name = ast.text ?? '';
      const spec = lookupFunction(name);
      if (spec === undefined) {
        return {
          rule: 'E-FORM-02',
          message: `unknown function "${name}" — the function registry is closed.`,
        };
      }
      if (spec.kind === 'reserved') {
        return {
          rule: 'E-FORM-02',
          message: `"${name}" is a reserved marker, not a function — it belongs inside damage().`,
        };
      }
      if (spec.kind === 'validity') {
        if (ctx.allow !== 'validity') {
          return {
            rule: 'E-FORM-02',
            message: `function "${name}" is a validity function, not a formula function.`,
          };
        }
        for (const arg of ast.args ?? []) {
          const failure = checkFormulaAst(arg, ctx, true);
          if (failure !== undefined) return failure;
        }
        return undefined;
      }
      if (spec.kind !== 'formula') {
        return {
          rule: 'E-FORM-02',
          message: `function "${name}" is an effect function, not a formula function.`,
        };
      }
      const [minArgs, maxArgs] = typeof spec.arity === 'number' ? [spec.arity, spec.arity] : spec.arity;
      const count = (ast.args ?? []).length;
      if (count < minArgs || count > maxArgs) {
        return {
          rule: 'E-FORM-02',
          message: `function "${name}" takes ${minArgs === maxArgs ? minArgs : `${minArgs}-${maxArgs}`} argument(s), got ${count}.`,
        };
      }
      for (const arg of ast.args ?? []) {
        const failure = checkFormulaAst(arg, ctx, insideValidity);
        if (failure !== undefined) return failure;
      }
      return undefined;
    }
    case 'unary':
      return checkFormulaAst(ast.operand!, ctx, insideValidity);
    case 'binary':
    case 'comparator':
      return (
        checkFormulaAst(ast.left!, ctx, insideValidity) ?? checkFormulaAst(ast.right!, ctx, insideValidity)
      );
    case 'number':
      return undefined;
  }
}

function isFormulaName(name: string, ctx: FormulaCheckContext): boolean {
  return (
    BUILTIN_SCALARS.includes(name) ||
    ctx.abilities.includes(name) ||
    ctx.saves.includes(name) ||
    (ctx.scalars ?? []).includes(name)
  );
}

function nameCandidates(ctx: FormulaCheckContext): readonly string[] {
  return [...BUILTIN_SCALARS, ...ctx.abilities, ...ctx.saves, ...(ctx.scalars ?? [])];
}

/**
 * The S01 seam for formula-shaped fields (`formula`, `valid`, `passive`,
 * `attackBonus`): parse + semantic check → ErrorCards. `valid` expressions
 * speak the validity vocabulary (`hasTarget`); everything else speaks the
 * formula vocabulary.
 */
export function checkFormula(request: DslCheckRequest): ErrorCard[] {
  const parsed = parseFormula(request.expr);
  if (!parsed.ok) {
    return [
      dslCard(
        'E-FORM-01',
        request,
        `cannot parse ${request.kind} expression at offset ${parsed.start}: ${parsed.reason}`,
      ),
    ];
  }
  const ctx: FormulaCheckContext =
    request.kind === 'valid'
      ? { abilities: request.abilities, saves: request.saves, allow: 'validity' }
      : { abilities: request.abilities, saves: request.saves };
  const failure = checkFormulaAst(parsed.value, ctx);
  if (failure === undefined) return [];
  return [dslCard(failure.rule, request, failure.message, failure.hint)];
}
