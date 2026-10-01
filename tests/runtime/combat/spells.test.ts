/**
 * spells-in-combat — a spell is declared through the one combat pipeline
 * (FR-9, CA-S1): `fight.declare(spellId, { targetId })` runs the restriction,
 * target, spatial, armor and cost gates, picks the bound slot (DD-S18),
 * records the spend (CA-S2) and resolves the parse-once spell AST with
 * `why.rule` `content.spells.<id>` (DD-S17).
 *
 * Profiles are hand-built on the fixture pack (`emberMarchesPack()`): the
 * statblock machinery supplies the numbers, the test supplies `spells`,
 * `castBlockedBy` and the balances a character bridge would. Initiative is
 * pinned by ±100 bonuses; dice are scripted (the queue holds intended faces
 * and throws on exhaustion).
 */
import { describe, expect, it } from 'vitest';
import { emberMarchesPack, emberMarchesSpatialPack, withSpatial } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import { Combat, startCombat, type StartCombatRequest } from '../../../src/runtime/combat/combat';
import type { EconomyBalances } from '../../../src/runtime/combat/action-economy';
import type { Position } from '../../../src/runtime/combat/spatial';
import type { RuntimeEvent } from '../../../src/runtime/events';
import { applyCondition, isRestricted } from '../../../src/runtime/conditions';
import { Rng } from '../../../src/core/rng';
import type { Pack } from '../../../src/schema/pack';
import { generateCampaign, loadTheme } from '../../../src/compiler';
import { prepareSpell } from '../../../src/runtime/pools';
import { profileFromCharacter, settleSpellCasts } from '../../../src/runtime/character-profile';
import {
  deserializeCombat,
  restoreCharacter,
  serializeCharacter,
  serializeCombat,
  type CombatRestoreRequest,
} from '../../../src/runtime/snapshots';
import { RuntimeRuleError } from '../../../src/runtime/errors';
import { rest } from '../../../src/runtime/pools';
import { spawnMonster } from '../../../src/runtime/bestiary';

/** Intended die faces (1..sides); int(n) returns face − 1 because rollRecipe adds the +1. */
class ScriptedRng extends Rng {
  private readonly queue: number[];
  private cursor = 0;

  constructor(faces: readonly number[]) {
    super(0);
    this.queue = [...faces];
  }

  override int(maxExclusive: number): number {
    const face = this.queue[this.cursor];
    if (face === undefined) throw new Error('dice script exhausted — pin one face per roll');
    this.cursor += 1;
    if (face < 1 || face > maxExclusive) {
      throw new Error(`dice script face ${face} out of range 1..${maxExclusive}`);
    }
    return face - 1;
  }
}

interface Member {
  readonly id: string;
  readonly statblock?: string;
  readonly actions?: readonly string[];
  readonly spells?: readonly string[];
  readonly castBlockedBy?: string;
  readonly initiativeBonus: number;
  readonly hp?: number;
  readonly balances?: EconomyBalances;
}

/**
 * The fixture plus a points spell (`ember-mote`, the hexer list) and a
 * vancian ACTION (`hex-rite`) — test-local pack data, the fixture unchanged.
 */
function spellPack(): Pack {
  const pack = emberMarchesPack();
  return {
    ...pack,
    actions: {
      ...pack.actions,
      'hex-rite': { cost: { vancian: 1 }, effect: 'damage(1d4, radiance)', tags: ['casting'] },
    },
    content: {
      ...pack.content,
      spells: {
        ...pack.content.spells,
        'ember-mote': {
          name: 'Ember Mote',
          magic: { level: 1, lists: ['hexer'] },
          cost: { points: { pool: 'stamina', amount: 2 } },
          effect: 'damage(1d4, fire)',
          tags: ['casting'],
        },
      },
    },
  };
}

function profileOf(rt: Runtime, member: Member): CombatantProfile {
  const base = profileFromStatblock(
    rt.pack,
    rt.pack.bestiary[member.statblock ?? 'barrow-wight']!,
    member.id,
  );
  return {
    ...base,
    actions: [...(member.actions ?? ['strike'])],
    initiativeBonus: member.initiativeBonus,
    ...(member.hp !== undefined ? { hp: member.hp } : {}),
    ...(member.spells !== undefined ? { spells: [...member.spells] } : {}),
    ...(member.castBlockedBy !== undefined ? { castBlockedBy: member.castBlockedBy } : {}),
  };
}

function sideOf(rt: Runtime, members: readonly Member[]): StartCombatRequest['allies'] {
  return members.map((member) => ({
    id: member.id,
    profile: profileOf(rt, member),
    ...(member.balances !== undefined ? { balances: member.balances } : {}),
  }));
}

/** Start a fight and rebind it to the script so play rolls are pinned (the grid-journey idiom). */
function fightOf(
  rt: Runtime,
  allies: readonly Member[],
  enemies: readonly Member[],
  faces: readonly number[],
  positions?: Readonly<Record<string, Position>>,
): Combat {
  const rng = new ScriptedRng(faces);
  const started = startCombat(rt, {
    allies: sideOf(rt, allies),
    enemies: sideOf(rt, enemies),
    rng,
    ...(positions !== undefined ? { positions } : {}),
  });
  return new Combat(rt, started.state, rng);
}

/** The events one call emitted (declare() returns the round window, not one call's events). */
function during(rt: Runtime, work: () => unknown): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  const sink = (event: RuntimeEvent) => events.push(event);
  rt.events.on(sink);
  try {
    work();
  } finally {
    rt.events.off(sink);
  }
  return events;
}

/** One `declare:rejected` and nothing changed: slots, pools, spends, rng (CA-S1). */
function expectRejected(
  rt: Runtime,
  fight: Combat,
  run: () => unknown,
  kind: string,
  rule: string,
): RuntimeEvent {
  const before = fight.serialize();
  const events = during(rt, run);
  expect(events).toHaveLength(1);
  expect(events[0]!.type).toBe('declare:rejected');
  expect(events[0]!.payload['kind']).toBe(kind);
  expect(events[0]!.why.rule).toBe(rule);
  expect(fight.serialize()).toEqual(before);
  return events[0]!;
}

const HEXER: Member = {
  id: 'hexer',
  spells: ['grave-light', 'ember-bloom', 'ember-mote'],
  initiativeBonus: 100,
  hp: 40,
  balances: { boundSlots: { '1': 1 }, bindings: { '1': ['grave-light'] }, pools: { stamina: 5 } },
};
const WIGHT: Member = { id: 'wight', actions: ['wight-claw'], initiativeBonus: -100, hp: 40 };

describe('CAP-S1 — a known spell is declarable in combat (CA-S1, DD-S17, DD-S18)', () => {
  it('success: spell:cast → effect events → action:resolved, all provenanced content.spells.<id>; the bound slot is spent', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [HEXER], [WIGHT], [1, 1, 4]);
    expect(fight.state.active).toBe('hexer');
    const events = during(rt, () => fight.declare('grave-light', { targetId: 'wight' }));
    expect(events.map((event) => event.type)).toEqual([
      'spell:cast',
      'damage:applied',
      'condition:applied',
      'action:resolved',
    ]);
    expect(events.every((event) => event.why.rule === 'content.spells.grave-light')).toBe(true);
    expect(events[0]!.actor).toBe('hexer');
    expect(events[0]!.target).toBe('wight');
    expect(events[0]!.payload).toEqual({
      spellId: 'grave-light',
      targetId: 'wight',
      cost: 'vancian',
      slotLevel: '1',
      slotIndex: 0,
    });
    expect(events[3]!.payload).toEqual({ actionId: 'grave-light', targetId: 'wight' });
    expect(fight.state.combatants['wight']!.hp.current).toBe(36);
    const hexer = fight.state.combatants['hexer']!;
    expect(hexer.slotsCast).toEqual({ '1': [0] });
    expect(hexer.boundSlots['1']).toBe(0);
    // The fixture spell costs no turn slot.
    expect(hexer.slots.remaining['main']).toBe(1);
    expect(fight.state.phase).toBe('resolved');
  });

  it('a points spell draws the pool and records poolsSpent (DD-S5)', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [HEXER], [WIGHT], [1, 1, 3]);
    const events = during(rt, () => fight.declare('ember-mote', { targetId: 'wight' }));
    expect(events[0]!.payload).toEqual({
      spellId: 'ember-mote',
      targetId: 'wight',
      cost: 'points',
      pool: 'stamina',
      amount: 2,
    });
    const hexer = fight.state.combatants['hexer']!;
    expect(hexer.pools['stamina']).toBe(3);
    expect(hexer.poolsSpent).toEqual({ stamina: 2 });
    expect(hexer.slotsCast).toEqual({});
  });
});

describe('the binding pick (DD-S18)', () => {
  it('consumes the lowest uncast index bound to the spell; a second cast of that binding is rejected E-VANC-01', () => {
    const rt = new Runtime(spellPack());
    const caster: Member = {
      ...HEXER,
      balances: { boundSlots: { '1': 2 }, bindings: { '1': ['other', 'grave-light'] } },
    };
    const fight = fightOf(rt, [caster], [WIGHT], [1, 1, 2]);
    const cast = during(rt, () => fight.declare('grave-light', { targetId: 'wight' }));
    expect(cast[0]!.payload['slotIndex']).toBe(1);
    expect(fight.state.combatants['hexer']!.slotsCast).toEqual({ '1': [1] });
    expect(fight.state.combatants['hexer']!.boundSlots['1']).toBe(1);
    const again = expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'wight' }),
      'vancian',
      'E-VANC-01',
    );
    expect(again.payload['resource']).toBe('1');
    expect(again.payload['message']).toBe('no uncast level-1 slot is bound to "grave-light"');
  });

  it('a count-only combatant (no bindings) cannot cast a vancian spell', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [{ ...HEXER, balances: { boundSlots: { '1': 1 } } }], [WIGHT], [1, 1]);
    expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'wight' }),
      'vancian',
      'E-VANC-01',
    );
  });

  it('a vancian ACTION on a count-only combatant consumes index 0', () => {
    const rt = new Runtime(spellPack());
    const caster: Member = { ...HEXER, actions: ['hex-rite'], balances: { boundSlots: { '1': 2 } } };
    const fight = fightOf(rt, [caster], [WIGHT], [1, 1, 3]);
    const events = during(rt, () => fight.declare('hex-rite', { targetId: 'wight' }));
    expect(events.map((event) => event.type)).toEqual(['damage:applied', 'action:resolved']);
    expect(events[0]!.why.rule).toBe('actions.hex-rite');
    expect(fight.state.combatants['hexer']!.slotsCast).toEqual({ '1': [0] });
    expect(fight.state.combatants['hexer']!.boundSlots['1']).toBe(1);
  });
});

describe('spell rejections: one declare:rejected, nothing changed (CA-S1)', () => {
  it('a spell the combatant does not know is no-action', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [{ ...HEXER, spells: ['ember-bloom'] }], [WIGHT], [1, 1]);
    const rejected = expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'wight' }),
      'no-action',
      'E-REF-01',
    );
    expect(rejected.payload['message']).toBe('combatant "hexer" does not know spell "grave-light".');
  });

  it('the fixture hexbound (actions.tagged:casting) restricts the casting spell in combat (DD-S10, CA-S5)', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [HEXER], [WIGHT], [1, 1]);
    fight.state.combatants['hexer']!.conditions.push({ conditionId: 'hexbound', duration: 3 });
    const rejected = expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'wight' }),
      'restricted',
      'E-REF-01',
    );
    expect(rejected.payload['resource']).toBe('casting');
  });

  it('a spells.tagged: pattern restricts a spell in combat and never an action (DD-S10)', () => {
    const base = spellPack();
    const rt = new Runtime({
      ...base,
      content: {
        ...base.content,
        conditions: {
          ...base.content.conditions,
          'spell-sealed': {
            name: 'Spell Sealed',
            duration: 2,
            stacking: 'refresh',
            restricts: ['spells.tagged:casting'],
          },
        },
      },
    });
    const fight = fightOf(
      rt,
      [{ ...HEXER, actions: ['hex-rite'], balances: { ...HEXER.balances, boundSlots: { '1': 2 } } }],
      [WIGHT],
      [1, 1, 3],
    );
    fight.state.combatants['hexer']!.conditions.push({ conditionId: 'spell-sealed', duration: 2 });
    expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'wight' }),
      'restricted',
      'E-REF-01',
    );
    // The action carrying the same tag is matched by `actions.tagged:` only.
    const action = during(rt, () => fight.declare('hex-rite', { targetId: 'wight' }));
    expect(action.some((event) => event.type === 'declare:rejected')).toBe(false);
  });

  it('out of combat the stance is unchanged: hexbound does not restrict the spell kind (carried asymmetry)', () => {
    const rt = new Runtime(spellPack());
    const state = rt.createCharacter({ name: 'Vex', race: 'ashling', classes: ['hexer'] }).state;
    applyCondition(rt, state, 'hexbound');
    expect(isRestricted(rt, state, 'spell', 'grave-light')).toBe(false);
  });

  it('equipped blocking armor rejects a vancian spell armor-not-castable (DD-S6)', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [{ ...HEXER, castBlockedBy: 'scale-coat' }], [WIGHT], [1, 1]);
    const rejected = expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'wight' }),
      'armor-not-castable',
      'E-REF-01',
    );
    expect(rejected.payload['resource']).toBe('scale-coat');
  });

  it('the same armor never blocks a points spell (DD-S6: only vancian casts are gated)', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [{ ...HEXER, castBlockedBy: 'scale-coat' }], [WIGHT], [1, 1, 2]);
    const events = during(rt, () => fight.declare('ember-mote', { targetId: 'wight' }));
    expect(events.map((event) => event.type)).toEqual(['spell:cast', 'damage:applied', 'action:resolved']);
  });

  it('a pool short of the cost is points / E-POINTS-01', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [{ ...HEXER, balances: { pools: { stamina: 1 } } }], [WIGHT], [1, 1]);
    const rejected = expectRejected(
      rt,
      fight,
      () => fight.declare('ember-mote', { targetId: 'wight' }),
      'points',
      'E-POINTS-01',
    );
    expect(rejected.payload['resource']).toBe('stamina');
  });

  it('a statblock profile carries no spells: declaring one is no-action (DD-S2)', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(
      rt,
      [{ id: 'brynn', initiativeBonus: -100, hp: 40 }],
      [{ ...WIGHT, initiativeBonus: 100 }],
      [1, 1],
    );
    expect(fight.state.active).toBe('wight');
    expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'brynn' }),
      'no-action',
      'E-REF-01',
    );
  });
});

describe('spell targets (DD-S8): any combatant in the fight', () => {
  const BRYNN: Member = { id: 'brynn', initiativeBonus: -50, hp: 40 };

  it('an ally targetId succeeds for a spell', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [HEXER, BRYNN], [WIGHT], [1, 1, 1, 5]);
    const events = during(rt, () => fight.declare('grave-light', { targetId: 'brynn' }));
    expect(events.map((event) => event.type)).toEqual([
      'spell:cast',
      'damage:applied',
      'condition:applied',
      'action:resolved',
    ]);
    expect(events[1]!.target).toBe('brynn');
    expect(fight.state.combatants['brynn']!.hp.current).toBe(35);
  });

  it('the same targetId on an action is still invalid-target', () => {
    const rt = new Runtime(spellPack());
    const fight = fightOf(rt, [HEXER, BRYNN], [WIGHT], [1, 1, 1]);
    expectRejected(
      rt,
      fight,
      () => fight.declare('strike', { targetId: 'brynn' }),
      'invalid-target',
      'E-REF-01',
    );
  });
});

/**
 * The spatial fixture with ranges (test-local pack data): `grave-light` single
 * at range 3, `ember-bloom` burst-2 at range 6, and `ember-ring`, a burst
 * spell whose effect root is `save(...)` rather than `target(burst-…)`.
 */
function rangedPack(): Pack {
  const pack = spellPack();
  const spells = pack.content.spells!;
  return withSpatial(
    {
      ...pack,
      content: {
        ...pack.content,
        spells: {
          ...spells,
          'grave-light': { ...spells['grave-light']!, targeting: { shape: 'single', range: 3 } },
          'ember-bloom': { ...spells['ember-bloom']!, targeting: { shape: 'burst', radius: 2, range: 6 } },
          'ember-ring': {
            name: 'Ember Ring',
            magic: { level: 2, lists: ['hexer'] },
            cost: { vancian: 2 },
            targeting: { shape: 'burst', radius: 2, range: 6 },
            effect: 'save(reason, 12, damage(2d6, fire), damage(half))',
            tags: ['casting'],
          },
        },
      },
    },
    { model: 'grid', reach: { default: 1 }, shapes: ['single', 'burst'] },
  );
}

const CASTER: Member = {
  id: 'hexer',
  spells: ['grave-light', 'ember-bloom', 'ember-ring'],
  initiativeBonus: 100,
  hp: 40,
  balances: {
    boundSlots: { '1': 1, '2': 2 },
    bindings: { '1': ['grave-light'], '2': ['ember-bloom', 'ember-ring'] },
  },
};

describe('CAP-S9 — the range gate (CA-S9, DD-S8)', () => {
  it('range 3: distance 3 casts; distance 4 is one out-of-range (E-SPAT-01) with nothing changed', () => {
    const near = new Runtime(rangedPack());
    const inRange = fightOf(near, [CASTER], [WIGHT], [1, 1, 2], {
      hexer: { x: 0, y: 0 },
      wight: { x: 3, y: 1 },
    });
    const cast = during(near, () => inRange.declare('grave-light', { targetId: 'wight' }));
    expect(cast.map((event) => event.type)).toContain('spell:cast');

    const far = new Runtime(rangedPack());
    const outOfRange = fightOf(far, [CASTER], [WIGHT], [1, 1], {
      hexer: { x: 0, y: 0 },
      wight: { x: 4, y: 0 },
    });
    const rejected = expectRejected(
      far,
      outOfRange,
      () => outOfRange.declare('grave-light', { targetId: 'wight' }),
      'out-of-range',
      'E-SPAT-01',
    );
    expect(rejected.payload['resource']).toBe('wight');
    expect(rejected.payload['message']).toBe('spell "grave-light" has range 3; wight is 4 away.');
  });

  it("no range: the caster's effective reach applies (reach 1 — distance 2 is out of range)", () => {
    const rt = new Runtime(emberMarchesSpatialPack());
    const fight = fightOf(rt, [HEXER], [WIGHT], [1, 1], { hexer: { x: 0, y: 0 }, wight: { x: 2, y: 0 } });
    const rejected = expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'wight' }),
      'out-of-range',
      'E-SPAT-01',
    );
    expect(rejected.payload['message']).toBe('spell "grave-light" has range 1; wight is 2 away.');
  });

  it('no range: a reach entry below spatial.reach.default still gets the default, as canReach does (F-M2 floor)', () => {
    // A reach entry must be >= 1 at load, so the floor is shown as entry 1 under default 2:
    // the caster's own entry alone would refuse distance 2.
    const rt = new Runtime(
      withSpatial(spellPack(), {
        model: 'grid',
        reach: { default: 2, hexer: 1 },
        shapes: ['single', 'burst'],
      }),
    );
    const fight = fightOf(rt, [HEXER], [WIGHT], [1, 1, 2], { hexer: { x: 0, y: 0 }, wight: { x: 2, y: 1 } });
    const events = during(rt, () => fight.declare('grave-light', { targetId: 'wight' }));
    expect(events.some((event) => event.type === 'declare:rejected')).toBe(false);
    expect(events[0]!.type).toBe('spell:cast');
  });
});

describe('CAP-S9 — empty-cell bursts (CA-S9, DD-S8, DD-S19)', () => {
  // hexer (0,0); ally brynn (5,1) and enemy wight (4,2) stand within 2 of the
  // empty cell (4,0); shambles (9,0) does not; the caster is 4 away.
  const POSITIONS = {
    hexer: { x: 0, y: 0 },
    brynn: { x: 5, y: 1 },
    wight: { x: 4, y: 2 },
    shambles: { x: 9, y: 0 },
  };
  const BRYNN: Member = { id: 'brynn', statblock: 'grave-shambles', initiativeBonus: -50, hp: 40 };
  const SHAMBLES: Member = { id: 'shambles', statblock: 'grave-shambles', initiativeBonus: -150, hp: 40 };

  function blastFight(rt: Runtime, faces: readonly number[]): Combat {
    return fightOf(rt, [CASTER, BRYNN], [WIGHT, SHAMBLES], [1, 1, 1, 1, ...faces], POSITIONS);
  }

  it('hits exactly the standing combatants within radius 2 of the cell, both sides, each saving with its own value', () => {
    const rt = new Runtime(rangedPack());
    // brynn (reason 0): save 10 + 0 < 12 → fail, 3d6 = 9; wight (reason 3): save 10 + 3 ≥ 12 → pass, half of 9 = 5.
    const fight = blastFight(rt, [10, 2, 3, 4, 10, 2, 3, 4]);
    const center = { x: 4, y: 0 };
    const expected = fight.state.order.filter((id) => {
      const combatant = fight.state.combatants[id]!;
      const p = combatant.position!;
      return combatant.hp.current > 0 && Math.max(Math.abs(p.x - center.x), Math.abs(p.y - center.y)) <= 2;
    });
    expect(expected).toEqual(['brynn', 'wight']);
    const events = during(rt, () => fight.declare('ember-bloom', { at: center }));
    expect(events.map((event) => event.type)).toEqual([
      'spell:cast',
      'damage:applied',
      'damage:applied',
      'action:resolved',
    ]);
    const damage = events.filter((event) => event.type === 'damage:applied');
    expect(damage.map((event) => event.target)).toEqual(expected);
    expect(damage.map((event) => event.payload['amount'])).toEqual([9, 5]);
    expect(fight.state.combatants['shambles']!.hp.current).toBe(40);
    expect(fight.state.combatants['hexer']!.hp.current).toBe(40);
    expect(events[0]!.target).toBeUndefined();
    expect(events[0]!.payload).toEqual({
      spellId: 'ember-bloom',
      at: { x: 4, y: 0 },
      cost: 'vancian',
      slotLevel: '2',
      slotIndex: 0,
    });
    expect(events[3]!.payload).toEqual({ actionId: 'ember-bloom', at: { x: 4, y: 0 } });
  });

  it('a blast that catches nobody is a legal cast: the bound slot is spent, no effect events', () => {
    const rt = new Runtime(rangedPack());
    const fight = blastFight(rt, []);
    const slotsBefore = { ...fight.state.combatants['hexer']!.slots.remaining };
    const events = during(rt, () => fight.declare('ember-bloom', { at: { x: 0, y: 5 } }));
    expect(events.map((event) => event.type)).toEqual(['spell:cast', 'action:resolved']);
    const hexer = fight.state.combatants['hexer']!;
    expect(hexer.slotsCast).toEqual({ '2': [0] });
    expect(hexer.boundSlots['2']).toBe(1);
    // The fixture ember-bloom costs { vancian: 2 } only: no turn slot moves.
    expect(hexer.slots.remaining).toEqual(slotsBefore);
  });

  it('each at refusal is one invalid-target with nothing changed', () => {
    const rt = new Runtime(rangedPack());
    const fight = blastFight(rt, []);
    const at = { x: 4, y: 0 };
    const both = expectRejected(
      rt,
      fight,
      () => fight.declare('ember-bloom', { at, targetId: 'wight' }),
      'invalid-target',
      'E-REF-01',
    );
    expect(both.payload['message']).toContain('either targetId or at');
    const single = expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { at }),
      'invalid-target',
      'E-REF-01',
    );
    expect(single.payload['message']).toContain('not a burst');
    const action = expectRejected(
      rt,
      fight,
      () => fight.declare('strike', { at }),
      'invalid-target',
      'E-REF-01',
    );
    expect(action.payload['message']).toContain('only a burst spell takes at');
    const root = expectRejected(
      rt,
      fight,
      () => fight.declare('ember-ring', { at }),
      'invalid-target',
      'E-REF-01',
    );
    expect(root.payload['message']).toContain('not target(burst-');
  });

  it('an at beyond range is out-of-range with resource "x,y"', () => {
    const rt = new Runtime(rangedPack());
    const fight = blastFight(rt, []);
    const rejected = expectRejected(
      rt,
      fight,
      () => fight.declare('ember-bloom', { at: { x: 8, y: 0 } }),
      'out-of-range',
      'E-SPAT-01',
    );
    expect(rejected.payload['resource']).toBe('8,0');
    expect(rejected.payload['message']).toBe('spell "ember-bloom" has range 6; (8,0) is 8 away.');
  });
});

describe('CAP-S9 — theater of mind never consults range or at (DD-M11 discipline)', () => {
  it('any distance passes, and at is dropped: the burst resolves to the bound target', () => {
    const rt = new Runtime(spellPack());
    const caster: Member = { ...CASTER, spells: ['grave-light', 'ember-bloom'] };
    const fight = fightOf(rt, [caster], [WIGHT], [1, 1, 3, 1, 1, 1, 1], {
      hexer: { x: 0, y: 0 },
      wight: { x: 40, y: 0 },
    });
    const far = during(rt, () => fight.declare('grave-light', { targetId: 'wight' }));
    expect(far[0]!.type).toBe('spell:cast');
    const bloom = during(rt, () => fight.declare('ember-bloom', { at: { x: 4, y: 0 } }));
    expect(bloom[0]!.payload).toMatchObject({ spellId: 'ember-bloom', targetId: 'wight' });
    expect(bloom[0]!.payload['at']).toBeUndefined();
    expect(bloom.filter((event) => event.type === 'damage:applied').map((event) => event.target)).toEqual([
      'wight',
    ]);
  });
});

describe('CAP-S1 integrated — a generated character casts through the production bridge (dark-fantasy, seed 42)', () => {
  /**
   * The src integration: generateCampaign → Runtime → createCharacter →
   * prepareSpell → profileFromCharacter → startCombat → declare. No doubles:
   * the executor, economy and grid geometry are production code. The fixture
   * hexer class declares no actions, so this runs on the generated pack.
   */
  function hexerFight(prepared: boolean) {
    const rt = new Runtime(generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 }));
    const hexer = rt.createCharacter({
      name: 'hexer',
      race: 'hillfolk',
      classes: [{ id: 'hexer', level: 1 }],
    });
    expect(hexer.state.slots).toEqual({ '1': [null, null, null] });
    if (prepared) prepareSpell(rt, hexer.state, 'grave-light');
    const pair = profileFromCharacter(rt, hexer, 'hexer');
    const fight = startCombat(rt, {
      allies: [{ id: 'hexer', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
      enemies: [
        { id: 'wight', profile: { ...spawnMonster(rt, 'barrow-wight', 'wight'), initiativeBonus: -100 } },
      ],
      // Adjacent: no theme spell declares a range until checkpoint 5, so the reach fallback (1) applies.
      positions: { hexer: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
      rng: new Rng('spells-bridge'),
    });
    return { rt, fight };
  }

  it('a prepared grave-light is declared and resolves: spell:cast first, the bound slot spent', () => {
    const { rt, fight } = hexerFight(true);
    expect(fight.state.active).toBe('hexer');
    expect(fight.state.combatants['hexer']!.spells).toContain('grave-light');
    const events = during(rt, () => fight.declare('grave-light', { targetId: 'wight' }));
    expect(events.map((event) => event.type)).toEqual([
      'spell:cast',
      'damage:applied',
      'condition:applied',
      'action:resolved',
    ]);
    expect(events.every((event) => event.why.rule === 'content.spells.grave-light')).toBe(true);
    expect(events[0]!.payload).toMatchObject({ slotLevel: '1', slotIndex: 0, cost: 'vancian' });
    expect(fight.state.combatants['hexer']!.slotsCast).toEqual({ '1': [0] });
    expect(fight.state.combatants['hexer']!.boundSlots['1']).toBe(0);
  });

  it('a hexer that never prepared it is rejected vancian with nothing changed', () => {
    const { rt, fight } = hexerFight(false);
    expectRejected(
      rt,
      fight,
      () => fight.declare('grave-light', { targetId: 'wight' }),
      'vancian',
      'E-VANC-01',
    );
  });
});

describe('CAP-S3 — settleSpellCasts writes the spend into the character (CA-S3)', () => {
  /**
   * A level-3 dark-fantasy hexer casts its prepared grave-light (level-1 slot 0)
   * and draws 2 ember through its `ember-surge` action in one turn; the fight
   * then ends through the restore harness (every enemy at hp 0 in the snapshot
   * → restore derives combat-over), which also carries the spend across a
   * snapshot. The settlement and the character round-trip are the real path.
   */
  function endedFight() {
    const rt = new Runtime(generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 }));
    const hexer = rt.createCharacter({
      name: 'hexer',
      race: 'hillfolk',
      classes: [{ id: 'hexer', level: 3 }],
    });
    prepareSpell(rt, hexer.state, 'grave-light');
    const pair = profileFromCharacter(rt, hexer, 'hexer');
    const request: CombatRestoreRequest = {
      allies: [{ id: 'hexer', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
      enemies: [
        {
          id: 'wight',
          profile: { ...spawnMonster(rt, 'barrow-wight', 'wight'), initiativeBonus: -100, hp: 60 },
        },
      ],
      positions: { hexer: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
    };
    const live = startCombat(rt, { ...request, rng: new Rng('settle') });
    const cast = during(rt, () => live.declare('grave-light', { targetId: 'wight' }));
    expect(cast[0]!.type).toBe('spell:cast');
    const surge = during(rt, () => live.declare('ember-surge', { targetId: 'wight' }));
    expect(surge.some((event) => event.type === 'declare:rejected')).toBe(false);
    const snapshot = JSON.parse(JSON.stringify(serializeCombat(live, { pairsWith: 'party-1' }))) as {
      combatants: { id: string; hp: number }[];
    };
    for (const combatant of snapshot.combatants) if (combatant.id === 'wight') combatant.hp = 0;
    const fight = deserializeCombat(rt, snapshot, request);
    expect(fight.state.phase).toBe('combat-over');
    expect(fight.state.combatants['hexer']!.slotsCast).toEqual({ '1': [0] });
    expect(fight.state.combatants['hexer']!.poolsSpent).toEqual({ ember: 2 });
    return { rt, hexer, live, fight };
  }

  function refusedWith(run: () => unknown): string[] {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRuleError);
      return (error as RuntimeRuleError).errors.map((card) => card.rule);
    }
    throw new Error('expected a refusal');
  }

  it('pools drop by the spend and cast slots empty, with pool:settled / slot:settled', () => {
    const { rt, hexer, fight } = endedFight();
    expect(hexer.state.slots['1']).toEqual(['grave-light', null, null, null]);
    const events = settleSpellCasts(rt, hexer, fight, 'hexer');
    expect(events.map((event) => [event.type, event.payload, event.why.rule])).toEqual([
      ['pool:settled', { combatantId: 'hexer', pool: 'ember', amount: 2 }, 'pools.ember'],
      [
        'slot:settled',
        { combatantId: 'hexer', slotLevel: '1', slotIndex: 0, spellId: 'grave-light' },
        'content.spells',
      ],
    ]);
    expect(hexer.state.pools['ember']).toBe(16);
    expect(hexer.state.slots['1']).toEqual([null, null, null, null]);
    expect(fight.state.combatants['hexer']!.slotsCast).toEqual({});
    expect(fight.state.combatants['hexer']!.poolsSpent).toEqual({});
  });

  it('the character snapshot round-trip keeps the settled pools and slots', () => {
    const { rt, hexer, fight } = endedFight();
    settleSpellCasts(rt, hexer, fight, 'hexer');
    const restored = restoreCharacter(
      rt,
      JSON.parse(JSON.stringify(serializeCharacter(rt, hexer.state))) as ReturnType<
        typeof serializeCharacter
      >,
    );
    expect(restored.state.pools['ember']).toBe(16);
    expect(restored.state.slots['1']).toEqual([null, null, null, null]);
  });

  it('a second settle returns [] and changes nothing', () => {
    const { rt, hexer, fight } = endedFight();
    settleSpellCasts(rt, hexer, fight, 'hexer');
    const after = structuredClone(hexer.state);
    expect(settleSpellCasts(rt, hexer, fight, 'hexer')).toEqual([]);
    expect(hexer.state).toEqual(after);
  });

  it('combat-not-over: a live fight never settles; the character is unchanged', () => {
    const { rt, hexer, live } = endedFight();
    const before = structuredClone(hexer.state);
    expect(refusedWith(() => settleSpellCasts(rt, hexer, live, 'hexer'))).toEqual(['combat-not-over']);
    expect(hexer.state).toEqual(before);
  });

  it('slot-mismatch: the character re-bound the cast slot mid-fight; nothing changes', () => {
    const { rt, hexer, fight } = endedFight();
    rest(rt, hexer.state);
    prepareSpell(rt, hexer.state, 'bone-dart');
    expect(hexer.state.slots['1']![0]).toBe('bone-dart');
    const before = structuredClone(hexer.state);
    expect(refusedWith(() => settleSpellCasts(rt, hexer, fight, 'hexer'))).toEqual(['slot-mismatch']);
    expect(hexer.state).toEqual(before);
  });

  it('insufficient-points: the pool no longer covers the spend; every refusal is collected before any change', () => {
    const { rt, hexer, fight } = endedFight();
    hexer.state.pools['ember'] = 1;
    hexer.state.slots['1']![0] = null;
    const before = structuredClone(hexer.state);
    expect(refusedWith(() => settleSpellCasts(rt, hexer, fight, 'hexer'))).toEqual([
      'insufficient-points',
      'slot-mismatch',
    ]);
    expect(hexer.state).toEqual(before);
  });

  it('unknown-target: the combatant is not in the fight', () => {
    const { rt, hexer, fight } = endedFight();
    expect(refusedWith(() => settleSpellCasts(rt, hexer, fight, 'nobody'))).toEqual(['unknown-target']);
  });
});
