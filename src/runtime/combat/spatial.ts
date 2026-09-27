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
 */
import type { SpatialDef } from '../../schema/pack';

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
  /** Distance in grid steps between two positions (Chebyshev — a square grid). */
  distance(a: Position, b: Position): number;
  /** Whether `from` may melee `to` under the model's reach rules. */
  canReach(from: Position, to: Position, reach: number): boolean;
  /** All positions within a burst radius of the center (FR-11's burst shape). */
  inBurst(
    center: Position,
    radius: number,
    candidates: readonly (readonly [string, Position])[],
  ): readonly string[];
}

/** The no-op: packs without positions never fail a spatial check. */
export const theaterOfMind: SpatialGeometry = {
  enabled: false,
  distance: () => 0,
  canReach: () => true,
  inBurst: (_center, _radius, candidates) => candidates.map(([id]) => id),
};

/** A square-grid geometry: Chebyshev distance, reach in grid steps. */
export function gridGeometry(model: SpatialModel): SpatialGeometry {
  return {
    enabled: true,
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
  return model === undefined ? theaterOfMind : gridGeometry(model);
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
