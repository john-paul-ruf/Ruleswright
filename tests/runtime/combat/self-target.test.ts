/**
 * CA-A1 / CA-A2 (v1.7, DD-A1/A2) — the `self` shape and self actions.
 * The emberMarches fixture is copied in-test and its effects overridden (the
 * fixture file is never edited): `withdraw` becomes
 * `target(self, applyCondition(braced, 2))`, so it is a self action. Real
 * Runtime, real executor, real offer queue. Initiative is pinned with
 * `initiativeBonus` so the actor under test takes the first turn.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/core/rng';
import { emberMarchesPack, withSpatial } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import { isSelfAction, startCombat, type Combat } from '../../../src/runtime/combat/combat';
import type { Position } from '../../../src/runtime/combat/spatial';
import type { RuntimeEvent } from '../../../src/runtime/events';
import type { Pack } from '../../../src/schema/pack';

const SELF_BRACE = 'target(self, applyCondition(braced, 2))';

/** The fixture with self effects: `withdraw` and the `shrug-off` reaction act on their user. */
function selfPack(extra: Pack['actions'] = {}): Pack {
  const pack = emberMarchesPack();
  return {
    ...pack,
    actions: {
      ...pack.actions,
      withdraw: { ...pack.actions['withdraw']!, effect: SELF_BRACE },
      'shrug-off': {
        cost: { slots: { reaction: 1 } },
        trigger: { on: 'attack:rolled[target=self]' },
        effect: SELF_BRACE,
        tags: ['reaction'],
      },
      ...extra,
    },
  };
}

const spatial = (pack: Pack): Pack =>
  withSpatial(pack, { model: 'grid', reach: { default: 1 }, shapes: ['single', 'burst'] });

interface Member {
  readonly id: string;
  readonly actions: readonly string[];
  readonly initiativeBonus: number;
  readonly feats?: readonly string[];
}

interface FightRequest {
  readonly pack: Pack;
  readonly allies: readonly Member[];
  readonly enemies: readonly Member[];
  readonly positions?: Readonly<Record<string, Position>>;
}

function fight(request: FightRequest): { fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(request.pack);
  const events: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    events.push(event);
  });
  const entry = (member: Member) => {
    const profile: CombatantProfile = {
      ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, member.id),
      hp: 100,
      actions: member.actions,
      initiativeBonus: member.initiativeBonus,
      ...(member.feats !== undefined ? { feats: member.feats } : {}),
    };
    return { id: member.id, profile };
  };
  const combat = startCombat(runtime, {
    allies: request.allies.map(entry),
    enemies: request.enemies.map(entry),
    ...(request.positions !== undefined ? { positions: request.positions } : {}),
    rng: new Rng('self-target'),
  });
  combat.step(); // the first combatant's turn begins
  return { fight: combat, events };
}

const ofType = (events: readonly RuntimeEvent[], type: string) =>
  events.filter((event) => event.type === type);

const brynn = (actions: readonly string[], feats?: readonly string[]): Member => ({
  id: 'brynn',
  actions,
  initiativeBonus: 100,
  ...(feats !== undefined ? { feats } : {}),
});
const foe = (id: string, actions: readonly string[] = ['wight-claw']): Member => ({
  id,
  actions,
  initiativeBonus: -100,
});

/** The self action's events: braced on the declarer, `action:resolved` naming the declarer. */
function expectLandsOnActor(events: readonly RuntimeEvent[], actorId: string, actionId = 'withdraw'): void {
  expect(ofType(events, 'declare:rejected')).toEqual([]);
  expect(
    ofType(events, 'condition:applied').map((event) => [
      event.actor,
      event.target,
      event.payload['conditionId'],
      event.why.rule,
    ]),
  ).toEqual([[actorId, actorId, 'braced', `actions.${actionId}`]]);
  expect(ofType(events, 'action:resolved').map((event) => event.payload)).toEqual([
    { actionId, targetId: actorId },
  ]);
}

describe('isSelfAction (DD-A2, root-only)', () => {
  it('is true only for an action whose effect root is target(self, …)', () => {
    const runtime = new Runtime(
      selfPack({
        nested: {
          cost: { slots: { main: 1 } },
          effect: `sequence(attack(ac, might), ${SELF_BRACE})`,
          tags: ['main'],
        },
      }),
    );
    expect(isSelfAction(runtime, 'withdraw')).toBe(true);
    expect(isSelfAction(runtime, 'shrug-off')).toBe(true);
    expect(isSelfAction(runtime, 'nested')).toBe(false);
    expect(isSelfAction(runtime, 'ember-bloom-rite')).toBe(false);
    expect(isSelfAction(runtime, 'grave-light')).toBe(false); // a spell is never a self action
  });
});

describe('a declared self action binds its actor (CA-A1, CA-A2)', () => {
  it('(a) two enemies, no targetId → braced on the declarer, no no-target', () => {
    const { fight: combat, events } = fight({
      pack: selfPack(),
      allies: [brynn(['withdraw'])],
      enemies: [foe('wight-a'), foe('wight-b')],
    });
    combat.declare('withdraw');
    expectLandsOnActor(events, 'brynn');
    expect(combat.state.combatants['wight-a']!.conditions).toEqual([]);
    expect(combat.state.combatants['wight-b']!.conditions).toEqual([]);
    expect(combat.state.combatants['brynn']!.slots.remaining['move']).toBe(0);
  });

  it('(b) spatial, every enemy beyond reach → lands on the declarer, no spatial rejection', () => {
    const { fight: combat, events } = fight({
      pack: spatial(selfPack()),
      allies: [brynn(['withdraw'])],
      enemies: [foe('wight-a'), foe('wight-b')],
      positions: { brynn: { x: 0, y: 0 }, 'wight-a': { x: 6, y: 0 }, 'wight-b': { x: 0, y: 6 } },
    });
    combat.declare('withdraw');
    expectLandsOnActor(events, 'brynn');
  });

  it('a targetId equal to the actor is accepted', () => {
    const { fight: combat, events } = fight({
      pack: selfPack(),
      allies: [brynn(['withdraw'])],
      enemies: [foe('wight-a'), foe('wight-b')],
    });
    combat.declare('withdraw', { targetId: 'brynn' });
    expectLandsOnActor(events, 'brynn');
  });

  it('(c) a targetId naming an enemy → invalid-target E-REF-01, nothing changes', () => {
    const { fight: combat, events } = fight({
      pack: selfPack(),
      allies: [brynn(['withdraw'])],
      enemies: [foe('wight-a'), foe('wight-b')],
    });
    const before = combat.serialize();
    const answer = combat.declare('withdraw', { targetId: 'wight-a' });
    expect(answer[answer.length - 1]).toMatchObject({
      type: 'declare:rejected',
      actor: 'brynn',
      payload: { kind: 'invalid-target', resource: 'wight-a' },
      why: { rule: 'E-REF-01' },
    });
    expect(ofType(events, 'condition:applied')).toEqual([]);
    expect(combat.serialize()).toEqual(before);
  });

  it('(d) theater-of-mind → lands on the declarer, not the bound foe', () => {
    const { fight: combat, events } = fight({
      pack: selfPack(),
      allies: [brynn(['withdraw'])],
      enemies: [foe('wight-a')],
    });
    combat.declare('withdraw');
    expectLandsOnActor(events, 'brynn');
    expect(combat.state.combatants['wight-a']!.conditions).toEqual([]);
  });

  it('(e) a nested target(self, …) in an ordinary action: the attack hits the foe, braced lands on the actor', () => {
    const pack = selfPack({
      'brace-strike': {
        cost: { slots: { main: 1 } },
        effect: 'sequence(attack(ac, might), target(self, applyCondition(braced, 1)))',
        tags: ['main'],
      },
    });
    const { fight: combat, events } = fight({
      pack,
      allies: [brynn(['brace-strike'])],
      enemies: [foe('wight-a')],
    });
    combat.declare('brace-strike');
    expect(ofType(events, 'declare:rejected')).toEqual([]);
    expect(ofType(events, 'attack:rolled').map((event) => event.target)).toEqual(['wight-a']);
    expect(ofType(events, 'condition:applied').map((event) => [event.target, event.payload])).toEqual([
      ['brynn', { conditionId: 'braced', duration: 1 }],
    ]);
    expect(ofType(events, 'action:resolved').map((event) => event.payload)).toEqual([
      { actionId: 'brace-strike', targetId: 'wight-a' },
    ]);
  });

  it('(g) the restriction gate still bites: a move-tagged self action while rooted → restricted', () => {
    const base = selfPack({
      'root-self': {
        cost: { slots: { main: 1 } },
        effect: 'target(self, applyCondition(rooted, 2))',
        tags: ['main'],
      },
    });
    const pack: Pack = {
      ...base,
      content: {
        ...base.content,
        conditions: {
          ...base.content.conditions,
          rooted: { name: 'Rooted', duration: 2, stacking: 'refresh', restricts: ['actions.tagged:move'] },
        },
      },
    };
    const { fight: combat, events } = fight({
      pack,
      allies: [brynn(['root-self', 'withdraw'])],
      enemies: [foe('wight-a'), foe('wight-b')],
    });
    combat.declare('root-self');
    expect(combat.state.combatants['brynn']!.conditions.map((c) => c.conditionId)).toEqual(['rooted']);
    const before = combat.serialize();
    const answer = combat.declare('withdraw');
    expect(answer[answer.length - 1]).toMatchObject({
      type: 'declare:rejected',
      payload: { kind: 'restricted', resource: 'move' },
    });
    expect(ofType(events, 'condition:applied')).toHaveLength(1);
    expect(combat.serialize()).toEqual(before);
  });

  it('(h) control: the plain fixture withdraw with one foe still lands on the foe', () => {
    const { fight: combat, events } = fight({
      pack: emberMarchesPack(),
      allies: [brynn(['withdraw'])],
      enemies: [foe('wight-a')],
    });
    combat.declare('withdraw');
    expect(ofType(events, 'condition:applied').map((event) => [event.actor, event.target])).toEqual([
      ['brynn', 'wight-a'],
    ]);
  });
});

describe('a taken self reaction binds its reactor (CA-A2)', () => {
  /** The wight (reach 2 via its id) claws brynn from two cells away; brynn (reach 1) cannot reach back. */
  function reactionFight() {
    const pack = withSpatial(selfPack(), {
      model: 'grid',
      reach: { default: 1, 'barrow-wight': 2 },
      shapes: ['single', 'burst'],
    });
    return fight({
      pack,
      allies: [{ id: 'brynn', actions: ['strike', 'shrug-off'], initiativeBonus: -100 }],
      enemies: [{ id: 'barrow-wight', actions: ['wight-claw'], initiativeBonus: 100 }],
      positions: { 'barrow-wight': { x: 0, y: 0 }, brynn: { x: 2, y: 0 } },
    });
  }

  it("(f) take with the attacker beyond the reactor's reach → braced on the reactor, no rejection", () => {
    const { fight: combat, events } = reactionFight();
    combat.declare('wight-claw', { targetId: 'brynn' });
    expect(combat.pendingTriggers.map((offer) => offer.triggerId)).toEqual(['brynn.shrug-off']);
    const answered = combat.respond('brynn.shrug-off', 'take');
    expect(ofType(answered, 'declare:rejected')).toEqual([]);
    expect(
      ofType(events, 'condition:applied').map((event) => [event.actor, event.target, event.why.rule]),
    ).toEqual([['brynn', 'brynn', 'actions.shrug-off']]);
    expect(combat.state.combatants['barrow-wight']!.conditions).toEqual([]);
    expect(combat.state.combatants['brynn']!.slots.remaining['reaction']).toBe(0);
  });

  it('take naming the attacker → invalid-target, nothing changes', () => {
    const { fight: combat, events } = reactionFight();
    combat.declare('wight-claw', { targetId: 'brynn' });
    const before = combat.serialize();
    const answered = combat.respond('brynn.shrug-off', 'take', 'barrow-wight');
    expect(answered[answered.length - 1]).toMatchObject({
      type: 'declare:rejected',
      payload: { kind: 'invalid-target', resource: 'barrow-wight' },
      why: { rule: 'E-REF-01' },
    });
    expect(ofType(events, 'condition:applied')).toEqual([]);
    expect(combat.serialize()).toEqual(before);
  });
});

describe("a self action offers its actor's own condition:applied[target=self] feats (F-A2, DD-S13)", () => {
  it('withdraw → brynn.second-gust offered; take resolves on brynn; nothing chains', () => {
    const { fight: combat, events } = fight({
      pack: selfPack(),
      allies: [brynn(['withdraw'], ['second-gust'])],
      enemies: [foe('wight-a'), foe('wight-b')],
    });
    combat.declare('withdraw');
    expectLandsOnActor(events, 'brynn');
    expect(combat.pendingTriggers).toEqual([
      {
        triggerId: 'brynn.second-gust',
        actorId: 'brynn',
        actionId: 'second-gust',
        source: 'feat',
        matchingEvent: 'condition:applied',
      },
    ]);
    const answered = combat.respond('brynn.second-gust', 'take');
    expect(answered.map((event) => [event.type, event.actor, event.target, event.why.rule])).toEqual([
      ['condition:applied', 'brynn', 'brynn', 'content.feats.second-gust'],
    ]);
    expect(combat.pendingTriggers).toEqual([]);
    expect(ofType(events, 'trigger:fired')).toHaveLength(1);
  });
});
