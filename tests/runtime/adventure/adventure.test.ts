import { describe, expect, it } from 'vitest';
import { createAdventure, restoreAdventure } from '../../../src/runtime';
import type { AdventureCommand } from '../../../src/runtime';
import { adventureFixture, choose } from './fixtures';

describe('CAP-03 guarded noncombat adventure', () => {
  it('traverses a real graph, persists all streams/policy/cursors and completes explicitly', () => {
    const { pack, definition, options } = adventureFixture();
    const a = createAdventure(pack, definition, options);
    expect(a.serialize().director).toEqual({
      policy: { id: 'manual', version: 1 },
      decisions: 0,
      stalledSteps: 0,
      lastMechanicalHash: null,
    });
    expect(Object.keys(a.serialize().rng)).toEqual(['generation', 'play', 'rewards', 'director']);
    expect(a.view().availableCommands).toEqual(['choose', 'abandon']);
    expect(choose(a).ok).toBe(true);
    const b = restoreAdventure(pack, definition, JSON.parse(JSON.stringify(a.serialize())));
    expect(choose(a)).toEqual(choose(b));
    expect(a.view().phase).toBe('completed');
    expect(a.serialize().visitedNodeIds).toEqual(['start', 'clearing', 'home']);
    expect(a.serialize().resolvedNodeIds).toEqual(['start', 'clearing', 'home']);
    expect(choose(a).ok).toBe(false);
  });
  it.each([
    { nodeId: 'other' },
    { choiceId: 'other' },
    { expectedRevision: 4 },
    { adventureId: 'other' },
    { extra: true },
    { type: 'ack-narration', throughSequence: 0 },
  ])('refuses %j without changing state or entropy', (patch) => {
    const { pack, definition, options } = adventureFixture(),
      a = createAdventure(pack, definition, options),
      before = a.serialize();
    const result = a.dispatch({
      adventureId: options.adventureId,
      expectedRevision: 0,
      type: 'choose',
      nodeId: 'start',
      choiceId: 'continue',
      ...patch,
    } as AdventureCommand);
    expect(result.ok).toBe(false);
    expect(result.events).toEqual([]);
    expect(a.serialize()).toEqual(before);
  });
  it('reads detached views/snapshots without draws and owns copied start inputs', () => {
    const { pack, definition, options } = adventureFixture(),
      a = createAdventure(pack, definition, options),
      before = a.serialize();
    const view = a.view();
    (view.members[0]!.character.state.hp as { current: number }).current = 999;
    (options.members[0]!.character.state.hp as { current: number }).current = 999;
    a.view();
    a.serialize();
    expect(a.serialize()).toEqual(before);
  });
  it('abandon is terminal and refuses subsequent actions', () => {
    const { pack, definition, options } = adventureFixture(),
      a = createAdventure(pack, definition, options);
    expect(a.dispatch({ type: 'abandon', adventureId: options.adventureId, expectedRevision: 0 }).ok).toBe(
      true,
    );
    expect(a.view().phase).toBe('abandoned');
    expect(choose(a).ok).toBe(false);
  });
});

import { combatFixture, dispatch, encounterCommand, finishEncounter } from './fixtures';
it('composes real encounter revisions and projects spend without publishing rejected nested actions', () => {
  const { pack, definition, options } = combatFixture(),
    a = createAdventure(pack, definition, options);
  expect(choose(a).ok).toBe(true);
  const before = a.serialize(),
    command = encounterCommand(a);
  expect(before.revision).not.toBe(before.activeEncounter!.revision);
  for (const patch of [
    { expectedRevision: 99 },
    { sessionId: 'foreign' },
    { type: 'next' },
    { type: 'pass', actor: { kind: 'enemy', enemyId: 'wrong' } },
  ]) {
    const result = a.dispatch({ ...command, command: { ...command.command, ...patch } } as AdventureCommand);
    expect(result.ok).toBe(false);
    expect(result.events).toEqual([]);
    expect(a.serialize()).toEqual(before);
  }
  expect(a.dispatch({ ...command, encounterId: 'foreign' }).ok).toBe(false);
  expect(choose(a).ok).toBe(false);
  expect(() => finishEncounter(a, 0)).toThrow(/step limit/);
  finishEncounter(a);
  expect(a.view().phase).toBe('exploration');
  expect(a.serialize().encounterReceipts[0]!.receipt.result).toBe('victory');
  expect(a.serialize().activeEncounter).toBeNull();
  expect(a.serialize().encounterEventCursor).toBe(0);
  expect(a.serialize().journal.filter((e) => e.event.type === 'combat:start')).toHaveLength(1);
});
it('defeat and active abandonment settle actual members and never stage success rewards', () => {
  const f = combatFixture(true),
    a = createAdventure(f.pack, f.definition, f.options);
  choose(a);
  const before = a.view().members;
  expect(dispatch(a, { type: 'abandon' }).ok).toBe(true);
  expect(a.view().phase).toBe('abandoned');
  expect(a.serialize().rewards).toEqual([]);
  expect(a.serialize().members.map((m) => m.character)).toEqual(before.map((m) => m.character));
  const options = {
    ...f.options,
    members: f.options.members.map((m) => ({
      ...m,
      character: { ...m.character, state: { ...m.character.state, hp: { current: -3, temp: 2 } } },
    })),
  };
  const b = createAdventure(f.pack, f.definition, options);
  expect(choose(b).ok).toBe(true);
  expect(b.view().phase).toBe('defeated');
  expect(b.serialize().rewards).toEqual([]);
  expect(b.serialize().members[0]!.character.state.hp).toEqual({ current: -3, temp: 2 });
});
