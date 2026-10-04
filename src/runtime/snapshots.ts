/**
 * M03 — snapshot serializers (FR-14, CAP-7): three independent envelopes —
 * character, party, combat — as plain JSON the host stores anywhere. State
 * only: no timestamps, no captured environment, and no engine I/O of any kind
 * (no fs, no fetch, no localStorage — the engine computes, validates,
 * serializes; storage adapters are third-party territory).
 *
 * Every envelope carries pack identity, and load verifies it BEFORE applying
 * anything (CA-1): id + schemaVersion + contentHash must all match (E-SNAP-01)
 * and snapshotVersion must be 1 (E-SNAP-02) — loud refusal, all cards at once,
 * no state mutated, never partial, never mangled. No v1 migration: a version
 * bump renders old snapshots stale, and the API says so plainly (FR-23).
 *
 * Envelope shapes are the DB contract verbatim —
 * src/schema/contracts/snapshots.schema.json (`additionalProperties: false`):
 *   - classes[].xp   ⇄ CharacterState.classXp (the FR-6 per-class XP split)
 *   - knownSpells    ⇄ CharacterState.spells (the stored known list; play-time
 *                      gating derives known spells from pack + classes)
 *   - conditions[]   ⇄ { id: conditionId, remaining: duration }
 *   - slots          ⇄ the bindings record verbatim (string level → (null|spell id)[])
 *   - pools          ⇄ the drain-pool balances verbatim (FR-8)
 *   - inventory      ⇄ state.inventory (CA-01)
 *   - equipped       ⇄ state.equipped, presence-preserving (v1.4, CA-EG6):
 *                      emitted only when the state carries it; restore
 *                      validates every entry before applying anything
 *   - feats          ⇄ state.feats, presence-preserving (v1.6, DD-S11): emitted
 *                      only when the state carries it; restore refuses an
 *                      unknown feat id before applying anything
 *   - skills         ⇄ absent (envelope optional; v1 engine state has none)
 *   - saves / hp / level / xp / id ⇄ NOT envelope fields: reconstructed from
 *     pack + classes through the engine's own progression invariants (best-of
 *     saves, the reserved hp formula at the derived level, Σ levels, Σ classXp,
 *     the target runtime's monotonic id serial — no ambient state).
 *
 * The character/party serializers are pure over their state: the snapshot is a
 * detached plain-JSON copy, and restore builds a fresh state — mutating either
 * side never aliases the other (FR-5/FR-14 plain-JSON discipline).
 */
import { packContentHash } from '../schema/version';
import { makeErrorCard, type ErrorCard } from '../schema/error-card';
import type { Pack } from '../schema/pack';
import { Rng, type RngState } from '../core/rng';
import { RuntimeRuleError } from './errors';
import { buildCharacter, validateBuild } from './progression';
import { Character, reserveValue } from './character';
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
} from './combat/combat';
import type { CombatantProfile } from './combat/resolve';
import type { Position, TerrainCell } from './combat/spatial';
import type { EconomyBalances } from './combat/action-economy';
import type { Runtime, CharacterState } from './runtime';

/** snapshots.schema.json $defs/packIdentity — exactly {id, schemaVersion, contentHash}. */
export interface SnapshotPackIdentity {
  readonly id: string;
  readonly schemaVersion: number;
  readonly contentHash: string;
}

/** snapshots.schema.json $defs/characterState/properties/classes/items. */
export interface SnapshotClassEntry {
  readonly id: string;
  readonly level: number;
  /** Per-class XP (FR-6 split) — CharacterState.classXp[id]. */
  readonly xp?: number;
}

/** snapshots.schema.json $defs/characterState/properties/conditions/items. */
export interface SnapshotActiveCondition {
  readonly id: string;
  readonly remaining: number;
}

/** snapshots.schema.json $defs/characterState/properties/inventory/items. */
export interface SnapshotInventoryEntry {
  readonly id: string;
  readonly qty: number;
}

/** snapshots.schema.json $defs/characterState/properties/equipped/items (v1.4). */
export interface SnapshotEquippedEntry {
  readonly slot: string;
  readonly itemId: string;
}

/** snapshots.schema.json $defs/characterState — exactly these fields, no others. */
export interface SnapshotCharacterState {
  readonly name: string;
  readonly race: string;
  readonly classes: readonly SnapshotClassEntry[];
  readonly abilities: Readonly<Record<string, number>>;
  readonly skills?: Readonly<Record<string, number>>;
  readonly feats?: readonly string[];
  readonly knownSpells?: readonly string[];
  readonly pools: Readonly<Record<string, number>>;
  readonly slots: Readonly<Record<string, readonly (string | null)[]>>;
  readonly conditions: readonly SnapshotActiveCondition[];
  readonly inventory: readonly SnapshotInventoryEntry[];
  /** v1.4 — occupied equip slots; absent when the character never equipped (CA-EG6). */
  readonly equipped?: readonly SnapshotEquippedEntry[];
}

/** The character envelope — kind/snapshotVersion/pack/state, nothing else. */
export interface CharacterSnapshot {
  readonly kind: 'character';
  readonly snapshotVersion: 1;
  readonly pack: SnapshotPackIdentity;
  readonly state: SnapshotCharacterState;
}

/** The party envelope — membership as character states; characters serialize separately. */
export interface PartySnapshot {
  readonly kind: 'party';
  readonly snapshotVersion: 1;
  readonly pack: SnapshotPackIdentity;
  readonly members: readonly SnapshotCharacterState[];
}

/** The one snapshot format version (D3); any other value refuses with E-SNAP-02. */
const SNAPSHOT_VERSION = 1;
/** uint32 word ceiling (exclusive) for the rng-state gate. */
const UINT32_MAX_WORD = 4294967296;

// ---------------------------------------------------------------- serialize

/** FR-14 — the character envelope: state only + pack identity. */
export function serializeCharacter(runtime: Runtime, state: CharacterState): CharacterSnapshot {
  return {
    kind: 'character',
    snapshotVersion: SNAPSHOT_VERSION,
    pack: packIdentity(runtime.pack),
    state: serializeCharacterState(state),
  };
}

/** FR-14 — the party envelope: members as character states under one pack identity. */
export function serializeParty(runtime: Runtime, members: readonly CharacterState[]): PartySnapshot {
  return {
    kind: 'party',
    snapshotVersion: SNAPSHOT_VERSION,
    pack: packIdentity(runtime.pack),
    members: members.map(serializeCharacterState),
  };
}

function packIdentity(pack: Pack): SnapshotPackIdentity {
  return {
    id: pack.manifest.id,
    schemaVersion: pack.manifest.schemaVersion,
    contentHash: packContentHash(pack),
  };
}

/** CharacterState → the envelope's characterState def (fresh plain-JSON copies throughout). */
function serializeCharacterState(state: CharacterState): SnapshotCharacterState {
  const slots: Record<string, (string | null)[]> = {};
  for (const [level, bindings] of Object.entries(state.slots)) slots[level] = [...bindings];
  return {
    name: state.name,
    race: state.race,
    classes: state.classes.map((entry) => ({
      id: entry.id,
      level: entry.level,
      xp: state.classXp[entry.id] ?? 0,
    })),
    abilities: { ...state.abilities },
    knownSpells: [...state.spells],
    pools: { ...state.pools },
    slots,
    conditions: state.conditions.map((active) => ({ id: active.conditionId, remaining: active.duration })),
    inventory: state.inventory.map((entry) => ({ id: entry.id, qty: entry.qty })),
    ...(state.equipped !== undefined
      ? { equipped: state.equipped.map((entry) => ({ slot: entry.slot, itemId: entry.itemId })) }
      : {}),
    ...(state.feats !== undefined ? { feats: [...state.feats] } : {}),
  };
}

// ---------------------------------------------------------------- load discipline

/**
 * The identity gate (CA-1, database.md load discipline): every refusal card at
 * once, before anything is applied. `kind` (E-SNAP-01 — the artifact is not
 * what the load request says), pack id / schemaVersion / contentHash
 * (E-SNAP-01), snapshotVersion (E-SNAP-02 — the documented staleness answer).
 */
function envelopeRefusals(
  kind: 'character' | 'party' | 'combat',
  snapshot: unknown,
  pack: Pack,
): ErrorCard[] {
  if (!isRecord(snapshot)) {
    return [makeErrorCard('E-SNAP-01', '(snapshot)', '(root)', 'a snapshot must be a JSON object.')];
  }
  const cards: ErrorCard[] = [];
  const artifactId = declaredIdentityId(snapshot) ?? '(snapshot)';
  if (snapshot['kind'] !== kind) {
    cards.push(
      makeErrorCard(
        'E-SNAP-01',
        artifactId,
        'kind',
        `expected a "${kind}" snapshot, got ${display(snapshot['kind'])} — refusing rather than loading it into the wrong surface (FR-14).`,
      ),
    );
  }
  const identity = snapshot['pack'];
  if (!isRecord(identity)) {
    cards.push(
      makeErrorCard(
        'E-SNAP-01',
        artifactId,
        'pack',
        'snapshot.pack is missing or unreadable — every snapshot carries pack identity {id, schemaVersion, contentHash} (FR-14).',
      ),
    );
  } else {
    if (identity['id'] !== pack.manifest.id) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          'pack.id',
          `pack id ${display(identity['id'])} does not match the loaded pack "${pack.manifest.id}" — refusing rather than producing mangled characters (FR-14).`,
          `this pack's identity: id "${pack.manifest.id}", schemaVersion ${pack.manifest.schemaVersion}, contentHash ${packContentHash(pack)}.`,
        ),
      );
    }
    if (identity['schemaVersion'] !== pack.manifest.schemaVersion) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          'pack.schemaVersion',
          `snapshot's pack schemaVersion ${display(identity['schemaVersion'])} does not match the loaded pack's ${pack.manifest.schemaVersion} (FR-14/FR-23).`,
        ),
      );
    }
    const expectedHash = packContentHash(pack);
    if (identity['contentHash'] !== expectedHash) {
      cards.push(
        makeErrorCard(
          'E-SNAP-01',
          artifactId,
          'pack.contentHash',
          `pack content hash ${display(identity['contentHash'])} does not match ${expectedHash} — refusing rather than producing mangled characters (FR-14).`,
          'no v1 migration: re-save against the current pack (FR-23).',
        ),
      );
    }
  }
  if (snapshot['snapshotVersion'] !== SNAPSHOT_VERSION) {
    cards.push(
      makeErrorCard(
        'E-SNAP-02',
        artifactId,
        'snapshotVersion',
        `snapshotVersion ${display(snapshot['snapshotVersion'])} is not loadable — this engine reads snapshotVersion 1 only; a schema or content version bump renders old snapshots stale, and the API says so plainly (FR-23).`,
      ),
    );
  }
  return cards;
}

function declaredIdentityId(snapshot: unknown): string | undefined {
  const identity = isRecord(snapshot) ? snapshot['pack'] : undefined;
  return isRecord(identity) && typeof identity['id'] === 'string' ? identity['id'] : undefined;
}

// ---------------------------------------------------------------- restore

/**
 * Rebuild a character from its envelope on the target runtime. The envelope
 * carries state only: the target runtime mints the id from its monotonic
 * serial, and the pack + classes reconstruct the engine-canonical pieces the
 * envelope omits (saves best-of, hp from the reserved formula, Σ levels, Σ
 * classXp) - the same values `applyProgression` produces for the same build.
 * A snapshot whose classes no longer fit the pack is refused with the build
 * validator's named rules (fail-closed, FR-5).
 */
export function restoreCharacter(runtime: Runtime, snapshot: CharacterSnapshot): Character {
  const cards = envelopeRefusals('character', snapshot, runtime.pack);
  if (cards.length > 0) throw new RuntimeRuleError(cards);
  const stateErrors = characterStateRefusals(runtime, snapshot.state, 'state');
  if (stateErrors.length > 0) throw new RuntimeRuleError(stateErrors);
  return new Character(runtime, restoreCharacterState(runtime, snapshot.state));
}

/** FR-14 - rebuild every party member; ids mint sequentially from the target runtime. */
export function restoreParty(runtime: Runtime, snapshot: PartySnapshot): CharacterState[] {
  const cards = envelopeRefusals('party', snapshot, runtime.pack);
  if (cards.length > 0) throw new RuntimeRuleError(cards);
  // One refusing member refuses the party: every build validates before any
  // build is minted - ids mint for valid builds only (fail-closed, FR-5).
  snapshot.members.forEach((member, index) => {
    const stateErrors = characterStateRefusals(runtime, member, `members[${index}]`);
    if (stateErrors.length > 0) throw new RuntimeRuleError(stateErrors);
  });
  return snapshot.members.map((member) => restoreCharacterState(runtime, member));
}

/**
 * Restore is the third build path: the shared build validator runs here too -
 * a snapshot whose build no longer fits the pack is refused with the named
 * rules, never partially applied (FR-5 discipline).
 */
function characterStateRefusals(runtime: Runtime, saved: SnapshotCharacterState, path: string): ErrorCard[] {
  return [
    ...validateBuild(
      runtime,
      saved.race,
      saved.classes.map((entry) => ({ id: entry.id, level: entry.level })),
      saved.feats ?? [],
    ),
    ...equippedRefusals(runtime, saved, path),
    ...featRefusals(runtime, saved, path),
  ];
}

/** DD-S11 — every restored feat id names a feat the pack declares (E-SNAP-01, all cards before anything is applied). */
function featRefusals(runtime: Runtime, saved: SnapshotCharacterState, path: string): ErrorCard[] {
  return (saved.feats ?? []).flatMap((featId, index) =>
    runtime.pack.content.feats?.[featId] !== undefined
      ? []
      : [
          makeErrorCard(
            'E-SNAP-01',
            runtime.pack.manifest.id,
            `${path}.feats[${index}]`,
            `feat ${display(featId)} is not declared in content.feats — refusing the snapshot (DD-S11).`,
          ),
        ],
  );
}

/**
 * CA-EG6 — the `equipped` restore gate (E-SNAP-01, all cards before anything
 * is applied): every entry names a declared item and a declared slot the item
 * admits, each slot appears once (the schema cannot say so, R-9a), and the
 * restored inventory holds a unit for every entry. Absent `equipped` = nothing.
 */
function equippedRefusals(runtime: Runtime, saved: SnapshotCharacterState, path: string): ErrorCard[] {
  const equipped: unknown = saved.equipped;
  if (equipped === undefined) return [];
  const refuse = (jsonPath: string, message: string) =>
    makeErrorCard(
      'E-SNAP-01',
      runtime.pack.manifest.id,
      jsonPath,
      `${message} — refusing the snapshot (CA-EG6).`,
    );
  if (!Array.isArray(equipped))
    return [refuse(`${path}.equipped`, 'equipped must be an array of {slot, itemId}')];
  const cards: ErrorCard[] = [];
  const packSlots = runtime.pack.equipSlots ?? [];
  const slotsSeen = new Set<string>();
  const unitsWorn = new Map<string, number>();
  equipped.forEach((entry: unknown, index) => {
    const at = `${path}.equipped[${index}]`;
    if (!isRecord(entry) || typeof entry['slot'] !== 'string' || typeof entry['itemId'] !== 'string') {
      cards.push(refuse(at, 'an equipped entry must be {slot, itemId} strings'));
      return;
    }
    const slot = entry['slot'];
    const itemId = entry['itemId'];
    const item = runtime.pack.content.items?.[itemId];
    if (item === undefined)
      cards.push(refuse(`${at}.itemId`, `item "${itemId}" is not declared in content.items`));
    if (!packSlots.includes(slot))
      cards.push(refuse(`${at}.slot`, `slot "${slot}" is not declared in equipSlots`));
    else if (item !== undefined && !(item.slots ?? []).includes(slot)) {
      cards.push(refuse(`${at}.slot`, `item "${itemId}" cannot be equipped in "${slot}"`));
    }
    if (slotsSeen.has(slot)) cards.push(refuse(`${at}.slot`, `slot "${slot}" is equipped twice`));
    slotsSeen.add(slot);
    const worn = (unitsWorn.get(itemId) ?? 0) + 1;
    unitsWorn.set(itemId, worn);
    const held = saved.inventory.find((stack) => stack.id === itemId)?.qty ?? 0;
    if (held < worn) {
      cards.push(refuse(at, `"${itemId}" is equipped ${worn} time(s) but the inventory holds x${held}`));
    }
  });
  return cards;
}

function restoreCharacterState(runtime: Runtime, saved: SnapshotCharacterState): CharacterState {
  const built = buildCharacter(runtime, {
    name: saved.name,
    race: saved.race,
    classes: saved.classes.map((entry) => ({ id: entry.id, level: entry.level })),
  });
  runtime.nextCharacterId += 1;
  const classXp: Record<string, number> = {};
  let xp = 0;
  for (const entry of saved.classes) {
    const amount = entry.xp ?? 0;
    classXp[entry.id] = amount;
    xp += amount;
  }
  const abilities: Record<string, number> = { ...saved.abilities };
  const slots: Record<string, (string | null)[]> = {};
  for (const [level, bindings] of Object.entries(saved.slots)) slots[level] = [...bindings];
  return {
    id: built.id,
    name: saved.name,
    race: saved.race,
    level: built.level,
    xp,
    classes: built.classes,
    classXp,
    abilities,
    saves: built.saves,
    pools: { ...saved.pools },
    slots,
    conditions: saved.conditions.map((active) => ({ conditionId: active.id, duration: active.remaining })),
    spells: [...(saved.knownSpells ?? [])],
    inventory: saved.inventory.map((entry) => ({ ...entry })),
    ...(saved.equipped !== undefined
      ? { equipped: saved.equipped.map((entry) => ({ slot: entry.slot, itemId: entry.itemId })) }
      : {}),
    ...(saved.feats !== undefined ? { feats: [...saved.feats] } : {}),
    hp: { current: reserveValue(runtime, 'hp', abilities, built.level, new Rng(0)), temp: 0 },
  };
}

// ---------------------------------------------------------------- combat

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

// ---------------------------------------------------------------- shared

function display(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
