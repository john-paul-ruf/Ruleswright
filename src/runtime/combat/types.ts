/**
 * Combat types (M03): the plain-JSON combat state and the shapes the combat
 * verbs take and return. Type-only — `combat.ts` re-exports every one it
 * exported before the split.
 */
import type { RandomSource, RngState } from '../../core/rng';
import type { EventClock } from '../events';
import type { CostRejection, EconomyBalances, SlotLedger } from './action-economy';
import type { CombatantProfile, Side } from './resolve';
import type { MoveRejection, Position, SpatialRejection, TerrainCell } from './spatial';

/** One combatant's live combat state — plain JSON, snapshot-ready (FR-14). */
export interface CombatantState {
  readonly id: string;
  readonly side: Side;
  readonly name: string;
  readonly hp: { current: number };
  /** The heal cap, fixed at fight start (CA-EG4): `profile.maxHp`, else `max(0, profile.hp)` (R-9). */
  readonly maxHp: number;
  conditions: { conditionId: string; duration: number }[];
  /** Per-turn slot ledger (CA-4): the combat transient, replenished each turn start. */
  readonly slots: SlotLedger;
  pools: Record<string, number>;
  /** Spell level ("1") → remaining bound slot count (FR-8; consuming decrements). */
  boundSlots: Record<string, number>;
  /** Item id -> host-stated charges at fight start (CA-EG5, `balances.items`); never changes in the fight. */
  readonly itemBalances: Readonly<Record<string, number>>;
  /** Item id -> units SPENT in this fight (CA-EG5); remaining = itemBalances − itemsUsed. */
  itemsUsed: Record<string, number>;
  readonly abilities: Readonly<Record<string, number>>;
  readonly saves: Readonly<Record<string, number>>;
  readonly level: number;
  readonly ac: number;
  readonly initiativeBonus: number;
  /** v1.5 — the profile's movement budget (`formulas.speed`); absent when the pack declares none. */
  readonly speed?: number;
  readonly actions: readonly string[];
  /** v1.6 — spell ids this combatant may declare (`profile.spells`; empty = none, DD-S4). */
  readonly spells: readonly string[];
  /** v1.6 — spell level → the slot bindings at fight start (`balances.bindings`, deep copy); absent = count-only. */
  readonly bindings?: Readonly<Record<string, readonly (string | null)[]>>;
  /** v1.6 — spell level → slot indices cast in this fight (CA-S2); `boundSlots` = start − cast. */
  slotsCast: Record<string, number[]>;
  /** v1.6 — pool id → points SPENT in this fight (CA-S2); `pools` = start − spent. */
  poolsSpent: Record<string, number>;
  /** v1.6 — the equipped armor that blocks vancian casts (`profile.castBlockedBy`, DD-S6); absent = not blocked. */
  readonly castBlockedBy?: string;
  /** v1.6 — the reactive feats this combatant holds (`profile.feats`, DD-S12); present only when non-empty (absent = none). */
  readonly feats?: readonly string[];
  readonly attackTable?: readonly { level: number; byDefense: Record<string, number> }[];
  readonly attackBonus?: number;
  /** The host-declared grid position (FR-11); absent in theater-of-mind packs. */
  readonly position?: Position;
  /** v1.5 — a move paused by open leaving-reach offers; absent = no paused move (DD-M10). */
  readonly pendingMove?: PendingMove;
}

/** A paused move (DD-M10/DD-M12): it resumes toward `to` with `remaining` budget once the offer queue empties. */
export interface PendingMove {
  readonly actionId: string;
  readonly to: Position;
  readonly remaining: number;
  readonly offeredDepartures?: readonly {
    readonly from: Position;
    readonly to: Position;
    readonly reactorId: string;
  }[];
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
  /** v1.5 — host-placed terrain cells for this fight (`[]` when none); never frozen in snapshots. */
  readonly terrain: readonly TerrainCell[];
}

export type CombatPhase = 'awaiting-declare' | 'resolved' | 'awaiting-trigger-response' | 'combat-over';

/** A declared-but-not-yet-resolved action (host may still be animating). */
export interface PendingAction {
  readonly actionId: string;
  readonly targetId: string | undefined;
}

/** An offered reactive action or feat awaiting `respond()` (FR-4/FR-13, triggers.html; feats v1.6, DD-S12). */
export interface PendingTrigger {
  readonly triggerId: string;
  readonly actorId: string;
  /** The offered id: a reactive action id, or a feat id when `source` is `'feat'`. */
  readonly actionId: string;
  /** v1.6 — what is offered: a reactive action, or a held reactive feat (DD-S12). */
  readonly source: 'action' | 'feat';
  /** The event that matched, as the offer's provenance. */
  readonly matchingEvent: string;
}

export interface DeclareOptions {
  /** Optional explicit target; a single-enemy action resolves to the only opponent otherwise. */
  readonly targetId?: string;
  /** v1.5 — a move action's destination (FR-11); ignored by theater-of-mind packs. */
  readonly to?: Position;
  /** v1.6 — a burst spell's area center; may be an empty cell (DD-S8). Spatial packs only; theater packs ignore it. */
  readonly at?: Position;
}

/** Why a declare was rejected — one ErrorCard-shaped object, play-time economy family. */
export type DeclareRejection =
  | CostRejection
  | {
      kind:
        | 'no-action'
        | 'not-your-turn'
        | 'no-target'
        | 'restricted'
        | 'invalid-target'
        | 'unknown-target'
        | 'armor-not-castable'
        | 'unknown-item'
        | 'not-consumable'
        | 'no-charges';
      rule: 'E-REF-01';
      resource: string;
      message: string;
    }
  | SpatialRejection
  | MoveRejection
  | {
      kind: 'out-of-range';
      rule: 'E-SPAT-01';
      resource: string;
      message: string;
    }
  | {
      kind: 'valid';
      rule: 'E-REF-01';
      resource: string;
      message: string;
    };

/** `fight.use` options (CA-EG5): the item's target, defaulting to the user itself. */
export interface UseOptions {
  readonly target?: string;
}

/** What one `step()` call advanced — the stepwise boundary (FR-10). */
export type StepOutcome =
  | { kind: 'turn-started'; combatantId: string; clock: EventClock }
  | { kind: 'awaiting-declare'; combatantId: string }
  | { kind: 'action-resolved'; combatantId: string; actionId: string }
  | { kind: 'turn-ended'; combatantId: string }
  | { kind: 'round-completed'; round: number }
  | { kind: 'combat-over' };

export interface StartCombatRequest {
  readonly allies: readonly {
    id: string;
    profile: CombatantProfile;
    balances?: EconomyBalances;
    conditions?: readonly { readonly conditionId: string; readonly duration: number }[];
  }[];
  readonly enemies: StartCombatRequest['allies'];
  /** Host-declared grid positions (FR-11); every combatant needs one when the pack declares a spatial model. */
  readonly positions?: Readonly<Record<string, Position>>;
  /** v1.5 — host-placed terrain cells; kinds come from the pack's `spatial.terrain` vocabulary. */
  readonly terrain?: readonly TerrainCell[];
  /** Initiative roll source; defaults to the injected rng. */
  readonly rng?: RandomSource;
}

/** A vancian slot a cast consumes: the spell level and the slot index (DD-S18). */
export interface CastSlot {
  readonly level: string;
  readonly index: number;
}
