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
import { choices, commandShape, currentNode, exact, refuse, prepareMembers } from './choices';
import { jsonValue, readMembers, readAdventureSnapshot } from './snapshot';
import { createEncounterSession, restoreEncounterSession, type EncounterSession } from '../play/session';
import type { PlayJournalEntry } from '../../schema/play-session';
import { stageRewards, claimReward } from './rewards';
import type { Adventure, AdventureSnapshot, AdventureView, AdventureCommand, RewardReceipt } from './types';

function append(
  saved: AdventureSnapshot,
  entries: readonly Pick<PlayJournalEntry, 'event' | 'subjects'>[],
): AdventureSnapshot {
  const journal = [...saved.journal];
  for (const entry of entries) {
    const sequence = journal.length + 1;
    if (!Number.isSafeInteger(sequence)) refuse('sequence', 'Journal sequence exhausted.');
    journal.push({ ...entry, sequence, revision: saved.revision });
  }
  return { ...saved, journal, sequence: journal.length };
}
function copyEncounter(saved: AdventureSnapshot, session: EncounterSession): AdventureSnapshot {
  const nested = session.serialize();
  return {
    ...append(saved, nested.journal.slice(saved.encounterEventCursor)),
    activeEncounter: nested,
    encounterEventCursor: nested.sequence,
  };
}
function settle(
  pack: Pack,
  definition: AdventureDefinition,
  saved: AdventureSnapshot,
  session: EncounterSession,
): AdventureSnapshot {
  if (session.view().phase === 'terminal') {
    const result = session.dispatch({
      type: 'finalize',
      sessionId: session.view().sessionId,
      expectedRevision: session.view().revision,
    });
    if (!result.ok) throw new RuntimeRuleError(result.errors);
  }
  let next = copyEncounter(saved, session);
  const nested = session.serialize();
  if (nested.phase !== 'settled') return next;
  const receipt = nested.settlements[0]!;
  next = {
    ...next,
    members: nested.members,
    activeEncounter: null,
    encounterEventCursor: 0,
    encounterReceipts: [...next.encounterReceipts, { nodeId: saved.nodeId, receipt }],
  };
  if (receipt.result !== 'victory')
    return { ...next, phase: receipt.result === 'defeat' ? 'defeated' : 'abandoned' };
  return stageRewards(pack, definition, { ...next, resolvedNodeIds: [...next.resolvedNodeIds, next.nodeId] });
}
function enter(pack: Pack, definition: AdventureDefinition, saved: AdventureSnapshot): AdventureSnapshot {
  const node = currentNode(definition, saved);
  const next = append(saved, [
    {
      event: {
        type: 'node:entered',
        at: { round: 0, turn: 0 },
        payload: { nodeId: node.id },
        why: { rule: `nodes.${node.id}`, rolls: [] },
      },
      subjects: [],
    },
  ]);
  if (node.kind !== 'encounter')
    return stageRewards(pack, definition, { ...next, resolvedNodeIds: [...next.resolvedNodeIds, node.id] });
  const generation = new Rng(next.rng.generation);
  const session = createEncounterSession(pack, {
    sessionId: JSON.stringify([next.adventureId, node.id]),
    seed: generation.int(4294967296),
    members: next.members,
    setup: node.encounter!,
  });
  return settle(
    pack,
    definition,
    { ...next, phase: 'encounter', rng: { ...next.rng, generation: generation.getState() } },
    session,
  );
}
function facade(pack: Pack, definition: AdventureDefinition, initial: AdventureSnapshot): Adventure {
  let saved = initial;
  const view = (): AdventureView => {
    const encounter = saved.activeEncounter
      ? restoreEncounterSession(pack, saved.activeEncounter).view()
      : null;
    const availableCommands: AdventureCommand['type'][] = [];
    if (['exploration', 'encounter', 'reward-pending'].includes(saved.phase))
      availableCommands.push('abandon');
    if (saved.phase === 'exploration') availableCommands.unshift('choose');
    if (saved.phase === 'encounter') availableCommands.push('encounter');
    if (saved.phase === 'reward-pending') availableCommands.push('claim-reward');
    const node = currentNode(definition, saved);
    if (['exploration', 'reward-pending'].includes(saved.phase) && saved.resolvedNodeIds.includes(node.id)) {
      if (node.rest === 'once' && !saved.restedNodeIds.includes(node.id)) availableCommands.push('rest');
      if (node.preparation) availableCommands.push('prepare');
      availableCommands.push('equip', 'unequip', 'use-item');
    }
    return detached({
      adventureId: saved.adventureId,
      revision: saved.revision,
      phase: saved.phase,
      nodeId: saved.nodeId,
      objective: definition.objective,
      members:
        encounter?.members ??
        saved.members.map((member) => ({ ...member, combatantId: `m:${member.memberId}` })),
      combat: encounter?.combat ?? null,
      choices: choices(definition, saved),
      pendingRewards: saved.rewards
        .filter((r) => r.status === 'pending')
        .map(({ claimId, nodeId, rewardId, eligibleMemberIds, roll }) => ({
          claimId,
          nodeId,
          rewardId,
          eligibleMemberIds,
          roll,
        })),
      availableCommands,
      journalSequence: saved.sequence,
      narrationAck: saved.narrationAck,
    });
  };
  return {
    view,
    serialize: () => detached(saved),
    dispatch(input) {
      try {
        jsonValue(input, 'command');
        if (!commandShape(input)) refuse('command', 'Malformed command or unexpected field.');
        if (input.adventureId !== saved.adventureId) refuse('adventureId', 'Foreign adventure.');
        if (input.expectedRevision !== saved.revision) refuse('expectedRevision', 'Stale revision.');
        if (saved.phase === 'defeated' || saved.phase === 'abandoned')
          refuse('phase', 'Adventure is terminal.');
        let claim;
        let recipient: string | null = null;
        if (input.type === 'claim-reward') {
          claim = saved.rewards.find((r) => r.claimId === input.claimId);
          if (!claim || claim.nodeId !== input.nodeId || claim.rewardId !== input.rewardId)
            refuse('claimId', 'Foreign reward subject.');
          if (claim.roll !== null) {
            if (!input.recipientMemberId || !claim.eligibleMemberIds.includes(input.recipientMemberId))
              refuse('recipientMemberId', 'Choose an eligible loot recipient.');
            recipient = input.recipientMemberId;
          } else if ('recipientMemberId' in input)
            refuse('recipientMemberId', 'A reward without loot has no recipient.');
          if (claim.status === 'claimed') {
            if (claim.receipt.recipientMemberId !== recipient)
              refuse('recipientMemberId', 'Receipt recipient differs.');
            return {
              ok: true,
              revision: saved.revision,
              events: [],
              view: view(),
              receipt: detached(claim.receipt),
            };
          }
          if (saved.phase !== 'reward-pending' || claim.nodeId !== saved.nodeId)
            refuse('phase', 'Claim is not available at this node.');
        }
        if (!Number.isSafeInteger(saved.revision + 1)) refuse('revision', 'Revision exhausted.');
        if (saved.phase === 'completed') refuse('phase', 'Adventure is complete.');
        let next: AdventureSnapshot = { ...saved, revision: saved.revision + 1 };
        let receipt: RewardReceipt | undefined;
        if (input.type === 'choose') {
          if (saved.phase !== 'exploration') refuse('phase', 'Resolve this node and its rewards first.');
          if (input.nodeId !== saved.nodeId) refuse('nodeId', 'Foreign current node.');
          const choice = currentNode(definition, saved).choices.find((c) => c.id === input.choiceId);
          if (!choice) refuse('choiceId', 'Unknown choice.');
          next = enter(pack, definition, {
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
        } else if (input.type === 'encounter') {
          if (
            !saved.activeEncounter ||
            saved.phase !== 'encounter' ||
            input.encounterId !== saved.activeEncounter.encounter.encounterId
          )
            refuse('encounterId', 'No matching active encounter.');
          if ((input.command.type as string) === 'next')
            refuse('command.type', 'Adventure nodes own separate encounters.');
          const session = restoreEncounterSession(pack, saved.activeEncounter);
          const result = session.dispatch(input.command);
          if (!result.ok) throw new RuntimeRuleError(result.errors);
          next = settle(pack, definition, next, session);
        } else if (input.type === 'claim-reward') {
          const staged = claimReward(pack, definition, next, claim!, recipient);
          next = append(staged.saved, staged.events);
          receipt = staged.receipt;
        } else if (input.type !== 'abandon') {
          const staged = prepareMembers(pack, definition, next, input);
          next = append(staged.saved, staged.events);
        } else {
          if (saved.activeEncounter) {
            const session = restoreEncounterSession(pack, saved.activeEncounter);
            const result = session.dispatch({
              type: 'abandon',
              sessionId: session.view().sessionId,
              expectedRevision: session.view().revision,
            });
            if (!result.ok) throw new RuntimeRuleError(result.errors);
            next = settle(pack, definition, next, session);
          }
          next = { ...next, phase: 'abandoned' };
        }
        next = readAdventureSnapshot(pack, definition, next);
        const events = next.journal.slice(saved.sequence);
        saved = next;
        return {
          ok: true,
          revision: saved.revision,
          events: detached(events),
          view: view(),
          ...(receipt ? { receipt: detached(receipt) } : {}),
        };
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
    readAdventureSnapshot(owned.pack, owned.definition, enter(owned.pack, owned.definition, saved)),
  );
}
export function restoreAdventure(pack: Pack, definition: AdventureDefinition, snapshot: unknown): Adventure {
  const owned = ownInputs(pack, definition);
  return facade(owned.pack, owned.definition, readAdventureSnapshot(owned.pack, owned.definition, snapshot));
}
