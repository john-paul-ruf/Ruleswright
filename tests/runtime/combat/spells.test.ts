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
import { emberMarchesPack } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import { Combat, startCombat, type StartCombatRequest } from '../../../src/runtime/combat/combat';
import type { EconomyBalances } from '../../../src/runtime/combat/action-economy';
import type { Position } from '../../../src/runtime/combat/spatial';
import type { RuntimeEvent } from '../../../src/runtime/events';
import { applyCondition, isRestricted } from '../../../src/runtime/conditions';
import { Rng } from '../../../src/core/rng';
import type { Pack } from '../../../src/schema/pack';

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
