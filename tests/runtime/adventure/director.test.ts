import { expect, it } from 'vitest';
import { advanceSolo, createAdventure, restoreAdventure, RuntimeRuleError } from '../../../src/runtime';
import { packContentHash } from '../../../src/schema/version';
import { Rng } from '../../../src/core/rng';
import { mechanicalHash } from '../../../src/runtime/adventure/snapshot';
import { adventureContexts } from '../../../src/runtime/adventure/adventure';
import {
  directorFixture,
  adventureFixture,
  departureFixture,
  choose,
  dispatch,
  rehash,
  encounterCommand,
} from './fixtures';

function start(options: Parameters<typeof directorFixture>[0] = {}) {
  const f = directorFixture(options),
    adventure = createAdventure(f.pack, f.definition, f.options);
  expect(choose(adventure).ok).toBe(true);
  return { ...f, adventure };
}

it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'refuses invalid budget %s without effects',
  (maxSteps) => {
    const { adventure } = start();
    const before = adventure.serialize();
    expect(() => advanceSolo(adventure, { maxSteps })).toThrow(RuntimeRuleError);
    expect(adventure.serialize()).toEqual(before);
  },
);

it('uses exact authored priorities, preserves lexical entropy, and yields at the player turn', () => {
  const { adventure } = start();
  const before = adventure.serialize();
  const result = advanceSolo(adventure, { maxSteps: 10 });
  expect(Object.keys(result).sort()).toEqual(['events', 'reason', 'stepsUsed', 'view']);
  expect(result.reason).toBe('awaiting-player');
  expect(result.stepsUsed).toBe(3);
  expect(result.events.some((e) => e.event.type === 'damage:applied' && e.event.target === 'm:hero-1')).toBe(
    true,
  );
  const saved = adventure.serialize();
  expect(saved.director).toEqual({
    policy: { id: 'sentinel', version: 2 },
    decisions: 3,
    stalledSteps: 0,
    lastMechanicalHash: mechanicalHash(saved),
  });
  expect(saved.rng.director).toEqual(before.rng.director);
  expect(saved.activeEncounter!.revision).toBe(before.activeEncounter!.revision + 3);
  const boundary = adventure.serialize();
  expect(advanceSolo(adventure, { maxSteps: 10 })).toMatchObject({
    reason: 'awaiting-player',
    stepsUsed: 0,
    events: [],
  });
  expect(adventure.serialize()).toEqual(boundary);
});

it('draws only for an actual seeded tie and continues exactly across budgets and reopen', () => {
  const f = start({ tieBreak: 'seeded' });
  const original = f.adventure.serialize(),
    rng = new Rng(original.rng.director);
  const index = rng.int(2);
  const whole = advanceSolo(f.adventure, { maxSteps: 20 });
  expect(whole.events.find((e) => e.event.type === 'damage:applied')!.event.target).toBe(
    `m:hero-${index + 1}`,
  );
  expect(f.adventure.serialize().rng.director).toEqual(rng.getState());
  let split = restoreAdventure(f.pack, f.definition, original);
  const events = [];
  let steps = 0;
  for (let i = 0; i < 10; i++) {
    const result = advanceSolo(split, { maxSteps: 1 });
    events.push(...result.events);
    steps += result.stepsUsed;
    split = restoreAdventure(f.pack, f.definition, JSON.parse(JSON.stringify(split.serialize())));
    if (result.reason === 'awaiting-player') break;
    expect(result.reason).toBe('budget-exhausted');
  }
  expect(steps).toBe(whole.stepsUsed);
  expect(events).toEqual(whole.events);
  expect(split.serialize()).toEqual(f.adventure.serialize());
});

it('moves using actual geometry, then attacks only after reaching an opponent', () => {
  const { adventure } = start({ spatial: true });
  const result = advanceSolo(adventure, { maxSteps: 20 });
  expect(result.reason).toBe('awaiting-player');
  expect(result.events.some((e) => e.event.type === 'move:advanced')).toBe(true);
  expect(result.events.some((e) => e.event.type === 'damage:applied')).toBe(false);
  expect(adventure.view().combat!.state.combatants['e:0:1']!.position).not.toEqual({ x: 4, y: 0 });
});

it('candidate exhaustion yields without committing a partial enumeration or tie draw', () => {
  const f = directorFixture({ spatial: true, tieBreak: 'seeded' });
  const definition = rehash({ ...f.definition, director: { ...f.definition.director, maxCandidates: 1 } });
  const adventure = createAdventure(f.pack, definition, f.options);
  choose(adventure);
  expect(advanceSolo(adventure, { maxSteps: 1 }).stepsUsed).toBe(1);
  const before = adventure.serialize();
  expect(advanceSolo(adventure, { maxSteps: 20 })).toMatchObject({
    reason: 'budget-exhausted',
    stepsUsed: 0,
    events: [],
  });
  expect(adventure.serialize()).toEqual(before);
});

it('zero-damage play stays bounded without false stall; a restored stall predicate survives reads and reopen', () => {
  const f = start({ damage: 0 });
  expect(advanceSolo(f.adventure, { maxSteps: 2 })).toMatchObject({
    reason: 'budget-exhausted',
    stepsUsed: 2,
  });
  const saved = f.adventure.serialize();
  expect(saved.phase).toBe('encounter');
  expect(saved.director.stalledSteps).toBe(0);
  expect(saved.director.lastMechanicalHash).toBe(mechanicalHash(saved));
  const stalled = { ...saved, director: { ...saved.director, decisions: 5, stalledSteps: 3 } };
  const reopened = restoreAdventure(f.pack, f.definition, stalled);
  expect(advanceSolo(reopened, { maxSteps: 20 })).toMatchObject({ reason: 'stalled', stepsUsed: 0 });
  expect(reopened.serialize()).toEqual(stalled);
  expect(reopened.dispatch(encounterCommand(reopened)).ok).toBe(true);
  expect(advanceSolo(reopened, { maxSteps: 20 }).reason).toBe('awaiting-player');
});

it('hashes only mechanical state, including the actual current geometry/control and reward status', () => {
  const { adventure } = start();
  const saved = adventure.serialize(),
    clone = JSON.parse(JSON.stringify(saved));
  clone.revision++;
  clone.sequence++;
  clone.narrationAck++;
  clone.director.decisions++;
  clone.rng.director.a++;
  clone.activeEncounter.encounter.combat.rng.a++;
  clone.activeEncounter.revision++;
  expect(mechanicalHash(clone)).toBe(mechanicalHash(saved));
  clone.activeEncounter.encounter.control.turnStarted = true;
  expect(mechanicalHash(clone)).not.toBe(mechanicalHash(saved));
});

it('failed and stale staged decisions publish no state or director entropy', () => {
  const { adventure } = start(),
    before = adventure.serialize();
  const command = encounterCommand(adventure),
    rng = new Rng(before.rng.director);
  rng.int(2);
  const context = adventureContexts.get(adventure)!;
  expect(context.decide({ ...command, expectedRevision: -1 }, rng.getState()).ok).toBe(false);
  expect(adventure.serialize()).toEqual(before);
  expect(
    context.decide({ ...command, command: { ...command.command, expectedRevision: 99 } }, rng.getState()).ok,
  ).toBe(false);
  expect(adventure.serialize()).toEqual(before);
});

it('yields for routes, rewards and preparation; terminal completion and abandonment survive reopen', () => {
  const f = adventureFixture(),
    adventure = createAdventure(f.pack, f.definition, f.options);
  expect(advanceSolo(adventure, { maxSteps: 10 })).toMatchObject({ reason: 'awaiting-choice', stepsUsed: 0 });
  choose(adventure);
  choose(adventure);
  expect(advanceSolo(adventure, { maxSteps: 10 }).reason).toBe('completed');
  const terminal = restoreAdventure(f.pack, f.definition, adventure.serialize());
  expect(advanceSolo(terminal, { maxSteps: 10 }).reason).toBe('completed');
  const active = start();
  dispatch(active.adventure, { type: 'abandon' });
  expect(
    advanceSolo(restoreAdventure(active.pack, active.definition, active.adventure.serialize()), {
      maxSteps: 10,
    }).reason,
  ).toBe('abandoned');
});

it('defeat is produced by actual enemy damage and settlement', () => {
  const { adventure } = start({ damage: 100 });
  for (let i = 0; i < 100; i++) {
    const result = advanceSolo(adventure, { maxSteps: 20 });
    if (result.reason === 'defeated') break;
    expect(result.reason).toBe('awaiting-player');
    let command = encounterCommand(adventure);
    // Host passes player turns but still performs their explicit turn-start.
    if (command.command.type === 'declare')
      command = {
        ...command,
        command: {
          type: 'pass',
          actor: command.command.actor,
          sessionId: command.command.sessionId,
          expectedRevision: command.command.expectedRevision,
        },
      };
    expect(adventure.dispatch(command).ok).toBe(true);
  }
  expect(adventure.view().phase).toBe('defeated');
  expect(adventure.serialize().members.every((m) => m.character.state.hp.current <= 0)).toBe(true);
});

it('takes real enemy offers but leaves player-owned offers untouched', () => {
  const f = departureFixture();
  const a = createAdventure(f.pack, f.definition, f.options);
  choose(a);
  const send = (body: object) => {
    const s = a.serialize(),
      n = s.activeEncounter!;
    return dispatch(a, {
      type: 'encounter',
      encounterId: n.encounter.encounterId,
      command: { ...body, sessionId: n.sessionId, expectedRevision: n.revision } as Exclude<
        import('../../../src/runtime').EncounterCommand,
        { type: 'next' }
      >,
    });
  };
  send({ type: 'advance' });
  expect(
    send({
      type: 'declare',
      actor: { kind: 'member', memberId: 'hero-1' },
      actionId: 'stride',
      options: { to: { x: -2, y: 0 } },
    }).ok,
  ).toBe(true);
  const result = advanceSolo(a, { maxSteps: 10 });
  expect(result.reason).toBe('awaiting-player');
  expect(result.events.some((e) => e.event.type === 'damage:applied')).toBe(true);
  expect(a.view().combat!.pendingOffers).toEqual([]);
});

it('orders actual reaction offers by policy and declines a take whose slot was spent', () => {
  const f = departureFixture();
  f.pack.actions['preferred'] = { ...f.pack.actions['departure']! };
  for (const monster of Object.values(f.pack.bestiary)) monster.actions.push('preferred');
  const identity = { ...f.definition.pack, contentHash: packContentHash(f.pack) };
  const definition = rehash({
    ...f.definition,
    pack: identity,
    director: { ...f.definition.director, reactionPriority: ['preferred', 'departure'] },
  });
  const adventure = createAdventure(f.pack, definition, {
    ...f.options,
    members: f.options.members.map((m) => ({ ...m, character: { ...m.character, pack: identity } })),
  });
  choose(adventure);
  expect(adventure.dispatch(encounterCommand(adventure)).ok).toBe(true);
  const saved = adventure.serialize(),
    nested = saved.activeEncounter!;
  expect(
    dispatch(adventure, {
      type: 'encounter',
      encounterId: nested.encounter.encounterId,
      command: {
        type: 'declare',
        sessionId: nested.sessionId,
        expectedRevision: nested.revision,
        actor: { kind: 'member', memberId: 'hero-1' },
        actionId: 'stride',
        options: { to: { x: -2, y: 0 } },
      },
    }).ok,
  ).toBe(true);
  expect(adventure.view().combat!.pendingOffers).toHaveLength(2);
  const result = advanceSolo(adventure, { maxSteps: 10 });
  expect(result.reason).toBe('awaiting-player');
  expect(result.stepsUsed).toBe(2);
  expect(result.events.filter((e) => e.event.type === 'damage:applied').map((e) => e.event.why.rule)).toEqual(
    ['actions.preferred'],
  );
  expect(
    result.events.filter((e) => e.event.type === 'trigger:declined').map((e) => e.event.payload['actionId']),
  ).toEqual(['departure']);
});

it('refuses the random-validity solo domain before any automated transition, preserving manual play', () => {
  const f = directorFixture();
  f.pack.actions['press']!.valid = '1d6 > 0';
  const identity = { ...f.definition.pack, contentHash: packContentHash(f.pack) };
  const definition = rehash({ ...f.definition, pack: identity });
  const adventure = createAdventure(f.pack, definition, {
    ...f.options,
    members: f.options.members.map((m) => ({ ...m, character: { ...m.character, pack: identity } })),
  });
  choose(adventure);
  const before = adventure.serialize();
  expect(() => advanceSolo(adventure, { maxSteps: 10 })).toThrow('Solo play requires deterministic');
  expect(adventure.serialize()).toEqual(before);
  expect(adventure.dispatch(encounterCommand(adventure)).ok).toBe(true);
});
