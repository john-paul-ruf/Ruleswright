/**
 * Movement (v1.5, FR-11): a move action — an action whose parse-once effect
 * root is `move(<formula>)` — targets its actor, passes the movement gate
 * (destination + cheapest legal path within the budget, DD-M9) where other
 * actions pass the reach gate, and walks the planned path through
 * `apply.move`, emitting `move:advanced` / `move:ended`. Theater-of-mind packs
 * resolve it as a no-op (DD-M11). Terrain is host-placed per fight.
 */
import type { RandomSource } from '../../core/rng';
import type { Runtime } from '../runtime';
import type { RuntimeEvent } from '../events';
import type { ErrorCard } from '../../schema/error-card';
import { evalFormula, valueOfFormula, type FormulaAst } from '../../core/dsl/formula';
import { ruleCard } from '../errors';
import { effectVars } from './resolve';
import { entryCost, findPath, terrainAt, type Position, type TerrainCell } from './spatial';
import { isDowned, profileOf, reachOf, ruleBaseOf } from './combatants';
import { restrictionRejection } from './declare';
import type { FightCore } from './fight';
import type { CombatantState, DeclareRejection, PendingMove } from './types';

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

/** `step()` while a move is paused forfeits it (`move:ended {reason: 'forfeited'}`) before its usual effect (DD-M10). */
export function forfeitMove(core: FightCore): void {
  const pending = core.state.combatants[core.state.active]?.pendingMove;
  if (pending === undefined) return;
  core.setClock();
  endMove(core, core.state.active, pending.actionId, 'forfeited');
}

/**
 * The movement gate (DD-M9), where the reach gate runs for other actions:
 * the destination, then the cheapest legal path within the budget. The
 * budget is the move statement's dice-free formula over the same actor vars
 * the executor binds (`speed` included), evaluated without RNG. A passable
 * cell holds no standing enemy; an endable cell holds no standing combatant,
 * the mover included (DD-M6). Theater packs: a no-op walk, no gate (DD-M11).
 */
export function movementGate(
  core: FightCore,
  actor: CombatantState,
  actionId: string,
  budgetAst: FormulaAst,
  to: Position | undefined,
): { move: (budget: number) => void } | { rejection: DeclareRejection } {
  const geometry = core.runtime.spatial;
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
  const plan = findPath(geometry, pathQuery(core, actor, from, to, budget));
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
  return { move: (walked) => walk(core, actor.id, actionId, to, plan.path, walked) };
}

/** The path request for a mover, against the fight's current occupancy and terrain. */
export function pathQuery(
  core: FightCore,
  mover: CombatantState,
  from: Position,
  to: Position,
  budget: number,
) {
  const standing = Object.values(core.state.combatants).filter(
    (combatant) => !isDowned(combatant) && combatant.position !== undefined,
  );
  const at = (p: Position) => (combatant: CombatantState) =>
    combatant.position!.x === p.x && combatant.position!.y === p.y;
  return {
    from,
    to,
    budget,
    terrain: core.runtime.pack.spatial?.terrain ?? {},
    cells: core.state.terrain,
    occupied: Object.values(core.state.combatants).flatMap((combatant) =>
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
export function walk(
  core: FightCore,
  moverId: string,
  actionId: string,
  to: Position,
  path: readonly Position[],
  budget: number,
  resumed = false,
): void {
  const from = core.state.combatants[moverId]!.position!;
  const kindAt = terrainAt(core.runtime.pack.spatial?.terrain ?? {}, core.state.terrain);
  const why = { rule: ruleBaseOf(core.runtime, actionId), rolls: [] };
  const walked: Position[] = [];
  let cost = 0;
  let at = from;
  const advanced = () => {
    if (walked.length === 0) return;
    core.runtime.events.emit({
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
    const threateners = resumed && index === 0 ? [] : threatenersLeft(core, moverId, at, next);
    for (const threatener of threateners) {
      const leaving = core.runtime.events.emit({
        type: 'move:leaving-reach',
        actor: moverId,
        target: threatener,
        payload: { at: { ...at }, next: { ...next } },
        why,
      });
      offers += core.surfaceOffers([leaving]);
    }
    if (offers > 0) {
      place(core, moverId, at);
      advanced();
      setPendingMove(core, moverId, { actionId, to: { x: to.x, y: to.y }, remaining: budget - cost });
      return;
    }
    cost += entryCost(kindAt(next))!;
    walked.push(next);
    at = next;
  }
  place(core, moverId, at);
  advanced();
  endMove(core, moverId, actionId, 'arrived');
}

/** Standing opponents with a position whose reach covers `at` but not `next` — the leaving-reach threateners, in initiative order. */
export function threatenersLeft(
  core: FightCore,
  moverId: string,
  at: Position,
  next: Position,
): readonly string[] {
  const geometry = core.runtime.spatial;
  const mover = core.state.combatants[moverId]!;
  return core.state.order.filter((id) => {
    const other = core.state.combatants[id]!;
    if (other.side === mover.side || isDowned(other) || other.position === undefined) return false;
    const reach = reachOf(core.runtime, id) ?? 1;
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
export function resumeMove(core: FightCore): readonly RuntimeEvent[] {
  const moverId = core.state.active;
  const mover = core.state.combatants[moverId];
  const pending = mover?.pendingMove;
  if (mover === undefined || pending === undefined) return [];
  core.setClock();
  const { emitted } = core.collect(() => {
    if (isDowned(mover)) return endMove(core, moverId, pending.actionId, 'downed');
    const def = core.runtime.pack.actions[pending.actionId]!;
    if (restrictionRejection(core.runtime, mover, def) !== undefined) {
      return endMove(core, moverId, pending.actionId, 'restricted');
    }
    const from = mover.position!;
    const plan = findPath(core.runtime.spatial, pathQuery(core, mover, from, pending.to, pending.remaining));
    if (!plan.ok) return endMove(core, moverId, pending.actionId, 'blocked');
    setPendingMove(core, moverId, undefined);
    walk(core, moverId, pending.actionId, pending.to, plan.path, pending.remaining, true);
  });
  core.surfaceOffers(emitted);
  return emitted;
}

/** End a move: clear any `pendingMove` and emit `move:ended {reason, at}`. */
export function endMove(
  core: FightCore,
  moverId: string,
  actionId: string,
  reason: 'arrived' | 'downed' | 'restricted' | 'blocked' | 'forfeited',
): void {
  setPendingMove(core, moverId, undefined);
  const at = core.state.combatants[moverId]!.position!;
  core.runtime.events.emit({
    type: 'move:ended',
    actor: moverId,
    payload: { reason, at: { ...at } },
    why: { rule: ruleBaseOf(core.runtime, actionId), rolls: [] },
  });
}

/** Set or clear a combatant's `pendingMove` — the combatant entry is replaced, like `place`. */
export function setPendingMove(core: FightCore, id: string, pending: PendingMove | undefined): void {
  const combatant: { -readonly [K in keyof CombatantState]: CombatantState[K] } = {
    ...core.state.combatants[id]!,
  };
  if (pending === undefined) delete combatant.pendingMove;
  else combatant.pendingMove = pending;
  core.state = { ...core.state, combatants: { ...core.state.combatants, [id]: combatant } };
}

/** Move a combatant — `position` is readonly, so the combatant entry is replaced. */
export function place(core: FightCore, id: string, at: Position): void {
  const combatant = core.state.combatants[id]!;
  core.state = {
    ...core.state,
    combatants: { ...core.state.combatants, [id]: { ...combatant, position: { x: at.x, y: at.y } } },
  };
}

/** Move statements evaluate their dice-free budget without consuming the fight's dice (DD-M8). */
const ZERO_RNG: RandomSource = { int: () => 0 };

/** A move action's budget formula: the argument of a root `move(...)` statement; `undefined` = not a move action. */
export function moveBudgetAst(runtime: Runtime, actionId: string): FormulaAst | undefined {
  const ast = runtime.index.actionEffects[actionId];
  return ast?.kind === 'call' && ast.text === 'move' ? ast.args?.[0] : undefined;
}

/** Cost-bounded flood fill; the policy cap also bounds work through occupied cells. */
export function movementDestinations(
  core: FightCore,
  actor: CombatantState,
  actionId: string,
  limit: number,
) {
  const ast = moveBudgetAst(core.runtime, actionId);
  const positions: Position[] = [];
  if (!ast || !core.runtime.spatial.enabled || !actor.position) return { positions, exhausted: false };
  const profile = profileOf(actor);
  const budget = valueOfFormula(evalFormula(ast, effectVars(profile, profile), ZERO_RNG));
  const query = pathQuery(core, actor, actor.position, actor.position, budget);
  const kindAt = terrainAt(query.terrain, query.cells);
  const key = (p: Position) => `${p.x},${p.y}`;
  const visited = new Set<string>();
  const frontier = [{ at: actor.position, cost: 0 }];
  const best = new Map([[key(actor.position), 0]]);
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const next = frontier.shift()!;
    if (visited.has(key(next.at))) continue;
    if (visited.size > limit) return { positions, exhausted: true };
    visited.add(key(next.at));
    if (query.endable(next.at)) positions.push(next.at);
    for (const at of core.runtime.spatial.neighbors(next.at)) {
      if (!Number.isSafeInteger(at.x) || !Number.isSafeInteger(at.y) || !query.passable(at)) continue;
      const cost = entryCost(kindAt(at));
      if (cost === undefined || cost + next.cost > budget) continue;
      const total = cost + next.cost;
      if ((best.get(key(at)) ?? Infinity) <= total) continue;
      best.set(key(at), total);
      frontier.push({ at, cost: total });
    }
  }
  return { positions, exhausted: false };
}
