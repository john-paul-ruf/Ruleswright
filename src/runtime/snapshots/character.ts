/**
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
import { makeErrorCard, type ErrorCard } from '../../schema/error-card';
import { Rng } from '../../core/rng';
import { RuntimeRuleError } from '../errors';
import { buildCharacter, validateBuild } from '../progression';
import { Character, reserveValue } from '../character';
import type { Runtime, CharacterState } from '../runtime';
import {
  SNAPSHOT_VERSION,
  display,
  envelopeRefusals,
  isRecord,
  packIdentity,
  type SnapshotPackIdentity,
} from './envelope';

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
