import type { Pack } from '../../schema/pack';
import { Rng } from '../../core/rng';
import { rest, prepareSpell } from '../pools';
import { equipItem, unequipItem, useItem } from '../equipment';
import { writeMembers } from './rewards';
import type { AdventureDefinition, AdventureNode } from '../../schema/adventure';
import type { AdventureCommand, AdventureSnapshot, AdventureView } from './types';
import { RuntimeRuleError, ruleCard } from '../errors';
import { isRecord } from '../snapshots/envelope';

export function refuse(path: string, message: string): never {
  throw new RuntimeRuleError([ruleCard('E-REF-01', '(adventure)', path, message)]);
}
export function exact(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
  );
}
export function commandShape(value: unknown): value is AdventureCommand {
  if (!isRecord(value)) return false;
  const common = ['type', 'adventureId', 'expectedRevision'];
  if (
    typeof value['adventureId'] !== 'string' ||
    !value['adventureId'].length ||
    !Number.isSafeInteger(value['expectedRevision']) ||
    (value['expectedRevision'] as number) < 0
  )
    return false;
  const text = (key: string) => typeof value[key] === 'string' && (value[key] as string).length > 0;
  switch (value['type']) {
    case 'ack-narration':
      return (
        exact(value, [...common, 'throughSequence']) &&
        Number.isSafeInteger(value['throughSequence']) &&
        (value['throughSequence'] as number) >= 0
      );
    case 'abandon':
      return exact(value, common);
    case 'encounter':
      return (
        exact(value, [...common, 'encounterId', 'command']) &&
        text('encounterId') &&
        isRecord(value['command'])
      );
    case 'choose':
      return exact(value, [...common, 'nodeId', 'choiceId']) && text('nodeId') && text('choiceId');
    case 'claim-reward':
      return (
        exact(value, [...common, 'nodeId', 'rewardId', 'claimId'], ['recipientMemberId']) &&
        ['nodeId', 'rewardId', 'claimId'].every(text) &&
        (!('recipientMemberId' in value) || text('recipientMemberId'))
      );
    case 'rest':
      return exact(value, [...common, 'nodeId']) && text('nodeId');
    case 'prepare':
      return (
        exact(value, [...common, 'nodeId', 'memberId', 'spellId'], ['slotIndex']) &&
        ['nodeId', 'memberId', 'spellId'].every(text) &&
        (!('slotIndex' in value) ||
          (Number.isSafeInteger(value['slotIndex']) && (value['slotIndex'] as number) >= 0))
      );
    case 'equip':
      return (
        exact(value, [...common, 'nodeId', 'memberId', 'itemId', 'slot']) &&
        ['nodeId', 'memberId', 'itemId', 'slot'].every(text)
      );
    case 'unequip':
      return (
        exact(value, [...common, 'nodeId', 'memberId', 'slot']) && ['nodeId', 'memberId', 'slot'].every(text)
      );
    case 'use-item':
      return (
        exact(value, [...common, 'nodeId', 'memberId', 'itemId']) &&
        ['nodeId', 'memberId', 'itemId'].every(text)
      );
    default:
      return false;
  }
}
export function currentNode(definition: AdventureDefinition, saved: AdventureSnapshot): AdventureNode {
  return definition.nodes.find((node) => node.id === saved.nodeId)!;
}
export function choices(definition: AdventureDefinition, saved: AdventureSnapshot): AdventureView['choices'] {
  return currentNode(definition, saved).choices.map((choice) => ({
    choiceId: choice.id,
    text: choice.text,
    toNodeId: choice.toNodeId,
    available: saved.phase === 'exploration',
    reason:
      saved.phase === 'exploration'
        ? null
        : ruleCard(
            'E-REF-01',
            saved.nodeId,
            'phase',
            'Resolve this location and claim its rewards before choosing a route.',
          ),
  }));
}

export function prepareMembers(
  pack: Pack,
  definition: AdventureDefinition,
  saved: AdventureSnapshot,
  command: Extract<AdventureCommand, { type: 'rest' | 'prepare' | 'equip' | 'unequip' | 'use-item' }>,
) {
  const node = currentNode(definition, saved);
  if (
    command.nodeId !== node.id ||
    !saved.resolvedNodeIds.includes(node.id) ||
    !['exploration', 'reward-pending'].includes(saved.phase)
  )
    refuse('nodeId', 'Preparation requires the current resolved node.');
  if (command.type === 'rest' && (node.rest !== 'once' || saved.restedNodeIds.includes(node.id)))
    refuse('rest', 'Rest is unavailable or already used.');
  if (command.type === 'prepare' && !node.preparation)
    refuse('preparation', 'This node does not permit preparation.');
  if ('memberId' in command && !saved.members.some((m) => m.memberId === command.memberId))
    refuse('memberId', 'Unknown member.');
  const rng = new Rng(saved.rng.play);
  const staged = writeMembers(pack, saved.members, (runtime, character, memberId) => {
    if ('memberId' in command && command.memberId !== memberId) return;
    switch (command.type) {
      case 'rest':
        rest(runtime, character.state);
        break;
      case 'prepare':
        prepareSpell(runtime, character.state, command.spellId, command.slotIndex);
        break;
      case 'equip':
        equipItem(runtime, character.state, command.itemId, command.slot);
        break;
      case 'unequip':
        unequipItem(runtime, character.state, command.slot);
        break;
      case 'use-item':
        useItem(runtime, character.state, command.itemId, { rng });
        break;
    }
  });
  return {
    ...staged,
    saved: {
      ...saved,
      members: staged.members,
      rng: { ...saved.rng, play: rng.getState() },
      restedNodeIds: command.type === 'rest' ? [...saved.restedNodeIds, node.id] : saved.restedNodeIds,
    },
  };
}
