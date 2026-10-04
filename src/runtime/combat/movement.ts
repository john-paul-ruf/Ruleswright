import type { RandomSource } from '../../core/rng';
import type { Runtime } from '../runtime';
import type { ErrorCard } from '../../schema/error-card';
import type { FormulaAst } from '../../core/dsl/formula';
import { ruleCard } from '../errors';
import { entryCost, type Position, type TerrainCell } from './spatial';
import { isDowned, reachOf, ruleBaseOf } from './combatants';
import type { FightCore } from './fight';
import type { CombatantState, PendingMove } from './types';

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
export const ZERO_RNG: RandomSource = { int: () => 0 };

/** A move action's budget formula: the argument of a root `move(...)` statement; `undefined` = not a move action. */
export function moveBudgetAst(runtime: Runtime, actionId: string): FormulaAst | undefined {
  const ast = runtime.index.actionEffects[actionId];
  return ast?.kind === 'call' && ast.text === 'move' ? ast.args?.[0] : undefined;
}
