import { packContentHash } from '../../schema/version';
import { makeErrorCard, type ErrorCard } from '../../schema/error-card';
import type { Pack } from '../../schema/pack';

/** snapshots.schema.json $defs/packIdentity — exactly {id, schemaVersion, contentHash}. */
export interface SnapshotPackIdentity {
  readonly id: string;
  readonly schemaVersion: number;
  readonly contentHash: string;
}

/** The one snapshot format version (D3); any other value refuses with E-SNAP-02. */
export const SNAPSHOT_VERSION = 1;

export function packIdentity(pack: Pack): SnapshotPackIdentity {
  return {
    id: pack.manifest.id,
    schemaVersion: pack.manifest.schemaVersion,
    contentHash: packContentHash(pack),
  };
}

// ---------------------------------------------------------------- load discipline

/**
 * The identity gate (CA-1, database.md load discipline): every refusal card at
 * once, before anything is applied. `kind` (E-SNAP-01 — the artifact is not
 * what the load request says), pack id / schemaVersion / contentHash
 * (E-SNAP-01), snapshotVersion (E-SNAP-02 — the documented staleness answer).
 */
export function envelopeRefusals(
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

export function declaredIdentityId(snapshot: unknown): string | undefined {
  const identity = isRecord(snapshot) ? snapshot['pack'] : undefined;
  return isRecord(identity) && typeof identity['id'] === 'string' ? identity['id'] : undefined;
}

// ---------------------------------------------------------------- shared

export function display(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
