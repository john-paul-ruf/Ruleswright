import { expect, it } from 'vitest';
import { createAdventure, restoreAdventure, RuntimeRuleError } from '../../src/runtime';
import { adventureFixture, choose } from '../runtime/adventure/fixtures';

it('reopens using only pack, definition and detached aggregate JSON', () => {
  const { pack, definition, options } = adventureFixture(),
    a = createAdventure(pack, definition, options);
  choose(a);
  const saved = JSON.parse(JSON.stringify(a.serialize()));
  expect(restoreAdventure(pack, definition, saved).serialize()).toEqual(saved);
});
it.each([
  ['snapshotVersion', 2],
  ['kind', 'combat'],
  ['adventureId', ''],
  ['revision', Number.MAX_SAFE_INTEGER + 1],
  ['nodeId', 'unknown'],
  ['phase', 'completed'],
  ['visitedNodeIds', ['clearing']],
  ['resolvedNodeIds', []],
  ['narrationAck', 999],
  ['encounterEventCursor', 1],
  ['pack', {}],
  ['definition', {}],
  ['rng', {}],
  ['members', []],
  ['journal', []],
  ['extra', true],
])('rejects invalid %s before exposing any state', (field, value) => {
  const { pack, definition, options } = adventureFixture(),
    a = createAdventure(pack, definition, options),
    saved = a.serialize();
  expect(() => restoreAdventure(pack, definition, { ...saved, [field]: value })).toThrow(RuntimeRuleError);
  expect(a.serialize()).toEqual(saved);
});
