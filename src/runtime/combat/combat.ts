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
 *
 * Consumables (CA-EG5): `use()` spends one of the actor's host-stated item
 * charges and runs the item's parse-once `use` effect through the same
 * executor path as an action. A heal arrives as a negative-amount damage
 * mutation and clamps at the combatant's `maxHp` (CA-EG4, R-2).
 */
import type { ActionDef } from '../../schema/artifacts';
import { Rng, type RandomSource, type RngState } from '../../core/rng';
import type { Runtime } from '../runtime';
import type { RuntimeEvent } from '../events';
import { answerOffer, resolveReactive } from './triggers';
import {
  checkCost,
  freshLedger,
  replenish,
  resolveSlotGrants,
  spend,
  type EconomyBalances,
  type SlotGrants,
  type SlotLedger,
} from './action-economy';
import type { CombatantProfile, Side } from './resolve';
import type { Position } from './spatial';
import { evalValidity } from '../../core/dsl/formula';
import { RuntimeRuleError, ruleCard } from '../errors';
import { displayRoll } from '../display-roll';
import { balancesOf, combatantFeats, copyBindings, defeatedSide, isDowned, validityVars } from './combatants';
import {
  applyNonSlotCosts,
  atRefusal,
  castPayload,
  isSelfAction,
  pickSlot,
  rangeGate,
  resolveTarget,
  restrictionRejection,
  selfTargetRefusal,
  spatialGate,
} from './declare';
import { endIfSideDefeated, executeBound, resolveAction, resolveShape } from './execute';
import { FightCore } from './fight';
import {
  copyTerrain,
  forfeitMove,
  moveBudgetAst,
  movementGate,
  resumeMove,
  terrainRefusals,
} from './movement';
import type {
  CastSlot,
  CombatantState,
  CombatState,
  DeclareOptions,
  PendingTrigger,
  StartCombatRequest,
  StepOutcome,
  UseOptions,
} from './types';

export type {
  CombatantState,
  PendingMove,
  CombatState,
  CombatPhase,
  PendingAction,
  PendingTrigger,
  DeclareOptions,
  DeclareRejection,
  UseOptions,
  StepOutcome,
  StartCombatRequest,
} from './types';

/**
 * Start a fight: build plain-JSON combatant state from profiles, roll
 * initiative (CA-6: the pack's reserved `initiative` formula when declared —
 * d20 + formula via profile.initiativeBonus — plain d20 fallback otherwise),
 * and emit `combat:start` with the roll provenance (combat-loop.html's first
 * row).
 */
export function startCombat(runtime: Runtime, request: StartCombatRequest): Combat {
  const conditionErrors = [...request.allies, ...request.enemies].flatMap((member) => {
    if (member.conditions === undefined) return [];
    const at = `combatants.${member.id}.conditions`;
    if (!Array.isArray(member.conditions))
      return [ruleCard('E-SNAP-01', member.id, at, 'Initial conditions must be an array.')];
    return member.conditions.flatMap((active, index) =>
      active !== null &&
      typeof active === 'object' &&
      Object.keys(active).length === 2 &&
      typeof active.conditionId === 'string' &&
      runtime.pack.content.conditions?.[active.conditionId] !== undefined &&
      Number.isSafeInteger(active.duration) &&
      active.duration >= 0
        ? []
        : [
            ruleCard(
              'E-SNAP-01',
              member.id,
              `${at}[${index}]`,
              'Initial condition requires a declared id and nonnegative safe duration.',
            ),
          ],
    );
  });
  if (conditionErrors.length) throw new RuntimeRuleError(conditionErrors);
  // CAP-G2 fail-closed gate: a spatial pack's fight is refused — all missing
  // combatants and every bad terrain placement in one aggregate, nothing
  // built — before any state or rolls.
  if (runtime.pack.spatial !== undefined) {
    const members = [...request.allies, ...request.enemies];
    const cards = members
      .filter((member) => request.positions?.[member.id] === undefined)
      .map((member) =>
        ruleCard(
          'E-SPAT-01',
          member.id,
          `positions.${member.id}`,
          `combatant "${member.id}" has no position — this pack declares a spatial model (FR-11), so startCombat requires every combatant's position.`,
        ),
      );
    cards.push(
      ...terrainRefusals(
        runtime,
        request.terrain ?? [],
        members.map((member) => member.id),
        request.positions,
        'start',
      ),
    );
    if (cards.length > 0) throw new RuntimeRuleError(cards);
  }
  const rng = request.rng ?? new Rng(0);
  const grants = resolveSlotGrants(runtime.pack);
  const entries: {
    id: string;
    side: Side;
    name: string;
    profile: CombatantProfile;
    balances: EconomyBalances;
    positions: Position | undefined;
    initiativeRoll: number;
    conditions: CombatantState['conditions'];
  }[] = [];
  for (const member of request.allies) {
    entries.push({
      id: member.id,
      side: 'allies',
      name: member.id,
      profile: member.profile,
      balances: member.balances ?? {},
      positions: request.positions?.[member.id],
      initiativeRoll: rng.int(20) + 1,
      conditions: (member.conditions ?? []).map((active) => ({ ...active })),
    });
  }
  for (const member of request.enemies) {
    entries.push({
      id: member.id,
      side: 'enemies',
      name: member.id,
      profile: member.profile,
      balances: member.balances ?? {},
      positions: request.positions?.[member.id],
      initiativeRoll: rng.int(20) + 1,
      conditions: (member.conditions ?? []).map((active) => ({ ...active })),
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
      maxHp: entry.profile.maxHp ?? Math.max(0, entry.profile.hp),
      conditions: entry.conditions,
      slots: freshLedger(grants),
      pools: { ...(entry.balances.pools ?? {}) },
      boundSlots: { ...(entry.balances.boundSlots ?? {}) },
      itemBalances: { ...(entry.balances.items ?? {}) },
      itemsUsed: {},
      abilities: { ...entry.profile.abilities },
      saves: { ...entry.profile.saves },
      level: entry.profile.level,
      ac: entry.profile.ac,
      initiativeBonus: entry.profile.initiativeBonus,
      ...(entry.profile.speed !== undefined ? { speed: entry.profile.speed } : {}),
      actions: [...entry.profile.actions],
      spells: [...(entry.profile.spells ?? [])],
      ...(entry.balances.bindings !== undefined ? { bindings: copyBindings(entry.balances.bindings) } : {}),
      slotsCast: {},
      poolsSpent: {},
      ...(entry.profile.castBlockedBy !== undefined ? { castBlockedBy: entry.profile.castBlockedBy } : {}),
      ...combatantFeats(entry.profile),
      attackTable: entry.profile.attackTable
        ? entry.profile.attackTable.map((row) => ({ level: row.level, byDefense: { ...row.byDefense } }))
        : undefined,
      attackBonus: entry.profile.attackBonus,
      ...(entry.positions !== undefined ? { position: entry.positions } : {}),
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
    terrain: copyTerrain(request.terrain ?? []),
  });
  runtime.events.emit({
    type: 'combat:start',
    payload: { order: [...order], initiative: initiativeSummary },
    why: { rule: 'combat.startCombat', rolls: whyRolls },
  });
  return fight;
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
  get state(): CombatState {
    return this.core.state;
  }
  set state(next: CombatState) {
    this.core.state = next;
  }
  /** Open trigger offers (triggers.html): the host answers each via respond(). The core's own array (DD-D3). */
  readonly pendingTriggers: PendingTrigger[];
  /** The fight's mutable internals, shared with the combat files' free functions (DD-D3). */
  private readonly core: FightCore;

  /**
   * `options.offeredCount` resumes the offer counter (v1.6, DD-S14): a restored
   * fight's next `trigger:fired.offerIndex` continues where the frozen fight
   * stopped. Absent = 0 (a new fight).
   */
  constructor(
    runtime: Runtime,
    state: CombatState,
    rng: Rng = new Rng(state.rng),
    options: { readonly offeredCount?: number } = {},
  ) {
    this.runtime = runtime;
    this.core = new FightCore(
      runtime,
      state,
      rng,
      resolveSlotGrants(runtime.pack),
      options.offeredCount ?? 0,
    );
    this.pendingTriggers = this.core.pendingTriggers;
  }

  /** How many offers this fight has raised so far — the snapshot's `offeredCount` (R-GM-1). */
  get offeredCount(): number {
    return this.core.offerCounter;
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
        this.core.setClock();
        return this.advanceFrom(this.state.turn + 1, this.state.active);
      }
      this.core.setClock();
      replenish(this.state.combatants[this.state.active]!.slots, this.core.grants);
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
      forfeitMove(this.core);
      return this.endTurn();
    }
    return { kind: 'awaiting-declare', combatantId: this.state.active };
  }

  /** End this turn without replenishing its ledger. Open offers must be answered first. */
  pass(): StepOutcome {
    if (this.state.phase === 'combat-over' || this.pendingTriggers.length > 0) {
      throw new RuntimeRuleError([
        ruleCard(
          'E-REF-01',
          this.state.active,
          'phase',
          'Cannot pass terminal combat or a turn with unanswered offers.',
        ),
      ]);
    }
    forfeitMove(this.core);
    return this.endTurn();
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
    // A spell is an action plus metadata (FR-9, CA-S1): ids are unique across
    // actions and spells (E-DUP-01), so at most one lookup hits.
    const spell = pack.actions[actionId] === undefined ? pack.content.spells?.[actionId] : undefined;
    const def: ActionDef | undefined =
      spell === undefined
        ? pack.actions[actionId]
        : {
            cost: spell.cost,
            effect: spell.effect,
            ...(spell.tags !== undefined ? { tags: spell.tags } : {}),
          };
    if (def === undefined) {
      return [
        this.core.reject(actorId, {
          kind: 'no-action',
          rule: 'E-REF-01',
          resource: actionId,
          message: `action "${actionId}" is not declared in the pack.`,
        }),
      ];
    }
    if (spell === undefined ? !actor.actions.includes(actionId) : !actor.spells.includes(actionId)) {
      return [
        this.core.reject(actorId, {
          kind: 'no-action',
          rule: 'E-REF-01',
          resource: actionId,
          message:
            spell === undefined
              ? `combatant "${actorId}" does not have action "${actionId}".`
              : `combatant "${actorId}" does not know spell "${actionId}".`,
        }),
      ];
    }
    const restriction = restrictionRejection(
      this.runtime,
      actor,
      def,
      spell === undefined ? 'action' : 'spell',
    );
    if (restriction !== undefined) {
      return [this.core.reject(actorId, restriction)];
    }
    // DD-S8: `at` centers a burst spell on a cell (spatial packs only; theater packs drop it).
    // An `at` cast binds the caster as the nominal executor target — no statement reads it.
    const at = this.runtime.spatial.enabled ? options.at : undefined;
    if (at !== undefined) {
      const refusal = atRefusal(this.runtime, actionId, options.targetId);
      if (refusal !== undefined) return [this.core.reject(actorId, refusal)];
    }
    // A move action targets its actor: no opponent resolution, no reach gate (DD-M9).
    // Spells never move (a spell `move` is E-FORM-02), so the budget is action-only.
    const budgetAst = moveBudgetAst(this.runtime, actionId);
    // A self action targets its actor too (v1.7, DD-A2): no opponent resolution, no reach gate.
    const selfAction = spell === undefined && isSelfAction(this.runtime, actionId);
    if (selfAction) {
      const refusal = selfTargetRefusal(actionId, actorId, options.targetId);
      if (refusal !== undefined) return [this.core.reject(actorId, refusal)];
    }
    const target =
      budgetAst !== undefined || at !== undefined || selfAction
        ? { combatant: actor }
        : resolveTarget(this.state, actor, options.targetId, spell !== undefined);
    if ('rejection' in target) {
      return [this.core.reject(actorId, target.rejection)];
    }
    // The validity gate speaks before the spatial gate (validity-into-grid.html:
    // the hasTarget failure is what the declarative gate reports; reach is
    // consulted after the action's own clause passes). Both run before cost.
    const validity = this.runtime.index.validAsts[actionId];
    if (validity !== undefined) {
      const ok = evalValidity(
        validity,
        validityVars(actor),
        (shape) =>
          resolveShape(this.core, shape, actor, target.combatant.position, target.combatant).length > 0,
      );
      if (!ok) {
        return [
          this.core.reject(actorId, {
            kind: 'valid',
            rule: 'E-REF-01',
            resource: actionId,
            message: `action "${actionId}" is not valid right now — its valid clause failed (hasTarget: no combatant resolves for the declared shape).`,
          }),
        ];
      }
    }
    let move: ((budget: number) => void) | undefined;
    if (budgetAst !== undefined) {
      const gate = movementGate(this.core, actor, actionId, budgetAst, options.to);
      if ('rejection' in gate) {
        return [this.core.reject(actorId, gate.rejection)];
      }
      move = gate.move;
    } else if (selfAction) {
      // DD-A2: a self action passes no reach gate.
    } else if (spell !== undefined) {
      // CA-S9: a spell passes the range gate where an action passes the reach gate.
      const range = rangeGate(this.runtime, actor, actionId, spell.targeting?.range, at ?? target.combatant);
      if (range !== undefined) {
        return [this.core.reject(actorId, range)];
      }
    } else {
      const spatial = spatialGate(this.runtime, actor, target.combatant);
      if (spatial !== undefined) {
        return [this.core.reject(actorId, spatial)];
      }
    }
    // DD-S6: equipped armor blocks a vancian spell exactly as outside combat.
    if (spell !== undefined && def.cost.vancian !== undefined && actor.castBlockedBy !== undefined) {
      return [
        this.core.reject(actorId, {
          kind: 'armor-not-castable',
          rule: 'E-REF-01',
          resource: actor.castBlockedBy,
          message: `"${actor.castBlockedBy}" is equipped armor of a kind none of the caster's classes lists in armorCasting — no slot cast (FR-9).`,
        }),
      ];
    }
    const costRejection = checkCost(def.cost, this.core.grants, balancesOf(actor));
    if (costRejection !== undefined) {
      return [this.core.reject(actorId, costRejection)];
    }
    // DD-S18: a vancian spell consumes a slot bound to it — chosen before any spend, recorded after.
    let slot: CastSlot | undefined;
    if (spell !== undefined && def.cost.vancian !== undefined) {
      const level = String(spell.magic.level);
      const index = pickSlot(actor, level, actionId);
      if (index === undefined) {
        return [
          this.core.reject(actorId, {
            kind: 'vancian',
            rule: 'E-VANC-01',
            resource: level,
            message: `no uncast level-${level} slot is bound to "${actionId}"`,
          }),
        ];
      }
      slot = { level, index };
    }
    // All gates passed — commit the spend and resolve.
    const spendRejection = spend(actor.slots, this.core.grants, def.cost);
    if (spendRejection !== undefined) {
      return [this.core.reject(actorId, spendRejection)];
    }
    slot = applyNonSlotCosts(actor, def.cost, slot);
    const aim = at !== undefined ? { at: { x: at.x, y: at.y } } : { targetId: target.combatant.id };
    const cast = spell === undefined ? undefined : castPayload(actionId, def.cost, aim, slot);
    const { result: events, emitted } = this.core.collect(() =>
      resolveAction(this.core, actor, actionId, def, target.combatant, { move, cast, at }),
    );
    this.core.surfaceOffers(emitted);
    return events;
  }

  /**
   * Use one charge of a consumable as the active combatant (CA-EG5, DD-EG6).
   * Gates, in order: `combat-over` throws exactly as `declare` does (R-3);
   * `unknown-item`; `not-consumable`; the restriction gate over a synthetic
   * item-only action (items declare no tags, so it cannot bite today);
   * `unknown-target` (default target: the user); `no-charges`. A rejection
   * is one `declare:rejected` event and changes nothing. On success the spend
   * is recorded, `item:used` is emitted, and the item's `use` effect runs
   * through the action executor with `why.rule` `content.items.<id>`. A use
   * consumes no turn slot and does not end the turn.
   */
  use(itemId: string, options: UseOptions = {}): readonly RuntimeEvent[] {
    if (this.state.phase === 'combat-over') throw new Error('combat is over');

    const actorId = this.state.active;
    const actor = this.state.combatants[actorId]!;
    const item = this.runtime.pack.content.items?.[itemId];
    if (item === undefined) {
      return [
        this.core.reject(actorId, {
          kind: 'unknown-item',
          rule: 'E-REF-01',
          resource: itemId,
          message: `item "${itemId}" is not declared in content.items.`,
        }),
      ];
    }
    const ast = this.runtime.index.itemEffects[itemId];
    if (ast === undefined || item.use === undefined) {
      return [
        this.core.reject(actorId, {
          kind: 'not-consumable',
          rule: 'E-REF-01',
          resource: itemId,
          message: `item "${itemId}" declares no use effect — it cannot be used.`,
        }),
      ];
    }
    // F-E15: an item-only synthetic action; spells are declared through declare() (v1.6), never use().
    const def: ActionDef = { cost: {}, effect: item.use };
    const restriction = restrictionRejection(this.runtime, actor, def);
    if (restriction !== undefined) {
      return [this.core.reject(actorId, restriction)];
    }
    const targetId = options.target ?? actorId;
    const target = this.state.combatants[targetId];
    if (target === undefined) {
      return [
        this.core.reject(actorId, {
          kind: 'unknown-target',
          rule: 'E-REF-01',
          resource: targetId,
          message: `target "${targetId}" is not in this fight.`,
        }),
      ];
    }
    const used = actor.itemsUsed[itemId] ?? 0;
    const remaining = (actor.itemBalances[itemId] ?? 0) - used;
    if (remaining <= 0) {
      return [
        this.core.reject(actorId, {
          kind: 'no-charges',
          rule: 'E-REF-01',
          resource: itemId,
          message: `combatant "${actorId}" has no "${itemId}" charges left (${used} of ${actor.itemBalances[itemId] ?? 0} spent).`,
        }),
      ];
    }

    actor.itemsUsed = { ...actor.itemsUsed, [itemId]: used + 1 };
    const rule = `content.items.${itemId}`;
    this.core.setClock();
    const usedEvent = this.runtime.events.emit({
      type: 'item:used',
      actor: actorId,
      target: targetId,
      payload: { itemId, remaining: remaining - 1 },
      why: { rule, rolls: [] },
    });
    const effectEvents = executeBound(this.core, actor, { id: itemId, def, ast }, target, rule);
    endIfSideDefeated(this.core);
    this.core.surfaceOffers(effectEvents);
    return [usedEvent, ...effectEvents];
  }

  /** Answer an offered trigger (api-map: fight.respond). */
  respond(triggerId: string, choice: 'take' | 'decline', targetId?: string): readonly RuntimeEvent[] {
    const index = this.pendingTriggers.findIndex((offer) => offer.triggerId === triggerId);
    if (index === -1) {
      throw new Error(`no pending trigger "${triggerId}" — the host answers an offered trigger, FR-10/FR-13`);
    }
    const [offer] = this.pendingTriggers.splice(index, 1);
    if (offer === undefined) return [];
    const events = answerOffer(this.core, offer, choice, targetId);
    // Every answer — a decline, a take, even a refused take — leaves the queue;
    // once it is empty a paused move resumes (DD-M10).
    return this.pendingTriggers.length === 0 ? [...events, ...resumeMove(this.core)] : events;
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

  /** A reactive action resolving outside the declare flow (host took a trigger offer). */
  declareReactive(offer: PendingTrigger, targetId: string | undefined): readonly RuntimeEvent[] {
    return resolveReactive(this.core, offer, targetId);
  }

  private endTurn(): StepOutcome {
    const actorId = this.state.active;
    this.core.setClock();
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

/** Re-exported from the leaf so the runtime barrel keeps `displayRoll` where it was. */
export { displayRoll };

/** Moved to the pure combatant leaf; re-exported where tests and snapshots import them. */
export { isDowned, defeatedSide, combatantFeats, copyBindings };

/** Moved to the declare gates; re-exported where tests import it. */
export { isSelfAction };

/** Moved to the movement file; re-exported where tests and snapshots import them. */
export { copyTerrain, terrainRefusals, moveBudgetAst };

/** A convenience alias for CombatState's rng — re-exported for the snapshot seam (S06). */
export type { SlotLedger, SlotGrants };
export { replenish };
