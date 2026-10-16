import type { Pack } from '../../schema/pack';
import {
  validateAdventureDefinition,
  type AdventureDefinition,
  type AdventureStartOptions,
} from '../../schema/adventure';
import { Rng } from '../../core/rng';
import { RuntimeRuleError } from '../errors';
import { PackLoadError } from '../runtime';
import { CharacterBuildError } from '../progression';
import { packIdentity } from '../snapshots/envelope';
import { streamKey } from '../play/encounter';
import { detached } from '../play/snapshot';
import { choices, commandShape, currentNode, exact, refuse } from './choices';
import { jsonValue, readMembers, readAdventureSnapshot } from './snapshot';
import type { Adventure, AdventureSnapshot, AdventureView } from './types';

function enter(definition: AdventureDefinition, saved: AdventureSnapshot): AdventureSnapshot {
  const node = currentNode(definition, saved);
  if (node.kind === 'encounter' || node.rewardIds.length)
    refuse('nodeId', 'This transition is not available yet.');
  const sequence = saved.sequence + 1;
  if (!Number.isSafeInteger(sequence)) refuse('sequence', 'Journal sequence exhausted.');
  return {
    ...saved,
    resolvedNodeIds: [...saved.resolvedNodeIds, node.id],
    phase: node.kind === 'success' ? 'completed' : 'exploration',
    sequence,
    journal: [
      ...saved.journal,
      {
        sequence,
        revision: saved.revision,
        event: {
          type: 'node:entered',
          at: { round: 0, turn: 0 },
          payload: { nodeId: node.id },
          why: { rule: `nodes.${node.id}`, rolls: [] },
        },
        subjects: [],
      },
    ],
  };
}
function facade(pack: Pack, definition: AdventureDefinition, initial: AdventureSnapshot): Adventure {
  let saved = initial;
  const view = (): AdventureView =>
    detached({
      adventureId: saved.adventureId,
      revision: saved.revision,
      phase: saved.phase,
      nodeId: saved.nodeId,
      objective: definition.objective,
      members: saved.members.map((member) => ({ ...member, combatantId: `m:${member.memberId}` })),
      combat: null,
      choices: choices(definition, saved),
      pendingRewards: [],
      availableCommands: saved.phase === 'exploration' ? ['choose', 'abandon'] : [],
      journalSequence: saved.sequence,
      narrationAck: saved.narrationAck,
    });
  return {
    view,
    serialize: () => detached(saved),
    dispatch(input) {
      try {
        jsonValue(input, 'command');
        if (!commandShape(input)) refuse('command', 'Malformed command or unexpected field.');
        if (input.adventureId !== saved.adventureId) refuse('adventureId', 'Foreign adventure.');
        if (input.expectedRevision !== saved.revision) refuse('expectedRevision', 'Stale revision.');
        if (!Number.isSafeInteger(saved.revision + 1)) refuse('revision', 'Revision exhausted.');
        if (saved.phase !== 'exploration') refuse('phase', 'Command is unavailable at this boundary.');
        let next: AdventureSnapshot = { ...saved, revision: saved.revision + 1 };
        if (input.type === 'choose') {
          if (input.nodeId !== saved.nodeId) refuse('nodeId', 'Foreign current node.');
          const choice = currentNode(definition, saved).choices.find((c) => c.id === input.choiceId);
          if (!choice) refuse('choiceId', 'Unknown choice.');
          next = enter(definition, {
            ...next,
            nodeId: choice.toNodeId,
            visitedNodeIds: [...saved.visitedNodeIds, choice.toNodeId],
            choiceTrail: [
              ...saved.choiceTrail,
              {
                nodeId: saved.nodeId,
                choiceId: choice.id,
                toNodeId: choice.toNodeId,
                revision: next.revision,
              },
            ],
          });
        } else next = { ...next, phase: 'abandoned' };
        next = readAdventureSnapshot(pack, definition, next);
        const events = next.journal.slice(saved.sequence);
        saved = next;
        return { ok: true, revision: saved.revision, events: detached(events), view: view() };
      } catch (error) {
        if (!(
          error instanceof RuntimeRuleError ||
          error instanceof CharacterBuildError ||
          error instanceof PackLoadError
        ))
          throw error;
        return {
          ok: false,
          revision: saved.revision,
          errors: detached(error.errors),
          events: [],
          view: view(),
        };
      }
    },
  };
}
function ownInputs(pack: Pack, definition: AdventureDefinition) {
  jsonValue(pack, 'pack');
  jsonValue(definition, 'definition');
  const errors = validateAdventureDefinition(pack, definition);
  if (errors.length) throw new RuntimeRuleError(errors);
  return { pack: detached(pack), definition: detached(definition) };
}
export function createAdventure(
  pack: Pack,
  definition: AdventureDefinition,
  options: AdventureStartOptions,
): Adventure {
  const owned = ownInputs(pack, definition);
  jsonValue(options, 'options');
  if (
    !exact(options, ['adventureId', 'seed', 'members']) ||
    typeof options.adventureId !== 'string' ||
    !options.adventureId.length ||
    !(typeof options.seed === 'string' || (typeof options.seed === 'number' && Number.isFinite(options.seed)))
  )
    refuse('options', 'Invalid adventure start options.');
  const members = readMembers(owned.pack, options.members),
    seed = String(options.seed),
    adventureId = options.adventureId;
  const rng = (tag: string) => new Rng(streamKey(tag, adventureId, seed)).getState();
  const saved: AdventureSnapshot = {
    kind: 'adventure',
    snapshotVersion: 1,
    pack: packIdentity(owned.pack),
    definition: { id: definition.id, schemaVersion: 1, contentHash: definition.contentHash },
    adventureId,
    revision: 0,
    seed,
    nodeId: definition.startNodeId,
    phase: 'exploration',
    visitedNodeIds: [definition.startNodeId],
    resolvedNodeIds: [],
    choiceTrail: [],
    restedNodeIds: [],
    members,
    activeEncounter: null,
    encounterReceipts: [],
    rng: {
      generation: rng('adventure-generation'),
      play: rng('adventure-play'),
      rewards: rng('adventure-rewards'),
      director: rng('adventure-director'),
    },
    rewards: [],
    sequence: 0,
    journal: [],
    encounterEventCursor: 0,
    director: {
      policy: { id: definition.director.id, version: definition.director.version },
      decisions: 0,
      stalledSteps: 0,
      lastMechanicalHash: null,
    },
    narrationAck: 0,
  };
  return facade(
    owned.pack,
    owned.definition,
    readAdventureSnapshot(owned.pack, owned.definition, enter(owned.definition, saved)),
  );
}
export function restoreAdventure(pack: Pack, definition: AdventureDefinition, snapshot: unknown): Adventure {
  const owned = ownInputs(pack, definition);
  return facade(owned.pack, owned.definition, readAdventureSnapshot(owned.pack, owned.definition, snapshot));
}
