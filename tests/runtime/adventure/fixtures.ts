import type { AdventureDefinition, AdventureStartOptions } from '../../../src/schema/adventure';
import type { Adventure, AdventureCommand } from '../../../src/runtime/adventure/types';
import { packContentHash } from '../../../src/schema/version';
import { playFixture } from '../play/fixtures';

export function adventureFixture() {
  const { pack, options: encounterOptions } = playFixture();
  const body: Omit<AdventureDefinition, 'contentHash'> = {
    kind: 'adventure-definition',
    schemaVersion: 1,
    id: 'lantern-route',
    template: { id: 'lantern-route', version: 1 },
    pack: encounterOptions.members[0]!.character.pack,
    seed: 'definition',
    objective: { id: 'home', text: 'Carry the lantern home.' },
    startNodeId: 'start',
    successNodeId: 'home',
    nodes: ['start', 'clearing', 'home'].map((id, i, ids) => ({
      id,
      kind: i === 2 ? 'success' : 'discovery',
      title: id,
      description: '',
      choices: i === 2 ? [] : [{ id: 'continue', text: 'Continue', toNodeId: ids[i + 1]! }],
      rewardIds: [],
      rest: 'none',
      preparation: false,
      facts: {},
    })),
    rewards: [],
    facts: {},
    director: {
      id: 'manual',
      version: 1,
      priorities: [{ kind: 'action', actionId: 'strike' }, { kind: 'pass' }],
      targetOrder: 'id',
      tieBreak: 'lexical',
      reactionPriority: [],
      maxCandidates: 20,
      stallLimit: 5,
    },
    narration: { fragments: [] },
  };
  const definition = { ...body, contentHash: packContentHash(body) };
  const options: AdventureStartOptions = {
    adventureId: 'adventure',
    seed: 42,
    members: encounterOptions.members,
  };
  return { pack, definition, options, encounterOptions };
}
export function rehash(definition: AdventureDefinition): AdventureDefinition {
  const body: Partial<AdventureDefinition> = { ...definition };
  Reflect.deleteProperty(body, 'contentHash');
  return { ...definition, contentHash: packContentHash(body) };
}
type Body<T = AdventureCommand> = T extends AdventureCommand
  ? Omit<T, 'adventureId' | 'expectedRevision'>
  : never;
export function dispatch(adventure: Adventure, body: Body) {
  return adventure.dispatch({
    ...body,
    adventureId: adventure.view().adventureId,
    expectedRevision: adventure.view().revision,
  } as AdventureCommand);
}
export function choose(adventure: Adventure, choiceId = 'continue') {
  return dispatch(adventure, { type: 'choose', nodeId: adventure.view().nodeId, choiceId });
}
