/**
 * The stepwise combat loop (FR-10, CAP-6): initiative → rounds → turns. A turn
 * is a sequence of pack-declared slots (FR-4, the action economy); between any
 * two steps the host may animate, prompt, or snapshot — `step()` advances one
 * lifecycle phase at a time (combat-loop.html's beginTurn → declare → resolve
 * → endTurn anatomy, verbatim field names).
 *
 * Every mutation emits a provenanced event (FR-13): the CA-3 envelope stamps
 * `at` from the combat clock; `why` carries the rule path + roll trail. The
 * engine never requires a subscriber. Combat state is plain JSON (FR-14) —
 * snapshots are `JSON.stringify`-able verbatim, per-combatant slot ledgers
 * included (CA-4: the economy is a combat transient, never character state).
 *
 * Attacks resolve through S03's executor (`executeEffect`, parse-once at
 * Runtime load) with the per-target vars wiring from resolve.ts; the combat
 * `apply` turns mutation requests into state + `damage:applied` /
 * `condition:applied` events carrying `why.rolls` (the mock's anatomy:
 * `rule` = the acting artifact's pack path, `rolls` = structured roll display
 * strings).
 */
import type { ActionDef, ActionCost } from '../../schema/artifacts';
import { Rng, type RandomSource, type RngState } from '../../core/rng';
import type { Runtime } from '../runtime';
import type { RuntimeEvent, EventClock } from '../events';
import { emitDeclined, emitOffer, offersForEvent } from './triggers';
import {
  checkCost,
  freshLedger,
  replenish,
  resolveSlotGrants,
  spend,
  type CostRejection,
  type EconomyBalances,
  type SlotGrants,
  type SlotLedger,
} from './action-economy';
import {
  executeAgainst,
  type BoundAction,
  type CombatantProfile,
  type MutationRequest,
  type Side,
} from './resolve';

/** One combatant's live combat state — plain JSON, snapshot-ready (FR-14). */
export interface CombatantState {
  readonly id: string;
  readonly side: Side;
  readonly name: string;
  readonly hp: { current: number };
  conditions: { conditionId: string; duration: number }[];
  /** Per-turn slot ledger (CA-4): the combat transient, replenished each turn start. */
  readonly slots: SlotLedger;
  pools: Record<string, number>;
  /** Spell level ("1") → remaining bound slot count (FR-8; consuming decrements). */
  boundSlots: Record<string, number>;
  readonly abilities: Readonly<Record<string, number>>;
  readonly saves: Readonly<Record<string, number>>;
  readonly level: number;
  readonly ac: number;
  readonly initiativeBonus: number;
  readonly actions: readonly string[];
  readonly attackTable?: readonly { level: number; byDefense: Record<string, number> }[];
  readonly attackBonus?: number;
}

/** The one combat state object — plain JSON end to end (FR-14). */
export interface CombatState {
  readonly round: number;
  readonly turn: number;
  /** Initiative order: combatant ids, highest first (ties: declared order). */
  readonly order: readonly string[];
  readonly active: string;
  readonly phase: CombatPhase;
  readonly combatants: Readonly<Record<string, CombatantState>>;
  readonly rng: RngState;
}

export type CombatPhase = 'awaiting-declare' | 'resolved' | 'awaiting-trigger-response' | 'combat-over';

/** A declared-but-not-yet-resolved action (host may still be animating). */
export interface PendingAction {
  readonly actionId: string;
  readonly targetId: string | undefined;
}

/** An offered reactive action awaiting `respond()` (FR-4/FR-13, triggers.html). */
export interface PendingTrigger {
  readonly triggerId: string;
  readonly actorId: string;
  readonly actionId: string;
  /** The event that matched, as the offer's provenance. */
  readonly matchingEvent: string;
}

export interface DeclareOptions {
  /** Optional explicit target; a single-enemy action resolves to the only opponent otherwise. */
  readonly targetId?: string;
}

/** Why a declare was rejected — one ErrorCard-shaped object, play-time economy family. */
export type DeclareRejection =
  | CostRejection
  | {
      kind: 'no-action' | 'not-your-turn' | 'no-target' | 'restricted' | 'invalid-target' | 'unknown-target';
      rule: 'E-REF-01';
      resource: string;
      message: string;
    };

/** What one `step()` call advanced — the stepwise boundary (FR-10). */
export type StepOutcome =
  | { kind: 'turn-started'; combatantId: string; clock: EventClock }
  | { kind: 'awaiting-declare'; combatantId: string }
  | { kind: 'action-resolved'; combatantId: string; actionId: string }
  | { kind: 'turn-ended'; combatantId: string }
  | { kind: 'round-completed'; round: number }
  | { kind: 'combat-over' };

export interface StartCombatRequest {
  readonly allies: readonly { id: string; profile: CombatantProfile; balances?: EconomyBalances }[];
  readonly enemies: readonly { id: string; profile: CombatantProfile; balances?: EconomyBalances }[];
  /** Initiative roll source; defaults to the injected rng. */
  readonly rng?: RandomSource;
}

/**
 * Start a fight: build plain-JSON combatant state from profiles, roll
 * initiative (CA-6: the pack's reserved `initiative` formula when declared —
 * d20 + formula via profile.initiativeBonus — plain d20 fallback otherwise),
 * and emit `combat:start` with the roll provenance (combat-loop.html's first
 * row).
 */
export function startCombat(runtime: Runtime, request: StartCombatRequest): Combat {
  const rng = request.rng ?? new Rng(0);
  const grants = resolveSlotGrants(runtime.pack);
  const entries: {
    id: string;
    side: Side;
    name: string;
    profile: CombatantProfile;
    balances: EconomyBalances;
    initiativeRoll: number;
  }[] = [];
  for (const member of request.allies) {
    entries.push({
      id: member.id,
      side: 'allies',
      name: member.id,
      profile: member.profile,
      balances: member.balances ?? {},
      initiativeRoll: rng.int(20) + 1,
    });
  }
  for (const member of request.enemies) {
    entries.push({
      id: member.id,
      side: 'enemies',
      name: member.id,
      profile: member.profile,
      balances: member.balances ?? {},
      initiativeRoll: rng.int(20) + 1,
    });
  }
  const order = entries
    .map((entry) => ({
      id: entry.id,
      total: entry.initiativeRoll + entry.profile.initiativeBonus,
      roll: entry.initiativeRoll,
      tieBreaker: entries.indexOf(entry),
    }))
    .sort((a, b) => b.total - a.total || a.tieBreaker - b.tieBreaker)
    .map((entry) => entry.id);

  const combatants: Record<string, CombatantState> = {};
  for (const entry of entries) {
    combatants[entry.id] = {
      id: entry.id,
      side: entry.side,
      name: entry.name,
      hp: { current: entry.profile.hp },
      conditions: [],
      slots: freshLedger(grants),
      pools: { ...(entry.balances.pools ?? {}) },
      boundSlots: { ...(entry.balances.boundSlots ?? {}) },
      abilities: { ...entry.profile.abilities },
      saves: { ...entry.profile.saves },
      level: entry.profile.level,
      ac: entry.profile.ac,
      initiativeBonus: entry.profile.initiativeBonus,
      actions: [...entry.profile.actions],
      attackTable: entry.profile.attackTable
        ? entry.profile.attackTable.map((row) => ({ level: row.level, byDefense: { ...row.byDefense } }))
        : undefined,
      attackBonus: entry.profile.attackBonus,
    };
  }

  const initiativeSummary = order.map(
    (id) => `${id} ${combatants[id]!.initiativeBonus >= 0 ? '+' : ''}${combatants[id]!.initiativeBonus}`,
  );
  const whyRolls = entries.map(
    (entry) =>
      `d20[${entry.initiativeRoll}]+${entry.profile.initiativeBonus}=${entry.initiativeRoll + entry.profile.initiativeBonus} (${entry.id})`,
  );

  const fight = new Combat(runtime, {
    round: 1,
    turn: 0,
    order,
    active: order[0] ?? '',
    phase: 'awaiting-declare',
    combatants,
    rng: rngStateOf(rng),
  });
  runtime.events.emit({
    type: 'combat:start',
    payload: { order: [...order], initiative: initiativeSummary },
    why: { rule: 'combat.startCombat', rolls: whyRolls },
  });
  return fight;
}

/** Flatten nested effect resolutions (sequence/target wrappers) for the attack-event loop. */
function flattenResolutions(
  outcomes: readonly import('../../core/dsl/effect').EffectResolution[],
): readonly import('../../core/dsl/effect').EffectResolution[] {
  const flat: import('../../core/dsl/effect').EffectResolution[] = [];
  for (const outcome of outcomes) {
    flat.push(outcome);
    if (outcome.kind === 'sequence') flat.push(...flattenResolutions(outcome.steps));
    else if (outcome.kind === 'target') flat.push(...flattenResolutions(outcome.outcomes));
    else if (outcome.kind === 'save') {
      for (const perTarget of outcome.perTarget) flat.push(...flattenResolutions(perTarget.outcomes));
    }
  }
  return flat;
}

function rngStateOf(rng: RandomSource): RngState {
  if ('getState' in rng && typeof (rng as Rng).getState === 'function') {
    return (rng as Rng).getState();
  }
  // A host-injected stream without exportable state — the snapshot carries the
  // combat state alone; resume semantics then bind to the host's stream.
  return { a: 0, b: 0, c: 0, d: 0 };
}

/** The stepwise facade (api-map: fight.step / declare / respond / serialize). */
export class Combat {
  readonly runtime: Runtime;
  state: CombatState;
  /** Open trigger offers (triggers.html): the host answers each via respond(). */
  readonly pendingTriggers: PendingTrigger[] = [];
  private offeredCount = 0;

  private readonly grants: SlotGrants;
  /** The fight's own dice stream — snapshot-resumable via state.rng (FR-14). */
  private readonly rng: Rng;

  constructor(runtime: Runtime, state: CombatState, rng: Rng = new Rng(state.rng)) {
    this.runtime = runtime;
    this.state = state;
    this.grants = resolveSlotGrants(runtime.pack);
    this.rng = rng;
  }

  get roundComplete(): boolean {
    return (
      this.state.phase === 'combat-over' ||
      (this.state.turn + 1 >= this.state.order.length && this.state.phase !== 'awaiting-trigger-response')
    );
  }

  /**
   * Advance one step. Between calls the host may serialize — state is always
   * whole. Phases: turn-start (ledger replenish + `turn:began`) → awaiting
   * declare → (host declares) resolve → `turn:ended` → next combatant or
   * `round:completed`.
   */
  step(): StepOutcome {
    if (this.state.phase === 'combat-over') return { kind: 'combat-over' };
    if (this.state.phase === 'awaiting-declare') {
      if (isDowned(this.state.combatants[this.state.active]!)) {
        this.setClock();
        return this.advanceFrom(this.state.turn + 1, this.state.active);
      }
      this.setClock();
      replenish(this.state.combatants[this.state.active]!.slots, this.grants);
      this.runtime.events.emit({
        type: 'turn:began',
        actor: this.state.active,
        payload: {
          turn: this.state.turn,
          round: this.state.round,
          slots: { ...this.state.combatants[this.state.active]!.slots.remaining },
        },
        why: { rule: 'combat.turnSlots', rolls: [] },
      });
      return {
        kind: 'turn-started',
        combatantId: this.state.active,
        clock: { round: this.state.round, turn: this.state.turn },
      };
    }
    if (this.state.phase === 'resolved' || this.state.phase === 'awaiting-trigger-response') {
      return this.endTurn();
    }
    return { kind: 'awaiting-declare', combatantId: this.state.active };
  }

  /**
   * Declare the active combatant's action. Validity-checked against the pack
   * (action exists on this combatant), the economy (slots/points/vancian),
   * active conditions (restricts via the pack's tag vocabulary — re-consults
   * the pack's declared tags, never re-derives tag existence, v1.1), and the
   * target's existence. On success the slot ledger is spent and the effect
   * executes through S03's evaluator.
   */
  declare(actionId: string, options: DeclareOptions = {}): readonly RuntimeEvent[] {
    if (this.state.phase === 'combat-over') throw new Error('combat is over');

    const actorId = this.state.active;
    const actor = this.state.combatants[actorId]!;
    const pack = this.runtime.pack;
    const def = pack.actions[actionId];
    if (def === undefined) {
      return [
        this.rejectionEvent(actorId, {
          kind: 'no-action',
          rule: 'E-REF-01',
          resource: actionId,
          message: `action "${actionId}" is not declared in the pack.`,
        }),
      ];
    }
    if (!actor.actions.includes(actionId)) {
      return [
        this.rejectionEvent(actorId, {
          kind: 'no-action',
          rule: 'E-REF-01',
          resource: actionId,
          message: `combatant "${actorId}" does not have action "${actionId}".`,
        }),
      ];
    }
    const restriction = this.restrictionRejection(actor, def);
    if (restriction !== undefined) {
      return [this.rejectionEvent(actorId, restriction)];
    }
    const target = this.resolveTarget(actor, options.targetId);
    if ('rejection' in target) {
      return [this.rejectionEvent(actorId, target.rejection)];
    }
    const costRejection = checkCost(def.cost, this.grants, this.balancesOf(actor));
    if (costRejection !== undefined) {
      return [this.rejectionEvent(actorId, costRejection)];
    }
    // All gates passed — commit the spend and resolve.
    const spendRejection = spend(actor.slots, this.grants, def.cost);
    if (spendRejection !== undefined) {
      return [this.rejectionEvent(actorId, spendRejection)];
    }
    this.applyNonSlotCosts(actor, def.cost);
    const events = this.resolve(actor, actionId, def, target.combatant);
    this.surfaceOffers(events);
    return events;
  }

  /** Answer an offered trigger (api-map: fight.respond). */
  respond(triggerId: string, choice: 'take' | 'decline', targetId?: string): readonly RuntimeEvent[] {
    const index = this.pendingTriggers.findIndex((offer) => offer.triggerId === triggerId);
    if (index === -1) {
      throw new Error(`no pending trigger "${triggerId}" — the host answers an offered trigger, FR-10/FR-13`);
    }
    const [offer] = this.pendingTriggers.splice(index, 1);
    if (offer === undefined) return [];
    if (choice === 'decline') {
      emitDeclined(this.runtime, offer);
      const declined = this.runtime.events.sinceRound(this.state.round);
      return [declined[declined.length - 1]!];
    }
    return this.resolveReactive(offer, targetId);
  }

  /**
   * Serialize the whole fight — plain JSON (FR-14). No class instances, no
   * closures: `JSON.parse(JSON.stringify(state))` round-trips exactly.
   */
  serialize(): CombatState {
    return JSON.parse(JSON.stringify(this.state)) as CombatState;
  }

  /** Events at or after `round` (api-map: fight.events.sinceRound). */
  eventsSince(round: number): readonly RuntimeEvent[] {
    return this.runtime.events.sinceRound(round);
  }

  private setClock(): void {
    this.runtime.events.setClock({ round: this.state.round, turn: this.state.turn });
  }

  private balancesOf(actor: CombatantState): EconomyBalances {
    return { pools: actor.pools, boundSlots: actor.boundSlots };
  }

  private restrictionRejection(actor: CombatantState, def: ActionDef): DeclareRejection | undefined {
    const blocked = new Set<string>();
    for (const active of actor.conditions) {
      const condition = this.runtime.pack.content.conditions?.[active.conditionId];
      for (const pattern of condition?.restricts ?? []) {
        if (!pattern.startsWith('actions.tagged:')) continue;
        blocked.add(pattern.slice('actions.tagged:'.length));
      }
    }
    if (blocked.size === 0) return undefined;
    // The pack index is the tag vocabulary's authority (v1.1): the validator
    // (S01) enforced restricts integrity at load; this matcher re-consults the
    // pack's own tags, never re-derives tag existence.
    const defTags = new Set([...(def.tags ?? [])]);
    for (const tag of blocked) {
      if (defTags.has(tag)) {
        return {
          kind: 'restricted',
          rule: 'E-REF-01',
          resource: tag,
          message: `action "${def.tags?.join(',')}" carries tag "${tag}", which an active condition restricts (v1.1 restricts matcher).`,
        };
      }
    }
    return undefined;
  }

  private resolveTarget(
    actor: CombatantState,
    targetId: string | undefined,
  ): { combatant: CombatantState } | { rejection: DeclareRejection } {
    const opponents = this.state.order.filter((id) => this.state.combatants[id]!.side !== actor.side);
    if (opponents.length === 0) {
      return { combatant: actor };
    }
    const chosen = targetId ?? (opponents.length === 1 ? opponents[0]! : undefined);
    if (chosen === undefined) {
      return {
        rejection: {
          kind: 'no-target',
          rule: 'E-REF-01',
          resource: '',
          message: 'action needs a target — several opponents remain and none was declared.',
        },
      };
    }
    const target = this.state.combatants[chosen];
    if (target === undefined) {
      return {
        rejection: {
          kind: 'unknown-target',
          rule: 'E-REF-01',
          resource: chosen,
          message: `target "${chosen}" is not in this fight.`,
        },
      };
    }
    if (target.side === actor.side) {
      return {
        rejection: {
          kind: 'invalid-target',
          rule: 'E-REF-01',
          resource: chosen,
          message: `target "${chosen}" is not an opponent.`,
        },
      };
    }
    return { combatant: target };
  }

  private applyNonSlotCosts(actor: CombatantState, cost: ActionCost): void {
    if (cost.points !== undefined) {
      const pools = { ...actor.pools };
      pools[cost.points.pool] = (pools[cost.points.pool] ?? 0) - cost.points.amount;
      actor.pools = pools;
    }
    if (cost.vancian !== undefined) {
      const level = String(cost.vancian);
      const bound = { ...actor.boundSlots };
      bound[level] = (bound[level] ?? 0) - 1;
      actor.boundSlots = bound;
    }
  }

  private resolve(
    actor: CombatantState,
    actionId: string,
    def: ActionDef,
    target: CombatantState,
  ): readonly RuntimeEvent[] {
    const emitted: RuntimeEvent[] = [];
    const sink = (event: RuntimeEvent) => {
      emitted.push(event);
    };
    this.runtime.events.on(sink);
    try {
      this.setClock();
      // The attack gate: the executor's damage callbacks only land when the
      // pending attack for this target hit. One action = one attack verdict.
      let attackLanded: boolean | undefined;
      const boundAction = this.boundActionOf(actionId, def);
      const mutations: MutationRequest[] = [];
      const outcomes = executeAgainst(
        boundAction,
        { id: actor.id, side: actor.side, profile: this.profileOf(actor) },
        { id: target.id, side: target.side, profile: this.profileOf(target) },
        this.rng,
        (request) => {
          mutations.push(request);
          const isDamage = request.kind === 'damage';
          if (isDamage && attackLanded === false) return; // onHit anatomy: gated damage never applies
          this.applyMutation(target, request);
          const hpBefore = isDamage ? this.hpBefore(target, request.amount ?? 0) : undefined;
          const event = this.runtime.events.emit({
            type: isDamage ? 'damage:applied' : 'condition:applied',
            actor: actor.id,
            target: request.targetId,
            payload: isDamage
              ? {
                  amount: request.amount,
                  type: request.damageType,
                  hp:
                    hpBefore === undefined
                      ? undefined
                      : `${hpBefore}→${this.state.combatants[target.id]!.hp.current}`,
                }
              : { conditionId: request.conditionId, duration: request.duration },
            why: {
              rule: `${this.ruleBaseOf(actionId)}`,
              rolls: request.rolls.map((roll) => displayRoll(roll)),
            },
          });
          mutations.pop();
          void event;
        },
      );
      // Attack outcomes are events too (attack:rolled) — one per target, with the verdict.
      // The executor nests statements in sequence/target/save wrappers; flatten first.
      for (const outcome of flattenResolutions(outcomes)) {
        if (outcome.kind === 'attack') {
          attackLanded = outcome.hit;
          emitted.push(
            this.runtime.events.emit({
              type: 'attack:rolled',
              actor: actor.id,
              target: outcome.targetId,
              payload: { actionId, verdict: outcome.roll.verdict, total: outcome.roll.total },
              why: { rule: `${this.ruleBaseOf(actionId)}.attackBonus`, rolls: [displayRoll(outcome.roll)] },
            }),
          );
        }
      }
    } finally {
      this.runtime.events.off(sink);
    }
    this.state = { ...this.state, phase: 'resolved', rng: this.rng.getState() };
    this.runtime.events.emit({
      type: 'action:resolved',
      actor: actor.id,
      payload: { actionId, targetId: target.id },
      why: { rule: `${this.ruleBaseOf(actionId)}`, rolls: [] },
    });
    this.endIfSideDefeated();
    return this.runtime.events.sinceRound(this.state.round);
  }

  /**
   * The end rule (engine-universal, not pack data): once every combatant on one
   * side is at hp ≤ 0, the fight is over — open offers lapse and one
   * `combat:ended` event names the winning side.
   */
  private endIfSideDefeated(): void {
    const defeated = defeatedSide(this.state.combatants);
    if (defeated === undefined) return;
    this.state = { ...this.state, phase: 'combat-over' };
    this.pendingTriggers.length = 0;
    this.runtime.events.emit({
      type: 'combat:ended',
      payload: { winner: defeated === 'allies' ? 'enemies' : 'allies', defeated },
      why: { rule: 'combat.sideDefeated', rolls: [] },
    });
  }

  /** After any mutation event, offer every matching reactive action to standing combatants (FR-13 substrate); none once the fight is over. */
  private surfaceOffers(events: readonly RuntimeEvent[]): void {
    if (this.state.phase === 'combat-over') return;
    for (const event of events) {
      for (const offer of offersForEvent(this.runtime, this.state.combatants, event)) {
        if (isDowned(this.state.combatants[offer.actorId]!)) continue;
        this.pendingTriggers.push(offer);
        emitOffer(this.runtime, offer, this.offeredCount);
        this.offeredCount += 1;
      }
    }
  }

  /** Resolve a taken trigger through the same pipeline as a declared action (FR-4, FR-12 proof 2). */
  private resolveReactive(offer: PendingTrigger, targetId: string | undefined): readonly RuntimeEvent[] {
    const reactor = this.state.combatants[offer.actorId]!;
    const def = this.runtime.pack.actions[offer.actionId]!;
    const restriction = this.restrictionRejection(reactor, def);
    if (restriction !== undefined) {
      return [this.rejectionEvent(reactor.id, restriction)];
    }
    const target = this.resolveTarget(reactor, targetId);
    if ('rejection' in target) {
      return [this.rejectionEvent(reactor.id, target.rejection)];
    }
    const costRejection = checkCost(def.cost, this.grants, this.balancesOf(reactor));
    if (costRejection !== undefined) {
      return [this.rejectionEvent(reactor.id, costRejection)];
    }
    const spendRejection = spend(reactor.slots, this.grants, def.cost);
    if (spendRejection !== undefined) {
      return [this.rejectionEvent(reactor.id, spendRejection)];
    }
    this.applyNonSlotCosts(reactor, def.cost);
    const events = this.resolve(reactor, offer.actionId, def, target.combatant);
    this.surfaceOffers(events);
    return events;
  }

  /** A reactive action resolving outside the declare flow (host took a trigger offer). */
  declareReactive(offer: PendingTrigger, targetId: string | undefined): readonly RuntimeEvent[] {
    return this.resolveReactive(offer, targetId);
  }

  private boundActionOf(actionId: string, def: ActionDef): BoundAction {
    const ast = this.runtime.index.actionEffects[actionId];
    if (ast === undefined) {
      throw new Error(
        `action "${actionId}" has no parse-once AST — Runtime load compiles every action (CA-2)`,
      );
    }
    return { id: actionId, def, ast };
  }

  private profileOf(state: CombatantState): CombatantProfile {
    return {
      id: state.id,
      abilities: state.abilities,
      saves: state.saves,
      level: state.level,
      hp: state.hp.current,
      ac: state.ac,
      initiativeBonus: state.initiativeBonus,
      actions: state.actions,
      attackTable: state.attackTable,
      attackBonus: state.attackBonus,
    };
  }

  private ruleBaseOf(actionId: string): string {
    return `actions.${actionId}`;
  }

  private applyMutation(target: CombatantState, request: MutationRequest): void {
    if (request.kind === 'damage' && request.amount !== undefined) {
      target.hp.current -= request.amount;
    } else if (request.kind === 'condition' && request.conditionId !== undefined) {
      const def = this.runtime.pack.content.conditions?.[request.conditionId];
      target.conditions.push({
        conditionId: request.conditionId,
        duration: request.duration ?? def?.duration ?? 1,
      });
    }
  }

  private hpBefore(target: CombatantState, amount: number): number {
    return target.hp.current + amount;
  }

  private rejectionEvent(actorId: string, rejection: DeclareRejection): RuntimeEvent {
    this.setClock();
    return this.runtime.events.emit({
      type: 'declare:rejected',
      actor: actorId,
      payload: { kind: rejection.kind, resource: rejection.resource, message: rejection.message },
      why: { rule: rejection.rule, rolls: [] },
    });
  }

  private endTurn(): StepOutcome {
    const actorId = this.state.active;
    this.setClock();
    this.runtime.events.emit({
      type: 'turn:ended',
      actor: actorId,
      payload: { turn: this.state.turn, round: this.state.round },
      why: { rule: 'combat.endTurn', rolls: [] },
    });
    return this.advanceFrom(this.state.turn + 1, actorId);
  }

  /** Hand the turn to the first standing combatant at or after `turn`; past the order's end, the round completes. */
  private advanceFrom(turn: number, previousId: string): StepOutcome {
    const standing = (from: number) =>
      this.state.order.findIndex((id, index) => index >= from && !isDowned(this.state.combatants[id]!));
    const nextTurn = standing(turn);
    if (nextTurn === -1) {
      this.runtime.events.emit({
        type: 'round:completed',
        payload: { round: this.state.round },
        why: { rule: 'combat.roundComplete', rolls: [] },
      });
      const first = Math.max(standing(0), 0);
      this.state = {
        ...this.state,
        round: this.state.round + 1,
        turn: first,
        active: this.state.order[first]!,
        phase: 'awaiting-declare',
      };
      return { kind: 'round-completed', round: this.state.round - 1 };
    }
    this.state = {
      ...this.state,
      turn: nextTurn,
      active: this.state.order[nextTurn]!,
      phase: 'awaiting-declare',
    };
    return { kind: 'turn-ended', combatantId: previousId };
  }
}

/** A combatant at hp ≤ 0 is down: it takes no turns and is offered no triggers. */
export function isDowned(combatant: CombatantState): boolean {
  return combatant.hp.current <= 0;
}

/** The side whose every combatant is down, if any (a side with no combatants never counts as defeated). */
export function defeatedSide(combatants: Readonly<Record<string, CombatantState>>): Side | undefined {
  for (const side of ['allies', 'enemies'] as const) {
    const members = Object.values(combatants).filter((combatant) => combatant.side === side);
    if (members.length > 0 && members.every(isDowned)) return side;
  }
  return undefined;
}

/** Structured roll → the mock's display string (`d20[14]+3=17 ≥ ac15`, `d6[4]+2=6`). */
export function displayRoll(roll: import('../../core/dice').RollResult): string {
  const dicePart = `d${roll.sides}[${roll.values.join(',')}]`;
  const modifierPart =
    roll.modifier === 0 ? '' : roll.modifier > 0 ? `+${roll.modifier}` : `${roll.modifier}`;
  const base = `${dicePart}${modifierPart}=${roll.total}`;
  const verdict = roll.verdict;
  if (verdict === undefined) return base;
  const relation = verdict.result === 'miss' || verdict.result === 'fail' ? '<' : '≥';
  return `${base} ${relation} ${verdict.defense}${verdict.value}`;
}

/** A convenience alias for CombatState's rng — re-exported for the snapshot seam (S06). */
export type { SlotLedger, SlotGrants };
export { replenish };
