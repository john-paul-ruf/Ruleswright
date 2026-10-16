import { adventureContexts } from './adventure';
import { refuse } from './choices';
import type { Adventure, NarrationMessage } from './types';

/** Project committed facts; only ack-narration consumes them. */
export function readNarration(adventure: Adventure): readonly NarrationMessage[] {
  const context = adventureContexts.get(adventure);
  if (!context) refuse('adventure', 'Expected a created or restored adventure.');
  const { definition } = context;
  const saved = adventure.serialize();
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
  const fragments = new Map(definition.narration.fragments.map((fragment) => [fragment.eventType, fragment]));
  let nodeId = definition.startNodeId;
  const messages: NarrationMessage[] = [];
  for (const entry of saved.journal) {
    const event = entry.event;
    if (event.type === 'node:entered') nodeId = event.payload['nodeId'] as string;
    if (entry.sequence <= saved.narrationAck) continue;
    const name = (id: string | undefined) => entry.subjects.find((subject) => subject.id === id)?.name;
    const healing =
      event.type === 'damage:applied' &&
      typeof event.payload['amount'] === 'number' &&
      event.payload['amount'] < 0;
    const fragment = healing ? undefined : fragments.get(event.type);
    const values = new Map<string, string>();
    for (const slot of fragment?.slots ?? []) {
      let value: unknown;
      if (slot.path === 'type') value = event.type;
      else if (slot.path === 'actor') value = name(event.actor);
      else if (slot.path === 'target') value = name(event.target);
      else if (slot.path === 'why.rule') value = event.why.rule;
      else if (slot.path === 'why.rolls') value = event.why.rolls.join(', ');
      else if (slot.path.startsWith('payload.')) {
        const key = slot.path.slice(8);
        if (Object.prototype.hasOwnProperty.call(event.payload, key)) value = event.payload[key];
      } else if (slot.path.startsWith('facts.')) {
        const key = slot.path.slice(6),
          facts = nodes.get(nodeId)!.facts;
        value = Object.prototype.hasOwnProperty.call(facts, key)
          ? facts[key]
          : Object.prototype.hasOwnProperty.call(definition.facts, key)
            ? definition.facts[key]
            : undefined;
      }
      if (value !== undefined)
        values.set(slot.name, typeof value === 'string' ? value : JSON.stringify(value));
    }
    const matched = fragment !== undefined && values.size === fragment.slots.length;
    messages.push({
      messageId: JSON.stringify([saved.adventureId, entry.sequence]),
      sequence: entry.sequence,
      templateId: matched ? fragment.id : null,
      event,
      text: matched
        ? fragment.text.replace(/\{([a-z][a-z0-9-]*)\}/g, (_placeholder, slot: string) => values.get(slot)!)
        : `${healing ? 'Healing' : event.type}${event.actor ? `; actor: ${name(event.actor)}` : ''}${event.target ? `; target: ${name(event.target)}` : ''}; ${JSON.stringify(event.payload)}; rule: ${event.why.rule}; rolls: ${event.why.rolls.join(', ')}`,
    });
  }
  return messages;
}
