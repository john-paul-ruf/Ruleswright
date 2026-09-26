import { describe, expect, it } from 'vitest';
import { checkEffect, executeEffect, parseEffect } from '../../../src/core/dsl/effect';
import type { EffectResolution } from '../../../src/core/dsl/effect';
import type { DslCheckRequest } from '../../../src/schema/validate';
import type { RollResult } from '../../../src/core/dice';
import { Rng } from '../../../src/core/rng';

function mustParse(src: string) {
  const parsed = parseEffect(src);
  if (!parsed.ok) throw new Error(`"${src}" must parse: ${parsed.reason} @${parsed.start}`);
  return parsed.value;
}

function request(expr: string): DslCheckRequest {
  return {
    expr,
    kind: 'effect',
    artifactId: 'strike',
    jsonPath: 'actions.strike.effect',
    abilities: ['might'],
    saves: ['reason', 'grit', 'reflexes'],
  };
}

/** Die FACES (1-based) → RandomSource.int() (0-based). */
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

/** Records every mutation the executor requests, in order — the S05 wiring surface. */
function recordingApply(resolved: string[] = []) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    apply: {
      resolveTargets(shape: string) {
        const ids = resolved.map((id) => ({ id }));
        calls.push({ op: 'resolveTargets', shape, count: ids.length });
        return ids;
      },
      damage(target: { id: string }, roll: RollResult, type?: string) {
        calls.push({
          op: 'damage',
          targetId: target.id,
          total: roll.total,
          ...(type !== undefined ? { type } : {}),
        });
      },
      condition(target: { id: string }, conditionId: string, duration: number) {
        calls.push({ op: 'condition', targetId: target.id, conditionId, duration });
      },
    },
  };
}

const goblin = { id: 'goblin' };
const shambles = { id: 'grave-shambles' };
const brynn = { id: 'brynn' };

describe('parseEffect', () => {
  it('parses every effect statement shape and prebuilds recipes (parse-once)', () => {
    const attack = mustParse('attack(ac, might)');
    expect(attack.text).toBe('attack');
    const save = mustParse('save(reason, 14, damage(3d6), damage(half))');
    expect(save.saveRecipe).toBeDefined();
    expect(save.saveRecipe!.die).toEqual({ count: 1, sides: 20 });
    expect(save.saveRecipe!.vars).toEqual([{ name: 'reason', sign: 1 }]);
    expect(mustParse('applyCondition(prone, 2)').text).toBe('applyCondition');
    expect(mustParse('target(burst-2, damage(2d6, fire))').text).toBe('target');
    const seq = mustParse('sequence(attack(ac, 3), applyCondition(prone, 1))');
    expect(seq.text).toBe('sequence');
    expect(seq.args).toHaveLength(2);
  });

  it('rejects non-statement roots and malformed grammar with positions', () => {
    for (const src of ['', '8 + vigor', 'level', 'attack(', 'damage(3d6']) {
      const parsed = parseEffect(src);
      expect(parsed.ok, `"${src}" must be rejected`).toBe(false);
      if (!parsed.ok) expect(parsed.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('executeEffect', () => {
  it('attack → hit path with structured RollResult and verdict (FR-13 raw material)', () => {
    const ast = mustParse('attack(ac, 5)');
    const { apply, calls } = recordingApply();
    const outcomes = executeEffect(ast, {
      actor: null,
      targets: [goblin],
      rng: scripted([15]),
      apply,
      vars: { ac: 16 },
    });
    expect(outcomes).toHaveLength(1);
    const attack = outcomes[0] as Extract<EffectResolution, { kind: 'attack' }>;
    expect(attack.kind).toBe('attack');
    expect(attack.targetId).toBe('goblin');
    expect(attack.hit).toBe(true);
    expect(attack.roll.purpose).toBe('attack');
    expect(attack.roll.values).toEqual([15]);
    expect(attack.roll.total).toBe(20);
    expect(attack.roll.verdict).toEqual({ defense: 'ac', value: 16, result: 'hit' });
    expect(calls).toEqual([]); // damage is a separate statement; attack only reports
  });

  it('attack → miss path records the verdict', () => {
    const outcomes = executeEffect(mustParse('attack(ac, 0)'), {
      actor: null,
      targets: [goblin],
      rng: scripted([3]),
      apply: recordingApply().apply,
      vars: { ac: 15 },
    });
    const attack = outcomes[0] as Extract<EffectResolution, { kind: 'attack' }>;
    expect(attack.hit).toBe(false);
    expect(attack.roll.verdict!.result).toBe('miss');
    expect(attack.roll.total).toBe(3);
  });

  it('save-for-half mixed outcome across 2 targets (magic.html perTarget anatomy)', () => {
    const ast = mustParse('save(reason, 14, damage(3d6, fire), damage(half))');
    const { apply, calls } = recordingApply();
    const outcomes = executeEffect(ast, {
      actor: null,
      targets: [shambles, brynn],
      rng: scripted([11, 2, 3, 4, 16, 2, 3, 4]),
      apply,
      vars: { reason: 0 },
    });
    expect(outcomes).toHaveLength(1);
    const save = outcomes[0] as Extract<EffectResolution, { kind: 'save' }>;
    expect(save.kind).toBe('save');
    expect(save.saveName).toBe('reason');
    expect(save.dc).toBe(14);
    expect(save.perTarget).toHaveLength(2);

    const first = save.perTarget[0]!;
    expect(first.branch).toBe('fail');
    expect(first.roll.verdict).toEqual({ defense: 'reason', value: 14, result: 'fail' });
    const failDamage = first.outcomes[0] as Extract<EffectResolution, { kind: 'damage' }>;
    expect(failDamage.roll.total).toBe(9);
    expect(failDamage.type).toBe('fire');
    expect(failDamage.halved).toBe(false);

    const second = save.perTarget[1]!;
    expect(second.branch).toBe('pass');
    expect(second.roll.verdict!.result).toBe('pass');
    const halfDamage = second.outcomes[0] as Extract<EffectResolution, { kind: 'damage' }>;
    expect(halfDamage.halved).toBe(true);
    expect(halfDamage.roll.total).toBe(5); // fail total 9 → ceil(9 / 2) = 5, the mock's "half · 5 fire" row shape
    expect(halfDamage.type).toBe('fire');

    // apply was called once per target, in target order, with the right totals
    expect(calls).toEqual([
      { op: 'damage', targetId: 'grave-shambles', total: 9, type: 'fire' },
      { op: 'damage', targetId: 'brynn', total: 5, type: 'fire' },
    ]);
  });

  it('condition application invokes the host callback with id + duration', () => {
    const { apply, calls } = recordingApply();
    const outcomes = executeEffect(mustParse('applyCondition(prone, 2)'), {
      actor: null,
      targets: [goblin],
      rng: new Rng(1),
      apply,
      vars: {},
    });
    expect(calls).toEqual([{ op: 'condition', targetId: 'goblin', conditionId: 'prone', duration: 2 }]);
    const condition = outcomes[0] as Extract<EffectResolution, { kind: 'condition' }>;
    expect(condition).toEqual({ kind: 'condition', targetId: 'goblin', conditionId: 'prone', duration: 2 });
  });

  it('target(shape, effect) delegates geometry to the host and scopes the inner effect', () => {
    const { apply, calls } = recordingApply(['goblin', 'brynn']);
    const outcomes = executeEffect(mustParse('target(burst-2, damage(1d6))'), {
      actor: null,
      targets: [],
      rng: scripted([6, 3]),
      apply,
      vars: {},
    });
    expect(calls[0]).toEqual({ op: 'resolveTargets', shape: 'burst-2', count: 2 });
    expect(calls.slice(1)).toEqual([
      { op: 'damage', targetId: 'goblin', total: 6 },
      { op: 'damage', targetId: 'brynn', total: 3 },
    ]);
    const target = outcomes[0] as Extract<EffectResolution, { kind: 'target' }>;
    expect(target.count).toBe(2);
    expect(target.outcomes).toHaveLength(2);
  });

  it('sequence preserves statement order in steps', () => {
    const { apply, calls } = recordingApply();
    const outcomes = executeEffect(
      mustParse('sequence(applyCondition(prone, 1), applyCondition(hexed, 3))'),
      { actor: null, targets: [goblin], rng: new Rng(1), apply, vars: {} },
    );
    const sequence = outcomes[0] as Extract<EffectResolution, { kind: 'sequence' }>;
    expect(sequence.steps.map((step) => (step.kind === 'condition' ? step.conditionId : step.kind))).toEqual([
      'prone',
      'hexed',
    ]);
    expect(calls.map((call) => (call.op === 'condition' ? call.conditionId : call.op))).toEqual([
      'prone',
      'hexed',
    ]);
  });

  it('formulas inside effects read the injected actor vars (no parser access at play time)', () => {
    const { apply } = recordingApply();
    const outcomes = executeEffect(mustParse('applyCondition(stunned, level / 2)'), {
      actor: null,
      targets: [goblin],
      rng: new Rng(1),
      apply,
      vars: { level: 7 },
    });
    const condition = outcomes[0] as Extract<EffectResolution, { kind: 'condition' }>;
    expect(condition.duration).toBe(3.5); // ceil/floor is the author's job; the executor evaluates honestly
  });

  it('rolls saves against the d20 + save recipe with actor vars; tie passes', () => {
    const outcomes = executeEffect(mustParse('save(grit, 10 + level, damage(1d6), damage(half))'), {
      actor: null,
      targets: [goblin],
      rng: scripted([9]),
      apply: recordingApply().apply,
      vars: { level: 2, grit: 3 },
    });
    const save = outcomes[0] as Extract<EffectResolution, { kind: 'save' }>;
    expect(save.dc).toBe(12);
    expect(save.perTarget[0]!.roll.values).toEqual([9]);
    expect(save.perTarget[0]!.roll.total).toBe(12); // 9 + grit 3 → tie passes (total >= dc)
  });

  it('throws on unvalidated ASTs: unknown statement and missing recipes', () => {
    const bogus = { kind: 'call', text: 'smash', args: [], pos: { start: 0, length: 5 } } as never;
    expect(() =>
      executeEffect(bogus, {
        actor: null,
        targets: [],
        rng: new Rng(1),
        apply: recordingApply().apply,
        vars: {},
      }),
    ).toThrow(/smash/);
    const handBuilt = { kind: 'call', text: 'save', args: [], pos: { start: 0, length: 4 } } as never;
    expect(() =>
      executeEffect(handBuilt, {
        actor: null,
        targets: [],
        rng: new Rng(1),
        apply: recordingApply().apply,
        vars: {},
      }),
    ).toThrow(/recipe/);
  });
});

describe('checkEffect — the S01 seam for effect fields', () => {
  it('accepts the full pinned vocabulary with zero cards', () => {
    for (const expr of [
      'attack(ac, might)',
      'save(reason, 14, damage(3d6, fire), damage(half))',
      'applyCondition(prone, 2)',
      'target(burst-2, damage(2d6))',
      'sequence(attack(ac, 3), applyCondition(prone, 1))',
      'save(reflexes, 10 + level, target(burst-2, damage(3d6)), damage(half))',
    ]) {
      expect(checkEffect(request(expr)), expr).toEqual([]);
    }
  });

  it('E-FORM-02: unknown function, wrong vocabulary, bad arity, misplaced half', () => {
    expect(checkEffect(request('smash(goblin)'))[0]!.rule).toBe('E-FORM-02');
    expect(checkEffect(request('min(1, 2)'))[0]!.rule).toBe('E-FORM-02');
    expect(checkEffect(request('attack(ac)'))[0]!.rule).toBe('E-FORM-02');
    expect(checkEffect(request('save(reason, 14, damage(3d6))'))[0]!.rule).toBe('E-FORM-02');
    expect(checkEffect(request('damage(half)'))[0]!.rule).toBe('E-FORM-02');
    expect(checkEffect(request('8'))[0]!.rule).toBe('E-FORM-01');
  });

  it('E-FORM-03: unknown save name with did-you-mean', () => {
    const cards = checkEffect(request('save(rason, 14, damage(3d6), damage(half))'));
    expect(cards[0]!.rule).toBe('E-FORM-03');
    expect(cards[0]!.hint).toBe('did you mean "reason"?');
  });

  it('E-FORM-01: parse failures carry the offset; hasTarget is a vocabulary miss at check time', () => {
    expect(checkEffect(request('hasTarget(adjacent)'))[0]!.rule).toBe('E-FORM-02');
    const cards = checkEffect(request('attack(ac'));
    expect(cards[0]!.rule).toBe('E-FORM-01');
    expect(cards[0]!.message).toMatch(/offset/);
  });

  it('unknown names in formula arguments resolve against saves + EFFECT_SCALARS (hp/ac/initiative/level)', () => {
    expect(checkEffect(request('attack(ac, vigor)'))[0]!.rule).toBe('E-FORM-03');
    expect(checkEffect(request('save(reason, 14 + hp, damage(1d6), damage(half))'))).toEqual([]);
  });
});
