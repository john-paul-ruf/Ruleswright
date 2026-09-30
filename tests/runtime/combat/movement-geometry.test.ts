/**
 * grid-movement S03 ck1 — CA-M1 geometry + pathing units: hex distance,
 * neighbor orders, hex reach/burst, the model dispatch that closes the
 * S02 → S03 coverage window, and `findPath` (region-bounded exact Dijkstra,
 * DD-M18) with every failure kind — including the F-P9 wall detour whose
 * true cost exceeds both the budget and `distance × maxCost`.
 */
import { describe, expect, it } from 'vitest';
import {
  findPath,
  gridGeometry,
  hexGeometry,
  spatialFromPack,
  theaterOfMind,
  type PathQuery,
  type Position,
  type SpatialGeometry,
  type TerrainCell,
} from '../../../src/runtime/combat/spatial';

const MODEL = { defaultReach: 1 };
const grid = gridGeometry(MODEL);
const hex = hexGeometry(MODEL);
const TERRAIN = { wall: { blocks: true }, mire: { cost: 2 } } as const;

function cells(kind: string, at: readonly (readonly [number, number])[]): TerrainCell[] {
  return at.map(([x, y]) => ({ at: { x, y }, kind }));
}

function query(from: Position, to: Position, budget: number, placed: readonly TerrainCell[] = []): PathQuery {
  return {
    from,
    to,
    budget,
    terrain: TERRAIN,
    cells: placed,
    occupied: [from],
    passable: () => true,
    endable: (p) => p.x !== from.x || p.y !== from.y,
  };
}

/** The F-P9 wall: blocking cells at x=1 (grid) / q=1 (hex) for y in -3..3. */
const WALL = cells(
  'wall',
  [-3, -2, -1, 0, 1, 2, 3].map((y) => [1, y] as const),
);

describe('hex geometry (CA-M1, DD-M2)', () => {
  it('hex distance matches the known table', () => {
    expect(hex.distance({ x: 0, y: 0 }, { x: 2, y: -1 })).toBe(2);
    expect(hex.distance({ x: 0, y: 0 }, { x: -3, y: 3 })).toBe(3);
    expect(hex.distance({ x: 1, y: -2 }, { x: -1, y: 1 })).toBe(3);
  });

  it('the 6 hex neighbors come in the pinned order', () => {
    expect(hex.neighbors({ x: 0, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: -1 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
    ]);
    for (const neighbor of hex.neighbors({ x: 2, y: -3 }))
      expect(hex.distance({ x: 2, y: -3 }, neighbor)).toBe(1);
  });

  it('the 8 grid neighbors, counter-clockwise from east, all at distance 1', () => {
    expect(grid.neighbors({ x: 0, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: -1 },
      { x: 0, y: -1 },
      { x: -1, y: -1 },
      { x: -1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    for (const neighbor of grid.neighbors({ x: 4, y: 4 }))
      expect(grid.distance({ x: 4, y: 4 }, neighbor)).toBe(1);
  });

  it('hex burst radius 1 covers exactly 7 cells', () => {
    const candidates: (readonly [string, Position])[] = [];
    for (let x = -3; x <= 3; x += 1) {
      for (let y = -3; y <= 3; y += 1) candidates.push([`${x},${y}`, { x, y }]);
    }
    expect(hex.inBurst({ x: 0, y: 0 }, 1, candidates)).toHaveLength(7);
    expect(grid.inBurst({ x: 0, y: 0 }, 1, candidates)).toHaveLength(9);
  });

  it('hex reach and adjacency use hex distance and keep the max(reach, defaultReach) rule (DD-M14)', () => {
    expect(hex.canReach({ x: 0, y: 0 }, { x: 1, y: -1 }, 1)).toBe(true);
    // (1,1) is a square diagonal but two hex steps away.
    expect(grid.canReach({ x: 0, y: 0 }, { x: 1, y: 1 }, 1)).toBe(true);
    expect(hex.canReach({ x: 0, y: 0 }, { x: 1, y: 1 }, 1)).toBe(false);
    expect(hex.canReach({ x: 0, y: 0 }, { x: 1, y: 1 }, 2)).toBe(true);
    // An override below the default never shrinks reach (preserved quirk, F-M2).
    expect(hexGeometry({ defaultReach: 2 }).canReach({ x: 0, y: 0 }, { x: 1, y: 1 }, 1)).toBe(true);
  });

  it('spatialFromPack dispatches on model (closes the S02 → S03 coverage window)', () => {
    expect(spatialFromPack({ spatial: { model: 'hex', reach: { default: 1 } } }).model).toBe('hex');
    expect(spatialFromPack({ spatial: { model: 'grid', reach: { default: 1 } } }).model).toBe('grid');
    const hexFromPack = spatialFromPack({ spatial: { model: 'hex', reach: { default: 1 } } });
    expect(hexFromPack.distance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(2);
    expect(spatialFromPack({})).toBe(theaterOfMind);
    expect(theaterOfMind.neighbors({ x: 0, y: 0 })).toEqual([]);
  });
});

describe('findPath (CA-M1, DD-M9/DD-M18)', () => {
  it('a plain path ties to the fixed neighbor order', () => {
    expect(findPath(grid, query({ x: 0, y: 0 }, { x: 2, y: 0 }, 5))).toEqual({
      ok: true,
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      cost: 2,
    });
    expect(findPath(hex, query({ x: 0, y: 0 }, { x: 2, y: -1 }, 5))).toEqual({
      ok: true,
      path: [
        { x: 1, y: 0 },
        { x: 2, y: -1 },
      ],
      cost: 2,
    });
  });

  it('walks around a blocking wall', () => {
    const wall = cells('wall', [
      [1, -1],
      [1, 0],
      [1, 1],
    ]);
    const result = findPath(grid, query({ x: 0, y: 0 }, { x: 2, y: 0 }, 10, wall));
    expect(result).toEqual({
      ok: true,
      path: [
        { x: 0, y: -1 },
        { x: 1, y: -2 },
        { x: 2, y: -1 },
        { x: 2, y: 0 },
      ],
      cost: 4,
    });
  });

  it('difficult terrain (cost 2) wins over a longer plain detour — the cheapest path wins', () => {
    const corridor = [
      ...cells('wall', [
        [1, -1],
        [2, -1],
        [3, -1],
        [1, 1],
        [2, 1],
        [3, 1],
      ]),
      ...cells('mire', [[2, 0]]),
    ];
    expect(findPath(grid, query({ x: 0, y: 0 }, { x: 4, y: 0 }, 10, corridor))).toEqual({
      ok: true,
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
      cost: 5,
    });
    // With a lower budget the same destination is out of range at its true cost.
    expect(findPath(grid, query({ x: 0, y: 0 }, { x: 4, y: 0 }, 4, corridor))).toEqual({
      ok: false,
      kind: 'out-of-range',
      cost: 5,
    });
  });

  it('F-P9: a wall detour costing more than the budget AND distance × maxCost is out-of-range, never unreachable (grid + hex)', () => {
    const maxCost = 2; // the vocabulary's dearest enterable kind (mire)
    for (const [geometry, expectedCost] of [
      [grid, 8],
      [hex, 9],
    ] as const satisfies readonly (readonly [SpatialGeometry, number])[]) {
      const from = { x: 0, y: 0 };
      const to = { x: 2, y: 0 };
      const result = findPath(geometry, query(from, to, 6, WALL));
      expect(result).toEqual({ ok: false, kind: 'out-of-range', cost: expectedCost });
      expect(expectedCost).toBeGreaterThan(geometry.distance(from, to) * maxCost);
      // The same detour is walkable once the budget covers it.
      const walked = findPath(geometry, query(from, to, expectedCost, WALL));
      expect(walked.ok).toBe(true);
      if (walked.ok) expect(walked.path).toHaveLength(expectedCost);
    }
  });

  it('a destination fully enclosed by blocking cells is unreachable (no path at any cost)', () => {
    const ring = grid.neighbors({ x: 5, y: 5 }).map((at) => ({ at, kind: 'wall' }));
    expect(findPath(grid, query({ x: 0, y: 0 }, { x: 5, y: 5 }, 100, ring))).toEqual({
      ok: false,
      kind: 'unreachable',
    });
    const hexRing = hex.neighbors({ x: 5, y: 5 }).map((at) => ({ at, kind: 'wall' }));
    expect(findPath(hex, query({ x: 0, y: 0 }, { x: 5, y: 5 }, 100, hexRing))).toEqual({
      ok: false,
      kind: 'unreachable',
    });
  });

  it('each failure kind, in classification order', () => {
    const from = { x: 0, y: 0 };
    // blocked beats occupied: the destination is a blocking cell.
    expect(findPath(grid, query(from, { x: 1, y: 0 }, 5, cells('wall', [[1, 0]])))).toEqual({
      ok: false,
      kind: 'blocked',
    });
    // to = from with endable excluding the mover's own cell (F-P10a).
    expect(findPath(grid, query(from, from, 5))).toEqual({ ok: false, kind: 'occupied' });
    // A standing combatant on the destination.
    const held = { ...query(from, { x: 2, y: 0 }, 5), endable: (p: Position) => p.x !== 2 };
    expect(findPath(grid, held)).toEqual({ ok: false, kind: 'occupied' });
    // Impassable enemies wall the mover in: unreachable.
    const boxedIn = {
      ...query(from, { x: 3, y: 0 }, 50),
      occupied: [from, ...grid.neighbors(from)],
      passable: (p: Position) => Math.max(Math.abs(p.x), Math.abs(p.y)) !== 1,
    };
    expect(findPath(grid, boxedIn)).toEqual({ ok: false, kind: 'unreachable' });
    expect(findPath(grid, query(from, { x: 3, y: 0 }, 2))).toEqual({
      ok: false,
      kind: 'out-of-range',
      cost: 3,
    });
  });

  it('passable allies are walked through but never ended on', () => {
    const ally = { x: 1, y: 0 };
    const through = {
      ...query(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        5,
        cells('wall', [
          [1, -1],
          [1, 1],
        ]),
      ),
      occupied: [{ x: 0, y: 0 }, ally],
      endable: (p: Position) => !(p.x === 0 && p.y === 0) && !(p.x === ally.x && p.y === ally.y),
    };
    expect(findPath(grid, through)).toEqual({
      ok: true,
      path: [ally, { x: 2, y: 0 }],
      cost: 2,
    });
  });
});
