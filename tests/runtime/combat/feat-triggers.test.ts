/**
 * CAP-S6 unit (DD-S12, CA-S6) — reactive feats ride the trigger substrate.
 * The fixture pack's `second-gust` (`condition:applied[target=self]` →
 * `applyCondition(braced, 2)`) is held by brynn; the wight's `grave-gaze`
 * applies `hexbound` on either save branch. Real Runtime, real executor, real
 * offer queue: a held feat is offered like a reactive action (`source:
 * 'feat'`), taking it acts on the holder, and a taken feat never chains.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../../src/core/rng';
import { emberMarchesPack } from '../fixtures/packs';
import { Runtime } from '../../../src/runtime/runtime';
import { profileFromStatblock, type CombatantProfile } from '../../../src/runtime/combat/resolve';
import { startCombat, type Combat } from '../../../src/runtime/combat/combat';
import type { RuntimeEvent } from '../../../src/runtime/events';
import type { Pack } from '../../../src/schema/pack';

interface FightOptions {
  /** brynn's starting hp (0 = downed holder). */
  readonly brynnHp?: number;
  /** extra actions per combatant (pack-declared in `pack`). */
  readonly brynnActions?: readonly string[];
  readonly aldActions?: readonly string[];
  readonly pack?: Pack;
}

/** brynn (holds second-gust) and ald fight a wight that acts first (initiative pinned ±100). */
function featFight(options: FightOptions = {}): { fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(options.pack ?? emberMarchesPack());
  const events: RuntimeEvent[] = [];
  runtime.events.on((event) => {
    events.push(event);
  });
  const frame = (id: string, actions: readonly string[], initiativeBonus: number): CombatantProfile => ({
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, id),
    actions,
    initiativeBonus,
  });
  const fight = startCombat(runtime, {
    allies: [
      {
        id: 'brynn',
        profile: {
          ...frame('brynn', ['strike', ...(options.brynnActions ?? [])], -100),
          ...(options.brynnHp !== undefined ? { hp: options.brynnHp } : {}),
          feats: ['second-gust'],
        },
      },
      { id: 'ald', profile: frame('ald', ['strike', ...(options.aldActions ?? [])], -100) },
    ],
    enemies: [{ id: 'wight', profile: frame('wight', ['grave-gaze'], 100) }],
    rng: new Rng('feats'),
  });
  expect(fight.state.order[0]).toBe('wight');
  fight.step(); // the wight's turn begins
  return { fight, events };
}

const ofType = (events: readonly RuntimeEvent[], type: string) =>
  events.filter((event) => event.type === type);

describe('reactive feats are offered (DD-S12)', () => {
  it('a held feat is offered once on condition:applied targeting its holder — source feat, the feat trigger path', () => {
    const { fight, events } = featFight();
    fight.declare('grave-gaze', { targetId: 'brynn' });
    expect(
      ofType(events, 'condition:applied').map((event) => [event.target, event.payload['conditionId']]),
    ).toEqual([['brynn', 'hexbound']]);
    const fired = ofType(events, 'trigger:fired');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({
      actor: 'brynn',
      payload: {
        triggerId: 'brynn.second-gust',
        actionId: 'second-gust',
        source: 'feat',
        on: 'condition:applied',
        offerIndex: 0,
      },
      why: { rule: 'content.feats.second-gust.trigger', rolls: [] },
    });
    expect(fight.pendingTriggers).toEqual([
      {
        triggerId: 'brynn.second-gust',
        actorId: 'brynn',
        actionId: 'second-gust',
        source: 'feat',
        matchingEvent: 'condition:applied',
      },
    ]);
  });

  it('is not offered to a downed holder', () => {
    const { fight, events } = featFight({ brynnHp: 0 });
    fight.declare('grave-gaze', { targetId: 'brynn' });
    expect(ofType(events, 'condition:applied')).toHaveLength(1);
    expect(ofType(events, 'trigger:fired')).toEqual([]);
    expect(fight.pendingTriggers).toEqual([]);
  });

  it('is not offered when the event targets someone else', () => {
    const { fight, events } = featFight();
    fight.declare('grave-gaze', { targetId: 'ald' });
    expect(ofType(events, 'condition:applied').map((event) => event.target)).toEqual(['ald']);
    expect(ofType(events, 'trigger:fired')).toEqual([]);
  });

  it('a reactive action and a feat on the same event both queue — every action offer first', () => {
    const pack = emberMarchesPack();
    pack.actions['shrug-off'] = {
      cost: { slots: { reaction: 1 } },
      trigger: { on: 'condition:applied[target=self]' },
      effect: 'applyCondition(braced, 1)',
      tags: ['reaction'],
    };
    pack.actions['cover-ally'] = {
      cost: { slots: { reaction: 1 } },
      trigger: { on: 'condition:applied[target=brynn]' },
      effect: 'applyCondition(braced, 1)',
      tags: ['reaction'],
    };
    const { fight } = featFight({ pack, brynnActions: ['shrug-off'], aldActions: ['cover-ally'] });
    fight.declare('grave-gaze', { targetId: 'brynn' });
    expect(fight.pendingTriggers.map((offer) => [offer.triggerId, offer.source])).toEqual([
      ['brynn.shrug-off', 'action'],
      ['ald.cover-ally', 'action'],
      ['brynn.second-gust', 'feat'],
    ]);
  });
});

describe('answering a feat offer (DD-S12)', () => {
  it('take → braced on the holder with the feat rule path, and no new offer (the no-chain rule)', () => {
    const { fight, events } = featFight();
    fight.declare('grave-gaze', { targetId: 'brynn' });
    const before = events.length;
    const slotsBefore = { ...fight.state.combatants['brynn']!.slots.remaining };
    const answered = fight.respond('brynn.second-gust', 'take');
    expect(
      answered.map((event) => [event.type, event.actor, event.target, event.payload, event.why.rule]),
    ).toEqual([
      [
        'condition:applied',
        'brynn',
        'brynn',
        { conditionId: 'braced', duration: 2 },
        'content.feats.second-gust',
      ],
    ]);
    expect(events.slice(before)).toEqual(answered);
    expect(ofType(events, 'trigger:fired')).toHaveLength(1);
    expect(fight.pendingTriggers).toEqual([]);
    expect(fight.state.combatants['brynn']!.conditions.map((active) => active.conditionId)).toEqual([
      'hexbound',
      'braced',
    ]);
    expect(fight.state.combatants['brynn']!.slots.remaining).toEqual(slotsBefore); // a feat costs nothing
  });

  it('decline → one trigger:declined with source feat; nothing else changes', () => {
    const { fight, events } = featFight();
    fight.declare('grave-gaze', { targetId: 'brynn' });
    const state = fight.serialize();
    const answered = fight.respond('brynn.second-gust', 'decline');
    expect(answered).toHaveLength(1);
    expect(answered[0]).toMatchObject({
      type: 'trigger:declined',
      actor: 'brynn',
      payload: {
        triggerId: 'brynn.second-gust',
        actionId: 'second-gust',
        source: 'feat',
        on: 'condition:applied',
      },
      why: { rule: 'content.feats.second-gust.trigger' },
    });
    expect(ofType(events, 'trigger:declined')).toHaveLength(1);
    expect(fight.serialize()).toEqual(state);
    expect(fight.pendingTriggers).toEqual([]);
  });

  it('a targetId other than the holder is invalid-target, and the offer has still left the queue', () => {
    const { fight, events } = featFight();
    fight.declare('grave-gaze', { targetId: 'brynn' });
    const state = fight.serialize();
    const answered = fight.respond('brynn.second-gust', 'take', 'wight');
    expect(
      answered.map((event) => [event.type, event.actor, event.payload['kind'], event.payload['resource']]),
    ).toEqual([['declare:rejected', 'brynn', 'invalid-target', 'wight']]);
    expect(answered[0]!.why.rule).toBe('E-REF-01');
    expect(fight.pendingTriggers).toEqual([]);
    expect(fight.serialize()).toEqual(state);
    expect(ofType(events, 'condition:applied')).toHaveLength(1);
  });

  it('naming the holder itself is a legal take', () => {
    const { fight } = featFight();
    fight.declare('grave-gaze', { targetId: 'brynn' });
    expect(fight.respond('brynn.second-gust', 'take', 'brynn').map((event) => event.type)).toEqual([
      'condition:applied',
    ]);
  });
});

it.each(['brynn', 'wight'])('pure feat preview retains holder-only semantics: %s', async (targetId) => {
  const { FightCore } = await import('../../../src/runtime/combat/fight');
  const { resolveSlotGrants } = await import('../../../src/runtime/combat/action-economy');
  const { previewFeat } = await import('../../../src/runtime/combat/preview');
  const { fight, events } = featFight();
  fight.declare('grave-gaze', { targetId: 'brynn' });
  fight.state.combatants['brynn']!.slots.remaining = {};
  fight.state.combatants['brynn']!.conditions.push({ conditionId: 'shaken', duration: 2 });
  const offer = fight.pendingTriggers[0]!;
  const core = new FightCore(
    fight.runtime,
    fight.state,
    new Rng(fight.state.rng),
    resolveSlotGrants(fight.runtime.pack),
    0,
  );
  const before = fight.serialize(),
    count = events.length;
  const preview = previewFeat(core, offer, targetId);
  expect(fight.serialize()).toEqual(before);
  expect(events).toHaveLength(count);
  expect(fight.pendingTriggers).toEqual([offer]);
  const result = fight.respond(offer.triggerId, 'take', targetId);
  if (preview.rejection)
    expect(result[0]).toMatchObject({
      type: 'declare:rejected',
      payload: {
        kind: preview.rejection.kind,
        resource: preview.rejection.resource,
        message: preview.rejection.message,
      },
      why: { rule: preview.rejection.rule },
    });
  else expect(result[0]).toMatchObject({ type: 'condition:applied', target: 'brynn' });
  expect(fight.state.combatants['brynn']!.slots.remaining).toEqual({});
  expect(fight.pendingTriggers).toEqual([]);
});
