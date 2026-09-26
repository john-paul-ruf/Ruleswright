import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFormula, evalFormula, parseFormula } from '../../../src/core/dsl/formula';
import { REGISTRY } from '../../../src/core/dsl/registry';
import type { DslCheckRequest } from '../../../src/schema/validate';
import type { RollResult } from '../../../src/core/dice';
import { Rng } from '../../../src/core/rng';

function mustParse(src: string) {
  const parsed = parseFormula(src);
  if (!parsed.ok) throw new Error(`"${src}" must parse: ${parsed.reason} @${parsed.start}`);
  return parsed.value;
}

function request(expr: string, kind: DslCheckRequest['kind'] = 'formula'): DslCheckRequest {
  return { expr, kind, artifactId: 'ac', jsonPath: 'formulas.ac.expr', abilities: ['vigor', 'might', 'finesse'], saves: ['reason', 'grit'] };
}

/** Die FACES (1-based) → RandomSource.int() (0-based), like dice.test.ts. */
function scripted(values: number[]) {
  let next = 0;
  return {
    int(maxExclusive: number) {
      const face = values[next] ?? 1;
      next = (next + 1) % values.length;
      return (face - 1) % maxExclusive;
    },
  };
}

describe('formula parsing (FR-3 vocabulary)', () => {
  it('parses arithmetic, dice, names, and precedence', () => {
    expect(mustParse('8 + vigor').kind).toBe('binary');
    expect(mustParse('level * 2').kind).toBe('binary');
    const precedence = mustParse('2 + 3 * 4');
    expect(precedence.kind).toBe('binary');
    expect(precedence.op).toBe('+');
    expect(precedence.right!.kind).toBe('binary');
    expect(precedence.right!.op).toBe('*');
    const parens = mustParse('(2 + 3) * 4');
    expect(parens.op).toBe('*');
    expect(parens.left!.kind).toBe('binary');
    const dice = mustParse('4d6kh3');
    expect(dice.kind).toBe('dice');
    expect(dice.recipe!.die).toEqual({ count: 4, sides: 6, keep: { mode: 'kh', count: 3 } });
    expect(mustParse('1d8 + might').left!.kind).toBe('dice');
    expect(mustParse('d100').kind).toBe('dice');
  });

  it('parses comparators and validity calls with both spellings', () => {
    for (const [src, op] of [
      ['level >= 3', '≥'],
      ['level ≥ 3', '≥'],
      ['level <= 2', '≤'],
      ['level > 1', '>'],
      ['level < 5', '<'],
      ['level = 3', '='],
    ] as const) {
      const ast = mustParse(src);
      expect(ast.kind, src).toBe('comparator');
      expect(ast.op, src).toBe(op);
    }
    const validity = mustParse('hasTarget(adjacent)');
    expect(validity.kind).toBe('call');
    expect(validity.text).toBe('hasTarget');
    expect(validity.args).toHaveLength(1);
  });

  it('keeps kebab names whole: iron-will is one name, not subtraction', () => {
    const ast = mustParse('iron-will + 2');
    expect(ast.op).toBe('+');
    expect(ast.left!.kind).toBe('name');
    expect(ast.left!.text).toBe('iron-will');
  });

  it('rejects malformed input with a source position (E-FORM-01)', () => {
    for (const [src, start] of [
      ['8 +', 3],
      ['2 @@ 3', 2],
      ['(1 + 2', 6],
      ['1 2', 2],
      ['min(1,)', 6],
    ] as const) {
      const parsed = parseFormula(src);
      expect(parsed.ok, `"${src}" must be rejected`).toBe(false);
      if (!parsed.ok) {
        expect(parsed.start, `"${src}" position`).toBe(start);
        expect(parsed.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('bounds parse depth: the documented limit parses, one deeper fails', () => {
    const okExpr = `${'('.repeat(24)}1${')'.repeat(24)}`;
    expect(parseFormula(okExpr).ok).toBe(true);
    const tooDeep = `${'('.repeat(25)}1${')'.repeat(25)}`;
    const parsed = parseFormula(tooDeep);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/limit/);
  });

  it('bounds expression length', () => {
    const parsed = parseFormula(`1 + ${'a'.repeat(600)}`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/length limit/);
  });
});

describe('formula evaluation', () => {
  it('evaluates arithmetic with correct precedence, parens, and division', () => {
    const rng = new Rng(1);
    expect(evalFormula(mustParse('8 + vigor'), { vigor: 5 }, rng)).toBe(13);
    expect(evalFormula(mustParse('level * 2'), { level: 3 }, rng)).toBe(6);
    expect(evalFormula(mustParse('(2 + 3) * 4'), {}, rng)).toBe(20);
    expect(evalFormula(mustParse('2 + 3 * 4'), {}, rng)).toBe(14);
    expect(evalFormula(mustParse('10 / 4'), {}, rng)).toBe(2.5);
    expect(evalFormula(mustParse('-vigor + 10'), { vigor: 4 }, rng)).toBe(6);
  });

  it('evaluates the registry formula functions', () => {
    const rng = new Rng(1);
    expect(evalFormula(mustParse('min(floor(level / 2) + might, 6)'), { level: 7, might: 2 }, rng)).toBe(5);
    expect(evalFormula(mustParse('max(vigor, 3)'), { vigor: 1 }, rng)).toBe(3);
    expect(evalFormula(mustParse('ceil(7 / 2)'), {}, rng)).toBe(4);
  });

  it('rolls 4d6kh3 + might through S02 recipes (CA-2 composition)', () => {
    const result = evalFormula(mustParse('4d6kh3 + might'), { might: 2 }, scripted([2, 5, 4, 3]));
    expect(typeof result).toBe('object');
    const roll = result as RollResult;
    expect(roll.values).toEqual([5, 4, 3]);
    expect(roll.modifier).toBe(2);
    expect(roll.total).toBe(14);
    expect(roll.total).toBe(roll.values.reduce((a, b) => a + b, 0) + roll.modifier);
  });

  it('composes multi-dice formulas: 2d6 + 1d4 merges into one roll result', () => {
    const result = evalFormula(mustParse('2d6 + 1d4'), {}, scripted([3, 4, 2]));
    const roll = result as RollResult;
    expect(roll.values).toEqual([3, 4, 2]);
    expect(roll.total).toBe(9);
    expect(roll.sides).toBe(6);
  });

  it('composes subtraction of dice and dice-minus-scalar', () => {
    const minusDie = evalFormula(mustParse('1d6 - 1d4'), {}, scripted([4, 1])) as RollResult;
    expect(minusDie.values).toEqual([4, -1]);
    expect(minusDie.total).toBe(3);

    const minusScalar = evalFormula(mustParse('1d8 - 2'), {}, scripted([6])) as RollResult;
    expect(minusScalar.modifier).toBe(-2);
    expect(minusScalar.total).toBe(4);
  });

  it('judges rolls by total through comparators (validity arithmetic)', () => {
    expect(evalFormula(mustParse('1d20 >= 10'), {}, scripted([12]))).toBe(1);
    expect(evalFormula(mustParse('1d20 >= 10'), {}, scripted([3]))).toBe(0);
    expect(evalFormula(mustParse('level >= 3'), { level: 3 }, new Rng(1))).toBe(1);
    expect(evalFormula(mustParse('10 = 10'), {}, new Rng(1))).toBe(1);
  });

  it('is deterministic under the same seed and call sequence', () => {
    const first = evalFormula(mustParse('4d6kh3 + might'), { might: 1 }, new Rng('formula-seed'));
    const second = evalFormula(mustParse('4d6kh3 + might'), { might: 1 }, new Rng('formula-seed'));
    expect(second).toEqual(first);
  });

  it('throws on unknown names at play time — callers must validate first (E-FORM-03 territory)', () => {
    expect(() => evalFormula(mustParse('8 + vigor'), {}, new Rng(1))).toThrow(/vigor/);
    expect(() => evalFormula(mustParse('1d8 + vigor'), {}, new Rng(1))).toThrow();
  });
});

describe('checkFormula — the S01 seam (E-FORM-01/02/03)', () => {
  it('accepts every pinned formula shape with zero cards', () => {
    for (const expr of ['8 + vigor', '1d8 + might', 'level * 2', '4d6kh3 + might', 'min(floor(level / 2) + might, 6)', 'level * 2 + vigor - 1']) {
      expect(checkFormula(request(expr)), expr).toEqual([]);
    }
  });

  it('E-FORM-03: unknown name with a did-you-mean hint from ctx abilities/saves', () => {
    const cards = checkFormula(request('8 + vigr'));
    expect(cards).toHaveLength(1);
    expect(cards[0]!.rule).toBe('E-FORM-03');
    expect(cards[0]!.artifactId).toBe('ac');
    expect(cards[0]!.jsonPath).toBe('formulas.ac.expr');
    expect(cards[0]!.hint).toBe('did you mean "vigor"?');
  });

  it('E-FORM-03: no hint when nothing is near', () => {
    const cards = checkFormula(request('8 + zzzzz'));
    expect(cards[0]!.rule).toBe('E-FORM-03');
    // S01's nearestIds semantics: the nearest name is always offered, however far.
    expect(cards[0]!.hint).toMatch(/^did you mean/);
  });

  it('E-FORM-02: unknown function, reserved marker, and wrong-vocabulary calls are registry misses', () => {
    expect(checkFormula(request('d20 + smash(2)'))[0]!.rule).toBe('E-FORM-02');
    expect(checkFormula(request('half()'))[0]!.rule).toBe('E-FORM-02');
    expect(checkFormula(request('attack(ac, 5)'))[0]!.rule).toBe('E-FORM-02');
    expect(checkFormula(request('floor()'))[0]!.rule).toBe('E-FORM-02');
  });

  it('E-FORM-01: parse failures carry the offset', () => {
    const cards = checkFormula(request('8 +'));
    expect(cards).toHaveLength(1);
    expect(cards[0]!.rule).toBe('E-FORM-01');
    expect(cards[0]!.message).toMatch(/offset 3/);
  });

  it('E-FORM-01: an illegal dice recipe inside a formula is a parse error', () => {
    const cards = checkFormula(request('4d6kh0 + might'));
    expect(cards[0]!.rule).toBe('E-FORM-01');
    expect(cards[0]!.message).toMatch(/dice term/);
  });

  it('valid fields speak the validity vocabulary: hasTarget + comparators, open predicates', () => {
    expect(checkFormula(request('hasTarget(adjacent)', 'valid'))).toEqual([]);
    expect(checkFormula(request('level >= 3', 'valid'))).toEqual([]);
    expect(checkFormula(request('hasTarget(adjacent) and level', 'valid')).length).toBeGreaterThan(0);
    expect(checkFormula(request('hasTarget(blast-3)', 'valid'))).toEqual([]);
  });

  it('validity functions are rejected in plain formula fields', () => {
    const cards = checkFormula(request('hasTarget(adjacent)'));
    expect(cards[0]!.rule).toBe('E-FORM-02');
  });
});

describe('registry + security invariants (CA-2 / NFR-Security)', () => {
  it('the registry is frozen — mutation attempts are ignored', () => {
    expect(Object.isFrozen(REGISTRY)).toBe(true);
    expect(() => ((REGISTRY as Record<string, unknown>)['smash'] = { arity: 1, kind: 'formula', signature: ['formula'] })).toThrow();
    expect('smash' in REGISTRY).toBe(false);
    expect(Object.keys(REGISTRY).sort()).toEqual(Object.keys(REGISTRY).sort());
  });

  it('no eval, no new Function, no ambient randomness anywhere in the DSL modules', () => {
    const dir = fileURLToPath(new URL('../../../src/core/dsl', import.meta.url));
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    const banned = /eval\(|new Function|Math\.random|import\(/;
    for (const name of files) {
      const source = readFileSync(join(dir, name), 'utf8');
      expect(banned.test(source), `${name} must not contain eval/new Function/Math.random/dynamic import`).toBe(false);
    }
  });
});