import { makeErrorCard, type ErrorCard } from '../../schema/error-card';
import type { RngState } from '../../core/rng';
import { RuntimeRuleError } from '../errors';
import {
  Combat,
  combatantFeats,
  copyBindings,
  copyTerrain,
  defeatedSide,
  moveBudgetAst,
  terrainRefusals,
  type CombatantState,
  type CombatPhase,
  type PendingMove,
} from '../combat/combat';
import type { CombatantProfile } from '../combat/resolve';
import type { Position, TerrainCell } from '../combat/spatial';
import type { EconomyBalances } from '../combat/action-economy';
import type { Runtime } from '../runtime';
import { eventMatches } from '../combat/triggers';
import type { SnapshotActiveCondition } from './character';
import {
  SNAPSHOT_VERSION,
  declaredIdentityId,
  display,
  envelopeRefusals,
  isRecord,
  packIdentity,
  type SnapshotPackIdentity,
} from './envelope';

/** uint32 word ceiling (exclusive) for the rng-state gate. */
const UINT32_MAX_WORD = 4294967296;

/** snapshots.schema.json $defs/combatSnapshot/properties/combatants/items - the per-combatant def, verbatim. */
export interface SnapshotCombatant {
  readonly id: string;
  readonly hp: number;
  /** CA-4 transients: the owner's per-turn slot ledger, by slot name. */
  readonly slotsUsed?: Readonly<Record<string, number>>;
  readonly conditions?: readonly SnapshotActiveCondition[];
  /** The precise {x, y} — emitted only when set; never null (FR-11, CA-G3). */
  readonly position?: Position;
  /** Legacy (v1.5 writers) — the combatant's first open reactive-action offer; read on restore, never written by v1.6 (DD-S14). */
  readonly pendingTrigger?: null | string;
  /** v1.4 — item id -> units SPENT in this fight (CA-EG6); emitted only when non-empty. */
  readonly itemsUsed?: Readonly<Record<string, number>>;
  /** v1.4 — the heal cap fixed at fight start (CA-EG4/EG6); always emitted by v1.4 serializers. */
  readonly maxHp?: number;
  /** v1.5 — a move paused by open leaving-reach offers (DD-M12); emitted only when set. */
  readonly pendingMove?: PendingMove;
  /** v1.6 — pool id -> points SPENT in this fight (CA-S2); emitted only when non-empty. */
  readonly poolsSpent?: Readonly<Record<string, number>>;
  /** v1.6 — spell level -> slot indices cast in this fight (CA-S2); emitted only when non-empty. */
  readonly slotsCast?: Readonly<Record<string, readonly number[]>>;
}

/** v1.6 — one open offer (DD-S14): `on` is the live offer's matching event type. */
export interface SnapshotOffer {
  readonly actorId: string;
  readonly source: 'action' | 'feat';
  readonly id: string;
  readonly on: string;
}

/** The combat envelope - pairsWith is the documented combat→party pairing (FR-14). */
export interface CombatSnapshot {
  readonly kind: 'combat';
  readonly snapshotVersion: 1;
  readonly pack: SnapshotPackIdentity;
  readonly pairsWith: string;
  readonly round: number;
  readonly turn: number;
  readonly order: readonly string[];
  readonly rng: RngState;
  readonly combatants: readonly SnapshotCombatant[];
  /** v1.6 — the live phase (R-GM-2); always written by v1.6 serializers. */
  readonly phase?: CombatPhase;
  /** v1.6 — offers raised so far, so the next `offerIndex` continues (R-GM-1); always written by v1.6 serializers. */
  readonly offeredCount?: number;
  /** v1.6 — every open offer, in queue order; written only when non-empty. */
  readonly offers?: readonly SnapshotOffer[];
}

/** The sides exactly as `startCombat` took them: the host re-states its original request to resume (FR-10 between-steps boundary). */
export interface CombatRestoreRequest {
  readonly allies: readonly { id: string; profile: CombatantProfile; balances?: EconomyBalances }[];
  readonly enemies: readonly { id: string; profile: CombatantProfile; balances?: EconomyBalances }[];
  /** The host re-states each combatant's position (FR-10 between-steps: movement = restore with updated positions). */
  readonly positions?: Readonly<Record<string, Position>>;
  /** v1.5 — the host re-states the fight's terrain cells, like positions (never frozen); same refusals as `startCombat`. */
  readonly terrain?: readonly TerrainCell[];
}

/**
 * FR-14 - the combat envelope: the whole fight, mid-round included (the state
 * is whole between any two steps). Per-combatant state carries the CA-4
 * transients (the per-turn slot ledger), the item spend (`itemsUsed`), the
 * spell spend (`poolsSpent`/`slotsCast`, v1.6) and the heal cap (`maxHp`). Pool/bound-slot/item balances ride the paired party's
 * character states - FR-14's pairsWith discipline. The envelope (v1.6,
 * DD-S14) always carries `phase` and `offeredCount`, and `offers` — every
 * open offer, actions and feats, in queue order — when any is open; the
 * per-combatant `pendingTrigger` is no longer written.
 */
export function serializeCombat(fight: Combat, options: { readonly pairsWith: string }): CombatSnapshot {
  const state = fight.state;
  return {
    kind: 'combat',
    snapshotVersion: SNAPSHOT_VERSION,
    pack: packIdentity(fight.runtime.pack),
    pairsWith: options.pairsWith,
    round: state.round,
    turn: state.turn,
    order: [...state.order],
    rng: { ...state.rng },
    phase: state.phase,
    offeredCount: fight.offeredCount,
    ...(fight.pendingTriggers.length > 0
      ? {
          offers: fight.pendingTriggers.map((offer) => ({
            actorId: offer.actorId,
            source: offer.source,
            id: offer.actionId,
            on: offer.matchingEvent,
          })),
        }
      : {}),
    combatants: state.order.map((id) => {
      const combatant = state.combatants[id]!;
      return {
        id,
        hp: combatant.hp.current,
        maxHp: combatant.maxHp,
        slotsUsed: { ...combatant.slots.remaining },
        conditions: combatant.conditions.map((active) => ({
          id: active.conditionId,
          remaining: active.duration,
        })),
        ...(combatant.position !== undefined ? { position: { ...combatant.position } } : {}),
        ...(Object.keys(combatant.itemsUsed).length > 0 ? { itemsUsed: { ...combatant.itemsUsed } } : {}),
        ...(combatant.pendingMove !== undefined
          ? { pendingMove: copyPendingMove(combatant.pendingMove) }
          : {}),
        ...(Object.keys(combatant.poolsSpent).length > 0 ? { poolsSpent: { ...combatant.poolsSpent } } : {}),
        ...(Object.keys(combatant.slotsCast).length > 0
          ? { slotsCast: copySlotsCast(combatant.slotsCast) }
          : {}),
      };
    }),
  };
}

/**
 * Resume a fight from its envelope (FR-14 resume discipline): the identity
 * gate first, then the host re-states its sides exactly as `startCombat` took
 * them. hp/conditions/slot ledgers carry the frozen transients; item charges
 * are the re-stated `balances.items` with the frozen `itemsUsed` as the spend;
 * pools and bound-slot counts are the re-stated balances minus the frozen
 * `poolsSpent`/`slotsCast` (CA-S2), with bindings, spells and
 * `castBlockedBy` re-stated;
 * and `maxHp` is the frozen value, else `profile.maxHp`, else
 * `max(0, profile.hp)` (CA-EG6, R-9). The phase (DD-S14): `combat-over` when
 * the frozen hp already satisfy the end rule (every combatant of one side at
 * hp ≤ 0), else the envelope `phase`, else the v1.5 derivation (DD-M12) —
 * `resolved` when any combatant carries a `pendingMove` or `pendingTrigger`,
 * or the envelope carries `offers` (the turn's action already resolved),
 * else `awaiting-declare` (freezing between steps is the FR-10 boundary).
 * Open offers come from the envelope `offers`, in queue order, else from the
 * legacy per-combatant `pendingTrigger`, whose matching event is the trigger
 * pattern's event type (the base before `[`), as live offers store it. The
 * offer counter resumes from `offeredCount` (absent = 0).
 * Positions and terrain are re-stated by the host (CAP-G5). The rng words rebuild the dice stream: the
 * next roll equals the uninterrupted fight's next roll.
 */
export function deserializeCombat(
  runtime: Runtime,
  snapshot: unknown,
  restore: CombatRestoreRequest,
): Combat {
  const cards = envelopeRefusals('combat', snapshot, runtime.pack);
  if (isRecord(snapshot) && cards.length === 0) {
    cards.push(...combatRestoreRefusals(runtime, snapshot as unknown as CombatSnapshot, restore));
    // CAP-G5 fail-closed: a spatial pack's fight restores only when every
    // combatant re-states its position (CA-G3) — all cards at once, before
    // anything is rebuilt.
    cards.push(...spatialRestoreRefusals(runtime, restore));
    cards.push(
      ...terrainRefusals(
        runtime,
        restore.terrain ?? [],
        [...restore.allies, ...restore.enemies].map((entry) => entry.id),
        restore.positions,
        'restore',
      ),
    );
  }
  if (cards.length > 0) throw new RuntimeRuleError(cards);
  validateRngWords(snapshot);
  const saved = snapshot as CombatSnapshot;
  const frozen = new Map(saved.combatants.map((combatant) => [combatant.id, combatant]));
  const sides = [
    ...restore.allies.map((entry) => ({ ...entry, side: 'allies' as const })),
    ...restore.enemies.map((entry) => ({ ...entry, side: 'enemies' as const })),
  ];
  const combatants: Record<string, CombatantState> = {};
  for (const entry of sides) {
    const frozenState = frozen.get(entry.id);
    if (frozenState === undefined) continue; // combatRestoreRefusals already refused this
    combatants[entry.id] = {
      id: entry.id,
      side: entry.side,
      name: entry.id,
      hp: { current: frozenState.hp },
      maxHp: frozenState.maxHp ?? entry.profile.maxHp ?? Math.max(0, entry.profile.hp),
      conditions:
        frozenState.conditions?.map((active) => ({ conditionId: active.id, duration: active.remaining })) ??
        [],
      slots: { remaining: { ...frozenState.slotsUsed } },
      pools: remainingPools(entry.balances?.pools ?? {}, frozenState.poolsSpent ?? {}),
      boundSlots: remainingBound(entry.balances?.boundSlots ?? {}, frozenState.slotsCast ?? {}),
      itemBalances: { ...(entry.balances?.items ?? {}) },
      itemsUsed: { ...(frozenState.itemsUsed ?? {}) },
      abilities: { ...entry.profile.abilities },
      saves: { ...entry.profile.saves },
      level: entry.profile.level,
      ac: entry.profile.ac,
      initiativeBonus: entry.profile.initiativeBonus,
      ...(entry.profile.speed !== undefined ? { speed: entry.profile.speed } : {}),
      actions: [...entry.profile.actions],
      spells: [...(entry.profile.spells ?? [])],
      ...(entry.balances?.bindings !== undefined ? { bindings: copyBindings(entry.balances.bindings) } : {}),
      slotsCast: copySlotsCast(frozenState.slotsCast ?? {}),
      poolsSpent: { ...(frozenState.poolsSpent ?? {}) },
      ...(entry.profile.castBlockedBy !== undefined ? { castBlockedBy: entry.profile.castBlockedBy } : {}),
      ...combatantFeats(entry.profile),
      attackTable: entry.profile.attackTable
        ? entry.profile.attackTable.map((row) => ({ level: row.level, byDefense: { ...row.byDefense } }))
        : undefined,
      attackBonus: entry.profile.attackBonus,
      ...(restore.positions?.[entry.id] !== undefined ? { position: restore.positions[entry.id] } : {}),
      ...(frozenState.pendingMove !== undefined
        ? { pendingMove: copyPendingMove(frozenState.pendingMove) }
        : {}),
    };
  }
  const derivedPhase: CombatPhase =
    (saved.offers?.length ?? 0) > 0 ||
    saved.combatants.some(
      (c) => c.pendingMove !== undefined || (c.pendingTrigger !== undefined && c.pendingTrigger !== null),
    )
      ? 'resolved'
      : 'awaiting-declare';
  const fight = new Combat(
    runtime,
    {
      round: saved.round,
      turn: saved.turn,
      order: [...saved.order],
      active: saved.order[saved.turn] ?? '',
      phase: defeatedSide(combatants) !== undefined ? 'combat-over' : (saved.phase ?? derivedPhase),
      combatants,
      rng: { ...saved.rng },
      terrain: copyTerrain(restore.terrain ?? []),
    },
    undefined,
    { offeredCount: saved.offeredCount ?? 0 },
  );
  if (saved.offers !== undefined) {
    for (const offer of saved.offers) {
      fight.pendingTriggers.push({
        triggerId: `${offer.actorId}.${offer.id}`,
        actorId: offer.actorId,
        actionId: offer.id,
        source: offer.source,
        matchingEvent: offer.on,
      });
    }
    return fight;
  }
  for (const combatant of saved.combatants) {
    if (combatant.pendingTrigger === undefined || combatant.pendingTrigger === null) continue;
    const pattern = runtime.pack.actions[combatant.pendingTrigger]!.trigger!.on; // restoreRefusals proved both lookups
    const bracket = pattern.indexOf('[');
    fight.pendingTriggers.push({
      triggerId: `${combatant.id}.${combatant.pendingTrigger}`,
      actorId: combatant.id,
      actionId: combatant.pendingTrigger,
      source: 'action',
      // The live offer's `event.type`: the pattern's base before `[` (eventMatches' base).
      matchingEvent: bracket === -1 ? pattern : pattern.slice(0, bracket),
    });
  }
  return fight;
}

/**
 * The spatial restore gate (CAP-G5): a spatial pack refuses a positionless
 * combatant — the E-SPAT-01 family, fail-closed, every missing position one
 * card, all before anything is rebuilt.
 */
function spatialRestoreRefusals(runtime: Runtime, restore: CombatRestoreRequest): ErrorCard[] {
  if (runtime.pack.spatial === undefined) return [];
  return [...restore.allies, ...restore.enemies]
    .filter((entry) => restore.positions?.[entry.id] === undefined)
    .map((entry) =>
      makeErrorCard(
        'E-SPAT-01',
        '(snapshot)',
        `restore.${entry.id}.position`,
        `combatant "${entry.id}" has no position on restore — this pack declares a spatial model (FR-11), so resume requires every combatant's position.`,
      ),
    );
}

/**
 * The combat restore's own refusals (E-SNAP-01, the snapshot-load refusal
 * family): the frozen fight and the host's restore request must describe the
 * same fight, and a frozen offer must name a reactive action this pack
 * declares. All cards at once, before anything is rebuilt.
 */
function combatRestoreRefusals(
  runtime: Runtime,
  saved: CombatSnapshot,
  restore: CombatRestoreRequest,
): ErrorCard[] {
  const cards: ErrorCard[] = [];
  const artifactId = declaredIdentityId(saved) ?? '(snapshot)';
  const orderIds = new Set(saved.order);
  if (saved.order.length === 0) {
    cards.push(
      makeErrorCard(
        'E-SNAP-01',
        artifactId,
        'order',
        'combat order is empty - an initiative order has at least one combatant (FR-10).',
      ),
    );
  }
  const frozenIds = new Set(saved.combatants.map((combatant) => combatant.id));
  for (const id of saved.order) {
    if (!frozenIds.has(id)) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          'combatants',
          `combatant "${id}" is in the order but carries no frozen state - refusing a partially described fight (FR-14).`,
        ),
      );
    }
  }
  const sideIds = new Set([...restore.allies, ...restore.enemies].map((entry) => entry.id));
  if (sideIds.size !== restore.allies.length + restore.enemies.length) {
    cards.push(
      makeErrorCard(
        'E-SNAP-01',
        artifactId,
        'restore',
        'the restore request repeats a combatant id - each combatant states one side (FR-10).',
      ),
    );
  }
  for (const entry of [...restore.allies, ...restore.enemies]) {
    if (!orderIds.has(entry.id)) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          'restore',
          `restore request names combatant "${entry.id}", who is not in this fight (FR-14).`,
        ),
      );
    }
  }
  for (const id of saved.order) {
    if (!sideIds.has(id)) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          'combatants',
          `frozen combatant "${id}" is missing from the restore request - the host re-states every side (FR-10).`,
        ),
      );
    }
  }
  const balances = new Map(
    [...restore.allies, ...restore.enemies].map((entry) => [entry.id, entry.balances]),
  );
  saved.combatants.forEach((combatant, index) => {
    if (combatant.maxHp !== undefined && !(Number.isInteger(combatant.maxHp) && combatant.maxHp >= 0)) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          `combatants[${index}].maxHp`,
          `maxHp ${display(combatant.maxHp)} is not an integer ≥ 0 (CA-EG6).`,
        ),
      );
    }
    for (const [itemId, spent] of Object.entries(combatant.itemsUsed ?? {})) {
      const at = `combatants[${index}].itemsUsed.${itemId}`;
      const stated = balances.get(combatant.id)?.items?.[itemId] ?? 0;
      if (runtime.pack.content.items?.[itemId] === undefined) {
        cards.push(
          makeErrorCard(
            'E-SNAP-01',
            artifactId,
            at,
            `frozen spend names item "${itemId}", which this pack does not declare (CA-EG6).`,
          ),
        );
      } else if (!Number.isInteger(spent) || spent < 0 || spent > stated) {
        cards.push(
          makeErrorCard(
            'E-SNAP-01',
            artifactId,
            at,
            `combatant "${combatant.id}" spent ${display(spent)} "${itemId}", but the restore request states ${stated} — the host re-states the fight-start balances.items (CA-EG6).`,
          ),
        );
      }
    }
  });
  saved.combatants.forEach((combatant, index) => {
    cards.push(...spendRefusals(artifactId, combatant, index, balances.get(combatant.id)));
  });
  saved.combatants.forEach((combatant, index) => {
    if (combatant.pendingMove === undefined) return;
    const actionId = combatant.pendingMove.actionId;
    if (runtime.pack.actions[actionId] === undefined || moveBudgetAst(runtime, actionId) === undefined) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          `combatants[${index}].pendingMove.actionId`,
          `frozen paused move names ${display(actionId)}, which is not a move action in this pack (its effect root is not move(...), FR-11).`,
        ),
      );
    }
  });
  const allies = new Set(restore.allies.map((c) => c.id));
  const position = (value: unknown): value is Position =>
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    Number.isSafeInteger(value['x']) &&
    Number.isSafeInteger(value['y']);
  for (const [index, mover] of saved.combatants.entries()) {
    const history: unknown = mover.pendingMove?.offeredDepartures;
    if (history === undefined) continue;
    const at = `combatants[${index}].pendingMove.offeredDepartures`;
    const refuse = (message: string) => cards.push(makeErrorCard('E-SNAP-01', artifactId, at, message));
    if (!Array.isArray(history)) {
      refuse('Departure history must be an array.');
      continue;
    }
    const seen = new Set<string>();
    for (const d of history) {
      if (
        !isRecord(d) ||
        Object.keys(d).length !== 3 ||
        !position(d['from']) ||
        !position(d['to']) ||
        typeof d['reactorId'] !== 'string'
      ) {
        refuse('Each departure requires exactly from, to and reactorId.');
        continue;
      }
      const from = d['from'],
        to = d['to'],
        reactor = d['reactorId'];
      const key = JSON.stringify([from.x, from.y, to.x, to.y, reactor]);
      if (seen.has(key)) refuse('Departure tuple repeats.');
      seen.add(key);
      if (!frozenIds.has(reactor) || allies.has(reactor) === allies.has(mover.id))
        refuse('Departure reactor must exist on the opposing side.');
      if (!runtime.spatial.enabled || runtime.spatial.distance(from, to) !== 1)
        refuse('Departure must connect adjacent cells.');
    }
    if (Array.isArray(saved.offers))
      for (const offer of saved.offers) {
        if (
          !isRecord(offer) ||
          offer.on !== 'move:leaving-reach' ||
          typeof offer.id !== 'string' ||
          typeof offer.actorId !== 'string'
        )
          continue;
        const pattern =
          offer.source === 'feat'
            ? runtime.pack.content.feats?.[offer.id]?.trigger?.on
            : runtime.pack.actions[offer.id]?.trigger?.on;
        const reactorId = offer.actorId;
        const current = history.filter(
          (d) =>
            isRecord(d) &&
            position(d['from']) &&
            d['from'].x === mover.position?.x &&
            d['from'].y === mover.position?.y,
        );
        const events = (history.length ? current : [{ reactorId: offer.actorId }]).map((d) => ({
          type: 'move:leaving-reach',
          actor: mover.id,
          target: d.reactorId as string,
          at: { round: saved.round, turn: saved.turn },
          payload: {},
          why: { rule: '', rolls: [] },
        }));
        if (
          saved.order[saved.turn] !== mover.id ||
          !pattern ||
          !events.some((event) => eventMatches(pattern, event, reactorId))
        )
          refuse('Current departure offer disagrees with the paused mover, edge or reactive source.');
      }
  }
  cards.push(...envelopeV16Refusals(runtime, saved, restore, artifactId));
  saved.combatants.forEach((combatant, index) => {
    if (combatant.pendingTrigger === undefined || combatant.pendingTrigger === null) return;
    const def = runtime.pack.actions[combatant.pendingTrigger];
    if (def === undefined || def.trigger === undefined) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          `combatants[${index}].pendingTrigger`,
          `frozen offer names "${combatant.pendingTrigger}", which is not a reactive action in this pack (FR-4/FR-13).`,
        ),
      );
    }
  });
  return cards;
}

const COMBAT_PHASES: readonly CombatPhase[] = [
  'awaiting-declare',
  'resolved',
  'awaiting-trigger-response',
  'combat-over',
];

/**
 * DD-S14 — the v1.6 envelope fields must describe this fight (E-SNAP-01, one
 * card per defect, all before anything is rebuilt): `offers` never rides
 * beside a legacy `pendingTrigger`; each offer names a combatant in the order
 * and, for its `source`, a reactive action in that combatant's re-stated
 * `actions` or a reactive feat in its re-stated `feats`; `phase` is a
 * combat phase, and `combat-over` only when the frozen hp defeat a side;
 * `offeredCount` is an integer ≥ 0.
 */
function envelopeV16Refusals(
  runtime: Runtime,
  saved: CombatSnapshot,
  restore: CombatRestoreRequest,
  artifactId: string,
): ErrorCard[] {
  const cards: ErrorCard[] = [];
  const refuse = (at: string, message: string) =>
    cards.push(makeErrorCard('E-SNAP-01', artifactId, at, message));
  const offers: unknown = saved.offers;
  if (offers !== undefined && !Array.isArray(offers)) {
    refuse('offers', 'offers must be an array of {actorId, source, id, on} (DD-S14).');
  } else if (offers !== undefined) {
    if (saved.combatants.some((c) => c.pendingTrigger !== undefined && c.pendingTrigger !== null)) {
      refuse(
        'offers',
        'the snapshot carries both envelope offers and a per-combatant pendingTrigger — v1.6 writers emit offers only (DD-S14).',
      );
    }
    const profiles = new Map(
      [...restore.allies, ...restore.enemies].map((entry) => [entry.id, entry.profile]),
    );
    offers.forEach((offer: unknown, index) => {
      const at = `offers[${index}]`;
      if (
        !isRecord(offer) ||
        typeof offer['actorId'] !== 'string' ||
        typeof offer['id'] !== 'string' ||
        typeof offer['on'] !== 'string'
      ) {
        refuse(at, 'an offer must be {actorId, source, id, on} (DD-S14).');
        return;
      }
      const actorId = offer['actorId'];
      const id = offer['id'];
      const source = offer['source'];
      if (!saved.order.includes(actorId)) {
        refuse(`${at}.actorId`, `offer names combatant "${actorId}", who is not in this fight (DD-S14).`);
        return;
      }
      if (saved.combatants.some((c) => c.pendingMove?.offeredDepartures !== undefined)) {
        const pattern =
          source === 'feat'
            ? runtime.pack.content.feats?.[id]?.trigger?.on
            : runtime.pack.actions[id]?.trigger?.on;
        if (pattern !== undefined && pattern.split('[')[0] !== offer['on'])
          refuse(`${at}.on`, 'Offer event disagrees with its reactive source.');
      }
      const profile = profiles.get(actorId);
      const held =
        source === 'action'
          ? profile?.actions.includes(id) === true && runtime.pack.actions[id]?.trigger !== undefined
          : source === 'feat'
            ? profile?.feats?.includes(id) === true && runtime.pack.content.feats?.[id]?.trigger !== undefined
            : false;
      if (!held) {
        refuse(
          `${at}.id`,
          `offer names ${display(source)} "${id}", which is not a reactive action or feat of that source combatant "${actorId}" holds (DD-S14).`,
        );
      }
    });
  }
  if (saved.phase !== undefined) {
    if (!COMBAT_PHASES.includes(saved.phase)) {
      refuse(
        'phase',
        `phase ${display(saved.phase)} is not a combat phase (${COMBAT_PHASES.join(', ')}) (DD-S14).`,
      );
    } else if (saved.phase === 'combat-over' && !frozenSideDefeated(saved, restore)) {
      refuse('phase', 'phase "combat-over", but the frozen hp defeat no side (DD-S14).');
    }
  }
  const count: unknown = saved.offeredCount;
  if (count !== undefined && !(typeof count === 'number' && Number.isInteger(count) && count >= 0)) {
    refuse('offeredCount', `offeredCount ${display(count)} is not an integer ≥ 0 (DD-S14).`);
  }
  return cards;
}

/** The end rule over the frozen hp and the re-stated sides: every member of one side at hp ≤ 0. */
function frozenSideDefeated(saved: CombatSnapshot, restore: CombatRestoreRequest): boolean {
  const hp = new Map(saved.combatants.map((combatant) => [combatant.id, combatant.hp]));
  return [restore.allies, restore.enemies].some(
    (members) => members.length > 0 && members.every((member) => (hp.get(member.id) ?? 1) <= 0),
  );
}

/**
 * CA-S2 — the frozen spell spend must fit the re-stated fight-start balances
 * (E-SNAP-01, one card per defect): a pool the combatant was not re-stated,
 * a spend that is not an integer ≥ 1 or exceeds the re-stated pool; a cast
 * level with no re-stated slots; an index that is not an integer ≥ 0, lies
 * past the re-stated bindings (or the re-stated count when there are no
 * bindings), names a null binding, or repeats.
 */
function spendRefusals(
  artifactId: string,
  combatant: SnapshotCombatant,
  index: number,
  balances: EconomyBalances | undefined,
): ErrorCard[] {
  const cards: ErrorCard[] = [];
  const refuse = (at: string, message: string) =>
    cards.push(makeErrorCard('E-SNAP-01', artifactId, `combatants[${index}].${at}`, message));
  for (const [pool, spent] of Object.entries(combatant.poolsSpent ?? {})) {
    const stated = balances?.pools?.[pool];
    if (stated === undefined) {
      refuse(
        `poolsSpent.${pool}`,
        `frozen spend names pool "${pool}", which the restore request does not state for "${combatant.id}" (CA-S2).`,
      );
    } else if (!Number.isInteger(spent) || spent < 1 || spent > stated) {
      refuse(
        `poolsSpent.${pool}`,
        `combatant "${combatant.id}" spent ${display(spent)} "${pool}", but the restore request states ${stated} — the host re-states the fight-start balances.pools (CA-S2).`,
      );
    }
  }
  for (const [level, indices] of Object.entries(combatant.slotsCast ?? {})) {
    const bindings = balances?.bindings?.[level];
    const count = balances?.boundSlots?.[level];
    if ((balances?.bindings !== undefined ? bindings : count) === undefined || !Array.isArray(indices)) {
      refuse(
        `slotsCast.${level}`,
        `frozen casts name level ${level}, for which the restore request states no slots for "${combatant.id}" (CA-S2).`,
      );
      continue;
    }
    const seen = new Set<number>();
    indices.forEach((slot, k) => {
      const at = `slotsCast.${level}[${k}]`;
      const limit = bindings !== undefined ? bindings.length : (count ?? 0);
      if (!Number.isInteger(slot) || slot < 0 || slot >= limit) {
        refuse(
          at,
          `cast index ${display(slot)} is not a re-stated level-${level} slot (0..${limit - 1}) (CA-S2).`,
        );
      } else if (bindings !== undefined && bindings[slot] === null) {
        refuse(
          at,
          `cast index ${slot} names a level-${level} slot the restore request states empty (null) (CA-S2).`,
        );
      } else if (seen.has(slot)) {
        refuse(at, `cast index ${slot} repeats — each level-${level} slot is cast at most once (CA-S2).`);
      }
      seen.add(slot);
    });
  }
  return cards;
}

/** A plain-JSON copy of a cast-slot record (FR-14: state never aliases envelope objects). */
function copySlotsCast(slotsCast: Readonly<Record<string, readonly number[]>>): Record<string, number[]> {
  const copy: Record<string, number[]> = {};
  for (const [level, indices] of Object.entries(slotsCast)) copy[level] = [...indices];
  return copy;
}

/** CA-S2: a restored pool is the re-stated fight-start balance minus the frozen spend. */
function remainingPools(
  restated: Readonly<Record<string, number>>,
  spent: Readonly<Record<string, number>>,
): Record<string, number> {
  const pools: Record<string, number> = { ...restated };
  for (const [pool, amount] of Object.entries(spent)) pools[pool] = (pools[pool] ?? 0) - amount;
  return pools;
}

/** CA-S2: a restored bound-slot count is the re-stated count minus the slots cast. */
function remainingBound(
  restated: Readonly<Record<string, number>>,
  cast: Readonly<Record<string, readonly number[]>>,
): Record<string, number> {
  const bound: Record<string, number> = { ...restated };
  for (const [level, indices] of Object.entries(cast)) bound[level] = (bound[level] ?? 0) - indices.length;
  return bound;
}

/** A plain-JSON copy of a paused move (FR-14: state never aliases envelope objects). */
function copyPendingMove(pending: PendingMove): PendingMove {
  return {
    actionId: pending.actionId,
    to: { x: pending.to.x, y: pending.to.y },
    remaining: pending.remaining,
    ...(pending.offeredDepartures === undefined
      ? {}
      : {
          offeredDepartures: pending.offeredDepartures.map((d) => ({
            from: { ...d.from },
            to: { ...d.to },
            reactorId: d.reactorId,
          })),
        }),
  };
}

function validateRngWords(snapshot: unknown): void {
  const rng = isRecord(snapshot) ? snapshot['rng'] : undefined;
  if (!isRecord(rng)) return; // the gate's pack/identity cards already fired
  for (const word of ['a', 'b', 'c', 'd'] as const) {
    const value = (rng as Record<string, unknown>)[word];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > UINT32_MAX_WORD) {
      throw new RuntimeRuleError([
        makeErrorCard(
          'E-SNAP-01',
          declaredIdentityId(snapshot) ?? '(snapshot)',
          `rng.${word}`,
          `rng word ${word} must be a uint32, got ${display(value)} - refusing a mangled dice stream (FR-1/FR-14).`,
        ),
      ]);
    }
  }
}
