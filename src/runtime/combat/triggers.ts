/**
 * Triggered/reactive actions (FR-4, FR-13, triggers.html): packs declare
 * actions with `trigger.on` event patterns; when a matching event crosses the
 * stream, the engine OFFERS it as a `trigger:fired` event with a
 * `pendingTrigger` — the host answers in its own pacing via
 * `respond(triggerId, choice)` (stepwise by construction, FR-10). Declining is
 * a first-class outcome (`trigger:declined`); taking rides the same resolution
 * pipeline as a declared action (no magic subsystem, FR-9's discipline).
 *
 * Pattern language (the documented v1 grammar, from the mocks):
 *   `<eventType>`                     — matches the event type exactly
 *   `<eventType>[target=self]`        — matches when the event's target is the reactor
 *   `<eventType>[actor=self]`         — matches when the event's actor is the reactor
 * Anything else is a pack-literal pattern matched verbatim against the type.
 * The engine has never heard of "parry" (FR-4) — patterns are data.
 */
import type { Runtime } from '../runtime';
import type { RuntimeEvent } from '../events';
import type { ActionDef } from '../../schema/artifacts';
import type { Combat, CombatantState, PendingTrigger } from './combat';

/** A reactive action registered from the pack: the action id + its pattern. */
export interface ReactiveAction {
  readonly actionId: string;
  readonly pattern: string;
  /** The reactor this offer belongs to (the combatant holding the action). */
  readonly reactorId: string;
}

/** Test one event against one `trigger.on` pattern (the documented v1 grammar). */
export function eventMatches(pattern: string, event: RuntimeEvent, reactorId: string): boolean {
  const bracket = pattern.indexOf('[');
  const base = bracket === -1 ? pattern : pattern.slice(0, bracket);
  if (event.type !== base) return false;
  if (bracket === -1) return true;
  const clause = pattern.slice(bracket + 1, pattern.lastIndexOf(']'));
  const [key, value] = clause.split('=', 2).map((part) => part?.trim());
  if (key === 'target') return value === 'self' ? event.target === reactorId : event.target === value;
  if (key === 'actor') return value === 'self' ? event.actor === reactorId : event.actor === value;
  return false;
}

/** Reactive actions one combatant holds, from the pack's action defs. */
export function reactiveActionsFor(
  runtime: Runtime,
  combatant: CombatantState,
): readonly { actionId: string; def: ActionDef; pattern: string }[] {
  const held: { actionId: string; def: ActionDef; pattern: string }[] = [];
  for (const actionId of combatant.actions) {
    const def = runtime.pack.actions[actionId];
    if (def?.trigger !== undefined) held.push({ actionId, def, pattern: def.trigger.on });
  }
  return held;
}

/**
 * After an event lands, every OTHER combatant's reactive actions whose pattern
 * matches become offers. The engine never resolves them on its own — offering
 * is the whole mechanism (triggers.html: "the engine offers; the host decides
 * pacing").
 */
export function offersForEvent(
  runtime: Runtime,
  combatants: Readonly<Record<string, CombatantState>>,
  event: RuntimeEvent,
): readonly PendingTrigger[] {
  const offers: PendingTrigger[] = [];
  for (const combatant of Object.values(combatants)) {
    for (const reactive of reactiveActionsFor(runtime, combatant)) {
      if (eventMatches(reactive.pattern, event, combatant.id)) {
        offers.push({
          triggerId: `${combatant.id}.${reactive.actionId}`,
          actorId: combatant.id,
          actionId: reactive.actionId,
          matchingEvent: event.type,
        });
      }
    }
  }
  return offers;
}

/** The `trigger:fired` event — the offer itself is provenance (FR-12 proof 2 shape). */
export function emitOffer(runtime: Runtime, offer: PendingTrigger, offerIndex: number): void {
  runtime.events.emit({
    type: 'trigger:fired',
    actor: offer.actorId,
    payload: { triggerId: offer.triggerId, actionId: offer.actionId, on: offer.matchingEvent, offerIndex },
    why: { rule: `actions.${offer.actionId}.trigger`, rolls: [] },
  });
}

/** The `trigger:declined` event — declining is a first-class answer (triggers.html). */
export function emitDeclined(runtime: Runtime, offer: PendingTrigger): void {
  runtime.events.emit({
    type: 'trigger:declined',
    actor: offer.actorId,
    payload: { triggerId: offer.triggerId, actionId: offer.actionId, on: offer.matchingEvent },
    why: { rule: `actions.${offer.actionId}.trigger`, rolls: [] },
  });
}

/** The reactive executor's entry: resolve a taken trigger through the same pipeline as a declare (FR-4). */
export function resolveTriggered(
  fight: Combat,
  offer: PendingTrigger,
  targetId: string | undefined,
): readonly RuntimeEvent[] {
  return fight.declareReactive(offer, targetId);
}
