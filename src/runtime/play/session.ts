import type { Pack } from '../../schema/pack';
import type { ErrorCard } from '../../schema/error-card';
import type {
  EncounterSessionOptions,
  EncounterSetup,
  PlayEventSubject,
  PlayJournalEntry,
  PlayMember,
  PlaySessionSnapshot,
  PlaySettlementReceipt,
} from '../../schema/play-session';
import {
  validateEncounterSessionOptions,
  validateEncounterSetup,
  validatePlaySessionSnapshot,
} from '../../schema/play-session';
import { Runtime } from '../runtime';
import { RuntimeRuleError, ruleCard } from '../errors';
import type { RuntimeEvent } from '../events';
import type { CombatState, DeclareOptions, PendingTrigger } from '../combat/types';
import { packIdentity, isRecord } from '../snapshots/envelope';
import { settleEncounter } from './settlement';
import { beginEncounter } from './encounter';
import { detached, freezeFight, hydrateFight, projectMembers, readSnapshot } from './snapshot';

import { FightCore } from '../combat/fight';
import { Rng } from '../../core/rng';
import { resolveSlotGrants } from '../combat/action-economy';
import { isSelfAction } from '../combat/declare';
import { moveBudgetAst, movementDestinations } from '../combat/movement';
import {
  assertDeterministicValidity,
  previewDeclaration,
  previewReaction,
  previewFeat,
  previewReactionCost,
  previewUse,
} from '../combat/preview';

export type EncounterActor =
  | { readonly kind: 'member'; readonly memberId: string }
  | { readonly kind: 'enemy'; readonly enemyId: string };
type CommandBody =
  | { readonly type: 'advance' | 'finalize' | 'abandon' }
  | {
      readonly type: 'declare';
      readonly actor: EncounterActor;
      readonly actionId: string;
      readonly options?: DeclareOptions;
    }
  | {
      readonly type: 'use';
      readonly actor: EncounterActor;
      readonly itemId: string;
      readonly targetId?: string;
    }
  | {
      readonly type: 'respond';
      readonly actor: EncounterActor;
      readonly triggerId: string;
      readonly choice: 'take' | 'decline';
      readonly targetId?: string;
    }
  | { readonly type: 'pass'; readonly actor: EncounterActor }
  | { readonly type: 'next'; readonly setup: EncounterSetup };
export type EncounterCommand = CommandBody & {
  readonly sessionId: string;
  readonly expectedRevision: number;
};
export interface EncounterSessionView {
  readonly sessionId: string;
  readonly revision: number;
  readonly phase: PlaySessionSnapshot['phase'];
  readonly members: readonly (PlayMember & { readonly combatantId: string })[];
  readonly combat: { readonly state: CombatState; readonly pendingOffers: readonly PendingTrigger[] };
  readonly availableCommands: readonly EncounterCommand['type'][];
  readonly result: PlaySessionSnapshot['result'];
  readonly settlement: PlaySettlementReceipt | null;
}
export type EncounterCommandResult =
  | {
      readonly ok: true;
      readonly revision: number;
      readonly events: readonly PlayJournalEntry[];
      readonly view: EncounterSessionView;
      readonly receipt?: PlaySettlementReceipt;
    }
  | {
      readonly ok: false;
      readonly revision: number;
      readonly errors: readonly ErrorCard[];
      readonly events: readonly [];
      readonly view: EncounterSessionView;
    };
export interface EncounterSession {
  view(): EncounterSessionView;
  dispatch(command: EncounterCommand): EncounterCommandResult;
  serialize(): PlaySessionSnapshot;
}

function refuse(path: string, message: string): never {
  throw new RuntimeRuleError([ruleCard('E-REF-01', '(play-session)', path, message)]);
}
function exact(value: unknown, required: readonly string[], optional: readonly string[] = []) {
  return (
    isRecord(value) &&
    required.every((key) => Object.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
  );
}
function commandShape(value: unknown): value is EncounterCommand {
  if (!isRecord(value) || typeof value['type'] !== 'string') return false;
  const common = ['type', 'sessionId', 'expectedRevision'];
  const text = (key: string) => typeof value[key] === 'string' && value[key].length > 0;
  const target = () => !('targetId' in value) || text('targetId');
  const actor = value['actor'];
  const validActor =
    isRecord(actor) &&
    (actor['kind'] === 'member'
      ? exact(actor, ['kind', 'memberId']) &&
        typeof actor['memberId'] === 'string' &&
        actor['memberId'].length > 0
      : actor['kind'] === 'enemy' &&
        exact(actor, ['kind', 'enemyId']) &&
        typeof actor['enemyId'] === 'string' &&
        actor['enemyId'].length > 0);
  if (
    !text('sessionId') ||
    !Number.isSafeInteger(value['expectedRevision']) ||
    (value['expectedRevision'] as number) < 0
  )
    return false;
  switch (value['type']) {
    case 'advance':
    case 'finalize':
    case 'abandon':
      return exact(value, common);
    case 'next':
      return exact(value, [...common, 'setup']);
    case 'pass':
      return validActor && exact(value, [...common, 'actor']);
    case 'use':
      return (
        validActor && text('itemId') && target() && exact(value, [...common, 'actor', 'itemId'], ['targetId'])
      );
    case 'respond':
      return (
        validActor &&
        text('triggerId') &&
        target() &&
        (value['choice'] === 'take' || value['choice'] === 'decline') &&
        exact(value, [...common, 'actor', 'triggerId', 'choice'], ['targetId'])
      );
    case 'declare': {
      if (!validActor || !text('actionId') || !exact(value, [...common, 'actor', 'actionId'], ['options']))
        return false;
      if (!('options' in value)) return true;
      const options = value['options'];
      return (
        exact(options, [], ['targetId', 'at', 'to']) &&
        Object.entries(options as Record<string, unknown>).every(([key, entry]) =>
          key === 'targetId'
            ? typeof entry === 'string' && entry.length > 0
            : exact(entry, ['x', 'y']) &&
              Number.isSafeInteger((entry as Record<string, unknown>)['x']) &&
              Number.isSafeInteger((entry as Record<string, unknown>)['y']),
        )
      );
    }
    default:
      return false;
  }
}

function appendJournal(
  pack: Pack,
  saved: PlaySessionSnapshot,
  events: readonly RuntimeEvent[],
): PlaySessionSnapshot {
  const names = new Map<string, PlayEventSubject>();
  const remap = new Map<string, string>();
  for (const member of saved.encounter.entryMembers)
    names.set(`m:${member.memberId}`, {
      id: `m:${member.memberId}`,
      name: member.character.state.name,
      memberId: member.memberId,
    });
  for (const binding of saved.encounter.memberBindings) remap.set(binding.characterId, binding.combatantId);
  for (const enemy of saved.encounter.enemyInstances)
    names.set(enemy.enemyId, { id: enemy.enemyId, name: pack.bestiary[enemy.monsterId]!.name });
  const journal = [...saved.journal];
  for (const original of events) {
    const event = detached({
      ...original,
      ...(original.actor ? { actor: remap.get(original.actor) ?? original.actor } : {}),
      ...(original.target ? { target: remap.get(original.target) ?? original.target } : {}),
    }) as PlayJournalEntry['event'];
    const references = new Set<string>();
    const visit = (value: unknown): void => {
      if (typeof value === 'string' && names.has(value)) references.add(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (isRecord(value)) Object.values(value).forEach(visit);
    };
    visit(event);
    const sequence = journal.length + 1;
    if (!Number.isSafeInteger(sequence)) refuse('sequence', 'Journal sequence exhausted.');
    journal.push({
      sequence,
      revision: saved.revision,
      event,
      subjects: [...references].map((id) => names.get(id)!),
    });
  }
  return { ...saved, sequence: journal.length, journal };
}

function outcome(state: CombatState): 'victory' | 'defeat' | null {
  const combatants = Object.values(state.combatants);
  if (combatants.filter((c) => c.side === 'allies').every((c) => c.hp.current <= 0)) return 'defeat';
  if (combatants.filter((c) => c.side === 'enemies').every((c) => c.hp.current <= 0)) return 'victory';
  return null;
}

function facade(pack: Pack, initial: PlaySessionSnapshot): EncounterSession {
  let saved = initial;
  const view = (): EncounterSessionView => {
    const { fight } = hydrateFight(pack, saved);
    const availableCommands: EncounterCommand['type'][] = [];
    if (saved.phase === 'active') {
      availableCommands.push('abandon');
      if (fight.pendingTriggers.length) availableCommands.push('respond');
      else if (!saved.encounter.control.turnStarted || fight.state.phase === 'resolved')
        availableCommands.push('advance');
      if (saved.encounter.control.turnStarted && !fight.pendingTriggers.length)
        availableCommands.push('declare', 'use', 'pass');
    }
    if (saved.phase === 'settled' && saved.result === 'victory') availableCommands.push('next');
    if (saved.phase === 'terminal' || saved.phase === 'settled') availableCommands.push('finalize');
    return detached({
      sessionId: saved.sessionId,
      revision: saved.revision,
      phase: saved.phase,
      members: projectMembers(saved).map((member) => ({ ...member, combatantId: `m:${member.memberId}` })),
      combat: { state: fight.serialize(), pendingOffers: fight.pendingTriggers },
      availableCommands,
      result: saved.result,
      settlement: saved.settlements.find((r) => r.encounterId === saved.encounter.encounterId) ?? null,
    });
  };
  return {
    view,
    serialize: () => detached(saved),
    dispatch(input) {
      try {
        if (!commandShape(input)) refuse('command', 'Malformed command or unexpected field.');
        if (input.type === 'next') {
          const errors = validateEncounterSetup(pack, input.setup);
          if (errors.length) throw new RuntimeRuleError(errors);
        }
        const command = detached(input);
        if (command.sessionId !== saved.sessionId) refuse('sessionId', 'Foreign session.');
        if (command.expectedRevision !== saved.revision) refuse('expectedRevision', 'Stale revision.');
        if (command.type === 'finalize' && saved.phase === 'settled') {
          return {
            ok: true,
            revision: saved.revision,
            events: [],
            view: view(),
            receipt: detached(
              saved.settlements.find((receipt) => receipt.encounterId === saved.encounter.encounterId)!,
            ),
          };
        }
        if (!Number.isSafeInteger(saved.revision + 1)) refuse('revision', 'Revision exhausted.');
        if (command.type === 'finalize' || command.type === 'abandon') {
          if (command.type === 'finalize' ? saved.phase !== 'terminal' : saved.phase !== 'active')
            refuse('phase', 'Settlement is not available at this boundary.');
          const result = command.type === 'abandon' ? 'abandoned' : saved.result;
          if (result === null) refuse('result', 'Terminal result is missing.');
          const staged = settleEncounter(pack, saved, result, saved.revision + 1);
          const next = appendJournal(
            pack,
            {
              ...saved,
              revision: saved.revision + 1,
              phase: 'settled',
              result,
              members: staged.members,
              settlements: [...saved.settlements, staged.receipt],
            },
            staged.events,
          );
          const errors = validatePlaySessionSnapshot(pack, next);
          if (errors.length) throw new RuntimeRuleError(errors);
          const suffix = next.journal.slice(saved.sequence);
          saved = next;
          return {
            ok: true,
            revision: saved.revision,
            events: detached(suffix),
            view: view(),
            receipt: detached(staged.receipt),
          };
        }
        if (command.type === 'next') {
          if (saved.phase !== 'settled' || saved.result !== 'victory')
            refuse('phase', 'Only a settled victory can start another encounter.');
          if (!Number.isSafeInteger(saved.encounterIndex + 1))
            refuse('encounterIndex', 'Encounter index exhausted.');
          const errors = validateEncounterSessionOptions(pack, {
            sessionId: saved.sessionId,
            seed: saved.seed,
            members: saved.members,
            setup: command.setup,
          });
          if (errors.length) throw new RuntimeRuleError(errors);
          const runtime = new Runtime(detached(pack)),
            events: RuntimeEvent[] = [];
          runtime.events.on((event) => events.push(event));
          const created = beginEncounter(
            runtime,
            saved.sessionId,
            saved.seed,
            saved.encounterIndex + 1,
            saved.members,
            command.setup,
            saved.rng.play,
          );
          const next = appendJournal(
            pack,
            {
              ...saved,
              revision: saved.revision + 1,
              encounterIndex: saved.encounterIndex + 1,
              encounter: created.encounter,
              rng: created.rng,
              phase: 'active',
              result: null,
            },
            events,
          );
          const snapshotErrors = validatePlaySessionSnapshot(pack, next);
          if (snapshotErrors.length) throw new RuntimeRuleError(snapshotErrors);
          const suffix = next.journal.slice(saved.sequence);
          saved = next;
          return { ok: true, revision: saved.revision, events: detached(suffix), view: view() };
        }
        if (saved.phase !== 'active') refuse('phase', 'Encounter is not active.');
        const { runtime, fight } = hydrateFight(pack, saved);
        let started = saved.encounter.control.turnStarted;
        if ('actor' in command) {
          const id = command.actor.kind === 'member' ? `m:${command.actor.memberId}` : command.actor.enemyId;
          const member = command.actor.kind === 'member';
          if (!fight.state.combatants[id] || (fight.state.combatants[id]!.side === 'allies') !== member)
            refuse('actor', 'Unknown actor.');
          if (command.type === 'respond') {
            if (
              !fight.pendingTriggers.some(
                (offer) => offer.triggerId === command.triggerId && offer.actorId === id,
              )
            )
              refuse('actor', 'Actor does not own that offer.');
          } else if (id !== fight.state.active || !started || fight.pendingTriggers.length)
            refuse('actor', 'Actor cannot act at this boundary.');
        }
        const events: RuntimeEvent[] = [];
        runtime.events.on((event) => events.push(event));
        switch (command.type) {
          case 'advance': {
            if (fight.pendingTriggers.length || (started && fight.state.phase !== 'resolved'))
              refuse('type', 'Turn already started or offers remain.');
            const step = fight.step();
            started = step.kind === 'turn-started';
            break;
          }
          case 'pass':
            fight.pass();
            started = false;
            break;
          case 'declare':
            fight.declare(command.actionId, command.options);
            break;
          case 'use':
            fight.use(command.itemId, command.targetId === undefined ? {} : { target: command.targetId });
            break;
          case 'respond':
            fight.respond(command.triggerId, command.choice, command.targetId);
            break;
        }
        const rejected = events.find((event) => event.type === 'declare:rejected');
        if (rejected)
          throw new RuntimeRuleError([
            ruleCard(
              rejected.why.rule,
              String(rejected.payload['resource'] ?? ''),
              'command',
              String(rejected.payload['message'] ?? 'Action refused.'),
            ),
          ]);
        const result = outcome(fight.state);
        const next = appendJournal(
          pack,
          {
            ...saved,
            revision: saved.revision + 1,
            phase: result ? 'terminal' : 'active',
            result,
            encounter: { ...saved.encounter, ...freezeFight(fight, saved.encounter.encounterId, started) },
          },
          events,
        );
        const errors = validatePlaySessionSnapshot(pack, next);
        if (errors.length) throw new RuntimeRuleError(errors);
        const suffix = next.journal.slice(saved.sequence);
        saved = next;
        return { ok: true, revision: saved.revision, events: detached(suffix), view: view() };
      } catch (error) {
        if (!(error instanceof RuntimeRuleError)) throw error;
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

export function createEncounterSession(pack: Pack, options: EncounterSessionOptions): EncounterSession {
  const errors = validateEncounterSessionOptions(pack, options);
  if (errors.length) throw new RuntimeRuleError(errors);
  const owned = detached(pack),
    input = detached(options),
    runtime = new Runtime(owned),
    events: RuntimeEvent[] = [];
  runtime.events.on((event) => events.push(event));
  const created = beginEncounter(runtime, input.sessionId, String(input.seed), 0, input.members, input.setup);
  const result = outcome(created.fight.state);
  if (result) created.fight.state = { ...created.fight.state, phase: 'combat-over' };
  const saved: PlaySessionSnapshot = {
    kind: 'play-session',
    snapshotVersion: 1,
    pack: packIdentity(owned),
    sessionId: input.sessionId,
    revision: 0,
    seed: String(input.seed),
    members: input.members,
    encounterIndex: 0,
    encounter: { ...created.encounter, ...freezeFight(created.fight, created.encounter.encounterId, false) },
    phase: result ? 'terminal' : 'active',
    result,
    rng: created.rng,
    sequence: 0,
    journal: [],
    settlements: [],
  };
  return facade(owned, readSnapshot(owned, appendJournal(owned, saved, events)));
}
export function restoreEncounterSession(pack: Pack, snapshot: unknown): EncounterSession {
  const owned = detached(pack);
  return facade(owned, readSnapshot(owned, snapshot));
}

/** Internal host commands, stamped for this exact saved boundary. No command is executed here. */
export function encounterCandidates(pack: Pack, saved: PlaySessionSnapshot, maxCandidates: number) {
  if (!Number.isSafeInteger(maxCandidates) || maxCandidates <= 0)
    refuse('maxCandidates', 'Expected a positive safe integer.');
  const commands: EncounterCommand[] = [];
  const offers: EncounterCommand[] = [];
  let exhausted = false;
  if (saved.phase !== 'active') return { commands, offers, exhausted };
  const { runtime, fight } = hydrateFight(pack, saved);
  assertDeterministicValidity(
    runtime,
    Object.values(fight.state.combatants).flatMap((c) => c.actions),
  );
  const core = new FightCore(
    runtime,
    fight.state,
    new Rng(fight.state.rng),
    resolveSlotGrants(pack),
    fight.offeredCount,
  );
  const base = { sessionId: saved.sessionId, expectedRevision: saved.revision };
  const actorOf = (id: string): EncounterActor =>
    fight.state.combatants[id]!.side === 'allies'
      ? { kind: 'member', memberId: id.slice(2) }
      : { kind: 'enemy', enemyId: id };
  const targets = Object.keys(fight.state.combatants).sort();
  let inspected = 0;
  const inspect = () => {
    if (inspected === maxCandidates) {
      exhausted = true;
      return false;
    }
    inspected++;
    return true;
  };
  for (const offer of fight.pendingTriggers) {
    const actor = actorOf(offer.actorId);
    offers.push({ ...base, type: 'respond', actor, triggerId: offer.triggerId, choice: 'decline' });
    for (const targetId of targets) {
      if (!inspect()) return { commands, offers, exhausted };
      const result =
        offer.source === 'feat' ? previewFeat(core, offer, targetId) : previewReaction(core, offer, targetId);
      if (!('rejection' in result))
        offers.push({
          ...base,
          type: 'respond',
          actor,
          triggerId: offer.triggerId,
          choice: 'take',
          targetId,
        });
    }
  }
  if (offers.length) return { commands, offers, exhausted };
  if (!saved.encounter.control.turnStarted || fight.state.phase === 'resolved')
    commands.push({ ...base, type: 'advance' });
  if (!saved.encounter.control.turnStarted) return { commands, offers, exhausted };
  const actor = fight.state.combatants[fight.state.active]!;
  const identity = actorOf(actor.id);
  commands.push({ ...base, type: 'pass', actor: identity });
  for (const actionId of [...actor.actions].sort()) {
    const def = pack.actions[actionId]!;
    if (def.trigger) continue;
    const move = moveBudgetAst(runtime, actionId) !== undefined;
    if (move && previewReactionCost(core, actor, def)) continue;
    const destinations = move
      ? movementDestinations(core, actor, actionId, maxCandidates - inspected)
      : undefined;
    if (destinations?.exhausted) return { commands, offers, exhausted: true };
    const bindings: DeclareOptions[] =
      move && runtime.spatial.enabled
        ? destinations!.positions.map((to) => ({ to }))
        : move || isSelfAction(runtime, actionId)
          ? [{}]
          : targets.map((targetId) => ({ targetId }));
    for (const options of bindings) {
      if (!inspect()) return { commands, offers, exhausted };
      if (!('rejection' in previewDeclaration(core, actionId, options)))
        commands.push({ ...base, type: 'declare', actor: identity, actionId, options });
    }
  }
  for (const itemId of Object.keys(actor.itemBalances).sort()) {
    for (const targetId of targets) {
      if (!inspect()) return { commands, offers, exhausted };
      if (!('rejection' in previewUse(core, itemId, { target: targetId })))
        commands.push({ ...base, type: 'use', actor: identity, itemId, targetId });
    }
  }
  return { commands, offers, exhausted };
}
