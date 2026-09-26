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
 *   - inventory      ⇄ [] (required field; v1 engine state tracks no inventory)
 *   - skills / feats ⇄ absent (envelope optionals; v1 engine state has neither)
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
import { Rng } from '../core/rng';
import { RuntimeRuleError } from './errors';
import { buildCharacter, validateBuild } from './progression';
import { Character, reserveValue } from './character';
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

// ---------------------------------------------------------------- serialize

/** FR-14 — the character envelope: state only + pack identity. */
export function serializeCharacter(runtime: Runtime, state: CharacterState): CharacterSnapshot {
  return { kind: 'character', snapshotVersion: SNAPSHOT_VERSION, pack: packIdentity(runtime.pack), state: serializeCharacterState(state) };
}

/** FR-14 — the party envelope: members as character states under one pack identity. */
export function serializeParty(runtime: Runtime, members: readonly CharacterState[]): PartySnapshot {
  return { kind: 'party', snapshotVersion: SNAPSHOT_VERSION, pack: packIdentity(runtime.pack), members: members.map(serializeCharacterState) };
}

function packIdentity(pack: Pack): SnapshotPackIdentity {
  return { id: pack.manifest.id, schemaVersion: pack.manifest.schemaVersion, contentHash: packContentHash(pack) };
}

/** CharacterState → the envelope's characterState def (fresh plain-JSON copies throughout). */
function serializeCharacterState(state: CharacterState): SnapshotCharacterState {
  const slots: Record<string, (string | null)[]> = {};
  for (const [level, bindings] of Object.entries(state.slots)) slots[level] = [...bindings];
  return {
    name: state.name,
    race: state.race,
    classes: state.classes.map((entry) => ({ id: entry.id, level: entry.level, xp: state.classXp[entry.id] ?? 0 })),
    abilities: { ...state.abilities },
    knownSpells: [...state.spells],
    pools: { ...state.pools },
    slots,
    conditions: state.conditions.map((active) => ({ id: active.conditionId, remaining: active.duration })),
    inventory: [],
  };
}

// ---------------------------------------------------------------- load discipline

/**
 * The identity gate (CA-1, database.md load discipline): every refusal card at
 * once, before anything is applied. `kind` (E-SNAP-01 — the artifact is not
 * what the load request says), pack id / schemaVersion / contentHash
 * (E-SNAP-01), snapshotVersion (E-SNAP-02 — the documented staleness answer).
 */
function envelopeRefusals(kind: 'character' | 'party' | 'combat', snapshot: unknown, pack: Pack): ErrorCard[] {
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

function declaredIdentityId(snapshot: Record<string, unknown>): string | undefined {
  const identity = snapshot['pack'];
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
  const buildErrors = characterBuildRefusals(runtime, snapshot.state);
  if (buildErrors.length > 0) throw new RuntimeRuleError(buildErrors);
  return new Character(runtime, restoreCharacterState(runtime, snapshot.state));
}

/** FR-14 - rebuild every party member; ids mint sequentially from the target runtime. */
export function restoreParty(runtime: Runtime, snapshot: PartySnapshot): CharacterState[] {
  const cards = envelopeRefusals('party', snapshot, runtime.pack);
  if (cards.length > 0) throw new RuntimeRuleError(cards);
  // One refusing member refuses the party: every build validates before any
  // build is minted - ids mint for valid builds only (fail-closed, FR-5).
  for (const member of snapshot.members) {
    const buildErrors = characterBuildRefusals(runtime, member);
    if (buildErrors.length > 0) throw new RuntimeRuleError(buildErrors);
  }
  return snapshot.members.map((member) => restoreCharacterState(runtime, member));
}

/**
 * Restore is the third build path: the shared build validator runs here too -
 * a snapshot whose build no longer fits the pack is refused with the named
 * rules, never partially applied (FR-5 discipline).
 */
function characterBuildRefusals(runtime: Runtime, saved: SnapshotCharacterState): ErrorCard[] {
  return validateBuild(runtime, saved.race, saved.classes.map((entry) => ({ id: entry.id, level: entry.level })));
}

function restoreCharacterState(runtime: Runtime, saved: SnapshotCharacterState): CharacterState {
  const built = buildCharacter(runtime, { name: saved.name, race: saved.race, classes: saved.classes.map((entry) => ({ id: entry.id, level: entry.level })) });
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
    hp: { current: reserveValue(runtime, 'hp', abilities, built.level, new Rng(0)), temp: 0 },
  };
}

// ---------------------------------------------------------------- shared

function display(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}