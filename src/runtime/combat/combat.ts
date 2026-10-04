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
 *
 * Movement (v1.5, FR-11): a move action — an action whose parse-once effect
 * root is `move(<formula>)` — targets its actor, passes the movement gate
 * (destination + cheapest legal path within the budget, DD-M9) where other
 * actions pass the reach gate, and walks the planned path through
 * `apply.move`, emitting `move:advanced` / `move:ended`. Theater-of-mind packs
 * resolve it as a no-op (DD-M11). Terrain is host-placed per fight.
 */
import type { ActionDef, ActionCost } from '../../schema/artifacts';
import { Rng, type RandomSource, type RngState } from '../../core/rng';
import type { Runtime } from '../runtime';
import type { RuntimeEvent } from '../events';
import { emitDeclined, emitOffer, offersForEvent } from './triggers';
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
import { effectVars, executeAgainst, type BoundAction, type CombatantProfile, type Side } from './resolve';
import { checkReach, entryCost, findPath, terrainAt, type Position, type TerrainCell } from './spatial';
import { evalFormula, evalValidity, valueOfFormula, type FormulaAst } from '../../core/dsl/formula';
import { RuntimeRuleError, ruleCard } from '../errors';
import { declaredTags, matchesRestriction } from '../conditions';
import { displayRoll } from '../display-roll';
import type { ErrorCard } from '../../schema/error-card';
import {
  applyMutation,
  balancesOf,
  combatantFeats,
  copyBindings,
  defeatedSide,
  isDowned,
  profileOf,
  reachOf,
  ruleBaseOf,
  validityVars,
} from './combatants';
import type {
  CastSlot,
  CombatantState,
  CombatState,
  DeclareOptions,
  DeclareRejection,
  PendingMove,
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
      conditions: [],
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

/** Plain-JSON copies of host terrain cells (FR-14: state never aliases host objects). */
export function copyTerrain(cells: readonly TerrainCell[]): TerrainCell[] {
  return cells.map((cell) => ({ at: { x: cell.at.x, y: cell.at.y }, kind: cell.kind }));
}

/**
 * The terrain placement refusals shared by `startCombat` and restore (DD-M5,
 * E-SPAT-01), spatial packs only: an unknown kind, a cell placed twice, a
 * combatant positioned on a blocking cell. Theater packs carry terrain
 * unconsulted (DD-M11), so they refuse nothing.
 */
export function terrainRefusals(
  runtime: Runtime,
  terrain: readonly TerrainCell[],
  combatantIds: readonly string[],
  positions: Readonly<Record<string, Position>> | undefined,
  phase: 'start' | 'restore',
): ErrorCard[] {
  const vocabulary = runtime.pack.spatial?.terrain;
  if (runtime.pack.spatial === undefined) return [];
  const prefix = phase === 'start' ? 'terrain' : 'restore.terrain';
  const artifact = (id: string) => (phase === 'start' ? id : '(snapshot)');
  const known = Object.keys(vocabulary ?? {});
  const cards: ErrorCard[] = [];
  const placed = new Map<string, number>();
  terrain.forEach((cell, index) => {
    if (vocabulary?.[cell.kind] === undefined) {
      cards.push(
        ruleCard(
          'E-SPAT-01',
          artifact(cell.kind),
          `${prefix}[${index}].kind`,
          `terrain kind "${cell.kind}" is not in the pack's spatial.terrain vocabulary (${known.length === 0 ? 'the pack declares none' : known.join(', ')}).`,
        ),
      );
    }
    const key = `${cell.at.x},${cell.at.y}`;
    const first = placed.get(key);
    if (first !== undefined) {
      cards.push(
        ruleCard(
          'E-SPAT-01',
          artifact(cell.kind),
          `${prefix}[${index}].at`,
          `terrain cell (${key}) is placed twice (first at ${prefix}[${first}]) — each cell has one kind.`,
        ),
      );
    } else {
      placed.set(key, index);
    }
  });
  const kindAt = (p: Position) => {
    const index = placed.get(`${p.x},${p.y}`);
    return index === undefined ? undefined : vocabulary?.[terrain[index]!.kind];
  };
  for (const id of combatantIds) {
    const position = positions?.[id];
    if (position === undefined) continue;
    const kind = kindAt(position);
    if (kind !== undefined && entryCost(kind) === undefined) {
      cards.push(
        ruleCard(
          'E-SPAT-01',
          artifact(id),
          phase === 'start' ? `positions.${id}` : `restore.${id}.position`,
          `combatant "${id}" is positioned on a blocking terrain cell (${position.x},${position.y}) — a blocking cell can never be occupied.`,
        ),
      );
    }
  }
  return cards;
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
  /** How many offers this fight has raised — the next `trigger:fired.offerIndex` (R-GM-1: restorable). */
  private offerCounter: number;
  /** Events already offered against — each (reactor, event) pair is offered once (F-P1). */
  private readonly surfaced = new WeakSet<RuntimeEvent>();

  private readonly grants: SlotGrants;
  /** The fight's own dice stream — snapshot-resumable via state.rng (FR-14). */
  private readonly rng: Rng;

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
    this.state = state;
    this.grants = resolveSlotGrants(runtime.pack);
    this.rng = rng;
    this.offerCounter = options.offeredCount ?? 0;
  }

  /** How many offers this fight has raised so far — the snapshot's `offeredCount` (R-GM-1). */
  get offeredCount(): number {
    return this.offerCounter;
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
      this.forfeitMove();
      return this.endTurn();
    }
    return { kind: 'awaiting-declare', combatantId: this.state.active };
  }

  /** `step()` while a move is paused forfeits it (`move:ended {reason: 'forfeited'}`) before its usual effect (DD-M10). */
  private forfeitMove(): void {
    const pending = this.state.combatants[this.state.active]?.pendingMove;
    if (pending === undefined) return;
    this.setClock();
    this.endMove(this.state.active, pending.actionId, 'forfeited');
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
        this.rejectionEvent(actorId, {
          kind: 'no-action',
          rule: 'E-REF-01',
          resource: actionId,
          message: `action "${actionId}" is not declared in the pack.`,
        }),
      ];
    }
    if (spell === undefined ? !actor.actions.includes(actionId) : !actor.spells.includes(actionId)) {
      return [
        this.rejectionEvent(actorId, {
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
    const restriction = this.restrictionRejection(actor, def, spell === undefined ? 'action' : 'spell');
    if (restriction !== undefined) {
      return [this.rejectionEvent(actorId, restriction)];
    }
    // DD-S8: `at` centers a burst spell on a cell (spatial packs only; theater packs drop it).
    // An `at` cast binds the caster as the nominal executor target — no statement reads it.
    const at = this.runtime.spatial.enabled ? options.at : undefined;
    if (at !== undefined) {
      const refusal = this.atRefusal(actionId, options.targetId);
      if (refusal !== undefined) return [this.rejectionEvent(actorId, refusal)];
    }
    // A move action targets its actor: no opponent resolution, no reach gate (DD-M9).
    // Spells never move (a spell `move` is E-FORM-02), so the budget is action-only.
    const budgetAst = moveBudgetAst(this.runtime, actionId);
    // A self action targets its actor too (v1.7, DD-A2): no opponent resolution, no reach gate.
    const selfAction = spell === undefined && isSelfAction(this.runtime, actionId);
    if (selfAction) {
      const refusal = selfTargetRefusal(actionId, actorId, options.targetId);
      if (refusal !== undefined) return [this.rejectionEvent(actorId, refusal)];
    }
    const target =
      budgetAst !== undefined || at !== undefined || selfAction
        ? { combatant: actor }
        : this.resolveTarget(actor, options.targetId, spell !== undefined);
    if ('rejection' in target) {
      return [this.rejectionEvent(actorId, target.rejection)];
    }
    // The validity gate speaks before the spatial gate (validity-into-grid.html:
    // the hasTarget failure is what the declarative gate reports; reach is
    // consulted after the action's own clause passes). Both run before cost.
    const validity = this.runtime.index.validAsts[actionId];
    if (validity !== undefined) {
      const ok = evalValidity(
        validity,
        validityVars(actor),
        (shape) => this.resolveShape(shape, actor, target.combatant.position, target.combatant).length > 0,
      );
      if (!ok) {
        return [
          this.rejectionEvent(actorId, {
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
      const gate = this.movementGate(actor, actionId, budgetAst, options.to);
      if ('rejection' in gate) {
        return [this.rejectionEvent(actorId, gate.rejection)];
      }
      move = gate.move;
    } else if (selfAction) {
      // DD-A2: a self action passes no reach gate.
    } else if (spell !== undefined) {
      // CA-S9: a spell passes the range gate where an action passes the reach gate.
      const range = this.rangeGate(actor, actionId, spell.targeting?.range, at ?? target.combatant);
      if (range !== undefined) {
        return [this.rejectionEvent(actorId, range)];
      }
    } else {
      const spatial = this.spatialGate(actor, target.combatant);
      if (spatial !== undefined) {
        return [this.rejectionEvent(actorId, spatial)];
      }
    }
    // DD-S6: equipped armor blocks a vancian spell exactly as outside combat.
    if (spell !== undefined && def.cost.vancian !== undefined && actor.castBlockedBy !== undefined) {
      return [
        this.rejectionEvent(actorId, {
          kind: 'armor-not-castable',
          rule: 'E-REF-01',
          resource: actor.castBlockedBy,
          message: `"${actor.castBlockedBy}" is equipped armor of a kind none of the caster's classes lists in armorCasting — no slot cast (FR-9).`,
        }),
      ];
    }
    const costRejection = checkCost(def.cost, this.grants, balancesOf(actor));
    if (costRejection !== undefined) {
      return [this.rejectionEvent(actorId, costRejection)];
    }
    // DD-S18: a vancian spell consumes a slot bound to it — chosen before any spend, recorded after.
    let slot: CastSlot | undefined;
    if (spell !== undefined && def.cost.vancian !== undefined) {
      const level = String(spell.magic.level);
      const index = this.pickSlot(actor, level, actionId);
      if (index === undefined) {
        return [
          this.rejectionEvent(actorId, {
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
    const spendRejection = spend(actor.slots, this.grants, def.cost);
    if (spendRejection !== undefined) {
      return [this.rejectionEvent(actorId, spendRejection)];
    }
    slot = this.applyNonSlotCosts(actor, def.cost, slot);
    const aim = at !== undefined ? { at: { x: at.x, y: at.y } } : { targetId: target.combatant.id };
    const cast = spell === undefined ? undefined : castPayload(actionId, def.cost, aim, slot);
    const { result: events, emitted } = this.collect(() =>
      this.resolve(actor, actionId, def, target.combatant, { move, cast, at }),
    );
    this.surfaceOffers(emitted);
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
        this.rejectionEvent(actorId, {
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
        this.rejectionEvent(actorId, {
          kind: 'not-consumable',
          rule: 'E-REF-01',
          resource: itemId,
          message: `item "${itemId}" declares no use effect — it cannot be used.`,
        }),
      ];
    }
    // F-E15: an item-only synthetic action; spells are declared through declare() (v1.6), never use().
    const def: ActionDef = { cost: {}, effect: item.use };
    const restriction = this.restrictionRejection(actor, def);
    if (restriction !== undefined) {
      return [this.rejectionEvent(actorId, restriction)];
    }
    const targetId = options.target ?? actorId;
    const target = this.state.combatants[targetId];
    if (target === undefined) {
      return [
        this.rejectionEvent(actorId, {
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
        this.rejectionEvent(actorId, {
          kind: 'no-charges',
          rule: 'E-REF-01',
          resource: itemId,
          message: `combatant "${actorId}" has no "${itemId}" charges left (${used} of ${actor.itemBalances[itemId] ?? 0} spent).`,
        }),
      ];
    }

    actor.itemsUsed = { ...actor.itemsUsed, [itemId]: used + 1 };
    const rule = `content.items.${itemId}`;
    this.setClock();
    const usedEvent = this.runtime.events.emit({
      type: 'item:used',
      actor: actorId,
      target: targetId,
      payload: { itemId, remaining: remaining - 1 },
      why: { rule, rolls: [] },
    });
    const effectEvents = this.execute(actor, { id: itemId, def, ast }, target, rule);
    this.endIfSideDefeated();
    this.surfaceOffers(effectEvents);
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
    let events: readonly RuntimeEvent[];
    if (choice === 'decline') {
      this.setClock(); // stamp with the fight's clock — a restored fight's stream starts at round 0
      emitDeclined(this.runtime, offer);
      const declined = this.runtime.events.sinceRound(this.state.round);
      events = [declined[declined.length - 1]!];
    } else {
      events =
        offer.source === 'feat' ? this.resolveFeat(offer, targetId) : this.resolveReactive(offer, targetId);
    }
    // Every answer — a decline, a take, even a refused take — leaves the queue;
    // once it is empty a paused move resumes (DD-M10).
    return this.pendingTriggers.length === 0 ? [...events, ...this.resumeMove()] : events;
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

  /**
   * The restricts gate (v1.1 matcher, `conditions.ts`): the first active
   * condition pattern, in condition order, matching one of the declared tags
   * blocks the declare. A spell is an action (FR-9): in combat either pattern
   * kind blocks it (DD-S10); an action matches `actions.tagged:` only.
   */
  private restrictionRejection(
    actor: CombatantState,
    def: ActionDef,
    kind: 'action' | 'spell' = 'action',
  ): DeclareRejection | undefined {
    const tags = def.tags ?? [];
    if (tags.length === 0 || actor.conditions.length === 0) return undefined;
    const declared = declaredTags(this.runtime);
    for (const active of actor.conditions) {
      for (const pattern of this.runtime.pack.content.conditions?.[active.conditionId]?.restricts ?? []) {
        const hit =
          matchesRestriction(pattern, 'action', tags, declared) ||
          (kind === 'spell' && matchesRestriction(pattern, 'spell', tags, declared));
        if (!hit) continue;
        const tag = pattern.slice(pattern.indexOf(':') + 1);
        return {
          kind: 'restricted',
          rule: 'E-REF-01',
          resource: tag,
          message: `action "${tags.join(',')}" carries tag "${tag}", which an active condition restricts (v1.1 restricts matcher).`,
        };
      }
    }
    return undefined;
  }

  /**
   * The declared target, else the only opponent. An action targets opponents
   * only; a spell (`anyCombatant`) may name any combatant in the fight — either
   * side, the caster included (DD-S8).
   */
  private resolveTarget(
    actor: CombatantState,
    targetId: string | undefined,
    anyCombatant = false,
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
    if (target.side === actor.side && !anyCombatant) {
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

  /**
   * The one spatial declare-gate (CAP-G2): a spatial pack's reach gate runs
   * after the target resolves and before any cost is spent — shared by
   * declare() and reactive resolution (triggers ride the same pipeline).
   * Theater-of-mind packs never reject: checkReach is a no-op there.
   */
  private spatialGate(actor: CombatantState, target: CombatantState): DeclareRejection | undefined {
    return checkReach(
      this.runtime.spatial,
      { position: actor.position, reach: reachOf(this.runtime, actor.id) },
      { id: target.id, position: target.position },
      this.runtime.pack.spatial?.reach.default ?? 1,
    );
  }

  /**
   * Why an `at` declare is refused (DD-S8, CA-S9): `at` with a `targetId`; `at`
   * on an action; `at` on a spell that is not a burst (absent targeting =
   * single); `at` on a burst spell whose parse-once root is not
   * `target(burst-…)`. Each is `invalid-target`, nothing changes.
   */
  private atRefusal(actionId: string, targetId: string | undefined): DeclareRejection | undefined {
    const refuse = (resource: string, message: string): DeclareRejection => ({
      kind: 'invalid-target',
      rule: 'E-REF-01',
      resource,
      message,
    });
    if (targetId !== undefined) {
      return refuse(targetId, `declare "${actionId}" with either targetId or at, not both.`);
    }
    const spell = this.runtime.pack.content.spells?.[actionId];
    if (this.runtime.pack.actions[actionId] !== undefined || spell === undefined) {
      return refuse(
        actionId,
        `action "${actionId}" cannot be centered on a cell — only a burst spell takes at.`,
      );
    }
    if (spell.targeting?.shape !== 'burst') {
      return refuse(
        actionId,
        `spell "${actionId}" is not a burst (shape ${spell.targeting?.shape ?? 'single'}) — only a burst spell takes at.`,
      );
    }
    const root = this.runtime.index.spellEffects[actionId];
    const shape = root?.kind === 'call' && root.text === 'target' ? root.args?.[0] : undefined;
    if (shape?.kind !== 'name' || !(shape.text ?? '').startsWith('burst-')) {
      return refuse(
        actionId,
        `spell "${actionId}" cannot be centered on a cell — its effect root is not target(burst-…).`,
      );
    }
    return undefined;
  }

  /**
   * The range gate (CA-S9), where an action passes the reach gate: the
   * distance from the caster to the center — the target's position or the
   * `at` cell — must not exceed the spell's `targeting.range`, else the
   * caster's effective reach `max(reach, spatial.reach.default)` (the
   * `canReach` value, so absent-range packs behave as under the reach gate).
   * Theater-of-mind packs never consult range.
   */
  private rangeGate(
    actor: CombatantState,
    spellId: string,
    declared: number | undefined,
    aim: CombatantState | Position,
  ): DeclareRejection | undefined {
    const geometry = this.runtime.spatial;
    if (!geometry.enabled) return undefined;
    const isCell = !('id' in aim);
    const center = isCell ? aim : aim.position;
    const resource = isCell ? `${aim.x},${aim.y}` : aim.id;
    if (actor.position === undefined || center === undefined) {
      return {
        kind: 'spatial',
        rule: 'E-SPAT-01',
        resource,
        message: `this pack declares a spatial model, but combatant positions are missing (from: ${actor.position === undefined ? 'absent' : 'set'}, target ${resource}: ${center === undefined ? 'absent' : 'set'}).`,
      };
    }
    const floor = this.runtime.pack.spatial?.reach.default ?? 1;
    const range = declared ?? Math.max(reachOf(this.runtime, actor.id) ?? floor, floor);
    const distance = geometry.distance(actor.position, center);
    if (distance <= range) return undefined;
    return {
      kind: 'out-of-range',
      rule: 'E-SPAT-01',
      resource,
      message: `spell "${spellId}" has range ${range}; ${isCell ? `(${resource})` : resource} is ${distance} away.`,
    };
  }

  /**
   * The movement gate (DD-M9), where the reach gate runs for other actions:
   * the destination, then the cheapest legal path within the budget. The
   * budget is the move statement's dice-free formula over the same actor vars
   * the executor binds (`speed` included), evaluated without RNG. A passable
   * cell holds no standing enemy; an endable cell holds no standing combatant,
   * the mover included (DD-M6). Theater packs: a no-op walk, no gate (DD-M11).
   */
  private movementGate(
    actor: CombatantState,
    actionId: string,
    budgetAst: FormulaAst,
    to: Position | undefined,
  ): { move: (budget: number) => void } | { rejection: DeclareRejection } {
    const geometry = this.runtime.spatial;
    if (!geometry.enabled) return { move: () => undefined };
    if (to === undefined) {
      return {
        rejection: {
          kind: 'no-destination',
          rule: 'E-SPAT-01',
          resource: actionId,
          message: `move action "${actionId}" needs a destination — declare it with { to: { x, y } }.`,
        },
      };
    }
    const from = actor.position;
    if (from === undefined) {
      return {
        rejection: {
          kind: 'spatial',
          rule: 'E-SPAT-01',
          resource: actor.id,
          message: `this pack declares a spatial model, but the mover's position is missing (${actor.id}: absent).`,
        },
      };
    }
    const profile = profileOf(actor);
    const budget = valueOfFormula(evalFormula(budgetAst, effectVars(profile, profile), ZERO_RNG));
    const plan = findPath(geometry, this.pathQuery(actor, from, to, budget));
    if (!plan.ok) {
      const cell = `(${to.x},${to.y})`;
      const messages: Record<typeof plan.kind, string> = {
        blocked: `destination ${cell} is a blocking terrain cell — it can never be entered (budget ${budget}).`,
        occupied: `destination ${cell} is held by a standing combatant — a move cannot end on an occupied cell (budget ${budget}).`,
        unreachable: `no legal path reaches ${cell} at any cost (budget ${budget}).`,
        'out-of-range': `the cheapest legal path to ${cell} costs ${plan.cost ?? '?'}, but the movement budget is ${budget}.`,
      };
      return {
        rejection: {
          kind: plan.kind,
          rule: 'E-SPAT-01',
          resource: `${to.x},${to.y}`,
          message: messages[plan.kind],
        },
      };
    }
    return { move: (walked) => this.walk(actor.id, actionId, to, plan.path, walked) };
  }

  /** The path request for a mover, against the fight's current occupancy and terrain. */
  private pathQuery(mover: CombatantState, from: Position, to: Position, budget: number) {
    const standing = Object.values(this.state.combatants).filter(
      (combatant) => !isDowned(combatant) && combatant.position !== undefined,
    );
    const at = (p: Position) => (combatant: CombatantState) =>
      combatant.position!.x === p.x && combatant.position!.y === p.y;
    return {
      from,
      to,
      budget,
      terrain: this.runtime.pack.spatial?.terrain ?? {},
      cells: this.state.terrain,
      occupied: Object.values(this.state.combatants).flatMap((combatant) =>
        combatant.position === undefined ? [] : [combatant.position],
      ),
      passable: (p: Position) => !standing.some((other) => other.side !== mover.side && at(p)(other)),
      endable: (p: Position) => !standing.some(at(p)),
    };
  }

  /**
   * `apply.move`: walk the planned path cell by cell. Before each step from P
   * to Q, every standing opponent T whose reach covers P but not Q raises
   * `move:leaving-reach {actor: mover, target: T, payload: {at: P, next: Q}}`,
   * surfaced as offers at once (no affordability filter, F-P10b). Any offer
   * pauses the move at P: `move:advanced` for the segment walked (omitted when
   * empty) and `pendingMove {actionId, to, remaining}`. Otherwise the walk
   * lands on `to`: `move:advanced` then `move:ended {reason: 'arrived'}`.
   * A resumed walk (`resumed`) does not re-check its first step out of the
   * paused cell: that step's leaving-reach offers were already raised and
   * answered (spatial.html: the move resumes straight to its destination).
   */
  private walk(
    moverId: string,
    actionId: string,
    to: Position,
    path: readonly Position[],
    budget: number,
    resumed = false,
  ): void {
    const from = this.state.combatants[moverId]!.position!;
    const kindAt = terrainAt(this.runtime.pack.spatial?.terrain ?? {}, this.state.terrain);
    const why = { rule: ruleBaseOf(this.runtime, actionId), rolls: [] };
    const walked: Position[] = [];
    let cost = 0;
    let at = from;
    const advanced = () => {
      if (walked.length === 0) return;
      this.runtime.events.emit({
        type: 'move:advanced',
        actor: moverId,
        payload: {
          from: { ...from },
          to: { ...at },
          path: walked.map((cell) => ({ ...cell })),
          cost,
          remaining: budget - cost,
        },
        why,
      });
    };
    for (const [index, next] of path.entries()) {
      let offers = 0;
      const threateners = resumed && index === 0 ? [] : this.threatenersLeft(moverId, at, next);
      for (const threatener of threateners) {
        const leaving = this.runtime.events.emit({
          type: 'move:leaving-reach',
          actor: moverId,
          target: threatener,
          payload: { at: { ...at }, next: { ...next } },
          why,
        });
        offers += this.surfaceOffers([leaving]);
      }
      if (offers > 0) {
        this.place(moverId, at);
        advanced();
        this.setPendingMove(moverId, { actionId, to: { x: to.x, y: to.y }, remaining: budget - cost });
        return;
      }
      cost += entryCost(kindAt(next))!;
      walked.push(next);
      at = next;
    }
    this.place(moverId, at);
    advanced();
    this.endMove(moverId, actionId, 'arrived');
  }

  /** Standing opponents with a position whose reach covers `at` but not `next` — the leaving-reach threateners, in initiative order. */
  private threatenersLeft(moverId: string, at: Position, next: Position): readonly string[] {
    const geometry = this.runtime.spatial;
    const mover = this.state.combatants[moverId]!;
    return this.state.order.filter((id) => {
      const other = this.state.combatants[id]!;
      if (other.side === mover.side || isDowned(other) || other.position === undefined) return false;
      const reach = reachOf(this.runtime, id) ?? 1;
      return geometry.canReach(other.position, at, reach) && !geometry.canReach(other.position, next, reach);
    });
  }

  /**
   * Resume the active combatant's paused move once the offer queue is empty
   * (DD-M10). Re-checks, in order: downed → `downed`; an active condition now
   * restricts the action → `restricted`; otherwise re-plan from the current
   * cell with the remaining budget against current occupancy — no path →
   * `blocked`, else walk again (which may pause again). Offers raised here are
   * surfaced per call.
   */
  private resumeMove(): readonly RuntimeEvent[] {
    const moverId = this.state.active;
    const mover = this.state.combatants[moverId];
    const pending = mover?.pendingMove;
    if (mover === undefined || pending === undefined) return [];
    this.setClock();
    const { emitted } = this.collect(() => {
      if (isDowned(mover)) return this.endMove(moverId, pending.actionId, 'downed');
      const def = this.runtime.pack.actions[pending.actionId]!;
      if (this.restrictionRejection(mover, def) !== undefined) {
        return this.endMove(moverId, pending.actionId, 'restricted');
      }
      const from = mover.position!;
      const plan = findPath(this.runtime.spatial, this.pathQuery(mover, from, pending.to, pending.remaining));
      if (!plan.ok) return this.endMove(moverId, pending.actionId, 'blocked');
      this.setPendingMove(moverId, undefined);
      this.walk(moverId, pending.actionId, pending.to, plan.path, pending.remaining, true);
    });
    this.surfaceOffers(emitted);
    return emitted;
  }

  /** End a move: clear any `pendingMove` and emit `move:ended {reason, at}`. */
  private endMove(
    moverId: string,
    actionId: string,
    reason: 'arrived' | 'downed' | 'restricted' | 'blocked' | 'forfeited',
  ): void {
    this.setPendingMove(moverId, undefined);
    const at = this.state.combatants[moverId]!.position!;
    this.runtime.events.emit({
      type: 'move:ended',
      actor: moverId,
      payload: { reason, at: { ...at } },
      why: { rule: ruleBaseOf(this.runtime, actionId), rolls: [] },
    });
  }

  /** Set or clear a combatant's `pendingMove` — the combatant entry is replaced, like `place`. */
  private setPendingMove(id: string, pending: PendingMove | undefined): void {
    const combatant: { -readonly [K in keyof CombatantState]: CombatantState[K] } = {
      ...this.state.combatants[id]!,
    };
    if (pending === undefined) delete combatant.pendingMove;
    else combatant.pendingMove = pending;
    this.state = { ...this.state, combatants: { ...this.state.combatants, [id]: combatant } };
  }

  /** Run `work`, collecting every event it emits — the per-call sink (the `execute()` idiom, F-P1). */
  private collect<T>(work: () => T): { result: T; emitted: RuntimeEvent[] } {
    const emitted: RuntimeEvent[] = [];
    const sink = (event: RuntimeEvent) => {
      emitted.push(event);
    };
    this.runtime.events.on(sink);
    try {
      return { result: work(), emitted };
    } finally {
      this.runtime.events.off(sink);
    }
  }

  /** Move a combatant — `position` is readonly, so the combatant entry is replaced. */
  private place(id: string, at: Position): void {
    const combatant = this.state.combatants[id]!;
    this.state = {
      ...this.state,
      combatants: { ...this.state.combatants, [id]: { ...combatant, position: { x: at.x, y: at.y } } },
    };
  }

  /**
   * The one shape resolver (CA-G4): the executor's resolveTargets, the
   * validity gate's hasTarget, and target() statements all resolve shapes
   * here — once, combat-side. A burst resolves around `center`: the bound
   * target's position, or an `at` cell (DD-S8). Theater-of-mind: every shape
   * answers with the bound targets (the no-op discipline — spatial.html's
   * absent-column).
   */
  private resolveShape(
    shape: string,
    actor: CombatantState,
    center: Position | undefined,
    bound: CombatantState,
  ): readonly string[] {
    if (shape === 'self') return [actor.id]; // DD-A1: every pack, theater-of-mind included
    const geometry = this.runtime.spatial;
    if (!geometry.enabled) return [bound.id];
    if (shape === 'adjacent') {
      return this.state.order.filter((id) => {
        const other = this.state.combatants[id]!;
        return (
          other.side !== actor.side &&
          other.position !== undefined &&
          actor.position !== undefined &&
          reachOf(this.runtime, actor.id) !== undefined &&
          geometry.canReach(actor.position, other.position, reachOf(this.runtime, actor.id)!)
        );
      });
    }
    if (shape.startsWith('burst-')) {
      const radius = Number(shape.slice('burst-'.length));
      if (center === undefined) return [];
      const candidates: (readonly [string, Position])[] = [];
      for (const id of this.state.order) {
        const combatant = this.state.combatants[id]!;
        if (combatant.hp.current <= 0 || combatant.position === undefined) continue;
        candidates.push([id, combatant.position]);
      }
      return geometry.inBurst(center, radius, candidates);
    }
    return [];
  }

  /**
   * Spend the non-slot costs and record them (CA-S2): pool points into
   * `poolsSpent`, a vancian slot index into `slotsCast`; the live `pools` and
   * `boundSlots` decrement as before. A spell passes its pre-chosen slot; a
   * vancian action's slot is chosen here (DD-S18). Returns the slot consumed.
   */
  private applyNonSlotCosts(
    actor: CombatantState,
    cost: ActionCost,
    chosen?: CastSlot,
  ): CastSlot | undefined {
    if (cost.points !== undefined) {
      const { pool, amount } = cost.points;
      actor.pools = { ...actor.pools, [pool]: (actor.pools[pool] ?? 0) - amount };
      actor.poolsSpent = { ...actor.poolsSpent, [pool]: (actor.poolsSpent[pool] ?? 0) + amount };
    }
    if (cost.vancian === undefined) return undefined;
    const level = chosen?.level ?? String(cost.vancian);
    const index = chosen?.index ?? this.pickSlot(actor, level);
    actor.boundSlots = { ...actor.boundSlots, [level]: (actor.boundSlots[level] ?? 0) - 1 };
    if (index === undefined) return undefined;
    actor.slotsCast = { ...actor.slotsCast, [level]: [...(actor.slotsCast[level] ?? []), index] };
    return { level, index };
  }

  /**
   * DD-S18 — the slot index a vancian cost consumes at `level`: for a spell,
   * the lowest uncast index bound to it (count-only combatants have none);
   * for an action, the lowest uncast non-null binding, or — without bindings —
   * the lowest uncast index below the fight-start count.
   */
  private pickSlot(actor: CombatantState, level: string, spellId?: string): number | undefined {
    const cast = actor.slotsCast[level] ?? [];
    const bindings = actor.bindings === undefined ? undefined : (actor.bindings[level] ?? []);
    if (bindings !== undefined) {
      const index = bindings.findIndex(
        (binding, i) => !cast.includes(i) && (spellId === undefined ? binding !== null : binding === spellId),
      );
      return index === -1 ? undefined : index;
    }
    if (spellId !== undefined) return undefined;
    const start = (actor.boundSlots[level] ?? 0) + cast.length;
    for (let i = 0; i < start; i += 1) if (!cast.includes(i)) return i;
    return undefined;
  }

  private resolve(
    actor: CombatantState,
    actionId: string,
    def: ActionDef,
    target: CombatantState,
    {
      move,
      cast,
      at,
    }: {
      readonly move?: ((budget: number) => void) | undefined;
      /** A spell's `spell:cast` payload (DD-S17); absent for actions. */
      readonly cast?: Readonly<Record<string, unknown>> | undefined;
      /** An empty-cell burst's center (DD-S8): `action:resolved` carries it instead of `targetId`. */
      readonly at?: Position | undefined;
    },
  ): readonly RuntimeEvent[] {
    if (cast !== undefined) {
      // DD-S17: `spell:cast` precedes the effect's events, inside the declare's own collection.
      this.setClock();
      this.runtime.events.emit({
        type: 'spell:cast',
        actor: actor.id,
        ...(typeof cast['targetId'] === 'string' ? { target: cast['targetId'] } : {}),
        payload: cast,
        why: { rule: ruleBaseOf(this.runtime, actionId), rolls: [] },
      });
    }
    this.execute(
      actor,
      this.boundActionOf(actionId, def),
      target,
      ruleBaseOf(this.runtime, actionId),
      move,
      at,
    );
    this.state = { ...this.state, phase: 'resolved' };
    this.runtime.events.emit({
      type: 'action:resolved',
      actor: actor.id,
      payload: at !== undefined ? { actionId, at: { x: at.x, y: at.y } } : { actionId, targetId: target.id },
      why: { rule: `${ruleBaseOf(this.runtime, actionId)}`, rolls: [] },
    });
    this.endIfSideDefeated();
    return this.runtime.events.sinceRound(this.state.round);
  }

  /**
   * Run a bound effect for one target through the executor: mutations land on
   * state as `damage:applied` / `condition:applied`, attack verdicts as
   * `attack:rolled`, every event provenanced by `rule`. Returns the events it
   * emitted; the rng state is saved afterwards.
   */
  private execute(
    actor: CombatantState,
    boundAction: BoundAction,
    target: CombatantState,
    rule: string,
    move?: (budget: number) => void,
    at?: Position,
  ): RuntimeEvent[] {
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
      const outcomes = executeAgainst(
        boundAction,
        { id: actor.id, side: actor.side, profile: profileOf(actor) },
        { id: target.id, side: target.side, profile: profileOf(target) },
        this.rng,
        (request) => {
          // CA-G4: burst scopes reach ids outside the primary target — apply
          // each mutation to the combatant the executor named, not the bound
          // target. The attack gate stays: one action = one attack verdict.
          const subject = this.state.combatants[request.targetId] ?? target;
          const isDamage = request.kind === 'damage';
          if (isDamage && attackLanded === false) return; // onHit anatomy: gated damage never applies
          const hpBefore = subject.hp.current; // captured before the (possibly clamped) mutation
          applyMutation(this.runtime, subject, request);
          this.runtime.events.emit({
            type: isDamage ? 'damage:applied' : 'condition:applied',
            actor: actor.id,
            target: request.targetId,
            payload: isDamage
              ? {
                  amount: request.amount,
                  type: request.damageType,
                  hp: `${hpBefore}→${subject.hp.current}`,
                }
              : { conditionId: request.conditionId, duration: request.duration },
            why: { rule, rolls: request.rolls.map((roll) => displayRoll(roll)) },
          });
        },
        (shape) => this.resolveShape(shape, actor, at ?? target.position, target),
        move,
        (id) => {
          // DD-S19: every target a shape scope names saves and defends with its own values.
          const combatant = this.state.combatants[id];
          return combatant === undefined ? undefined : profileOf(combatant);
        },
      );
      // Attack outcomes are events too (attack:rolled) — one per target, with the verdict.
      // The executor nests statements in sequence/target/save wrappers; flatten first.
      for (const outcome of flattenResolutions(outcomes)) {
        if (outcome.kind === 'attack') {
          attackLanded = outcome.hit;
          this.runtime.events.emit({
            type: 'attack:rolled',
            actor: actor.id,
            target: outcome.targetId,
            payload: { actionId: boundAction.id, verdict: outcome.roll.verdict, total: outcome.roll.total },
            why: { rule: `${rule}.attackBonus`, rolls: [displayRoll(outcome.roll)] },
          });
        }
      }
    } finally {
      this.runtime.events.off(sink);
    }
    this.state = { ...this.state, rng: this.rng.getState() };
    return emitted;
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

  /**
   * Offer every matching reactive action to standing combatants (FR-13
   * substrate); none once the fight is over. Callers pass only the events
   * their own call emitted (per-call surfacing, F-P1), and an event already
   * surfaced is skipped, so each (reactor, event) pair is offered once.
   * Returns how many offers were raised. `feats: false` is the no-chain rule
   * (DD-S12): events a taken feat emitted offer reactive actions only.
   */
  private surfaceOffers(events: readonly RuntimeEvent[], options: { readonly feats?: boolean } = {}): number {
    if (this.state.phase === 'combat-over') return 0;
    let raised = 0;
    for (const event of events) {
      if (this.surfaced.has(event)) continue;
      this.surfaced.add(event);
      for (const offer of offersForEvent(this.runtime, this.state.combatants, event, options)) {
        if (isDowned(this.state.combatants[offer.actorId]!)) continue;
        this.pendingTriggers.push(offer);
        emitOffer(this.runtime, offer, this.offerCounter);
        this.offerCounter += 1;
        raised += 1;
      }
    }
    return raised;
  }

  /** Resolve a taken trigger through the same pipeline as a declared action (FR-4, FR-12 proof 2). */
  private resolveReactive(offer: PendingTrigger, targetId: string | undefined): readonly RuntimeEvent[] {
    const reactor = this.state.combatants[offer.actorId]!;
    const def = this.runtime.pack.actions[offer.actionId]!;
    const restriction = this.restrictionRejection(reactor, def);
    if (restriction !== undefined) {
      return [this.rejectionEvent(reactor.id, restriction)];
    }
    if (isSelfAction(this.runtime, offer.actionId)) {
      // DD-A2: a self reaction binds its reactor — no opponent resolution, no reach gate.
      const refusal = selfTargetRefusal(offer.actionId, reactor.id, targetId);
      if (refusal !== undefined) return [this.rejectionEvent(reactor.id, refusal)];
      return this.resolveReactiveAgainst(offer, def, reactor, reactor);
    }
    const target = this.resolveTarget(reactor, targetId);
    if ('rejection' in target) {
      return [this.rejectionEvent(reactor.id, target.rejection)];
    }
    const spatial = this.spatialGate(reactor, target.combatant);
    if (spatial !== undefined) {
      return [this.rejectionEvent(reactor.id, spatial)];
    }
    return this.resolveReactiveAgainst(offer, def, reactor, target.combatant);
  }

  /** The cost gates, spend and resolution of a taken reaction whose target is bound. */
  private resolveReactiveAgainst(
    offer: PendingTrigger,
    def: ActionDef,
    reactor: CombatantState,
    target: CombatantState,
  ): readonly RuntimeEvent[] {
    const costRejection = checkCost(def.cost, this.grants, balancesOf(reactor));
    if (costRejection !== undefined) {
      return [this.rejectionEvent(reactor.id, costRejection)];
    }
    const spendRejection = spend(reactor.slots, this.grants, def.cost);
    if (spendRejection !== undefined) {
      return [this.rejectionEvent(reactor.id, spendRejection)];
    }
    this.applyNonSlotCosts(reactor, def.cost);
    const { result: events, emitted } = this.collect(() =>
      this.resolve(reactor, offer.actionId, def, target, {}),
    );
    this.surfaceOffers(emitted);
    return events;
  }

  /**
   * Take a reactive feat (DD-S12): feats declare no cost and pass no
   * restriction or reach gate; the parse-once effect runs with the holder as
   * its target and `why.rule` `content.feats.<id>`. A `targetId` other than
   * the holder is `invalid-target` (the offer has still left the queue).
   * Events it emits never offer feats — the no-chain rule.
   */
  private resolveFeat(offer: PendingTrigger, targetId: string | undefined): readonly RuntimeEvent[] {
    const holder = this.state.combatants[offer.actorId]!;
    if (targetId !== undefined && targetId !== holder.id) {
      return [
        this.rejectionEvent(holder.id, {
          kind: 'invalid-target',
          rule: 'E-REF-01',
          resource: targetId,
          message: `feat "${offer.actionId}" acts on its holder "${holder.id}" only (DD-S12).`,
        }),
      ];
    }
    const feat = this.runtime.pack.content.feats?.[offer.actionId];
    const ast = this.runtime.index.featEffects[offer.actionId];
    if (feat?.effect === undefined || ast === undefined) return [];
    const emitted = this.execute(
      holder,
      { id: offer.actionId, def: { cost: {}, effect: feat.effect }, ast },
      holder,
      `content.feats.${offer.actionId}`,
    );
    this.endIfSideDefeated();
    this.surfaceOffers(emitted, { feats: false });
    return emitted;
  }

  /** A reactive action resolving outside the declare flow (host took a trigger offer). */
  declareReactive(offer: PendingTrigger, targetId: string | undefined): readonly RuntimeEvent[] {
    return this.resolveReactive(offer, targetId);
  }

  /** A declared id's bound action: its parse-once AST from the action index, else the spell index (CA-S1). */
  private boundActionOf(actionId: string, def: ActionDef): BoundAction {
    const ast = this.runtime.index.actionEffects[actionId] ?? this.runtime.index.spellEffects[actionId];
    if (ast === undefined) {
      throw new Error(
        `action "${actionId}" has no parse-once AST — Runtime load compiles every action (CA-2)`,
      );
    }
    return { id: actionId, def, ast };
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

/** The `spell:cast` payload (DD-S17): the spell, its aim, and what the cast spent. */
function castPayload(
  spellId: string,
  cost: ActionCost,
  aim: { readonly targetId: string } | { readonly at: Position },
  slot: CastSlot | undefined,
): Record<string, unknown> {
  return {
    spellId,
    ...aim,
    cost: cost.vancian !== undefined ? 'vancian' : cost.points !== undefined ? 'points' : 'none',
    ...(slot !== undefined ? { slotLevel: slot.level, slotIndex: slot.index } : {}),
    ...(cost.points !== undefined ? { pool: cost.points.pool, amount: cost.points.amount } : {}),
  };
}

/** Move statements evaluate their dice-free budget without consuming the fight's dice (DD-M8). */
const ZERO_RNG: RandomSource = { int: () => 0 };

/** A move action's budget formula: the argument of a root `move(...)` statement; `undefined` = not a move action. */
export function moveBudgetAst(runtime: Runtime, actionId: string): FormulaAst | undefined {
  const ast = runtime.index.actionEffects[actionId];
  return ast?.kind === 'call' && ast.text === 'move' ? ast.args?.[0] : undefined;
}

/** A self action (v1.7, DD-A2): an action whose parse-once effect root is `target(self, …)`. Spells are never self actions. */
export function isSelfAction(runtime: Runtime, actionId: string): boolean {
  const ast = runtime.index.actionEffects[actionId];
  const shape = ast?.kind === 'call' && ast.text === 'target' ? ast.args?.[0] : undefined;
  return shape?.kind === 'name' && shape.text === 'self';
}

/** A self action names no target but its actor (DD-A2): any other `targetId` is `invalid-target`. */
function selfTargetRefusal(
  actionId: string,
  actorId: string,
  targetId: string | undefined,
): DeclareRejection | undefined {
  if (targetId === undefined || targetId === actorId) return undefined;
  return {
    kind: 'invalid-target',
    rule: 'E-REF-01',
    resource: targetId,
    message: `"${actionId}" is a self action — it targets its actor "${actorId}" only (DD-A2).`,
  };
}

/** Re-exported from the leaf so the runtime barrel keeps `displayRoll` where it was. */
export { displayRoll };

/** Moved to the pure combatant leaf; re-exported where tests and snapshots import them. */
export { isDowned, defeatedSide, combatantFeats, copyBindings };

/** A convenience alias for CombatState's rng — re-exported for the snapshot seam (S06). */
export type { SlotLedger, SlotGrants };
export { replenish };
