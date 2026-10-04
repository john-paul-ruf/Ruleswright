/**
 * Triggered/reactive actions (FR-4, FR-13, triggers.html): packs declare
 * actions with `trigger.on` event patterns; when a matching event crosses the
 * stream, the engine OFFERS it as a `trigger:fired` event with a
 * `pendingTrigger` — the host answers in its own pacing via
 * `respond(triggerId, choice)` (stepwise by construction, FR-10). Declining is
 * a first-class outcome (`trigger:declined`); taking rides the same resolution
 * pipeline as a declared action (no magic subsystem, FR-9's discipline).
 *
 * Pattern language (the v1 grammar; v1.6 enforces it at load, E-FORM-01,
 * `TRIGGER_PATTERN` in schema/validate/helpers.ts):
 *   `<eventType>`                     — matches the event type exactly
 *   `<eventType>[target=self|<id>]`   — matches when the event's target is the reactor (or <id>)
 *   `<eventType>[actor=self|<id>]`    — matches when the event's actor is the reactor (or <id>)
 * The engine has never heard of "parry" (FR-4) — patterns are data.
 *
 * Reactive feats (v1.6, DD-S12) ride the same substrate: a combatant's held
 * `feats` with a `trigger` are offered exactly like reactive actions, with
 * `source: 'feat'` on the offer and its events.
 */
import type { Runtime } from '../runtime';
import type { RuntimeEvent } from '../events';
import type { ActionDef, FeatDef } from '../../schema/artifacts';
import type { Combat } from './combat';
import type { FightCore } from './fight';
import type { CombatantState, PendingTrigger } from './types';
import { checkCost, spend } from './action-economy';
import { balancesOf } from './combatants';
import {
  applyNonSlotCosts,
  isSelfAction,
  resolveTarget,
  restrictionRejection,
  selfTargetRefusal,
  spatialGate,
} from './declare';
import { endIfSideDefeated, executeBound, resolveAction } from './execute';

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

/** Reactive feats one combatant holds (DD-S12): its `feats` that declare a `trigger`. */
export function reactiveFeatsFor(
  runtime: Runtime,
  combatant: CombatantState,
): readonly { featId: string; def: FeatDef; pattern: string }[] {
  const held: { featId: string; def: FeatDef; pattern: string }[] = [];
  for (const featId of combatant.feats ?? []) {
    const def = runtime.pack.content.feats?.[featId];
    if (def?.trigger !== undefined) held.push({ featId, def, pattern: def.trigger.on });
  }
  return held;
}

/**
 * After an event lands, every combatant's reactive actions whose pattern
 * matches become offers, then (unless `feats: false`, the no-chain rule,
 * DD-S12) every combatant's matching reactive feats — each pass in
 * `Object.values` order. The engine never resolves them on its own —
 * offering is the whole mechanism (triggers.html: "the engine offers; the
 * host decides pacing").
 */
export function offersForEvent(
  runtime: Runtime,
  combatants: Readonly<Record<string, CombatantState>>,
  event: RuntimeEvent,
  options: { readonly feats?: boolean } = {},
): readonly PendingTrigger[] {
  const offers: PendingTrigger[] = [];
  const offer = (combatant: CombatantState, id: string, source: PendingTrigger['source']) =>
    offers.push({
      triggerId: `${combatant.id}.${id}`,
      actorId: combatant.id,
      actionId: id,
      source,
      matchingEvent: event.type,
    });
  for (const combatant of Object.values(combatants)) {
    for (const reactive of reactiveActionsFor(runtime, combatant)) {
      if (eventMatches(reactive.pattern, event, combatant.id)) offer(combatant, reactive.actionId, 'action');
    }
  }
  if (options.feats === false) return offers;
  for (const combatant of Object.values(combatants)) {
    for (const reactive of reactiveFeatsFor(runtime, combatant)) {
      if (eventMatches(reactive.pattern, event, combatant.id)) offer(combatant, reactive.featId, 'feat');
    }
  }
  return offers;
}

/** The offered artifact's trigger path: `actions.<id>.trigger` or `content.feats.<id>.trigger`. */
function triggerRule(offer: PendingTrigger): string {
  return offer.source === 'feat'
    ? `content.feats.${offer.actionId}.trigger`
    : `actions.${offer.actionId}.trigger`;
}

/** The `trigger:fired` event — the offer itself is provenance (FR-12 proof 2 shape). */
export function emitOffer(runtime: Runtime, offer: PendingTrigger, offerIndex: number): void {
  runtime.events.emit({
    type: 'trigger:fired',
    actor: offer.actorId,
    payload: {
      triggerId: offer.triggerId,
      actionId: offer.actionId,
      source: offer.source,
      on: offer.matchingEvent,
      offerIndex,
    },
    why: { rule: triggerRule(offer), rolls: [] },
  });
}

/** The `trigger:declined` event — declining is a first-class answer (triggers.html). */
export function emitDeclined(runtime: Runtime, offer: PendingTrigger): void {
  runtime.events.emit({
    type: 'trigger:declined',
    actor: offer.actorId,
    payload: {
      triggerId: offer.triggerId,
      actionId: offer.actionId,
      source: offer.source,
      on: offer.matchingEvent,
    },
    why: { rule: triggerRule(offer), rolls: [] },
  });
}

/**
 * Answer a taken-off-the-queue offer: a decline emits `trigger:declined`
 * stamped with the fight's clock; a take resolves the feat or reactive action.
 */
export function answerOffer(
  core: FightCore,
  offer: PendingTrigger,
  choice: 'take' | 'decline',
  targetId: string | undefined,
): readonly RuntimeEvent[] {
  if (choice === 'decline') {
    core.setClock(); // stamp with the fight's clock — a restored fight's stream starts at round 0
    emitDeclined(core.runtime, offer);
    const declined = core.runtime.events.sinceRound(core.state.round);
    return [declined[declined.length - 1]!];
  }
  return offer.source === 'feat'
    ? resolveFeat(core, offer, targetId)
    : resolveReactive(core, offer, targetId);
}

/** Resolve a taken trigger through the same pipeline as a declared action (FR-4, FR-12 proof 2). */
export function resolveReactive(
  core: FightCore,
  offer: PendingTrigger,
  targetId: string | undefined,
): readonly RuntimeEvent[] {
  const reactor = core.state.combatants[offer.actorId]!;
  const def = core.runtime.pack.actions[offer.actionId]!;
  const restriction = restrictionRejection(core.runtime, reactor, def);
  if (restriction !== undefined) {
    return [core.reject(reactor.id, restriction)];
  }
  if (isSelfAction(core.runtime, offer.actionId)) {
    // DD-A2: a self reaction binds its reactor — no opponent resolution, no reach gate.
    const refusal = selfTargetRefusal(offer.actionId, reactor.id, targetId);
    if (refusal !== undefined) return [core.reject(reactor.id, refusal)];
    return resolveReactiveAgainst(core, offer, def, reactor, reactor);
  }
  const target = resolveTarget(core.state, reactor, targetId);
  if ('rejection' in target) {
    return [core.reject(reactor.id, target.rejection)];
  }
  const spatial = spatialGate(core.runtime, reactor, target.combatant);
  if (spatial !== undefined) {
    return [core.reject(reactor.id, spatial)];
  }
  return resolveReactiveAgainst(core, offer, def, reactor, target.combatant);
}

/** The cost gates, spend and resolution of a taken reaction whose target is bound. */
export function resolveReactiveAgainst(
  core: FightCore,
  offer: PendingTrigger,
  def: ActionDef,
  reactor: CombatantState,
  target: CombatantState,
): readonly RuntimeEvent[] {
  const costRejection = checkCost(def.cost, core.grants, balancesOf(reactor));
  if (costRejection !== undefined) {
    return [core.reject(reactor.id, costRejection)];
  }
  const spendRejection = spend(reactor.slots, core.grants, def.cost);
  if (spendRejection !== undefined) {
    return [core.reject(reactor.id, spendRejection)];
  }
  applyNonSlotCosts(reactor, def.cost);
  const { result: events, emitted } = core.collect(() =>
    resolveAction(core, reactor, offer.actionId, def, target, {}),
  );
  core.surfaceOffers(emitted);
  return events;
}

/**
 * Take a reactive feat (DD-S12): feats declare no cost and pass no
 * restriction or reach gate; the parse-once effect runs with the holder as
 * its target and `why.rule` `content.feats.<id>`. A `targetId` other than
 * the holder is `invalid-target` (the offer has still left the queue).
 * Events it emits never offer feats — the no-chain rule.
 */
export function resolveFeat(
  core: FightCore,
  offer: PendingTrigger,
  targetId: string | undefined,
): readonly RuntimeEvent[] {
  const holder = core.state.combatants[offer.actorId]!;
  if (targetId !== undefined && targetId !== holder.id) {
    return [
      core.reject(holder.id, {
        kind: 'invalid-target',
        rule: 'E-REF-01',
        resource: targetId,
        message: `feat "${offer.actionId}" acts on its holder "${holder.id}" only (DD-S12).`,
      }),
    ];
  }
  const feat = core.runtime.pack.content.feats?.[offer.actionId];
  const ast = core.runtime.index.featEffects[offer.actionId];
  if (feat?.effect === undefined || ast === undefined) return [];
  const emitted = executeBound(
    core,
    holder,
    { id: offer.actionId, def: { cost: {}, effect: feat.effect }, ast },
    holder,
    `content.feats.${offer.actionId}`,
  );
  endIfSideDefeated(core);
  core.surfaceOffers(emitted, { feats: false });
  return emitted;
}

/** The reactive executor's entry: resolve a taken trigger through the same pipeline as a declare (FR-4). */
export function resolveTriggered(
  fight: Combat,
  offer: PendingTrigger,
  targetId: string | undefined,
): readonly RuntimeEvent[] {
  return fight.declareReactive(offer, targetId);
}
