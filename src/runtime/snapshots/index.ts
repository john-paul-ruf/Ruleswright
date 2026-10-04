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
 */
export {
  serializeCharacter,
  serializeParty,
  restoreCharacter,
  restoreParty,
  type SnapshotClassEntry,
  type SnapshotActiveCondition,
  type SnapshotInventoryEntry,
  type SnapshotEquippedEntry,
  type SnapshotCharacterState,
  type CharacterSnapshot,
  type PartySnapshot,
} from './character';
export {
  serializeCombat,
  deserializeCombat,
  type SnapshotCombatant,
  type SnapshotOffer,
  type CombatSnapshot,
  type CombatRestoreRequest,
} from './combat';
export type { SnapshotPackIdentity } from './envelope';
