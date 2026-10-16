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
    expect(a.view().availableCommands).toEqual(['choose', 'abandon', 'equip', 'unequip', 'use-item']);
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

import { rewardFixture, claim } from './fixtures';
it('routes real prepare/equip/unequip/use and once-only rest without healing or time ticks', () => {
  const f = rewardFixture(0),
    a = createAdventure(f.pack, f.definition, f.options);
  for (let i = 0; i < 3; i++) expect(claim(a, i, i === 2 ? undefined : 'hero-1').ok).toBe(true);
  const before = a.serialize();
  expect(dispatch(a, { type: 'rest', nodeId: 'start' }).ok).toBe(true);
  const after = a.serialize();
  expect(after.members.map((m) => m.character.state.hp)).toEqual(
    before.members.map((m) => m.character.state.hp),
  );
  expect(after.members.map((m) => m.character.state.conditions)).toEqual(
    before.members.map((m) => m.character.state.conditions),
  );
  expect(after.members[0]!.character.state.pools.stamina).toBe(32);
  expect(after.members[0]!.character.state.slots).toEqual({ '1': [null, null], '2': [null, null] });
  expect(dispatch(a, { type: 'rest', nodeId: 'start' }).ok).toBe(false);
  expect(
    dispatch(a, {
      type: 'prepare',
      nodeId: 'start',
      memberId: 'hero-1',
      spellId: 'grave-light',
      slotIndex: 1,
    }).ok,
  ).toBe(true);
  expect(dispatch(a, { type: 'unequip', nodeId: 'start', memberId: 'hero-1', slot: 'ring' }).ok).toBe(true);
  expect(
    dispatch(a, { type: 'equip', nodeId: 'start', memberId: 'hero-1', itemId: 'ward-ring', slot: 'ring' }).ok,
  ).toBe(true);
  expect(
    dispatch(a, { type: 'use-item', nodeId: 'start', memberId: 'hero-1', itemId: 'mend-draught' }).ok,
  ).toBe(true);
  expect(a.serialize().members[0]!.character.state.hp.current).toBe(17);
  expect(a.serialize().members[0]!.character.state.inventory.find((i) => i.id === 'mend-draught')!.qty).toBe(
    1,
  );
  const stable = a.serialize();
  expect(
    dispatch(a, { type: 'prepare', nodeId: 'start', memberId: 'foreign', spellId: 'grave-light' }).ok,
  ).toBe(false);
  expect(a.serialize()).toEqual(stable);
  expect(choose(a).ok).toBe(true);
  expect(
    dispatch(a, { type: 'prepare', nodeId: 'clearing', memberId: 'hero-1', spellId: 'grave-light' }).ok,
  ).toBe(false);
});

import { rehash } from './fixtures';
import { packContentHash } from '../../../src/schema';
it.each(['defeated', 'abandoned'] as const)(
  'persists actual enemy injury and item spend through %s settlement and reopen',
  (terminal) => {
    const f = combatFixture(true);
    f.pack.actions['strike']!.effect = terminal === 'defeated' ? 'damage(100)' : 'damage(1)';
    const identity = { ...f.definition.pack, contentHash: packContentHash(f.pack) };
    const definition = rehash({ ...f.definition, pack: identity });
    const options = {
      ...f.options,
      members: f.options.members.map((m) => ({ ...m, character: { ...m.character, pack: identity } })),
    };
    const a = createAdventure(f.pack, definition, options);
    expect(choose(a).ok).toBe(true);
    let used = false,
      attacked = false;
    for (let step = 0; step < 20 && !attacked; step++) {
      const outer = encounterCommand(a),
        base = outer.command;
      let command = base;
      if (base.type === 'declare') {
        command = used
          ? {
              sessionId: base.sessionId,
              expectedRevision: base.expectedRevision,
              type: 'pass',
              actor: base.actor,
            }
          : {
              sessionId: base.sessionId,
              expectedRevision: base.expectedRevision,
              type: 'use',
              actor: base.actor,
              itemId: 'mend-draught',
            };
        used = true;
      } else if (base.type === 'pass') {
        command = {
          sessionId: base.sessionId,
          expectedRevision: base.expectedRevision,
          type: 'declare',
          actor: base.actor,
          actionId: 'strike',
          options: { targetId: 'm:hero-1' },
        };
        attacked = true;
      }
      expect(a.dispatch({ ...outer, command }).ok).toBe(true);
    }
    expect(used && attacked).toBe(true);
    if (terminal === 'abandoned') expect(dispatch(a, { type: 'abandon' }).ok).toBe(true);
    const saved = a.serialize();
    expect(saved.phase).toBe(terminal);
    expect(saved.members[0]!.character.state.hp).toEqual({
      current: terminal === 'defeated' ? -80 : 19,
      temp: 2,
    });
    expect(saved.members[0]!.character.state.inventory).toEqual([{ id: 'mend-draught', qty: 1 }]);
    expect(saved.rewards).toEqual([]);
    expect(saved.encounterReceipts[0]!.receipt.result).toBe(terminal === 'defeated' ? 'defeat' : 'abandoned');
    expect(restoreAdventure(f.pack, definition, JSON.parse(JSON.stringify(saved))).serialize()).toEqual(
      saved,
    );
  },
);
