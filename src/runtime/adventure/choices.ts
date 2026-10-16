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
  if (value['type'] === 'encounter')
    return (
      exact(value, [...common, 'encounterId', 'command']) &&
      typeof value['encounterId'] === 'string' &&
      isRecord(value['command'])
    );
  if (value['type'] === 'abandon') return exact(value, common);
  return (
    value['type'] === 'choose' &&
    exact(value, [...common, 'nodeId', 'choiceId']) &&
    typeof value['nodeId'] === 'string' &&
    typeof value['choiceId'] === 'string'
  );
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
