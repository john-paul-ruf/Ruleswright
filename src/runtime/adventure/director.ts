import { Rng } from '../../core/rng';
import { RuntimeRuleError } from '../errors';
import { Runtime } from '../runtime';
import { spatialFromPack } from '../combat/spatial';
import { assertDeterministicValidity } from '../combat/preview';
import { encounterCandidates, type EncounterCommand } from '../play/session';
import { adventureContexts } from './adventure';
import { refuse } from './choices';
import { mechanicalHash } from './snapshot';
import type { Adventure, AdventureCommand, SoloResult } from './types';

const lexical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function advanceSolo(adventure: Adventure, options: { maxSteps: number }): SoloResult {
  if (!Number.isSafeInteger(options?.maxSteps) || options.maxSteps <= 0)
    refuse('maxSteps', 'Expected a positive safe integer.');
  const context = adventureContexts.get(adventure);
  if (!context) refuse('adventure', 'Expected a created or restored adventure.');
  const { pack, definition } = context;
  // Reject the unsupported solo domain before even an initial automated turn-start.
  assertDeterministicValidity(new Runtime(pack), Object.keys(pack.actions));
  const policy = definition.director,
    geometry = spatialFromPack(pack);
  const events: SoloResult['events'][number][] = [];
  let stepsUsed = 0;
  const done = (reason: SoloResult['reason']): SoloResult => ({
    reason,
    stepsUsed,
    events,
    view: adventure.view(),
  });
  for (;;) {
    const saved = adventure.serialize();
    if (saved.phase === 'completed' || saved.phase === 'defeated' || saved.phase === 'abandoned')
      return done(saved.phase);
    if (saved.phase !== 'encounter') return done('awaiting-choice');
    const nested = saved.activeEncounter!,
      view = adventure.view().combat!;
    const active = view.state.combatants[view.state.active]!;
    if (view.pendingOffers.some((offer) => view.state.combatants[offer.actorId]!.side === 'allies'))
      return done('awaiting-player');
    if (!view.pendingOffers.length && active.side === 'allies' && active.hp.current > 0)
      return done('awaiting-player');
    if (
      saved.director.stalledSteps >= policy.stallLimit &&
      saved.director.lastMechanicalHash === mechanicalHash(saved)
    )
      return done('stalled');
    if (stepsUsed >= options.maxSteps) return done('budget-exhausted');
    const candidates = encounterCandidates(pack, nested, policy.maxCandidates);
    if (candidates.exhausted) return done('budget-exhausted');
    const rng = new Rng(saved.rng.director);
    const pick = (commands: EncounterCommand[], score: (command: EncounterCommand) => number | string) => {
      const sorted = commands.sort((a, b) => {
        const sa = score(a),
          sb = score(b);
        return (
          (typeof sa === 'number' && typeof sb === 'number' ? sa - sb : lexical(String(sa), String(sb))) ||
          lexical(JSON.stringify(a), JSON.stringify(b))
        );
      });
      const ties = sorted.filter((c) => score(c) === score(sorted[0]!));
      return ties[policy.tieBreak === 'seeded' && ties.length > 1 ? rng.int(ties.length) : 0]!;
    };
    const targetScore = (command: EncounterCommand): number | string => {
      const targetId =
        command.type === 'declare'
          ? command.options?.targetId
          : command.type === 'respond'
            ? command.targetId
            : undefined;
      const target = targetId === undefined ? undefined : view.state.combatants[targetId];
      const actorId =
        'actor' in command
          ? command.actor.kind === 'enemy'
            ? command.actor.enemyId
            : `m:${command.actor.memberId}`
          : active.id;
      const actor = view.state.combatants[actorId]!;
      if (policy.targetOrder === 'lowest-hp') return target?.hp.current ?? 0;
      if (policy.targetOrder === 'nearest')
        return actor.position && target?.position ? geometry.distance(actor.position, target.position) : 0;
      return targetId ?? actorId;
    };
    let command: EncounterCommand | undefined;
    if (view.pendingOffers.length) {
      const rank = (id: string) => {
        const index = policy.reactionPriority.indexOf(id);
        return index < 0 ? policy.reactionPriority.length : index;
      };
      const offer = [...view.pendingOffers].sort(
        (a, b) =>
          rank(a.actionId) - rank(b.actionId) ||
          lexical(a.actionId, b.actionId) ||
          lexical(a.actorId, b.actorId),
      )[0]!;
      const responses = candidates.offers.filter(
        (c) => c.type === 'respond' && c.triggerId === offer.triggerId,
      );
      const takes = responses.filter((c) => c.type === 'respond' && c.choice === 'take');
      command = takes.length ? pick(takes, targetScore) : responses[0];
    } else if (!nested.encounter.control.turnStarted || active.hp.current <= 0) {
      command = candidates.commands.find((c) => c.type === 'advance');
    } else {
      for (const priority of policy.priorities) {
        if (priority.kind === 'pass') {
          command = candidates.commands.find((c) => c.type === 'pass');
          break;
        }
        let legal = candidates.commands.filter(
          (c) => c.type === 'declare' && c.actionId === priority.actionId,
        );
        if (priority.kind === 'move') {
          const opponents = Object.values(view.state.combatants).filter(
            (c) => c.side !== active.side && c.hp.current > 0 && c.position,
          );
          const distance = (position: typeof active.position) =>
            position && opponents.length
              ? Math.min(...opponents.map((c) => geometry.distance(position, c.position!)))
              : Infinity;
          const score = (c: EncounterCommand) => distance(c.type === 'declare' ? c.options?.to : undefined);
          legal = legal.filter((c) => score(c) < distance(active.position));
          if (legal.length) command = pick(legal, score);
        } else {
          legal = legal.filter(
            (c) =>
              c.type === 'declare' &&
              (!c.options?.targetId || view.state.combatants[c.options.targetId]!.hp.current > 0),
          );
          if (legal.length) command = pick(legal, targetScore);
        }
        if (command) break;
      }
    }
    if (!command || command.type === 'next') refuse('director', 'No command is available at this boundary.');
    const outer: AdventureCommand = {
      type: 'encounter',
      adventureId: saved.adventureId,
      expectedRevision: saved.revision,
      encounterId: nested.encounter.encounterId,
      command,
    };
    stepsUsed++;
    const result = context.decide(outer, rng.getState());
    if (!result.ok) throw new RuntimeRuleError(result.errors);
    events.push(...result.events);
  }
}
