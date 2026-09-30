/**
 * The optional spatial layer (FR-11): positions, adjacency, reach, and the v1
 * shape set (single + burst; cone/line are deferred engine geometry, never
 * faked in data). Packs without a spatial model pay nothing — the no-op
 * geometry answers every shape with the combat's bound targets and rejects no
 * declares (theater-of-mind discipline, spatial.html).
 *
 * Positions are host-declared per combatant (the engine never invents a grid);
 * the reach model is pack data via the pack's `spatial` section. The pack
 * declares `{model:'grid', reach:{default, <id>: n, ...}, shapes?}` (the v1.3
 * contract, spatial.html verbatim); `spatialFromPack`/`packSpatialModel` are
 * the one adapter edge that splits that inline reach map into the internal
 * `SpatialModel` — pack keys (`default` + sibling overrides) vs internal keys
 * (`defaultReach`/`reachOverrides`), CA-G1.
 * Race `size` is a documented no-op for v1 adjacency (DB v1.1 rider, D6).
 *
 * v1.5 (grid-movement): `model` selects the geometry — `grid` is the square
 * grid (Chebyshev, 8 neighbors, a diagonal step costs 1), `hex` reuses `{x, y}`
 * as axial `{q, r}` (6 neighbors in the fixed order DD-M2). `findPath` is the
 * one movement pather: region-bounded exact Dijkstra over host-placed terrain
 * (DD-M9/DD-M18); `canReach` keeps its `max(reach, defaultReach)` semantics on
 * both models (DD-M14).
 */
import type { SpatialDef, TerrainKind } from '../../schema/pack';

/** A combatant's position — pack-neutral integers; the host may use any grid. */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/** The combat loop's internal reach model — the adapted form of the pack declaration. */
export interface SpatialModel {
  readonly defaultReach: number;
  /** Per-combatant reach overrides keyed by combatant or artifact id. */
  readonly reachOverrides?: Readonly<Record<string, number>>;
}

/** Geometry the combat loop consults; absent model = theater-of-mind no-op. */
export interface SpatialGeometry {
  readonly enabled: boolean;
  /** The pack's declared model; absent in theater of mind. */
  readonly model?: 'grid' | 'hex';
  /** Distance in steps between two positions (grid: Chebyshev; hex: axial). */
  distance(a: Position, b: Position): number;
  /** Whether `from` may melee `to` under the model's reach rules. */
  canReach(from: Position, to: Position, reach: number): boolean;
  /** All positions within a burst radius of the center (FR-11's burst shape). */
  inBurst(
    center: Position,
    radius: number,
    candidates: readonly (readonly [string, Position])[],
  ): readonly string[];
  /** v1.5 — adjacent cells in the fixed tie-break order (DD-M2/DD-M4); theater = []. */
  neighbors(p: Position): readonly Position[];
}

/** The no-op: packs without positions never fail a spatial check. */
export const theaterOfMind: SpatialGeometry = {
  enabled: false,
  distance: () => 0,
  canReach: () => true,
  inBurst: (_center, _radius, candidates) => candidates.map(([id]) => id),
  neighbors: () => [],
};

/** Square neighbors, counter-clockwise from east (the hex order's rotation, extended to 8). */
const GRID_STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** Axial hex neighbors in the fixed order DD-M2 pins. */
const HEX_STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

function stepsFrom(p: Position, steps: readonly (readonly [number, number])[]): readonly Position[] {
  return steps.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }));
}

/** A square-grid geometry: Chebyshev distance, reach in grid steps. */
export function gridGeometry(model: SpatialModel): SpatialGeometry {
  return {
    enabled: true,
    model: 'grid',
    distance: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
    canReach: (from, to, reach) =>
      Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) <= Math.max(reach, model.defaultReach),
    inBurst: (center, radius, candidates) =>
      candidates
        .filter(
          ([, position]) =>
            Math.max(Math.abs(position.x - center.x), Math.abs(position.y - center.y)) <= radius,
        )
        .map(([id]) => id),
    neighbors: (p) => stepsFrom(p, GRID_STEPS),
  };
}

/** Axial hex distance: `(|dq| + |dr| + |dq + dr|) / 2` (DD-M2). */
function hexDistance(a: Position, b: Position): number {
  const dq = a.x - b.x;
  const dr = a.y - b.y;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** An axial hex geometry (v1.5): hex distance; reach mirrors grid's `max(reach, defaultReach)` (DD-M14). */
export function hexGeometry(model: SpatialModel): SpatialGeometry {
  return {
    enabled: true,
    model: 'hex',
    distance: hexDistance,
    canReach: (from, to, reach) => hexDistance(from, to) <= Math.max(reach, model.defaultReach),
    inBurst: (center, radius, candidates) =>
      candidates.filter(([, position]) => hexDistance(position, center) <= radius).map(([id]) => id),
    neighbors: (p) => stepsFrom(p, HEX_STEPS),
  };
}

/**
 * The pack→internal adapter edge (CA-G1): split the declared inline reach map
 * — `default` becomes `defaultReach`, every sibling key becomes a
 * `reachOverrides` entry. `undefined` = theater of mind (FR-11): the pack's
 * own `{defaultReach, reachOverrides}` anatomy is never read as pack data.
 */
export function spatialFromPack(pack: { spatial?: SpatialDef }): SpatialGeometry {
  const model = packSpatialModel(pack);
  if (model === undefined) return theaterOfMind;
  return pack.spatial?.model === 'hex' ? hexGeometry(model) : gridGeometry(model);
}

/** The typed edge combat consumes: `undefined` = theater of mind (the pack declares no spatial model). */
export function packSpatialModel(pack: { spatial?: SpatialDef }): SpatialModel | undefined {
  const declared = pack.spatial;
  if (declared === undefined) return undefined;
  const { default: defaultReach, ...reachOverrides } = declared.reach;
  return { defaultReach, ...(Object.keys(reachOverrides).length > 0 ? { reachOverrides } : {}) };
}

/**
 * The typed spatial rejection, carrying the registered `E-SPAT-01` rule id
 * ("pack declares spatial geometry the engine does not ship / spatial gate
 * rejection" — v1.3 registry, additive minor). Faces: load-time validation of
 * unshippable geometry (the pack validator) and play-time spatial-gate
 * rejection ("out of reach", the combat loop) — one id, both mappings.
 */
export interface SpatialRejection {
  readonly kind: 'spatial';
  readonly rule: 'E-SPAT-01';
  readonly resource: string;
  readonly message: string;
  readonly hint?: string;
}

/** Adjacency/reach check at declare time; only meaningful in a spatial pack. */
export function checkReach(
  geometry: SpatialGeometry,
  from: { position?: Position; reach?: number },
  to: { id: string; position?: Position },
  defaultReach: number,
): SpatialRejection | undefined {
  if (!geometry.enabled) return undefined;
  if (from.position === undefined || to.position === undefined) {
    return {
      kind: 'spatial',
      rule: 'E-SPAT-01',
      resource: to.id,
      message: `this pack declares a spatial model, but combatant positions are missing (from: ${from.position === undefined ? 'absent' : 'set'}, target ${to.id}: ${to.position === undefined ? 'absent' : 'set'}).`,
    };
  }
  if (!geometry.canReach(from.position, to.position, from.reach ?? defaultReach)) {
    return {
      kind: 'spatial',
      rule: 'E-SPAT-01',
      resource: to.id,
      message: `action requires a target within reach ${from.reach ?? defaultReach}; nearest ${to.id} is ${geometry.distance(from.position, to.position)} away. Spatial rules are pack-declared (FR-11) — this pack opted in.`,
    };
  }
  return undefined;
}

/** A host-placed terrain cell (v1.5): `kind` names an entry of the pack's `spatial.terrain` vocabulary. */
export interface TerrainCell {
  readonly at: Position;
  readonly kind: string;
}

/** One movement path request (DD-M9): the pack vocabulary, the host placement, and occupancy. */
export interface PathQuery {
  readonly from: Position;
  readonly to: Position;
  readonly budget: number;
  /** The pack's terrain vocabulary (`spatial.terrain`). */
  readonly terrain: Readonly<Record<string, TerrainKind>>;
  /** The host placement for this fight. */
  readonly cells: readonly TerrainCell[];
  /** Every combatant position — bounds the search region. */
  readonly occupied: readonly Position[];
  /** Whether the mover may pass through `p` (not a standing enemy). */
  readonly passable: (p: Position) => boolean;
  /** Whether the move may end on `p` (no standing combatant — the mover included, F-P10a). */
  readonly endable: (p: Position) => boolean;
}

export type PathResult =
  | { ok: true; path: readonly Position[]; cost: number }
  | { ok: false; kind: 'blocked' | 'occupied' | 'unreachable' | 'out-of-range'; cost?: number };

/** A movement-gate rejection (v1.5): one `declare:rejected`, rule E-SPAT-01, nothing changes (DD-M9). */
export interface MoveRejection {
  readonly kind: 'no-destination' | 'blocked' | 'occupied' | 'unreachable' | 'out-of-range';
  readonly rule: 'E-SPAT-01';
  readonly resource: string;
  readonly message: string;
}

function cellKey(p: Position): string {
  return `${p.x},${p.y}`;
}

/** The host placement as a lookup: the placed kind at `p`, `undefined` = plain. An undeclared kind throws (startCombat/restore refuse it first). */
export function terrainAt(
  terrain: Readonly<Record<string, TerrainKind>>,
  cells: readonly TerrainCell[],
): (p: Position) => TerrainKind | undefined {
  const kinds = new Map<string, string>();
  for (const cell of cells) kinds.set(cellKey(cell.at), cell.kind);
  return (p) => {
    const kind = kinds.get(cellKey(p));
    if (kind === undefined) return undefined;
    const declared = terrain[kind];
    if (declared === undefined) {
      throw new Error(
        `terrain kind "${kind}" is not declared — startCombat/restore refuse unknown kinds (E-SPAT-01)`,
      );
    }
    return declared;
  };
}

/** Movement points to enter a cell of `kind` (plain = 1); `undefined` = a blocking cell, never entered. */
export function entryCost(kind: TerrainKind | undefined): number | undefined {
  if (kind === undefined) return 1;
  return 'cost' in kind ? kind.cost : undefined;
}

/**
 * The cheapest legal path from `from` to `to` (DD-M9, DD-M18). Entering a cell
 * costs its terrain kind's `cost` (plain = 1); a `blocks` cell is never
 * entered, nor is a cell `passable` rejects. Deterministic Dijkstra: the
 * frontier is ordered by (cost, insertion sequence) and neighbors expand in
 * `geometry.neighbors()` order, so ties go to the fixed neighbor order.
 *
 * Why the search region is exact (DD-M18): the region is the axis-aligned
 * box of `from`, `to`, every placed cell and every occupied position,
 * expanded by 1 on every side. Outside the original box every cell is plain,
 * unoccupied and unblocked. Clamping coordinates into the expanded box maps
 * each neighbor step to a neighbor step (or to staying put) under both the
 * 8-neighbor square set and the 6-neighbor axial set, and never raises a
 * step's cost — so any path that leaves the region clamps to a legal path
 * inside it that costs no more. The search therefore runs with no cost cutoff
 * over the region and is exact for reachability and cheapest cost; it is
 * never pruned by budget, because `out-of-range` must report the true cost.
 *
 * Classification: `to` blocking → `blocked`; `!endable(to)` → `occupied`;
 * not reached → `unreachable`; cheapest cost > budget → `out-of-range`.
 */
export function findPath(geometry: SpatialGeometry, query: PathQuery): PathResult {
  const kindAt = terrainAt(query.terrain, query.cells);
  const blocks = (p: Position): boolean => entryCost(kindAt(p)) === undefined;

  if (blocks(query.to)) return { ok: false, kind: 'blocked' };
  if (!query.endable(query.to)) return { ok: false, kind: 'occupied' };

  const points = [query.from, query.to, ...query.cells.map((cell) => cell.at), ...query.occupied];
  const minX = Math.min(...points.map((p) => p.x)) - 1;
  const maxX = Math.max(...points.map((p) => p.x)) + 1;
  const minY = Math.min(...points.map((p) => p.y)) - 1;
  const maxY = Math.max(...points.map((p) => p.y)) + 1;
  const inRegion = (p: Position): boolean => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;

  const best = new Map<string, number>([[cellKey(query.from), 0]]);
  const previous = new Map<string, Position>();
  const settled = new Set<string>();
  const frontier = new Frontier();
  frontier.push(query.from, 0);
  const target = cellKey(query.to);
  for (let next = frontier.pop(); next !== undefined; next = frontier.pop()) {
    const key = cellKey(next.at);
    if (settled.has(key)) continue;
    settled.add(key);
    if (key === target) break;
    for (const neighbor of geometry.neighbors(next.at)) {
      const neighborKey = cellKey(neighbor);
      if (settled.has(neighborKey) || !inRegion(neighbor)) continue;
      if (blocks(neighbor) || !query.passable(neighbor)) continue;
      const cost = next.cost + entryCost(kindAt(neighbor))!;
      const known = best.get(neighborKey);
      if (known !== undefined && known <= cost) continue;
      best.set(neighborKey, cost);
      previous.set(neighborKey, next.at);
      frontier.push(neighbor, cost);
    }
  }

  const cost = best.get(target);
  if (cost === undefined || !settled.has(target)) return { ok: false, kind: 'unreachable' };
  if (cost > query.budget) return { ok: false, kind: 'out-of-range', cost };
  const path: Position[] = [];
  for (let at: Position | undefined = query.to; at !== undefined && cellKey(at) !== cellKey(query.from);) {
    path.unshift(at);
    at = previous.get(cellKey(at));
  }
  return { ok: true, path, cost };
}

/** A binary min-heap on (cost, insertion sequence) — the deterministic Dijkstra frontier. */
class Frontier {
  private readonly heap: { at: Position; cost: number; seq: number }[] = [];
  private seq = 0;

  push(at: Position, cost: number): void {
    this.heap.push({ at, cost, seq: this.seq });
    this.seq += 1;
    let index = this.heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(index, parent)) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  pop(): { at: Position; cost: number } | undefined {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (top === undefined || last === undefined) return undefined;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.heap.length && this.before(left, smallest)) smallest = left;
        if (right < this.heap.length && this.before(right, smallest)) smallest = right;
        if (smallest === index) break;
        this.swap(index, smallest);
        index = smallest;
      }
    }
    return top;
  }

  private before(a: number, b: number): boolean {
    const [x, y] = [this.heap[a]!, this.heap[b]!];
    return x.cost < y.cost || (x.cost === y.cost && x.seq < y.seq);
  }

  private swap(a: number, b: number): void {
    [this.heap[a], this.heap[b]] = [this.heap[b]!, this.heap[a]!];
  }
}
