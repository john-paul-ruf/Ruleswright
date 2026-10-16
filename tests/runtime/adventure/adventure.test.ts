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
